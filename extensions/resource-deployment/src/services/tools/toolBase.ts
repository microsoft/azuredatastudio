/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command, ToolType, ITool, OsType } from '../../interfaces';
import { SemVer } from 'semver';
import { IPlatformService } from '../platformService';
import * as nls from 'vscode-nls';
import { EOL } from 'os';
import { delimiter } from 'path';
const localize = nls.loadMessageBundle();

export abstract class ToolBase implements ITool {
	constructor(private _platformService: IPlatformService) { }

	abstract name: string;
	abstract displayName: string;
	abstract description: string;
	abstract type: ToolType;
	abstract homePage: string;
	abstract autoInstallSupported: boolean;
	abstract installationCommands: Command[];
	protected abstract getVersionFromOutput(output: string): SemVer | undefined;
	protected abstract readonly versionCommand: Command;

	protected async getInstallationPath(): Promise<string | null> {
		return await Promise.resolve(null);
	}

	protected get installationSearchPaths(): (string | null)[] {
		return [this.storagePath];
	}

	protected get downloadPath(): string {
		return this.storagePath;
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

	public get isInstalled(): boolean {
		return this._isInstalled;
	}

	public get statusDescription(): string | undefined {
		return this._statusDescription;
	}

	protected async getPip3InstallLocation(packageName: string): Promise<string> {
		const command = `pip3 show ${packageName}`;
		const pip3ShowOutput: string = (await this._platformService.runCommand(command));
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

	protected logToOutputChannel(data: string | Buffer, header?: string): void {
		this._platformService.logToOutputChannel(data, header);
	}

	public async install(): Promise<void> {
		await this.installCore();
		await this.postInstall();
	}

	protected async installCore() {
		const installationCommands: Command[] = this.installationCommands;
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

	protected async postInstall() {
		await this.loadInformation();
	}

	protected async addInstallationSearchPathsToSystemPath(): Promise<void> {
		const installationPath = await this.getInstallationPath();
		const searchPaths = [installationPath, ...this.installationSearchPaths];
		console.log(`installationSearchPaths for tool:${this.displayName}: ${JSON.stringify(searchPaths, undefined, '\t')}`);
		searchPaths.forEach(installationSearchPath => {
			if (installationSearchPath) {
				if (process.env.PATH) {
					if (!`${delimiter}${process.env.PATH}${delimiter}`.includes(`${delimiter}${installationSearchPath}${delimiter}`)) {
						process.env.PATH += `${delimiter}${installationSearchPath}`;
						console.log(`Appending to Path -> ${delimiter}${installationSearchPath}`);
					}
				} else {
					process.env.PATH = installationSearchPath;
					console.log(`Appending to Path -> '${delimiter}${installationSearchPath}':${delimiter}${installationSearchPath}`);
				}
			}
		});
	}
	public async loadInformation(): Promise<void> {
		if (this._isInstalled) {
			return Promise.resolve();
		}
		this._isInstalled = false;
		this._statusDescription = undefined;
		this._version = undefined;
		this._versionOutput = undefined;
		this._osType = this._platformService.osType();
		await this.addInstallationSearchPathsToSystemPath();
		try {
			const stdout = await this._platformService.runCommand(this.versionCommand.command,
				{
					workingDirectory: this.versionCommand.workingDirectory,
					additionalEnvironmentVariables: this.versionCommand.additionalEnvironmentVariables
				});
			this._versionOutput = stdout;
			this._version = this.getVersionFromOutput(stdout);
			if (this._version) {
				this._isInstalled = true;
			} else {
				throw localize('deployCluster.InvalidToolVersionOutput', "Invalid output received.");
			}
		} catch (error) {

			const errorMessage = this._platformService.getErrorMessage(error);
			this._statusDescription = localize('deployCluster.GetToolVersionError', "Error retrieving version information.{0}Error: {1}{0}stdout: {2} ", EOL, errorMessage, this._versionOutput);
		}

	}

	private _isInstalled: boolean = false;
	private _osType: OsType = OsType.others;
	private _version?: SemVer;
	private _statusDescription?: string;
	private _versionOutput?: string;
}
