/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import * as path from 'path';
import { SemVer, compare as SemVerCompare } from 'semver';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { Command, ITool, OsDistribution, ToolStatus, ToolType } from '../../interfaces';
import { getErrorMessage } from '../../utils';
import { IPlatformService } from '../platformService';

const localize = nls.loadMessageBundle();
const toolStatusNotInstalled: string = localize('deploymentDialog.ToolStatus.NotInstalled', "Not Installed");
const toolStatusInstalled: string = localize('deploymentDialog.ToolStatus.Installed', "Installed");
const toolStatusInstalling: string = localize('deploymentDialog.ToolStatus.Installing', "Installing…");
const toolStatusError: string = localize('deploymentDialog.ToolStatus.Error', "Error");
const toolStatusFailed: string = localize('deploymentDialog.ToolStatus.Failed', "Failed");

const toolStatusLocalized: Map<ToolStatus, string> = new Map<ToolStatus, string>([
	[ToolStatus.Error, toolStatusError],
	[ToolStatus.Installed, toolStatusInstalled],
	[ToolStatus.Installing, toolStatusInstalling],
	[ToolStatus.NotInstalled, toolStatusNotInstalled],
	[ToolStatus.Failed, toolStatusFailed]
]);

export const enum dependencyType {
	Brew = 'Brew',
	Curl = 'Curl'
}

const brewLocalized = localize('deploymentDialog.ToolInformationalMessage.Brew', "•	brew is needed for deployment of the tools and needs to be pre-installed before necessary tools can be deployed");
const curlLocalized = localize('deploymentDialog.ToolInformationalMessage.Curl', "•	curl is needed for installation and needs to be pre-installed before necessary tools can be deployed");

export const messageByDependencyType: Map<dependencyType, string> = new Map<dependencyType, string>([
	[dependencyType.Brew, brewLocalized],
	[dependencyType.Curl, curlLocalized]
]);

export abstract class ToolBase implements ITool {
	constructor(private _platformService: IPlatformService) {
		this.startVersionAndStatusUpdate();
	}

	abstract name: string;
	abstract displayName: string;
	abstract description: string;
	abstract type: ToolType;
	abstract homePage: string;
	protected abstract readonly allInstallationCommands: Map<OsDistribution, Command[]>;
	protected readonly dependenciesByOsType: Map<OsDistribution, dependencyType[]> = new Map<OsDistribution, dependencyType[]>();

	protected abstract getVersionFromOutput(output: string): SemVer | undefined;
	protected readonly _onDidUpdateData = new vscode.EventEmitter<ITool>();
	protected readonly uninstallCommand?: string;

	protected abstract readonly versionCommand: Command;

	public get dependencyMessages(): string[] {
		return (this.dependenciesByOsType.get(this.osDistribution) || []).map((msgType: dependencyType) => messageByDependencyType.get(msgType)!);
	}

	protected async getInstallationPath(): Promise<string | undefined> {
		return undefined;
	}

	protected abstract readonly discoveryCommand: Command;

	protected async getSearchPaths(): Promise<string[]> {
		return [];
	}

	protected get downloadPath(): string {
		return this.storagePath;
	}

	protected logToOutputChannel(data: string | Buffer, header?: string): void {
		this._platformService.logToOutputChannel(data, header); // data and header are localized by caller
	}

	public get onDidUpdateData(): vscode.Event<ITool> {
		return this._onDidUpdateData.event;
	}

	public get status(): ToolStatus {
		return this._status;
	}

	protected setStatus(value: ToolStatus) {
		this._status = value;
		this._onDidUpdateData.fire(this);
	}

	public get displayStatus(): string {
		return <string>toolStatusLocalized.get(this._status);
	}

	public get autoInstallNeeded(): boolean {
		return this.status === ToolStatus.NotInstalled && this.autoInstallSupported;
	}
	public get storagePath(): string {
		return this._platformService.storagePath();
	}

	public get osDistribution(): OsDistribution {
		return this._platformService.osDistribution();
	}

	protected get version(): SemVer | undefined {
		return this._version;
	}

	protected set version(value: SemVer | undefined) {
		this._version = value;
		this._onDidUpdateData.fire(this);
	}

	public get fullVersion(): string | undefined {
		return this._version && this._version.version;

	}

	public get statusDescription(): string | undefined {
		return this._statusDescription;
	}

	public get installationPathOrAdditionalInformation(): string | undefined {
		return this._installationPathOrAdditionalInformation;
	}

	protected get installationCommands(): Command[] | undefined {
		return this.allInstallationCommands.get(this.osDistribution);
	}

	protected async getPip3InstallLocation(packageName: string): Promise<string> {
		const command = `pip3 show ${packageName}`;
		const pip3ShowOutput: string = await this._platformService.runCommand(command, { sudo: false, ignoreError: true });
		const installLocation = /^Location\: (.*)$/gim.exec(pip3ShowOutput);
		let retValue = installLocation && installLocation[1];
		if (retValue === undefined || retValue === null) {
			this.logToOutputChannel(`   >${command}`); //command is localized by caller
			this.logToOutputChannel(localize('toolBase.getPip3InstallationLocation.LocationNotFound', "   Could not find 'Location' in the output:"));
			this.logToOutputChannel(pip3ShowOutput, localize('toolBase.getPip3InstallationLocation.Output', "   output:"));
			return '';
		} else {
			return retValue;
		}
	}

	public get outputChannelName(): string {
		return this._platformService.outputChannelName();
	}

	public showOutputChannel(preserveFocus?: boolean | undefined): void {
		this._platformService.showOutputChannel(preserveFocus);
	}


	get autoInstallSupported(): boolean {
		return !!this.installationCommands && !!this.installationCommands.length;
	}

	public async install(): Promise<void> {
		this._statusDescription = '';
		try {
			this.setStatus(ToolStatus.Installing);
			await this.installCore();
			this.startVersionAndStatusUpdate();
			await this._pendingVersionAndStatusUpdate;
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			this._statusDescription = localize('toolBase.InstallError', "Error installing tool '{0}' [ {1} ].{2}Error: {3}{2}See output channel '{4}' for more details", this.displayName, this.homePage, EOL, errorMessage, this.outputChannelName);
			this.setStatus(ToolStatus.Error);
			this._installationPathOrAdditionalInformation = localize('toolBase.InstallErrorInformation', "Error installing tool. See output channel '{0}' for more details", this.outputChannelName);
			throw error;
		}

		// Since we just completed installation, the status should be ToolStatus.Installed
		// but if it is ToolStatus.NotInstalled then it means that installation failed with 0 exit code.
		if ((this.status as ToolStatus) === ToolStatus.NotInstalled) {
			this._statusDescription = localize('toolBase.InstallFailed', "Installation commands completed but version of tool '{0}' could not be detected so our installation attempt has failed. Detection Error: {1}{2}Cleaning up previous installations would help.", this.displayName, this._statusDescription, EOL);
			this._installationPathOrAdditionalInformation = localize('toolBase.InstallFailInformation', "Failed to detect version post installation. See output channel '{0}' for more details", this.outputChannelName);
			if (this.uninstallCommand) {
				this._statusDescription += localize('toolBase.ManualUninstallCommand', " A possibly way to uninstall is using this command:{0}   >{1}", EOL, this.uninstallCommand);
			}
			this._statusDescription += localize('toolBase.SeeOutputChannel', "{0}See output channel '{1}' for more details", EOL, this.outputChannelName);
			this.setStatus(ToolStatus.Failed);
			throw new Error(this._statusDescription);
		}
	}

	protected async installCore() {
		const installationCommands: Command[] | undefined = this.installationCommands;
		if (!installationCommands || installationCommands.length === 0) {
			throw new Error(localize('toolBase.installCore.CannotInstallTool', "Cannot install tool:{0}::{1} as installation commands are unknown for your OS distribution, Please install {0} manually before proceeding", this.displayName, this.description));
		}
		for (let i: number = 0; i < installationCommands.length; i++) {
			await this._platformService.runCommand(installationCommands[i].command,
				{
					workingDirectory: installationCommands[i].workingDirectory || this.downloadPath,
					additionalEnvironmentVariables: installationCommands[i].additionalEnvironmentVariables,
					sudo: installationCommands[i].sudo,
					commandTitle: installationCommands[i].comment,
					ignoreError: installationCommands[i].ignoreError
				},
			);
		}
	}

	protected async addInstallationSearchPathsToSystemPath(): Promise<void> {
		const searchPaths = [...(new Set<string>([...await this.getSearchPaths(), this.storagePath].filter(path => !!path))).values()]; // collect all unique installation search paths
		this.logToOutputChannel(localize('toolBase.addInstallationSearchPathsToSystemPath.SearchPaths', "Search Paths for tool '{0}': {1}", this.displayName, JSON.stringify(searchPaths, undefined, '\t'))); //this.displayName is localized and searchPaths are OS filesystem paths.
		searchPaths.forEach(searchPath => {
			if (process.env.PATH) {
				if (!`${path.delimiter}${process.env.PATH}${path.delimiter}`.includes(`${path.delimiter}${searchPath}${path.delimiter}`)) {
					process.env.PATH += `${path.delimiter}${searchPath}`;
				}
			} else {
				process.env.PATH = searchPath;
			}
		});
	}

	/**
	 * Sets the tool with discovered state and version information.
	 * Upon error this.status field is set to ToolStatus.Error and this.statusDescription && this.installationPathOrAdditionalInformation is set to the corresponding error message
	 * and original error encountered is re-thrown so that it gets bubbled up to the caller.
	 */
	public async finishInitialization(): Promise<void> {
		try {
			await this._pendingVersionAndStatusUpdate;
		} catch (error) {
			this.setStatus(ToolStatus.Error);
			this._statusDescription = getErrorMessage(error);
			this._installationPathOrAdditionalInformation = this._statusDescription;
			throw error;
		}
	}

	/**
	 * 	Invokes the async method to update version and status for the tool.
	 */
	private startVersionAndStatusUpdate(): void {
		this._statusDescription = '';
		this._pendingVersionAndStatusUpdate = this.updateVersionAndStatus();
	}

	/**
	 * updates the version and status for the tool.
	 */
	private async updateVersionAndStatus(): Promise<void> {
		this._statusDescription = '';
		await this.addInstallationSearchPathsToSystemPath();
		const commandOutput = await this._platformService.runCommand(
			this.versionCommand.command,
			{
				workingDirectory: this.versionCommand.workingDirectory,
				additionalEnvironmentVariables: this.versionCommand.additionalEnvironmentVariables,
				sudo: false,
				ignoreError: true
			},
		);
		this.version = this.getVersionFromOutput(commandOutput);
		if (this.version) {
			if (this.autoInstallSupported) {
				// discover and set the installationPath
				await this.setInstallationPath();
			}
			this.setStatus(ToolStatus.Installed);
		}
		else {
			this._installationPathOrAdditionalInformation = localize('deployCluster.GetToolVersionErrorInformation', "Error retrieving version information. See output channel '{0}' for more details", this.outputChannelName);
			this._statusDescription = localize('deployCluster.GetToolVersionError', "Error retrieving version information.{0}Invalid output received, get version command output: '{1}' ", EOL, commandOutput);
			this.setStatus(ToolStatus.NotInstalled);
		}
	}

	protected discoveryCommandString(toolBinary: string) {
		switch (this.osDistribution) {
			case OsDistribution.win32:
				return `where.exe  ${toolBinary}`;
			case OsDistribution.darwin:
				return `command -v ${toolBinary}`;
			default:
				return `which ${toolBinary}`;
		}
	}

	protected async setInstallationPath() {
		const commandOutput = await this._platformService.runCommand(
			this.discoveryCommand.command,
			{
				workingDirectory: this.discoveryCommand.workingDirectory,
				additionalEnvironmentVariables: this.discoveryCommand.additionalEnvironmentVariables,
				sudo: false,
				ignoreError: false
			},
		);
		if (!commandOutput) {
			throw new Error(`Install location of tool:'${this.displayName}' could not be discovered`);
		} else {
			this._installationPathOrAdditionalInformation = path.resolve(commandOutput.split(EOL)[0]);
		}
	}

	isSameOrNewerThan(version?: string): boolean {
		return !version || (this._version ? SemVerCompare(this._version, version) >= 0 : false);
	}

	private _pendingVersionAndStatusUpdate!: Promise<void>;
	private _status: ToolStatus = ToolStatus.NotInstalled;
	private _version?: SemVer;
	private _statusDescription?: string;
	private _installationPathOrAdditionalInformation?: string;
}
