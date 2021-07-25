/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as cp from 'promisify-child-process';
import * as nls from 'vscode-nls';
import { isNullOrUndefined } from 'util';
import * as utils from '../common/utils';
const localize = nls.loadMessageBundle();

export const DBProjectConfigurationKey: string = 'sqlDatabaseProjects';
export const NetCoreInstallLocationKey: string = 'netCoreSDKLocation';
export const NetCoreDoNotAskAgainKey: string = 'netCoreDoNotAsk';
export const NextCoreNonWindowsDefaultPath = '/usr/local/share';
export const NetCoreInstallationConfirmation: string = localize('sqlDatabaseProjects.NetCoreInstallationConfirmation', "The .NET Core SDK cannot be located. Project build will not work. Please install .NET Core SDK version 3.1 or update the .Net Core SDK location in settings if already installed.");
export const NetCoreSupportedVersionInstallationConfirmation: string = localize('sqlDatabaseProjects.NetCoreSupportedVersionInstallationConfirmation', "The .NET Core SDK that was found isn't a supported version. Project build will not work. Please install .NET Core SDK version 3.1 or update the .Net Core SDK supported version location in settings if already installed.");
export const UpdateNetCoreLocation: string = localize('sqlDatabaseProjects.UpdateNetCoreLocation', "Update Location");
export const InstallNetCore: string = localize('sqlDatabaseProjects.InstallNetCore', "Install");
export const DoNotAskAgain: string = localize('sqlDatabaseProjects.doNotAskAgain', "Don't Ask Again");
export const winPlatform = 'win32';
export const macPlatform = 'darwin';
export const linuxPlatform = 'linux';

const projectsOutputChannel = localize('sqlDatabaseProjects.outputChannel', "Database Projects");
const dotnet = os.platform() === 'win32' ? 'dotnet.exe' : 'dotnet';

export interface DotNetCommandOptions {
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
	commandTitle?: string;
	argument?: string;
}

export class NetCoreTool {

	private static _outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(projectsOutputChannel);

	private netCoreInstallationPresent: boolean | undefined;

	private osPlatform: string = os.platform();

	public async findOrInstallNetCore(): Promise<boolean> {
		this.netCoreInstallationPresent = this.isNetCoreInstallationPresent;
		if ((!this.netCoreInstallationPresent || !this.isNetCoreVersionSupported) &&
			vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreDoNotAskAgainKey] !== true) {
			await this.showInstallDialog();
			return false;
		}
		return true;
	}

	public async showInstallDialog(): Promise<void> {
		let result;
		if (!this.netCoreInstallationPresent) {
			result = await vscode.window.showInformationMessage(NetCoreInstallationConfirmation, UpdateNetCoreLocation, InstallNetCore, DoNotAskAgain);
		} else {
			result = await vscode.window.showInformationMessage(NetCoreSupportedVersionInstallationConfirmation, UpdateNetCoreLocation, InstallNetCore, DoNotAskAgain);
		}

		if (result === UpdateNetCoreLocation) {
			//open settings
			await vscode.commands.executeCommand('workbench.action.openGlobalSettings');
		} else if (result === InstallNetCore) {
			//open install link
			const dotnetcoreURL = 'https://dotnet.microsoft.com/download/dotnet-core/3.1';
			await vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
		} else if (result === DoNotAskAgain) {
			const config = vscode.workspace.getConfiguration(DBProjectConfigurationKey);
			await config.update(NetCoreDoNotAskAgainKey, true, vscode.ConfigurationTarget.Global);
		}
	}

	private get isNetCoreInstallationPresent(): boolean {
		return (!isNullOrUndefined(this.netcoreInstallLocation) && fs.existsSync(this.netcoreInstallLocation));
	}

	public get netcoreInstallLocation(): string {
		return vscode.workspace.getConfiguration(DBProjectConfigurationKey)[NetCoreInstallLocationKey] ||
			this.defaultLocalInstallLocationByDistribution;
	}

	private get defaultLocalInstallLocationByDistribution(): string | undefined {
		return (this.osPlatform === winPlatform) ? this.defaultWindowsLocation :
			(this.osPlatform === macPlatform || this.osPlatform === linuxPlatform) ? this.defaultnonWindowsLocation :
				undefined;
	}

	private get defaultnonWindowsLocation(): string | undefined {
		const defaultNonWindowsInstallLocation = NextCoreNonWindowsDefaultPath; //default folder for net core sdk
		return this.getDotnetPathIfPresent(defaultNonWindowsInstallLocation) ||
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

	private get isNetCoreVersionSupported(): boolean | undefined {
		try {
			let spawnSync = require('child_process').spawnSync;
			let child;

			child = spawnSync('dotnet --version', [], {
				encoding: 'utf-8',
				shell: true
			});

			let versions = String(child.stdout).split('.', 2);

			if (Number(versions[0]) < 3) {
				return false;
			} else if (Number(versions[0]) > 3) {
				return true;
			} else {	// major version = 3
				if (Number(versions[1]) >= 1) {
					return true;
				} else {
					return false;
				}
			}
		} catch (err) {
			return undefined;
		}
	}

	public async runDotnetCommand(options: DotNetCommandOptions): Promise<string> {
		if (options && options.commandTitle !== undefined && options.commandTitle !== null) {
			NetCoreTool._outputChannel.appendLine(`\t[ ${options.commandTitle} ]`);
		}

		if (!(await this.findOrInstallNetCore())) {
			if (!this.netCoreInstallationPresent) {
				throw new Error(NetCoreInstallationConfirmation);
			} else {
				throw new Error(NetCoreSupportedVersionInstallationConfirmation);
			}
		}

		const dotnetPath = utils.getQuotedPath(path.join(this.netcoreInstallLocation, dotnet));
		const command = dotnetPath + ' ' + options.argument;

		try {
			return await this.runStreamedCommand(command, NetCoreTool._outputChannel, options);
		} catch (error) {
			NetCoreTool._outputChannel.append(localize('sqlDatabaseProject.RunCommand.ErroredOut', "\t>>> {0}   … errored out: {1}", command, utils.getErrorMessage(error))); //errors are localized in our code where emitted, other errors are pass through from external components that are not easily localized
			throw error;
		}
	}

	// spawns the dotnet command with arguments and redirects the error and output to ADS output channel
	public async runStreamedCommand(command: string, outputChannel: vscode.OutputChannel, options?: DotNetCommandOptions): Promise<string> {
		const stdoutData: string[] = [];
		outputChannel.appendLine(`    > ${command}`);

		const spawnOptions = {
			cwd: options && options.workingDirectory,
			env: Object.assign({}, process.env, options && options.additionalEnvironmentVariables),
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024, // 10 Mb of output can be captured.
			shell: true,
			detached: false,
			windowsHide: true
		};

		const child = cp.spawn(command, [], spawnOptions);
		outputChannel.show();

		// Add listeners to print stdout and stderr and exit code
		child.on('exit', (code: number | null, signal: string | null) => {
			if (code !== null) {
				outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithCode', "    >>> {0}    … exited with code: {1}", command, code));
			} else {
				outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithSignal', "    >>> {0}   … exited with signal: {1}", command, signal));
			}
		});

		child.stdout!.on('data', (data: string | Buffer) => {
			stdoutData.push(data.toString());
			this.outputDataChunk(data, outputChannel, localize('sqlDatabaseProjects.RunCommand.stdout', "    stdout: "));
		});

		child.stderr!.on('data', (data: string | Buffer) => {
			this.outputDataChunk(data, outputChannel, localize('sqlDatabaseProjects.RunCommand.stderr', "    stderr: "));
		});
		await child;

		return stdoutData.join('');
	}

	private outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				outputChannel.appendLine(header + line);
			});
	}
}
