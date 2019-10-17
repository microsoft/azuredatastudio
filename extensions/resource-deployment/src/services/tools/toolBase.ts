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
import { IPlatformService } from '../platformService';

const localize = nls.loadMessageBundle();

export abstract class ToolBase implements ITool {
	constructor(private _platformService: IPlatformService) { }

	abstract name: string;
	abstract displayName: string;
	abstract description: string;
	abstract type: ToolType;
	abstract homePage: string;
	abstract autoInstallSupported: boolean;
	abstract readonly allInstallationCommands: Map<OsType, Command[]>;

	protected abstract getVersionFromOutput(output: string): SemVer | undefined;
	protected readonly _onDidUpdateData = new vscode.EventEmitter<ITool>();


	protected abstract readonly versionCommand: Command;

	protected async getInstallationPath(): Promise<string | undefined> {
		return await Promise.resolve(undefined);
	}

	protected get installationSearchPaths(): (string | undefined)[] {
		return [this.storagePath];
	}

	protected get downloadPath(): string {
		return this.storagePath;
	}

	protected logToOutputChannel(data: string | Buffer, header?: string): void {
		this._platformService.logToOutputChannel(data, header);
	}

	public get onDidUpdateData(): vscode.Event<ITool> {
		return this._onDidUpdateData.event;
	}

	public get status(): ToolStatus {
		return this._status;
	}

	public get storagePath(): string {
		return this._platformService.storagePath();
	}

	public get osType(): OsType {
		return this._osType;
	}

	public get version(): SemVer | undefined {
		return this._version;
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

	public getErrorMessage(error: any): string {
		return this._platformService.getErrorMessage(error);
	}

	protected async getPip3InstallLocation(packageName: string): Promise<string> {
		const command = `pip3 show ${packageName}`;
		const pip3ShowOutput: string = await this._platformService.runCommand(command, /* options */ undefined, /*sudo?*/ false, /*commandString*/ undefined, /*ignoreError*/ true);
		const installLocation = /^Location\: (.*)$/gim.exec(pip3ShowOutput);
		let retValue = installLocation && installLocation[1];
		if (retValue === undefined || retValue === null) {
			this.logToOutputChannel(`   >${command}`);
			this.logToOutputChannel(`   Could not find 'Location' in the output:`);
			this.logToOutputChannel(pip3ShowOutput, `   output:`);
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
			this._status = ToolStatus.Installing;
			this._onDidUpdateData.fire(this);
			this._onDidUpdateData.fire(this);
			await this.installCore();
			await this.checkAndUpdateVersion();
			this._onDidUpdateData.fire(this);
		} catch (error) {
			const errorMessage = this._platformService.getErrorMessage(error);
			this._statusDescription = localize('deployCluster.InstallError', "Error installing tool '{0}'.{1}Error: {2}{1}See output channel '{3}' for more details", this.displayName, EOL, errorMessage, this.outputChannelName);
			this._status = ToolStatus.Error;
			this._onDidUpdateData.fire(this);
			throw error;
		}
	}

	protected async installCore() {
		const installationCommands: Command[] | undefined = this.installationCommands;
		if (!installationCommands || installationCommands.length === 0) {
			throw new Error(`Cannot install tool:${this.displayName}::${this.description} as installation commands are unknown`);
		}
		for (let i: number = 0; i < installationCommands.length; i++) {
			await this._platformService.runCommand(installationCommands[i].command,
				{
					workingDirectory: installationCommands[i].workingDirectory || this.downloadPath,
					additionalEnvironmentVariables: installationCommands[i].additionalEnvironmentVariables
				},
				installationCommands[i].sudo,
				installationCommands[i].comment,
				installationCommands[i].ignoreError
			);
		}
	}

	protected async addInstallationSearchPathsToSystemPath(): Promise<void> {
		const installationPath = await this.getInstallationPath();
		const searchPaths = [installationPath, ...this.installationSearchPaths].filter(path => !!path);
		this.logToOutputChannel(`Search Paths for tool '${this.displayName}': ${JSON.stringify(searchPaths, undefined, '\t')}`);
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
		if (this.status === ToolStatus.Installed) {
			return Promise.resolve();
		}
		if (this.status === ToolStatus.NotInstalled) {
			this._statusDescription = undefined;
			this._version = undefined;
			this._versionOutput = undefined;
			this._osType = this._platformService.osType();
			await this.addInstallationSearchPathsToSystemPath();
			await this.checkAndUpdateVersion();
		}
	}

	private _status: ToolStatus = ToolStatus.NotInstalled;
	private _osType: OsType = OsType.others;
	private _version?: SemVer;
	private _statusDescription?: string;
	private _versionOutput?: string;

	private async checkAndUpdateVersion(): Promise<void> {
		const commandOutput = await this._platformService.runCommand(this.versionCommand.command, {
			workingDirectory: this.versionCommand.workingDirectory,
			additionalEnvironmentVariables: this.versionCommand.additionalEnvironmentVariables
		}, false, // sudo?
			undefined, // commandTitle
			true);
		this._versionOutput = commandOutput;
		this._version = this.getVersionFromOutput(commandOutput);
		if (this._version) {
			this._status = ToolStatus.Installed;
		}
		else {
			this._status = ToolStatus.NotInstalled;
			this._statusDescription = localize('deployCluster.GetToolVersionError', "Error retrieving version information.{0}Invalid output received, get version command output: {2} ", EOL, this._versionOutput);
		}
	}
}
