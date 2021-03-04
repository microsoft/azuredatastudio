/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdataExt from 'azdata-ext';
import { EOL } from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { Command, OsDistribution, ToolStatus, ToolType } from '../../interfaces';
import * as loc from '../../localizedConstants';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();
export const AzdataToolName = 'azdata';
const win32InstallationRoot = `${process.env['ProgramFiles(x86)']}\\Microsoft SDKs\\Azdata\\CLI\\wbin`;
const macInstallationRoot = '/usr/local/bin';
const debianInstallationRoot = '/usr/local/bin';

export class AzdataTool extends ToolBase {
	private azdataApi!: azdataExt.IExtension;
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
		return localize('resourceDeployment.AzdataDisplayName', "Azure Data CLI");
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/sql/big-data-cluster/deploy-install-azdata';
	}

	public isEulaAccepted(): boolean {
		if (!this.azdataApi) {
			return false;
		}
		if (this.azdataApi.isEulaAccepted()) {
			return true;
		} else {
			this.setStatusDescription(loc.azdataEulaNotAccepted);
			return false;
		}
	}

	public async promptForEula(): Promise<boolean> {
		const eulaAccepted = await this.azdataApi.promptForEula();
		if (!eulaAccepted) {
			this.setStatusDescription(loc.azdataEulaDeclined);
		}
		return eulaAccepted;
	}

	/* unused */
	protected get versionCommand(): Command {
		return {
			command: ''
		};
	}

	/* unused */
	protected get discoveryCommand(): Command {
		return {
			command: ''
		};
	}

	/**
	 * updates the version and status for the tool.
	 */
	protected async updateVersionAndStatus(): Promise<void> {
		this.azdataApi = await vscode.extensions.getExtension(azdataExt.extension.name)?.activate();
		if (!this.azdataApi) {
			this.setInstallationPathOrAdditionalInformation(localize('deploy.azdataExtMissing', "The Azure Data CLI extension must be installed to deploy this resource. Please install it through the extension gallery and try again."));
			this.setStatus(ToolStatus.NotInstalled);
			return;
		}
		this.setStatusDescription('');
		await this.addInstallationSearchPathsToSystemPath();

		const commandOutput = await this.azdataApi.azdata.version();
		this.version = await this.azdataApi.azdata.getSemVersion();
		if (this.version) {
			if (this.autoInstallSupported) {
				// set the installationPath
				this.setInstallationPathOrAdditionalInformation(await this.azdataApi.azdata.getPath());
			}
			this.setStatus(ToolStatus.Installed);
		}
		else {
			this.setInstallationPathOrAdditionalInformation(localize('deployCluster.GetToolVersionErrorInformation', "Error retrieving version information. See output channel '{0}' for more details", this.outputChannelName));
			this.setStatusDescription(localize('deployCluster.GetToolVersionError', "Error retrieving version information.{0}Invalid output received, get version command output: '{1}' ", EOL, commandOutput.stderr.join(EOL)));
			this.setStatus(ToolStatus.NotInstalled);
		}
	}

	protected getVersionFromOutput(output: string): SemVer | Promise<SemVer> | undefined {
		return this.azdataApi.azdata.getSemVersion();

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
		return new Map<OsDistribution, Command[]>();
	}
}
