/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, OsType, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';
import { DeploymentConfigurationKey, AzdataPipInstallUriKey, azdataPipInstallArgsKey } from '../../constants';

const localize = nls.loadMessageBundle();
const installationRoot = '~/.local/bin';

export class AzdataTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return 'azdata';
	}

	get description(): string {
		return localize('resourceDeployment.AzdataDescription', "A command-line utility written in Python that enables cluster administrators to bootstrap and manage the Big Data Cluster via REST APIs");
	}

	get type(): ToolType {
		return ToolType.Azdata;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzdataDisplayName', "azdata");
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/sql/big-data-cluster/deploy-install-azdata';
	}

	protected get versionCommand(): Command {
		return {
			command: 'azdata -v'
		};
	}

	protected getVersionFromOutput(output: string): SemVer | undefined {
		let version: SemVer | undefined = undefined;
		if (output && output.split(EOL).length > 0) {
			version = new SemVer(output.split(EOL)[0].replace(/ /g, ''));
		}
		return version;
	}

	get autoInstallSupported(): boolean {
		return true;
	}

	protected async getInstallationPath(): Promise<string | undefined> {
		switch (this.osType) {
			case OsType.linux:
				return installationRoot;
			default:
				const azdataCliInstallLocation = await this.getPip3InstallLocation('azdata-cli');
				return azdataCliInstallLocation && path.join(azdataCliInstallLocation, '..', 'Scripts');
		}
	}

	protected get allInstallationCommands(): Map<OsType, Command[]> {
		return new Map<OsType, Command[]>([
			[OsType.linux, this.defaultInstallationCommands],
			[OsType.win32, this.defaultInstallationCommands],
			[OsType.darwin, this.defaultInstallationCommands],
			[OsType.others, this.defaultInstallationCommands]
		]);
	}

	protected get uninstallCommand(): string | undefined {
		if (this.osType !== OsType.linux) {
			return this.defaultUninstallCommand;
		} else {
			return super.uninstallCommand;
		}
	}

	private get defaultInstallationCommands(): Command[] {
		return [
			{
				comment: localize('resourceDeployment.Azdata.InstallUpdatePythonRequestsPackage', "installing/updating to latest version of requests python package azdata ..."),
				command: `pip3 install -U requests`
			},
			{
				comment: localize('resourceDeployment.Azdata.InstallingAzdata', "installing azdata ..."),
				command: `pip3 install -r ${this.azdataInstallUri} ${this.azdataInstallAdditionalArgs} --quiet --user`
			}
		];
	}

	private get defaultUninstallCommand(): string {
		return `pip3 uninstall -r ${this.azdataInstallUri} ${this.azdataInstallAdditionalArgs} -y `;
	}

	private get azdataInstallUri(): string {
		return vscode.workspace.getConfiguration(DeploymentConfigurationKey)[AzdataPipInstallUriKey];
	}

	private get azdataInstallAdditionalArgs(): string {
		return vscode.workspace.getConfiguration(DeploymentConfigurationKey)[azdataPipInstallArgsKey];
	}
}

/*
const linuxInstallationCommands = [
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AptGetUpdate', "updating repository information ..."),
		command: 'apt-get update'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AptGetPackages', "getting packages needed for azdata installation ..."),
		command: 'apt-get install gnupg ca-certificates curl apt-transport-https lsb-release -y'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.DownloadAndInstallingSigningKey', "downloading and installing the signing key for azdata ..."),
		command: 'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | apt-key add -'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AddingAzureCliRepositoryInformation', "adding the azdata repository information ..."),
		command: 'add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/16.04/mssql-server-preview.list)"'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AptGetUpdate', "updating repository information ..."),
		command: 'apt-get update'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.InstallingAzdata', "installing azdata ..."),
		command: 'apt-get install -y azdata-cli'
	}
];
*/
