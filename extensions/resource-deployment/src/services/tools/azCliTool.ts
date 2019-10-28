/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, OsType, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { ToolBase, dependencyType } from './toolBase';

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
		return localize('resourceDeployment.AzCLIDescription', "A command-line tool for managing Azure resources");
	}

	get type(): ToolType {
		return ToolType.AzCli;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzCLIDisplayName', "Azure CLI");
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/cli/azure/install-azure-cli';
	}

	get autoInstallSupported(): boolean {
		return true;
	}

	protected async getSearchPaths(): Promise<string[]> {
		switch (this.osType) {
			case OsType.win32:
				return [win32InstallationRoot];
			default:
				return [defaultInstallationRoot];
		}
	}

	protected readonly allInstallationCommands: Map<OsType, Command[]> = new Map<OsType, Command[]>([
		[OsType.linux, linuxInstallationCommands],
		[OsType.win32, win32InstallationCommands],
		[OsType.darwin, macOsInstallationCommands],
		[OsType.others, defaultInstallationCommands]
	]);

	protected getVersionFromOutput(output: string): SemVer | undefined {
		if (output && output.includes('azure-cli')) {
			return new SemVer(output.split(EOL)[0].replace('azure-cli', '').replace(/ /g, '').replace('*', '')); //lgtm [js/incomplete-sanitization]
		} else {
			return undefined;
		}
	}

	protected get versionCommand(): Command {
		return {
			command: 'az --version'
		};
	}

	protected dependenciesByOsType: Map<OsType, dependencyType[]> = new Map<OsType, dependencyType[]>([
		[OsType.linux, []],
		[OsType.win32, []],
		[OsType.darwin, [dependencyType.Brew]],
		[OsType.others, [dependencyType.Curl]]
	]);

	protected get discoveryCommand(): Command {
		return {
			command: this.discoveryCommandString('az')
		};
	}
}

const win32InstallationCommands = [
	{
		comment: localize('resourceDeployment.AziCli.DeletingPreviousAzureCli.msi', "deleting previously downloaded azurecli.msi if one exists …"),
		command: `IF EXIST .\\AzureCLI.msi DEL /F .\\AzureCLI.msi`
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.DownloadingAndInstallingAzureCli', "downloading azurecli.msi and installing azure-cli …"),
		command: `powershell -Command "& {(New-Object System.Net.WebClient).DownloadFile('https://aka.ms/installazurecliwindows', 'AzureCLI.msi'); Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /passive /quiet /lvx ADS_AzureCliInstall.log'}"`
	},
	{
		comment: localize('resourceDeployment.AziCli.DisplayingInstallationLog', "displaying the installation log …"),
		command: `type AzureCliInstall.log | findstr /i /v /c:"cached product context" | findstr /i /v /c:"has no eligible binary patches" `,
		ignoreError: true
	}
];
const macOsInstallationCommands = [
	// try to install brew ourselves
	{
		comment: localize('resourceDeployment.AziCli.UpdatingBrewRepository', "updating your brew repository for azure-cli installation …"),
		command: 'brew update'
	},
	{
		comment: localize('resourceDeployment.AziCli.InstallingAzureCli', "installing azure-cli …"),
		command: 'brew install azure-cli'
	}
];
const linuxInstallationCommands = [
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.AptGetUpdate', "updating repository information before installing azure-cli …"),
		command: 'apt-get update'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.AptGetPackages', "getting packages needed for azure-cli installation …"),
		command: 'apt-get install ca-certificates curl apt-transport-https lsb-release gnupg -y'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.DownloadAndInstallingSigningKey', "downloading and installing the signing key for azure-cli …"),
		command: 'curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/microsoft.asc.gpg > /dev/null'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.AddingAzureCliRepositoryInformation', "adding the azure-cli repository information …"),
		command: 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ `lsb_release -cs` main" | tee /etc/apt/sources.list.d/azure-cli.list'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.AptGetUpdateAgain', "updating repository information again for azure-cli …"),
		command: 'apt-get update'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.InstallingAzureCli', "installing azure-cli …"),
		command: 'apt-get install azure-cli'
	}
];
const defaultInstallationCommands = [
	{
		sudo: true,
		comment: localize('resourceDeployment.AziCli.ScriptedInstall', "download and invoking script to install azure-cli …"),
		command: 'curl -sL https://aka.ms/InstallAzureCLIDeb | bash'
	}
];
