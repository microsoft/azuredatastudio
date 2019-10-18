/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, OsType, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

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
				return path.join(await this.getPip3InstallLocation('azdata-cli'), '..', 'Scripts');
		}
	}

	readonly allInstallationCommands: Map<OsType, Command[]> = new Map<OsType, Command[]>([
		[OsType.linux, linuxInstallationCommands],
		[OsType.win32, defaultInstallationCommands],
		[OsType.darwin, defaultInstallationCommands],
		[OsType.others, defaultInstallationCommands]
	]);

	protected get uninstallCommand(): string | undefined {
		if (this.osType !== OsType.linux) {
			return defaultUninstallCommand;
		} else {
			return super.uninstallCommand;
		}
	}
}

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

const defaultInstallationCommands = [
	{
		comment: localize('resourceDeployment.Azdata.InstallingAzdata', "installing azdata ..."),
		command: `pip3 install -r https://aka.ms/azdata --quiet --user --log ADS_AzdataPip3InstallLog_${Date.now()}`
	}
];

const defaultUninstallCommand = `pip3 uninstall -r https://aka.ms/azdata -y `;
