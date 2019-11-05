/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { azdataPipInstallArgsKey, AzdataPipInstallUriKey, DeploymentConfigurationKey } from '../../constants';
import { Command, OsType, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { dependencyType, ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();

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

	protected get discoveryCommand(): Command {
		return {
			command: this.discoveryCommandString('azdata')
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

	protected async getSearchPaths(): Promise<string[]> {
		switch (this.osType) {
			default:
				const azdataCliInstallLocation = await this.getPip3InstallLocation('azdata-cli');
				if (azdataCliInstallLocation) {
					return [path.join(azdataCliInstallLocation, '..', 'Scripts'), path.join(azdataCliInstallLocation, '..', '..', '..', 'bin')];
				} else {
					return [];
				}
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
		return this.defaultUninstallCommand;
	}

	private get defaultInstallationCommands(): Command[] {
		return [
			{
				comment: localize('resourceDeployment.Azdata.InstallUpdatePythonRequestsPackage', "installing/updating to latest version of requests python package azdata …"),
				command: `pip3 install -U requests`
			},
			{
				comment: localize('resourceDeployment.Azdata.InstallingAzdata', "installing azdata …"),
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

	protected dependenciesByOsType: Map<OsType, dependencyType[]> = new Map<OsType, dependencyType[]>([
		[OsType.linux, [dependencyType.PythonAndPip3]],
		[OsType.win32, [dependencyType.PythonAndPip3]],
		[OsType.darwin, [dependencyType.PythonAndPip3]],
		[OsType.others, [dependencyType.PythonAndPip3]]
	]);
}

/*
const linuxInstallationCommands = [
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AptGetUpdate', "updating repository information …"),
		command: 'apt-get update'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AptGetPackages', "getting packages needed for azdata installation …"),
		command: 'apt-get install gnupg ca-certificates curl apt-transport-https lsb-release -y'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.DownloadAndInstallingSigningKey', "downloading and installing the signing key for azdata …"),
		command: 'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | apt-key add -'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AddingAzureCliRepositoryInformation', "adding the azdata repository information …"),
		command: 'add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/16.04/mssql-server-preview.list)"'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.AptGetUpdate', "updating repository information …"),
		command: 'apt-get update'
	},
	{
		sudo: true,
		comment: localize('resourceDeployment.Azdata.InstallingAzdata', "installing azdata …"),
		command: 'apt-get install -y azdata-cli'
	}
];
*/
