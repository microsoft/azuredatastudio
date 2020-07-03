/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { AzdataInstallLocationKey, DeploymentConfigurationKey } from '../../constants';
import { Command, OsDistribution, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { dependencyType, ToolBase } from './toolBase';
import { SemVerProxy } from './SemVerProxy';

const localize = nls.loadMessageBundle();
export const AzdataToolName = 'azdata';
const win32InstallationRoot = `${process.env['ProgramFiles(x86)']}\\Microsoft SDKs\\Azdata\\CLI\\wbin`;
const macInstallationRoot = '/usr/local/bin';
const debianInstallationRoot = '/usr/local/bin';

export class AzdataTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return AzdataToolName;
	}

	get description(): string {
		return localize('resourceDeployment.AzdataDescription', "Azure Data command line interface");
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
			version = new SemVerProxy(output.split(EOL)[0].replace(/ /g, ''));
		}
		return version;
	}
	protected async getSearchPaths(): Promise<string[]> {
		switch (this.osDistribution) {
			case OsDistribution.win32:
				return [win32InstallationRoot];
			case OsDistribution.darwin:
				return [macInstallationRoot];
			case OsDistribution.debian:
				return [debianInstallationRoot];
			default:
				const azdataCliInstallLocation = await this.getPip3InstallLocation('azdata-cli');
				if (azdataCliInstallLocation) {
					return [path.join(azdataCliInstallLocation, '..', 'Scripts'), path.join(azdataCliInstallLocation, '..', '..', '..', 'bin')];
				} else {
					return [];
				}
		}
	}

	protected get allInstallationCommands(): Map<OsDistribution, Command[]> {
		return new Map<OsDistribution, Command[]>([
			[OsDistribution.debian, this.debianInstallationCommands],
			[OsDistribution.win32, this.win32InstallationCommands],
			[OsDistribution.darwin, this.macOsInstallationCommands],
			[OsDistribution.others, []]
		]);
	}


	private get azdataInstallLocation(): string {
		return vscode.workspace.getConfiguration(DeploymentConfigurationKey)[AzdataInstallLocationKey] || this.defaultInstallLocationByDistribution.get(this.osDistribution);
	}

	private defaultInstallLocationByDistribution: Map<OsDistribution, string> = new Map<OsDistribution, string>([
		[OsDistribution.debian, 'https://packages.microsoft.com/config/ubuntu/16.04/mssql-server-2019.list'],
		[OsDistribution.win32, 'https://aka.ms/azdata-msi'],
		[OsDistribution.darwin, 'microsoft/azdata-cli-release'],
		[OsDistribution.others, '']
	]);

	protected dependenciesByOsType: Map<OsDistribution, dependencyType[]> = new Map<OsDistribution, dependencyType[]>([
		[OsDistribution.debian, []],
		[OsDistribution.win32, []],
		[OsDistribution.darwin, [dependencyType.Brew]],
		[OsDistribution.others, []]
	]);

	private get win32InstallationCommands() {
		return [
			{
				comment: localize('resourceDeployment.Azdata.DeletingPreviousAzdata.msi', "deleting previously downloaded Azdata.msi if one exists …"),
				command: `IF EXIST .\\Azdata.msi DEL /F .\\Azdata.msi`
			},
			{
				sudo: true,
				comment: localize('resourceDeployment.Azdata.DownloadingAndInstallingAzdata', "downloading Azdata.msi and installing azdata-cli …"),
				command: `powershell -NoLogo -NonInteractive -NoProfile -Command "& {try {(New-Object System.Net.WebClient).DownloadFile('${this.azdataInstallLocation}', 'Azdata.msi'); Start-Process msiexec.exe -Wait -ArgumentList '/I Azdata.msi /passive /quiet /lvx ADS_AzdataInstall.log'} catch { Write-Error $_.Exception; exit 1 }}"`
			},
			{
				comment: localize('resourceDeployment.Azdata.DisplayingInstallationLog', "displaying the installation log …"),
				command: `type ADS_AzdataInstall.log | findstr /i /v ^MSI"`,
				ignoreError: true
			}
		];
	}

	private get macOsInstallationCommands() {
		return [
			{
				comment: localize('resourceDeployment.Azdata.TappingBrewRepository', "tapping into the brew repository for azdata-cli …"),
				command: `brew tap ${this.azdataInstallLocation}`
			},
			{
				comment: localize('resourceDeployment.Azdata.UpdatingBrewRepository', "updating the brew repository for azdata-cli installation …"),
				command: 'brew update'
			},
			{
				comment: localize('resourceDeployment.Azdata.InstallingAzdata', "installing azdata …"),
				command: 'brew install azdata-cli'
			}
		];
	}

	private get debianInstallationCommands() {
		return [
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
				comment: localize('resourceDeployment.Azdata.AddingAzdataRepositoryInformation', "adding the azdata repository information …"),
				command: `add-apt-repository "$(wget -qO- ${this.azdataInstallLocation})"`
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
	}
}
