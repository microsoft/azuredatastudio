/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DoNotAskAgain, Install, DotnetInstallationConfirmation, NetCoreSupportedVersionInstallationConfirmation, UpdateDotnetLocation } from '../common/constants';
import * as utils from '../common/utils';
import { ShellCommandOptions, ShellExecutionHelper } from './shellExecutionHelper';
const localize = nls.loadMessageBundle();

export const DBProjectConfigurationKey: string = 'sqlDatabaseProjects';
export const NetCoreInstallLocationKey: string = 'netCoreSDKLocation';
export const DotnetInstallLocationKey: string = 'dotnetSDK Location';
export const NetCoreDoNotAskAgainKey: string = 'netCoreDoNotAsk';
export const NetCoreMacDefaultPath = '/usr/local/share';
export const NetCoreLinuxDefaultPath = '/usr/share';
export const winPlatform: string = 'win32';
export const macPlatform: string = 'darwin';
export const linuxPlatform: string = 'linux';
export const minSupportedNetCoreVersionForBuild: string = '8.0.0';

export const enum netCoreInstallState {
	netCoreNotPresent,
	netCoreVersionNotSupported,
	netCoreVersionSupported
}

const dotnet = os.platform() === 'win32' ? 'dotnet.exe' : 'dotnet';

export class NetCoreTool extends ShellExecutionHelper {

	private osPlatform: string = os.platform();
	private netCoreSdkInstalledVersion: string | undefined;
	private netCoreInstallState: netCoreInstallState = netCoreInstallState.netCoreVersionSupported;

	/**
	 * This method presents the installation dialog for .NET Core, if not already present/supported
	 * @param skipVersionSupportedCheck If true then skip the check to determine whether the .NET version is supported (for commands that work on all versions)
	 * @returns True if .NET version was found and is supported
	 * 			False if .NET version isn't present or present but not supported
	 */
	public async findOrInstallNetCore(skipVersionSupportedCheck = false): Promise<boolean> {
		if (!this.isNetCoreInstallationPresent || (this.isNetCoreInstallationPresent && !skipVersionSupportedCheck)) {
			if ((!this.isNetCoreInstallationPresent || !await this.isNetCoreVersionSupportedForBuild())) {
				if (vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreDoNotAskAgainKey] !== true) {
					void this.showInstallDialog();		// Removing await so that Build and extension load process doesn't wait on user input
				}
				return false;
			}
		}

		this.netCoreInstallState = netCoreInstallState.netCoreVersionSupported;
		return true;
	}

	constructor(_outputChannel: vscode.OutputChannel) {
		super(_outputChannel);
	}

	public async showInstallDialog(): Promise<void> {
		let result;
		if (this.netCoreInstallState === netCoreInstallState.netCoreNotPresent) {
			result = await vscode.window.showErrorMessage(DotnetInstallationConfirmation, UpdateDotnetLocation, Install, DoNotAskAgain);
		} else {
			result = await vscode.window.showErrorMessage(NetCoreSupportedVersionInstallationConfirmation(this.netCoreSdkInstalledVersion!), UpdateDotnetLocation, Install, DoNotAskAgain);
		}

		if (result === UpdateDotnetLocation) {
			//open settings
			await vscode.commands.executeCommand('workbench.action.openGlobalSettings');
		} else if (result === Install) {
			//open install link
			const dotnetSdkUrl = 'https://aka.ms/sqlprojects-dotnet';
			await vscode.env.openExternal(vscode.Uri.parse(dotnetSdkUrl));
		} else if (result === DoNotAskAgain) {
			const config = vscode.workspace.getConfiguration(DBProjectConfigurationKey);
			await config.update(NetCoreDoNotAskAgainKey, true, vscode.ConfigurationTarget.Global);
		}
	}

	private get isNetCoreInstallationPresent(): boolean {
		const netCoreInstallationPresent = (!isNullOrUndefined(this.netcoreInstallLocation) && fs.existsSync(this.netcoreInstallLocation));
		if (!netCoreInstallationPresent) {
			this.netCoreInstallState = netCoreInstallState.netCoreNotPresent;
		}
		return netCoreInstallationPresent;
	}

	public get netcoreInstallLocation(): string {
		return vscode.workspace.getConfiguration(DBProjectConfigurationKey)[DotnetInstallLocationKey] ||
			this.defaultLocalInstallLocationByDistribution;
	}

	private get defaultLocalInstallLocationByDistribution(): string | undefined {
		switch (this.osPlatform) {
			case winPlatform: return this.defaultWindowsLocation;
			case macPlatform: return this.defaultMacLocation;
			case linuxPlatform: return this.defaultLinuxLocation;
			default: return undefined;
		}
	}

	private get defaultMacLocation(): string | undefined {
		return this.getDotnetPathIfPresent(NetCoreMacDefaultPath) ||			//default folder for net core sdk on Mac
			this.getDotnetPathIfPresent(os.homedir()) ||
			undefined;
	}

	private get defaultLinuxLocation(): string | undefined {
		return this.getDotnetPathIfPresent(NetCoreLinuxDefaultPath) ||			//default folder for net core sdk on Linux
			this.getDotnetPathIfPresent(os.homedir()) ||
			undefined;
	}

	private get defaultWindowsLocation(): string | undefined {
		return this.getDotnetPathIfPresent(process.env['ProgramW6432']) ||
			this.getDotnetPathIfPresent(process.env['ProgramFiles(x86)']) ||
			this.getDotnetPathIfPresent(process.env['ProgramFiles']);
	}

	private getDotnetPathIfPresent(folderPath: string | undefined): string | undefined {
		if (!isNullOrUndefined(folderPath) && fs.existsSync(path.join(folderPath, 'dotnet'))) {
			return path.join(folderPath, 'dotnet');
		}
		return undefined;
	}

	/**
	 * This function checks if the installed dotnet version is at least minSupportedNetCoreVersionForBuild.
	 * Versions lower than minSupportedNetCoreVersionForBuild aren't supported for building projects.
	 * Returns: True if installed dotnet version is supported, false otherwise.
	 * 			Undefined if dotnet isn't installed.
	 */
	private async isNetCoreVersionSupportedForBuild(): Promise<boolean | undefined> {
		try {
			const spawn = child_process.spawn;
			let child: child_process.ChildProcessWithoutNullStreams;
			let isSupported: boolean = false;
			const stdoutBuffers: Buffer[] = [];

			child = spawn('dotnet --version', [], {
				shell: true
			});

			child.stdout.on('data', (b: Buffer) => stdoutBuffers.push(b));

			await new Promise((resolve, reject) => {
				child.on('exit', () => {
					this.netCoreSdkInstalledVersion = Buffer.concat(stdoutBuffers).toString('utf8').trim();

					try {
						if (semver.gte(this.netCoreSdkInstalledVersion, minSupportedNetCoreVersionForBuild)) {		// Net core version greater than or equal to minSupportedNetCoreVersion are supported for Build
							isSupported = true;
						} else {
							isSupported = false;
						}
						resolve({ stdout: this.netCoreSdkInstalledVersion });
					} catch (err) {
						console.log(err);
						reject(err);
					}
				});
				child.on('error', (err) => {
					console.log(err);
					this.netCoreInstallState = netCoreInstallState.netCoreNotPresent;
					reject(err);
				});
			});

			if (isSupported) {
				this.netCoreInstallState = netCoreInstallState.netCoreVersionSupported;
			} else {
				this.netCoreInstallState = netCoreInstallState.netCoreVersionNotSupported;
			}

			return isSupported;
		} catch (err) {
			console.log(err);
			this.netCoreInstallState = netCoreInstallState.netCoreNotPresent;
			return undefined;
		}
	}

	/**
	 * Runs the specified dotnet command
	 * @param options The options to use when launching the process
	 * @param skipVersionSupportedCheck If true then skip the check to determine whether the .NET version is supported (for commands that work on all versions)
	 * @returns
	 */
	public async runDotnetCommand(options: ShellCommandOptions, skipVersionSupportedCheck = false): Promise<string> {
		if (options && options.commandTitle !== undefined && options.commandTitle !== null) {
			this._outputChannel.appendLine(`\t[ ${options.commandTitle} ]`);
		}

		await this.verifyNetCoreInstallation(skipVersionSupportedCheck);

		const dotnetPath = utils.getQuotedPath(path.join(this.netcoreInstallLocation, dotnet));
		const command = dotnetPath + ' ' + options.argument;

		try {
			return await this.runStreamedCommand(command, options);
		} catch (error) {
			this._outputChannel.append(localize('sqlDatabaseProject.RunCommand.ErroredOut', "\t>>> {0}   … errored out: {1}", command, utils.getErrorMessage(error))); //errors are localized in our code where emitted, other errors are pass through from external components that are not easily localized
			throw error;
		}
	}

	/**
	 * Assesses whether the .NET Core installation is present and supported.
	 * If not, it will prompt the user to install or update .NET Core.
	 * @param skipVersionSupportedCheck
	 */
	public async verifyNetCoreInstallation(skipVersionSupportedCheck = false): Promise<void> {
		if (!(await this.findOrInstallNetCore(skipVersionSupportedCheck))) {
			if (this.netCoreInstallState === netCoreInstallState.netCoreNotPresent) {
				throw new DotNetError(DotnetInstallationConfirmation);
			} else {
				throw new DotNetError(NetCoreSupportedVersionInstallationConfirmation(this.netCoreSdkInstalledVersion!));
			}
		}
	}
}

export class DotNetError extends Error {

}
