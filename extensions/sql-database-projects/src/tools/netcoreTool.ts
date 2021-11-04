/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { isNullOrUndefined } from 'util';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DoNotAskAgain, DoNotShowAgain, Install, NetCoreInstallationConfirmation, NetCoreSupportedVersionInstallationConfirmation, NetCoreVersionDowngradeConfirmation, UpdateNetCoreLocation } from '../common/constants';
import * as utils from '../common/utils';
import { ShellCommandOptions, ShellExecutionHelper } from './shellExecutionHelper';
const localize = nls.loadMessageBundle();

export const DBProjectConfigurationKey: string = 'sqlDatabaseProjects';
export const NetCoreInstallLocationKey: string = 'netCoreSDKLocation';
export const NetCoreDoNotAskAgainKey: string = 'netCoreDoNotAsk';
export const NetCoreDowngradeDoNotShowAgainKey: string = 'netCoreDowngradeDoNotShow';
export const NetCoreNonWindowsDefaultPath = '/usr/local/share';
export const winPlatform: string = 'win32';
export const macPlatform: string = 'darwin';
export const linuxPlatform: string = 'linux';
export const minSupportedNetCoreVersion: string = '3.1.0';
export const maxSupportedNetCoreVersionCutoff: string = '6.0.0';	// un-set this to allow latest

export const enum netCoreInstallState {
	netCoreNotPresent,
	netCoreVersionNotSupported,
	netCoreVersionSupported,
	netCoreVersionTooHigh
}

const dotnet = os.platform() === 'win32' ? 'dotnet.exe' : 'dotnet';

export class NetCoreTool extends ShellExecutionHelper {

	private osPlatform: string = os.platform();
	private netCoreSdkInstalledVersion: string | undefined;
	private netCoreInstallState: netCoreInstallState = netCoreInstallState.netCoreVersionSupported;

	/**
	 * This method presents the installation dialog for .NET Core, if not already present/supported
	 * @returns True if .NET version was found and is supported
	 * 			False if .NET version isn't present or present but not supported
	 */
	public async findOrInstallNetCore(): Promise<boolean> {
		if ((!this.isNetCoreInstallationPresent || !await this.isNetCoreVersionSupported())) {
			if (this.netCoreInstallState === netCoreInstallState.netCoreVersionSupported && vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreDoNotAskAgainKey] !== true) {
				void this.showInstallDialog();		// Removing await so that Build and extension load process doesn't wait on user input
			} else if (this.netCoreInstallState === netCoreInstallState.netCoreVersionTooHigh && vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreDowngradeDoNotShowAgainKey] !== true) {
				void this.showDowngradeDialog();
			}
			return false;
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
			result = await vscode.window.showErrorMessage(NetCoreInstallationConfirmation, UpdateNetCoreLocation, Install, DoNotAskAgain);
		} else {
			result = await vscode.window.showErrorMessage(NetCoreSupportedVersionInstallationConfirmation(this.netCoreSdkInstalledVersion!), UpdateNetCoreLocation, Install, DoNotAskAgain);
		}

		if (result === UpdateNetCoreLocation) {
			//open settings
			await vscode.commands.executeCommand('workbench.action.openGlobalSettings');
		} else if (result === Install) {
			//open install link
			const dotnetcoreURL = 'https://dotnet.microsoft.com/download/dotnet-core/3.1';
			await vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
		} else if (result === DoNotAskAgain) {
			const config = vscode.workspace.getConfiguration(DBProjectConfigurationKey);
			await config.update(NetCoreDoNotAskAgainKey, true, vscode.ConfigurationTarget.Global);
		}
	}

	public async showDowngradeDialog(): Promise<void> {
		const result = await vscode.window.showErrorMessage(NetCoreVersionDowngradeConfirmation(this.netCoreSdkInstalledVersion!), DoNotShowAgain);

		if (result === DoNotShowAgain) {
			const config = vscode.workspace.getConfiguration(DBProjectConfigurationKey);
			await config.update(NetCoreDowngradeDoNotShowAgainKey, true, vscode.ConfigurationTarget.Global);
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
		return vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreInstallLocationKey] ||
			this.defaultLocalInstallLocationByDistribution;
	}

	private get defaultLocalInstallLocationByDistribution(): string | undefined {
		switch (this.osPlatform) {
			case winPlatform: return this.defaultWindowsLocation;
			case macPlatform:
			case linuxPlatform: return this.defaultnonWindowsLocation;
			default: return undefined;
		}
	}

	private get defaultnonWindowsLocation(): string | undefined {
		return this.getDotnetPathIfPresent(NetCoreNonWindowsDefaultPath) ||			//default folder for net core sdk
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
	 * This function checks if the installed dotnet version is between minSupportedNetCoreVersion (inclusive) and maxSupportedNetCoreVersionCutoff (exclusive).
	 * When maxSupportedNetCoreVersionCutoff is not set, the latest dotnet version is assumed to be supported and only the min version is checked.
	 * Returns: True if installed dotnet version is supported, false otherwise.
	 * 			Undefined if dotnet isn't installed.
	 */
	private async isNetCoreVersionSupported(): Promise<boolean | undefined> {
		try {
			const spawn = child_process.spawn;
			let child: child_process.ChildProcessWithoutNullStreams;
			let installState: netCoreInstallState = netCoreInstallState.netCoreVersionSupported;
			const stdoutBuffers: Buffer[] = [];

			child = spawn('dotnet --version', [], {
				shell: true
			});

			child.stdout.on('data', (b: Buffer) => stdoutBuffers.push(b));

			await new Promise((resolve, reject) => {
				child.on('exit', () => {
					this.netCoreSdkInstalledVersion = Buffer.concat(stdoutBuffers).toString('utf8').trim();

					try {
						// minSupportedDotnetVersion <= supported version < maxSupportedDotnetVersion
						if (semver.gte(this.netCoreSdkInstalledVersion, minSupportedNetCoreVersion)) {
							// If maxSupportedNetCoreVersionCutoff is not set, the latest .NET version is allowed
							if (maxSupportedNetCoreVersionCutoff) {
								if (semver.lt(this.netCoreSdkInstalledVersion, maxSupportedNetCoreVersionCutoff)) {
									installState = netCoreInstallState.netCoreVersionSupported;
								} else {
									installState = netCoreInstallState.netCoreVersionTooHigh;
								}
							} else {
								installState = netCoreInstallState.netCoreVersionSupported;
							}
						} else {
							// .NET version is too low
							installState = netCoreInstallState.netCoreVersionNotSupported;
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

			this.netCoreInstallState = installState;
			return installState === netCoreInstallState.netCoreVersionSupported;
		} catch (err) {
			console.log(err);
			this.netCoreInstallState = netCoreInstallState.netCoreNotPresent;
			return undefined;
		}
	}

	public async runDotnetCommand(options: ShellCommandOptions): Promise<string> {
		if (options && options.commandTitle !== undefined && options.commandTitle !== null) {
			this._outputChannel.appendLine(`\t[ ${options.commandTitle} ]`);
		}

		if (!(await this.findOrInstallNetCore())) {
			if (this.netCoreInstallState === netCoreInstallState.netCoreNotPresent) {
				throw new DotNetError(NetCoreInstallationConfirmation);
			} else if (this.netCoreInstallState === netCoreInstallState.netCoreVersionTooHigh && vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreDowngradeDoNotShowAgainKey] === true) {
				// Assume user has used global.json to override SDK version and proceed with build as is
			} else {
				throw new DotNetError(NetCoreSupportedVersionInstallationConfirmation(this.netCoreSdkInstalledVersion!));
			}
		}

		const dotnetPath = utils.getQuotedPath(path.join(this.netcoreInstallLocation, dotnet));
		const command = dotnetPath + ' ' + options.argument;

		try {
			return await this.runStreamedCommand(command, this._outputChannel, options);
		} catch (error) {
			this._outputChannel.append(localize('sqlDatabaseProject.RunCommand.ErroredOut', "\t>>> {0}   … errored out: {1}", command, utils.getErrorMessage(error))); //errors are localized in our code where emitted, other errors are pass through from external components that are not easily localized
			throw error;
		}
	}
}

export class DotNetError extends Error {

}
