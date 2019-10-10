/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, OsType, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();
const defaultInstallationRoot = '~/.local/bin';
const win32InstallationRoot = `${process.env['ProgramFiles(x86)']}\\Microsoft SDKs\\Azure\\CLI2\\wbin`;

export class AzCliTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return 'azure-cli';
	}

	get description(): string {
		return localize('resourceDeployment.AzCLIDescription', 'A command-line tool for managing Azure resources');
	}

	get type(): ToolType {
		return ToolType.AzCli;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzCLIDisplayName', 'Azure CLI');
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/cli/azure/install-azure-cli';
	}

	get autoInstallSupported(): boolean {
		return true;
	}

	protected get installationPath(): Promise<string | null> {
		return new Promise<string | null>((resolve, _reject) => {
			switch (this.osType) {
				case OsType.linux:
					resolve(defaultInstallationRoot);
				default:
					resolve(win32InstallationRoot);
					console.log(`TCL: AzCliTool -> win32InstallationRoot:${win32InstallationRoot}`);
			}
		});
	}
	get installationCommands(): Command[] {
		switch (this.osType) {
			case OsType.darwin: return [
				{
					comment: `updating your brew repository ...`,
					command: 'brew update'
				},
				{
					comment: `installing ${this.name} ...`,
					command: 'brew install azure-cli'
				}
			];
			case OsType.win32: return [
				{
					comment: 'deleting previously downloaded azurecli.msi if one exists ...',
					command: `IF EXIST .\\AzureCLI.msi DEL /F .\\AzureCLI.msi`
				},
				{
					sudo: true,
					comment: `downloading azurecli.msi and installing ${this.name} ...`,
					command: `powershell -Command "& {(New-Object System.Net.WebClient).DownloadFile('https://aka.ms/installazurecliwindows', 'AzureCLI.msi'); Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /passive /quiet /lx AzureCliInstall.log'}"`
				},
				{
					comment: `displaying the installation log ...`,
					command: `type AzureCliInstall.log`
				}
			];
			case OsType.linux: return [
				{
					sudo: true,
					comment: 'updating repository information ...',
					command: 'apt-get update'
				},
				{
					sudo: true,
					comment: 'getting packages needed for installation ...',
					command: 'apt-get install ca-certificates curl apt-transport-https lsb-release gnupg'
				},
				{
					sudo: true,
					comment: 'downloading and installing the signing key ...',
					command: 'curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/microsoft.asc.gpg > /dev/null'
				},
				{
					sudo: true,
					comment: `adding the ${this.name} repository information ...`,
					command: 'AZ_REPO=$(lsb_release -cs) && echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" | tee /etc/apt/sources.list.d/azure-cli.list'
				},
				{
					sudo: true,
					comment: 'updating repository information ...',
					command: 'apt-get update'
				},
				{
					sudo: true,
					comment: `installing ${this.name} ...`,
					command: 'apt-get install azure-cli'
				}
			];
			// all other linux distributions
			default: return [
				{
					sudo: true,
					comment: `download and invoking script to install ${this.name} ...`,
					command: 'curl -sL https://aka.ms/InstallAzureCLIDeb | bash'
				}

			];
		}
	}

	protected getVersionFromOutput(output: string): SemVer | undefined {
		if (output && output.includes('azure-cli')) {
			return new SemVer(output.split(EOL)[0].replace('azure-cli', '').replace(/ /g, '').replace('*', ''));
		} else {
			return undefined;
		}
	}
	protected get versionCommand(): Command {
		return {
			command: 'az --version'
		};
	}
}
