/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import { delimiter } from 'path';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { Command, ITool, OsType, ToolStatus, ToolType } from '../../interfaces';
import { getErrorMessage } from '../../utils';
import { IPlatformService } from '../platformService';

const localize = nls.loadMessageBundle();
const toolStatusNotInstalled: string = localize('deploymentDialog.ToolStatus.NotInstalled', "Not Installed");
const toolStatusInstalled: string = localize('deploymentDialog.ToolStatus.Installed', "Installed");
const toolStatusInstalling: string = localize('deploymentDialog.ToolStatus.NotInstalling', "Installing ...");
const toolStatusError: string = localize('deploymentDialog.ToolStatus.Error', "Error");
const toolStatusFailed: string = localize('deploymentDialog.ToolStatus.Failed', "Failed");

const toolStatusLocalized: Map<ToolStatus, string> = new Map<ToolStatus, string>([
	[ToolStatus.Error, toolStatusError],
	[ToolStatus.Installed, toolStatusInstalled],
	[ToolStatus.Installing, toolStatusInstalling],
	[ToolStatus.NotInstalled, toolStatusNotInstalled],
	[ToolStatus.Failed, toolStatusFailed]
]);

export abstract class ToolBase implements ITool {
	constructor(private _platformService: IPlatformService) {
		this._osType = this._platformService.osType();
	}

	abstract name: string;
	abstract displayName: string;
	abstract description: string;
	abstract type: ToolType;
	abstract homePage: string;
	abstract autoInstallSupported: boolean;
	abstract readonly allInstallationCommands: Map<OsType, Command[]>;

	protected abstract getVersionFromOutput(output: string): SemVer | undefined;
	protected readonly _onDidUpdateData = new vscode.EventEmitter<ITool>();
	protected readonly uninstallCommand?: string;


	protected abstract readonly versionCommand: Command;

	protected async getInstallationPath(): Promise<string | undefined> {
		return undefined;
	}

	protected get installationSearchPaths(): (string | undefined)[] {
		return [this.storagePath];
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

	protected get status(): ToolStatus {
		return this._status;
	}

	protected set status(value: ToolStatus) {
		this._status = value;
		this._onDidUpdateData.fire(this);
	}

	public get displayStatus(): string {
		return <string>toolStatusLocalized.get(this._status);
	}

	public get autoInstallRequired(): boolean {
		return this.status !== ToolStatus.Installed && this.autoInstallSupported;
	}

	public get isNotInstalled(): boolean {
		return this.status === ToolStatus.NotInstalled;
	}

	public get isInstalling(): boolean {
		return this.status === ToolStatus.Installing;
	}

	public get needsInstallation(): boolean {
		return this.status !== ToolStatus.Installed;
	}

	public get storagePath(): string {
		const storagePath = this._platformService.storagePath();
		if (!this._storagePathEnsured) {
			this._platformService.ensureDirectoryExists(storagePath);
			this._storagePathEnsured = true;
		}
		return storagePath;
	}

	public get osType(): OsType {
		return this._osType;
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

	protected get installationCommands(): Command[] | undefined {
		return this.allInstallationCommands.get(this.osType);
	}

	protected async getPip3InstallLocation(packageName: string): Promise<string> {
		const command = `pip3 show ${packageName}`;
		const pip3ShowOutput: string = await this._platformService.runCommand(command, { sudo: false, ignoreError: true });
		const installLocation = /^Location\: (.*)$/gim.exec(pip3ShowOutput);
		let retValue = installLocation && installLocation[1];
		if (retValue === undefined || retValue === null) {
			this.logToOutputChannel(`   >${command}`); //command is localized by caller
			this.logToOutputChannel(`   ${localize('toolBase.getPip3InstallationLocation.LocationNotFound', "Could not find 'Location' in the output:")}`);
			this.logToOutputChannel(pip3ShowOutput, `   ${localize('toolBase.getPip3InstallationLocation.Output', "output:")}`);
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

	public async install(): Promise<void> {
		try {
			this.status = ToolStatus.Installing;
			await this.installCore();
			await this.addInstallationSearchPathsToSystemPath();
			this.status = await this.updateVersionAndGetStatus();
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			this._statusDescription = localize('toolBase.InstallError', "Error installing tool '{0}' [ {1} ].{2}Error: {3}{2}See output channel '{4}' for more details", this.homePage, this.displayName, EOL, errorMessage, this.outputChannelName);
			this.status = ToolStatus.Error;
			throw error;
		}
		// Since we just completed installation, the status should be ToolStatus.Installed
		// but if it is ToolStatus.NotInstalled then it means that installation failed with 0 exit code.
		if (this.status === ToolStatus.NotInstalled) {
			this._statusDescription = localize('toolBase.InstallFailed', "Installation commands completed but version of tool '{0}' could not be detected so our installation attempt has failed. Detection Error: {1}{2}Cleaning up previous installations would help.", this.displayName, this._statusDescription, EOL);
			if (this.uninstallCommand) {
				this._statusDescription += localize('toolBase.ManualUninstallCommand', " You can try this command:{1}   >{0}", this.uninstallCommand, EOL);
			}
			this._statusDescription += localize('toolBase.SeeOutputChannel', "{0}See output channel '{1}' for more details", EOL, this.outputChannelName);
			this.status = ToolStatus.Failed;
			throw new Error(this._statusDescription);
		}
	}

	protected async installCore() {
		const installationCommands: Command[] | undefined = this.installationCommands;
		if (!installationCommands || installationCommands.length === 0) {
			throw new Error(localize('toolBase.installCore.CannotInstallTool', "Cannot install tool:${0}::${1} as installation commands are unknown", this.displayName, this.description));
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
		const installationPath = await this.getInstallationPath();
		const searchPaths = [installationPath, ...this.installationSearchPaths].filter(path => !!path);
		this.logToOutputChannel(`${localize('toolBase.addInstallationSearchPathsToSystemPath.SearchPaths', "Search Paths for tool")} '${this.displayName}': ${JSON.stringify(searchPaths, undefined, '\t')}`); //this.displayName is localized and searchPaths are OS filesystem paths.
		searchPaths.forEach(installationSearchPath => {
			if (process.env.PATH) {
				if (!`${delimiter}${process.env.PATH}${delimiter}`.includes(`${delimiter}${installationSearchPath}${delimiter}`)) {
					process.env.PATH += `${delimiter}${installationSearchPath}`;
					console.log(`Appending to Path -> ${delimiter}${installationSearchPath}`);
				}
			} else {
				process.env.PATH = installationSearchPath;
				console.log(`Appending to Path -> '${delimiter}${installationSearchPath}':${delimiter}${installationSearchPath}`);
			}
		});
	}
	public async loadInformation(): Promise<void> {
		if (this.status === ToolStatus.NotInstalled) {
			await this.addInstallationSearchPathsToSystemPath();
			this.status = await this.updateVersionAndGetStatus();
		}
	}
	private async updateVersionAndGetStatus(): Promise<ToolStatus> {
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
			return ToolStatus.Installed;
		}
		else {
			this._statusDescription = localize('deployCluster.GetToolVersionError', "Error retrieving version information.{0}Invalid output received, get version command output: '{1}' ", EOL, commandOutput);
			return ToolStatus.NotInstalled;
		}
	}

	private _storagePathEnsured: boolean = false;
	private _status: ToolStatus = ToolStatus.NotInstalled;
	private _osType: OsType;
	private _version?: SemVer;
	private _statusDescription?: string;

}
