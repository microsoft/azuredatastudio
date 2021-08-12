/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, executeSudoCommand, ExitCodeError, ProcessOutput } from './common/childProcess';
import { HttpClient } from './common/httpClient';
import Logger from './common/logger';
import { AzureCLIArcExtError, NoAzureCLIError, searchForCmd } from './common/utils';
import { azArcdataInstallKey, azConfigSection, azFound, debugConfigKey, latestAzArcExtensionVersion, azCliInstallKey, azArcFound, azHostname, azUri } from './constants';
import * as loc from './localizedConstants';

/**
 * The latest Azure CLI arcdata extension version for this extension to function properly
 */
export const LATEST_AZ_ARC_EXTENSION_VERSION = new SemVer(latestAzArcExtensionVersion);

export const enum AzDeployOption {
	dontPrompt = 'dontPrompt',
	prompt = 'prompt'
}

/**
 * Interface for an object to interact with the az tool installed on the box.
 */
export interface IAzTool extends azExt.IAzApi {
	/**
	 * Executes az with the specified arguments (e.g. --version) and returns the result
	 * @param args The args to pass to az
	 * @param parseResult A function used to parse out the raw result into the desired shape
	 */
	executeCommand<R>(args: string[], additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<R>>
}

/**
 * An object to interact with the az tool installed on the box.
 */
export class AzTool implements azExt.IAzApi {

	private _semVersionAz: SemVer;
	private _semVersionArc: SemVer;

	constructor(private _path: string, versionAz: string, versionArc: string) {
		this._semVersionAz = new SemVer(versionAz);
		this._semVersionArc = new SemVer(versionArc);
	}

	/**
	 * The semVersion corresponding to this installation of Azure CLI. version() method should have been run
	 * before fetching this value to ensure that correct value is returned. This is almost always correct unless
	 * Az has gotten reinstalled in the background after this IAzApi object was constructed.
	 */
	public async getSemVersionAz(): Promise<SemVer> {
		return this._semVersionAz;
	}

	/**
	 * The semVersion corresponding to this installation of Azure CLI arcdata extension. version() method should have been run
	 * before fetching this value to ensure that correct value is returned. This is almost always correct unless
	 * arcdata has gotten reinstalled in the background after this IAzApi object was constructed.
	 */
	public async getSemVersionArc(): Promise<SemVer> {
		return this._semVersionArc;
	}

	/**
	 * gets the path where az tool is installed
	 */
	public async getPath(): Promise<string> {
		return this._path;
	}

	public arcdata = {
		dc: {
			endpoint: {
				list: (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.DcEndpointListResult[]>> => {
					return this.executeCommand<azExt.DcEndpointListResult[]>(['arcdata', 'dc', 'endpoint', 'list', '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
				}
			},
			config: {
				list: (additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.DcConfigListResult[]>> => {
					return this.executeCommand<azExt.DcConfigListResult[]>(['arcdata', 'dc', 'config', 'list'], additionalEnvVars);
				},
				show: (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.DcConfigShowResult>> => {
					return this.executeCommand<azExt.DcConfigShowResult>(['arcdata', 'dc', 'config', 'show', '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
				}
			}
		}
	};

	public postgres = {
		arcserver: {
			delete: (name: string, namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<void>> => {
				return this.executeCommand<void>(['postgres', 'arc-server', 'delete', '-n', name, '--k8s-namespace', namespace, '--force', '--use-k8s'], additionalEnvVars);
			},
			list: (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.PostgresServerListResult[]>> => {
				return this.executeCommand<azExt.PostgresServerListResult[]>(['postgres', 'arc-server', 'list', '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
			},
			show: (name: string, namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.PostgresServerShowResult>> => {
				return this.executeCommand<azExt.PostgresServerShowResult>(['postgres', 'arc-server', 'show', '-n', name, '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
			},
			edit: (
				name: string,
				args: {
					adminPassword?: boolean,
					coresLimit?: string,
					coresRequest?: string,
					coordinatorEngineSettings?: string,
					engineSettings?: string,
					extensions?: string,
					memoryLimit?: string,
					memoryRequest?: string,
					noWait?: boolean,
					port?: number,
					replaceEngineSettings?: boolean,
					workerEngineSettings?: string,
					workers?: number
				},
				namespace: string,
				additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<void>> => {
				const argsArray = ['postgres', 'arc-server', 'edit', '-n', name, '--k8s-namespace', namespace, '--use-k8s'];
				if (args.adminPassword) { argsArray.push('--admin-password'); }
				if (args.coresLimit) { argsArray.push('--cores-limit', args.coresLimit); }
				if (args.coresRequest) { argsArray.push('--cores-request', args.coresRequest); }
				if (args.coordinatorEngineSettings) { argsArray.push('--coordinator-settings', args.coordinatorEngineSettings); }
				if (args.engineSettings) { argsArray.push('--engine-settings', args.engineSettings); }
				if (args.extensions) { argsArray.push('--extensions', args.extensions); }
				if (args.memoryLimit) { argsArray.push('--memory-limit', args.memoryLimit); }
				if (args.memoryRequest) { argsArray.push('--memory-request', args.memoryRequest); }
				if (args.noWait) { argsArray.push('--no-wait'); }
				if (args.port) { argsArray.push('--port', args.port.toString()); }
				if (args.replaceEngineSettings) { argsArray.push('--replace-settings'); }
				if (args.workerEngineSettings) { argsArray.push('--worker-settings', args.workerEngineSettings); }
				if (args.workers !== undefined) { argsArray.push('--workers', args.workers.toString()); }
				return this.executeCommand<void>(argsArray, additionalEnvVars);
			}
		}
	};

	public sql = {
		miarc: {
			delete: (name: string, namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<void>> => {
				return this.executeCommand<void>(['sql', 'mi-arc', 'delete', '-n', name, '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
			},
			list: (namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.SqlMiListResult[]>> => {
				return this.executeCommand<azExt.SqlMiListResult[]>(['sql', 'mi-arc', 'list', '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
			},
			show: (name: string, namespace: string, additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<azExt.SqlMiShowResult>> => {
				return this.executeCommand<azExt.SqlMiShowResult>(['sql', 'mi-arc', 'show', '-n', name, '--k8s-namespace', namespace, '--use-k8s'], additionalEnvVars);
			},
			edit: (
				name: string,
				args: {
					coresLimit?: string,
					coresRequest?: string,
					memoryLimit?: string,
					memoryRequest?: string,
					noWait?: boolean,
				},
				namespace: string,
				additionalEnvVars?: azExt.AdditionalEnvVars
			): Promise<azExt.AzOutput<void>> => {
				const argsArray = ['sql', 'mi-arc', 'edit', '-n', name, '--k8s-namespace', namespace, '--use-k8s'];
				if (args.coresLimit) { argsArray.push('--cores-limit', args.coresLimit); }
				if (args.coresRequest) { argsArray.push('--cores-request', args.coresRequest); }
				if (args.memoryLimit) { argsArray.push('--memory-limit', args.memoryLimit); }
				if (args.memoryRequest) { argsArray.push('--memory-request', args.memoryRequest); }
				if (args.noWait) { argsArray.push('--no-wait'); }
				return this.executeCommand<void>(argsArray, additionalEnvVars);
			}
		}
	};

	/**
	 * Gets the output of running '--version' command on the az tool.
	 * It also updates the cachedVersion property based on the return value from the tool.
	 */
	public async version(): Promise<azExt.AzOutput<string>> {
		const output = await executeAzCommand(`"${this._path}"`, ['--version']);
		this._semVersionAz = new SemVer(<string>parseVersion(output.stdout));
		return {
			stdout: output.stdout,
			stderr: output.stderr.split(os.EOL)
		};
	}

	/**
	 * Executes the specified az command.
	 * @param args The args to pass to az
	 * @param additionalEnvVars Additional environment variables to set for this execution
	 */
	public async executeCommand<R>(args: string[], additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<R>> {
		try {
			const result = await executeAzCommand(`"${this._path}"`, args.concat(['--output', 'json']), additionalEnvVars);

			let stdout = <unknown>result.stdout;
			let stderr = <unknown>result.stderr;

			try {
				// Automatically try parsing the JSON. This is expected to fail for some az commands such as resource delete.
				stdout = JSON.parse(result.stdout);
			} catch (err) {
				// If the output was not pure JSON, catch the error and log it here.
				Logger.log(loc.azOutputParseErrorCaught(args.concat(['--output', 'json']).toString()));
			}

			return {
				stdout: <R>stdout,
				stderr: <string[]>stderr
			};
		} catch (err) {
			if (err instanceof ExitCodeError) {
				try {
					await fs.promises.access(this._path);
					//this.path exists
				} catch (e) {
					// this.path does not exist
					await vscode.commands.executeCommand('setContext', azFound, false);
					throw new NoAzureCLIError();
				}
			}
			throw err;
		}
	}
}

/**
 * Checks whether az is installed - and if it is not then invokes the process of az installation.
 * @param userRequested true means that this operation by was requested by a user by executing an ads command.
 */
export async function checkAndInstallAz(userRequested: boolean = false): Promise<IAzTool | undefined> {
	try {
		return await findAzAndArc(); // find currently installed Az
	} catch (err) {
		if (err === AzureCLIArcExtError) {
			// Az found but arcdata extension not found. Prompt user to install it, then check again.
			if (await promptToInstallArcdata(userRequested)) {
				return await findAzAndArc();
			}
		} else {
			// No az was found. Prompt user to install it, then check again.
			if (await promptToInstallAz(userRequested)) {
				return await findAzAndArc();
			}
		}
	}
	// If user declines to install upon prompt, return an undefined object instead of an AzTool
	return undefined;
}

/**
 * Finds the existing installation of az, or throws an error if it couldn't find it
 * or encountered an unexpected error. If arcdata extension was not found on the az,
 * throw an error. An AzTool will not be returned.
 * The promise is rejected when Az is not found.
 */
export async function findAzAndArc(): Promise<IAzTool> {
	Logger.log(loc.searchingForAz);
	try {
		const azTool = await findSpecificAzAndArc();
		await vscode.commands.executeCommand('setContext', azFound, true); // save a context key that az was found so that command for installing az is no longer available in commandPalette and that for updating it is.
		await vscode.commands.executeCommand('setContext', azArcFound, true); // save a context key that arcdata was found so that command for installing arcdata is no longer available in commandPalette and that for updating it is.
		Logger.log(loc.foundExistingAz(await azTool.getPath(), (await azTool.getSemVersionAz()).raw, (await azTool.getSemVersionArc()).raw));
		return azTool;
	} catch (err) {
		if (err === AzureCLIArcExtError) {
			Logger.log(loc.couldNotFindAzArc(err));
			Logger.log(loc.noAzArc);
			await vscode.commands.executeCommand('setContext', azArcFound, false); // save a context key that az was not found so that command for installing az is available in commandPalette and that for updating it is no longer available.
		} else {
			Logger.log(loc.couldNotFindAz(err));
			Logger.log(loc.noAz);
			await vscode.commands.executeCommand('setContext', azFound, false); // save a context key that arcdata was not found so that command for installing arcdata is available in commandPalette and that for updating it is no longer available.
		}
		throw err;
	}
}

/**
 * Find az by searching user's directories. If no az is found, this will error out and no arcdata is found.
 * If az is found, check if arcdata extension exists on it and return true if so, false if not.
 * Return the AzTool whether or not an arcdata extension has been found.
 */
async function findSpecificAzAndArc(): Promise<IAzTool> {
	// Check if az exists
	const path = await ((process.platform === 'win32') ? searchForCmd('az.cmd') : searchForCmd('az'));
	const versionOutput = await executeAzCommand(`"${path}"`, ['--version']);

	// The arcdata extension can't exist if there is no az. The function will not reach the following code
	// if no az has been found. If found, check if az arcdata extension exists.
	const arcVersion = parseArcExtensionVersion(versionOutput.stdout);
	if (arcVersion === undefined) {
		throw AzureCLIArcExtError;
	}

	return new AzTool(path, <string>parseVersion(versionOutput.stdout), <string>arcVersion);
}

/**
 * Prompt user to install Azure CLI.
 * @param userRequested - if true this operation was requested in response to a user issued command, if false it was issued at startup by system
 * returns true if installation was done and false otherwise.
 */
async function promptToInstallAz(userRequested: boolean = false): Promise<boolean> {
	let response: string | undefined = loc.yes;
	const config = <AzDeployOption>getAzConfig(azCliInstallKey);
	if (userRequested) {
		Logger.show();
		Logger.log(loc.userRequestedInstall);
	}
	if (config === AzDeployOption.dontPrompt && !userRequested) {
		Logger.log(loc.skipInstall(config));
		return false;
	}
	const responses = userRequested
		? [loc.yes, loc.no]
		: [loc.yes, loc.askLater, loc.doNotAskAgain];
	if (config === AzDeployOption.prompt) {
		Logger.log(loc.promptForAzInstallLog);
		response = await vscode.window.showErrorMessage(loc.promptForAzInstall, ...responses);
		Logger.log(loc.userResponseToInstallPrompt(response));
	}
	if (response === loc.doNotAskAgain) {
		await setAzConfig(azCliInstallKey, AzDeployOption.dontPrompt);
	} else if (response === loc.yes) {
		try {
			await installAz();
			vscode.window.showInformationMessage(loc.azInstalled);
			Logger.log(loc.azInstalled);
			return true;
		} catch (err) {
			// Windows: 1602 is User cancelling installation/update - not unexpected so don't display
			if (!(err instanceof ExitCodeError) || err.code !== 1602) {
				vscode.window.showWarningMessage(loc.installError(err));
				Logger.log(loc.installError(err));
			}
		}
	}
	return false;
}

/**
 * Prompt user to install Azure CLI arcdata extension.
 * @param userRequested - if true this operation was requested in response to a user issued command, if false it was issued at startup by system
 * returns true if installation was done and false otherwise.
 */
async function promptToInstallArcdata(userRequested: boolean = false): Promise<boolean> {
	let response: string | undefined = loc.yes;
	const config = <AzDeployOption>getAzConfig(azArcdataInstallKey);
	if (userRequested) {
		Logger.show();
		Logger.log(loc.userRequestedInstall);
	}
	if (config === AzDeployOption.dontPrompt && !userRequested) {
		Logger.log(loc.skipInstall(config));
		return false;
	}
	const responses = userRequested
		? [loc.yes, loc.no]
		: [loc.yes, loc.askLater, loc.doNotAskAgain];
	if (config === AzDeployOption.prompt) {
		Logger.log(loc.promptForArcdataInstallLog);
		response = await vscode.window.showErrorMessage(loc.promptForArcdataInstall, ...responses);
		Logger.log(loc.userResponseToInstallPrompt(response));
	}
	if (response === loc.doNotAskAgain) {
		await setAzConfig(azArcdataInstallKey, AzDeployOption.dontPrompt);
	} else if (response === loc.yes) {
		try {
			await installArcdata();
			vscode.window.showInformationMessage(loc.arcdataInstalled);
			Logger.log(loc.arcdataInstalled);
			return true;
		} catch (err) {
			// Windows: 1602 is User cancelling installation/update - not unexpected so don't display
			if (!(err instanceof ExitCodeError) || err.code !== 1602) {
				vscode.window.showWarningMessage(loc.installError(err));
				Logger.log(loc.installError(err));
			}
		}
	}
	return false;
}

/**
 * runs the commands to install az, downloading the installation package if needed
 */
export async function installAz(): Promise<void> {
	Logger.show();
	Logger.log(loc.installingAz);
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: loc.installingAz,
			cancellable: false
		},
		async (_progress, _token): Promise<void> => {
			switch (process.platform) {
				case 'win32':
					await downloadAndInstallAzWin32();
					break;
				case 'darwin':
					await installAzDarwin();
					break;
				case 'linux':
					await installAzLinux();
					break;
				default:
					throw new Error(loc.platformUnsupported(process.platform));
			}
		}
	);
}

/**
 * Downloads the Windows installer and runs it
 */
async function downloadAndInstallAzWin32(): Promise<void> {
	const downLoadLink = `${azHostname}/${azUri}`;
	const downloadFolder = os.tmpdir();
	const downloadLogs = path.join(downloadFolder, 'ads_az_install_logs.log');
	const downloadedFile = await HttpClient.downloadFile(downLoadLink, downloadFolder);

	try {
		await executeSudoCommand(`msiexec /qn /i "${downloadedFile}" /lvx "${downloadLogs}"`);
	} catch (err) {
		throw new Error(`${err.message}. See logs at ${downloadLogs} for more details.`);
	}
}

/**
 * Runs commands to install az on MacOS
 */
async function installAzDarwin(): Promise<void> {
	await executeCommand('brew', ['update']);
	await executeCommand('brew', ['install', 'azure-cli']);
}

/**
 * Runs commands to install az on Linux
 */
async function installAzLinux(): Promise<void> {
	// Get packages needed for install process
	await executeSudoCommand('apt-get update');
	await executeSudoCommand('apt-get install ca-certificates curl apt-transport-https lsb-release gnupg');
	// Download and install the signing key
	await executeSudoCommand('curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null');
	// Add the az repository information
	await executeSudoCommand('AZ_REPO=$(lsb_release -cs) echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" | sudo tee /etc/apt/sources.list.d/azure-cli.list');
	// Update repository information and install az
	await executeSudoCommand('apt-get update');
	await executeSudoCommand('apt-get install azure-cli');
}

/**
 * Runs the command to install az arcdata extension
 */
export async function installArcdata(): Promise<void> {
	Logger.show();
	Logger.log(loc.installingArcdata);
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: loc.installingArcdata,
			cancellable: false
		},
		async (_progress, _token): Promise<void> => {
			await executeCommand('az', ['extension', 'add', '--name', 'arcdata']);
		}
	);
}

/**
 * Parses out the Azure CLI version from the raw az version output
 * @param raw The raw version output from az --version
 */
function parseVersion(raw: string): string | undefined {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation, with the first line holding the version of az itself.
	//
	// The output of az --version looks like:
	// azure-cli                         2.26.1
	// ...
	const exp = /azure-cli\s*(\d*.\d*.\d*)/;
	return exp.exec(raw)?.pop();
}

/**
 * Parses out the arcdata extension version from the raw az version output
 * @param raw The raw version output from az --version
 */
function parseArcExtensionVersion(raw: string): string | undefined {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation and any extensions.
	//
	// The output of az --version looks like:
	// azure-cli                         2.26.1
	// ...
	// Extensions:
	// arcdata                            1.0.0
	// connectedk8s                       1.1.5
	// ...
	const exp = /arcdata\s*(\d*.\d*.\d*)/;
	return exp.exec(raw)?.pop();
}

async function executeAzCommand(command: string, args: string[], additionalEnvVars: azExt.AdditionalEnvVars = {}): Promise<ProcessOutput> {
	const debug = vscode.workspace.getConfiguration(azConfigSection).get(debugConfigKey);
	if (debug) {
		args.push('--debug');
	}
	return executeCommand(command, args, additionalEnvVars);
}

function getAzConfig(key: string): AzDeployOption | undefined {
	const config = vscode.workspace.getConfiguration(azConfigSection);
	const value = <AzDeployOption>config.get<AzDeployOption>(key);
	return value;
}

async function setAzConfig(key: string, value: string): Promise<void> {
	const config = vscode.workspace.getConfiguration(azConfigSection);
	await config.update(key, value, vscode.ConfigurationTarget.Global);
}
