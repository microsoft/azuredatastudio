/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, OsDistribution, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { dependencyType, ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();
const defaultInstallationRoot = '/usr/local/bin';
const win32InstallationRoot = `${process.env['ProgramFiles(x86)']}\\Microsoft SDKs\\Azure\\CLI2\\wbin`;
export const AzCliToolName = 'azure-cli';

export class AzCliTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return AzCliToolName;
	}

	get description(): string {
		return localize('resourceDeployment.AzCLIDescription', "Manages Azure resources");
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

	protected async getSearchPaths(): Promise<string[]> {
		switch (this.osDistribution) {
			case OsDistribution.win32:
				return [win32InstallationRoot];
			default:
				return [defaultInstallationRoot];
		}
	}

	protected readonly allInstallationCommands: Map<OsDistribution, Command[]> = new Map<OsDistribution, Command[]>([
		[OsDistribution.debian, debianInstallationCommands],
		[OsDistribution.win32, win32InstallationCommands],
		[OsDistribution.darwin, macOsInstallationCommands],
		[OsDistribution.others, defaultInstallationCommands]
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

	protected dependenciesByOsType: Map<OsDistribution, dependencyType[]> = new Map<OsDistribution, dependencyType[]>([
		[OsDistribution.debian, []],
		[OsDistribution.win32, []],
		[OsDistribution.darwin, [dependencyType.Brew]],
		[OsDistribution.others, [dependencyType.Curl]]
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
		command: `type ADS_AzureCliInstall.log | findstr /i /v "^MSI"`,
		ignoreError: true
	}
];
const macOsInstallationCommands = [
	{
		comment: localize('resourceDeployment.AziCli.UpdatingBrewRepository', "updating your brew repository for azure-cli installation …"),
		command: 'brew update'
	},
	{
		comment: localize('resourceDeployment.AziCli.InstallingAzureCli', "installing azure-cli …"),
		command: 'brew install azure-cli'
	}
];
const debianInstallationCommands = [
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
