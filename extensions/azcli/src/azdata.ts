/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { getPlatformDownloadLink, getPlatformReleaseVersion } from './azdataReleaseInfo';
import { executeCommand, executeSudoCommand, ExitCodeError, ProcessOutput } from './common/childProcess';
import { HttpClient } from './common/httpClient';
import Logger from './common/logger';
import { getErrorMessage, NoAzdataError, searchForCmd } from './common/utils';
import { azdataAcceptEulaKey, azdataConfigSection, azdataFound, azdataInstallKey, azdataUpdateKey, azdatarequiredUpdateKey, debugConfigKey, eulaAccepted, eulaUrl, microsoftPrivacyStatementUrl } from './constants';
import * as loc from './localizedConstants';

/**
 * The minimum required azdata CLI version for this extension to function properly
 */
export const MIN_AZDATA_VERSION = new SemVer('20.3.4');

export const enum AzdataDeployOption {
	dontPrompt = 'dontPrompt',
	prompt = 'prompt'
}

/**
 * Interface for an object to interact with the azdata tool installed on the box.
 */
export interface IAzdataTool extends azdataExt.IAzdataApi {
	/**
	 * Executes azdata with the specified arguments (e.g. --version) and returns the result
	 * @param args The args to pass to azdata
	 * @param parseResult A function used to parse out the raw result into the desired shape
	 */
	executeCommand<R>(args: string[], additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<R>>
}

/**
 * An object to interact with the azdata tool installed on the box.
 */
export class AzdataTool implements azdataExt.IAzdataApi {

	private _semVersion: SemVer;

	constructor(private _path: string, version: string) {
		this._semVersion = new SemVer(version);
	}

	/**
	 * The semVersion corresponding to this installation of azdata. version() method should have been run
	 * before fetching this value to ensure that correct value is returned. This is almost always correct unless
	 * Azdata has gotten reinstalled in the background after this IAzdataApi object was constructed.
	 */
	public async getSemVersion(): Promise<SemVer> {
		return this._semVersion;
	}

	/**
	 * gets the path where azdata tool is installed
	 */
	public async getPath(): Promise<string> {
		return this._path;
	}

	public arc = {
		dc: {
			create: (
				namespace: string,
				name: string,
				connectivityMode: string,
				resourceGroup: string,
				location: string,
				subscription: string,
				profileName?: string,
				storageClass?: string,
				additionalEnvVars?: azdataExt.AdditionalEnvVars,
				azdataContext?: string): Promise<azdataExt.AzdataOutput<void>> => {
				const args = ['arc', 'dc', 'create',
					'--namespace', namespace,
					'--name', name,
					'--connectivity-mode', connectivityMode,
					'--resource-group', resourceGroup,
					'--location', location,
					'--subscription', subscription];
				if (profileName) {
					args.push('--profile-name', profileName);
				}
				if (storageClass) {
					args.push('--storage-class', storageClass);
				}
				return this.executeCommand<void>(args, additionalEnvVars, azdataContext);
			},
			endpoint: {
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.DcEndpointListResult[]>> => {
					return this.executeCommand<azdataExt.DcEndpointListResult[]>(['arc', 'dc', 'endpoint', 'list'], additionalEnvVars, azdataContext);
				}
			},
			config: {
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.DcConfigListResult[]>> => {
					return this.executeCommand<azdataExt.DcConfigListResult[]>(['arc', 'dc', 'config', 'list'], additionalEnvVars, azdataContext);
				},
				show: (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.DcConfigShowResult>> => {
					return this.executeCommand<azdataExt.DcConfigShowResult>(['arc', 'dc', 'config', 'show'], additionalEnvVars, azdataContext);
				}
			}
		},
		postgres: {
			server: {
				delete: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<void>> => {
					return this.executeCommand<void>(['arc', 'postgres', 'server', 'delete', '-n', name, '--force'], additionalEnvVars, azdataContext);
				},
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerListResult[]>> => {
					return this.executeCommand<azdataExt.PostgresServerListResult[]>(['arc', 'postgres', 'server', 'list'], additionalEnvVars, azdataContext);
				},
				show: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerShowResult>> => {
					return this.executeCommand<azdataExt.PostgresServerShowResult>(['arc', 'postgres', 'server', 'show', '-n', name], additionalEnvVars, azdataContext);
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
					additionalEnvVars?: azdataExt.AdditionalEnvVars,
					azdataContext?: string): Promise<azdataExt.AzdataOutput<void>> => {
					const argsArray = ['arc', 'postgres', 'server', 'edit', '-n', name];
					if (args.adminPassword) { argsArray.push('--admin-password'); }
					if (args.coresLimit) { argsArray.push('--cores-limit', args.coresLimit); }
					if (args.coresRequest) { argsArray.push('--cores-request', args.coresRequest); }
					if (args.coordinatorEngineSettings) { argsArray.push('--coordinator-engine-settings', args.coordinatorEngineSettings); }
					if (args.engineSettings) { argsArray.push('--engine-settings', args.engineSettings); }
					if (args.extensions) { argsArray.push('--extensions', args.extensions); }
					if (args.memoryLimit) { argsArray.push('--memory-limit', args.memoryLimit); }
					if (args.memoryRequest) { argsArray.push('--memory-request', args.memoryRequest); }
					if (args.noWait) { argsArray.push('--no-wait'); }
					if (args.port) { argsArray.push('--port', args.port.toString()); }
					if (args.replaceEngineSettings) { argsArray.push('--replace-engine-settings'); }
					if (args.workerEngineSettings) { argsArray.push('--worker-engine-settings', args.workerEngineSettings); }
					if (args.workers !== undefined) { argsArray.push('--workers', args.workers.toString()); }
					return this.executeCommand<void>(argsArray, additionalEnvVars, azdataContext);
				}
			}
		},
		sql: {
			mi: {
				delete: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<void>> => {
					return this.executeCommand<void>(['arc', 'sql', 'mi', 'delete', '-n', name], additionalEnvVars, azdataContext);
				},
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiListResult[]>> => {
					return this.executeCommand<azdataExt.SqlMiListResult[]>(['arc', 'sql', 'mi', 'list'], additionalEnvVars, azdataContext);
				},
				show: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiShowResult>> => {
					return this.executeCommand<azdataExt.SqlMiShowResult>(['arc', 'sql', 'mi', 'show', '-n', name], additionalEnvVars, azdataContext);
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
					additionalEnvVars?: azdataExt.AdditionalEnvVars
				): Promise<azdataExt.AzdataOutput<void>> => {
					const argsArray = ['arc', 'sql', 'mi', 'edit', '-n', name];
					if (args.coresLimit) { argsArray.push('--cores-limit', args.coresLimit); }
					if (args.coresRequest) { argsArray.push('--cores-request', args.coresRequest); }
					if (args.memoryLimit) { argsArray.push('--memory-limit', args.memoryLimit); }
					if (args.memoryRequest) { argsArray.push('--memory-request', args.memoryRequest); }
					if (args.noWait) { argsArray.push('--no-wait'); }
					return this.executeCommand<void>(argsArray, additionalEnvVars);
				}
			}
		}
	};

	public async login(endpointOrNamespace: azdataExt.EndpointOrNamespace, username: string, password: string, additionalEnvVars: azdataExt.AdditionalEnvVars = {}, azdataContext?: string): Promise<azdataExt.AzdataOutput<void>> {
		const args = ['login', '-u', username];
		if (endpointOrNamespace.endpoint) {
			args.push('-e', endpointOrNamespace.endpoint);
		} else if (endpointOrNamespace.namespace) {
			args.push('--namespace', endpointOrNamespace.namespace);
		} else {
			throw new Error(loc.endpointOrNamespaceRequired);
		}
		return this.executeCommand<void>(args, Object.assign({}, additionalEnvVars, { 'AZDATA_PASSWORD': password }), azdataContext);
	}

	/**
	 * Gets the output of running '--version' command on the azdata tool.
	 * It also updates the cachedVersion property based on the return value from the tool.
	 */
	public async version(): Promise<azdataExt.AzdataOutput<string>> {
		const output = await executeAzdataCommand(`"${this._path}"`, ['--version']);
		this._semVersion = new SemVer(parseVersion(output.stdout));
		return {
			logs: [],
			stdout: output.stdout.split(os.EOL),
			stderr: output.stderr.split(os.EOL),
			result: output.stdout
		};
	}

	/**
	 * Executes the specified azdata command.
	 * @param args The args to pass to azdata
	 * @param additionalEnvVars Additional environment variables to set for this execution
	 */
	public async executeCommand<R>(args: string[], additionalEnvVars?: azdataExt.AdditionalEnvVars, azdataContext?: string): Promise<azdataExt.AzdataOutput<R>> {
		try {
			if (azdataContext) {
				args = args.concat('--controller-context', azdataContext);
			}
			const output = JSON.parse((await executeAzdataCommand(`"${this._path}"`, args.concat(['--output', 'json']), additionalEnvVars)).stdout);
			return {
				logs: <string[]>output.log,
				stdout: <string[]>output.stdout,
				stderr: <string[]>output.stderr,
				result: <R>output.result
			};
		} catch (err) {
			if (err instanceof ExitCodeError) {
				try {
					// For azdata internal errors the output is JSON and so we need to do some extra parsing here
					// to get the correct stderr out. The actual value we get is something like
					// ERROR: { stderr: '...' }
					// so we also need to trim off the start that isn't a valid JSON blob
					err.stderr = JSON.parse(err.stderr.substring(err.stderr.indexOf('{'), err.stderr.indexOf('}') + 1)).stderr;
				} catch {
					// it means this was probably some other generic error (such as command not being found)
					// check if azdata still exists if it does then rethrow the original error if not then emit a new specific error.
					try {
						await fs.promises.access(this._path);
						//this.path exists
					} catch (e) {
						// this.path does not exist
						await vscode.commands.executeCommand('setContext', azdataFound, false);
						throw new NoAzdataError();
					}
					throw err; // rethrow the original error
				}

			}
			throw err;
		}
	}
}

export type AzdataDarwinPackageVersionInfo = {
	versions: {
		stable: string,
		devel: string,
		head: string,
		bottle: boolean
	}
};

/**
 * Finds the existing installation of azdata, or throws an error if it couldn't find it
 * or encountered an unexpected error.
 * The promise is rejected when Azdata is not found.
 */
export async function findAzdata(): Promise<IAzdataTool> {
	Logger.log(loc.searchingForAzdata);
	try {
		const azdata = await findSpecificAzdata();
		await vscode.commands.executeCommand('setContext', azdataFound, true); // save a context key that azdata was found so that command for installing azdata is no longer available in commandPalette and that for updating it is.
		Logger.log(loc.foundExistingAzdata(await azdata.getPath(), (await azdata.getSemVersion()).raw));
		return azdata;
	} catch (err) {
		Logger.log(loc.couldNotFindAzdata(err));
		Logger.log(loc.noAzdata);
		await vscode.commands.executeCommand('setContext', azdataFound, false);// save a context key that azdata was not found so that command for installing azdata is available in commandPalette and that for updating it is no longer available.
		throw err;
	}
}

/**
 * runs the commands to install azdata, downloading the installation package if needed
 */
export async function installAzdata(): Promise<void> {
	Logger.show();
	Logger.log(loc.installingAzdata);
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: loc.installingAzdata,
			cancellable: false
		},
		async (_progress, _token): Promise<void> => {
			switch (process.platform) {
				case 'win32':
					await downloadAndInstallAzdataWin32();
					break;
				case 'darwin':
					await installAzdataDarwin();
					break;
				case 'linux':
					await installAzdataLinux();
					break;
				default:
					throw new Error(loc.platformUnsupported(process.platform));
			}
		}
	);
}

/**
 * Updates the azdata using os appropriate method
 */
async function updateAzdata(version: string): Promise<boolean> {
	try {
		Logger.show();
		Logger.log(loc.updatingAzdata);
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: loc.updatingAzdata,
				cancellable: false
			},
			async (_progress, _token): Promise<void> => {
				switch (process.platform) {
					case 'win32':
						await downloadAndInstallAzdataWin32();
						break;
					case 'darwin':
						await updateAzdataDarwin();
						break;
					case 'linux':
						await installAzdataLinux();
						break;
					default:
						throw new Error(loc.platformUnsupported(process.platform));
				}
			}
		);
		vscode.window.showInformationMessage(loc.azdataUpdated(version));
		Logger.log(loc.azdataUpdated(version));
		return true;
	} catch (err) {
		// Windows: 1602 is User cancelling installation/update - not unexpected so don't display
		if (!(err instanceof ExitCodeError) || err.code !== 1602) {
			vscode.window.showWarningMessage(loc.updateError(err));
			Logger.log(loc.updateError(err));
		}
	}
	return false;
}

/**
 * Checks whether azdata is installed - and if it is not then invokes the process of azdata installation.
 * @param userRequested true means that this operation by was requested by a user by executing an ads command.
 */
export async function checkAndInstallAzdata(userRequested: boolean = false): Promise<IAzdataTool | undefined> {
	try {
		return await findAzdata(); // find currently installed Azdata
	} catch (err) {
		// Calls will be made to handle azdata not being installed if user declines to install on the prompt
		if (await promptToInstallAzdata(userRequested)) {
			return await findAzdata();
		}
	}
	return undefined;
}

/**
 * Checks whether a newer version of azdata is available - and if it is then invokes the process of azdata update.
 * @param currentAzdata The current version of azdata to check against
 * @param userRequested true means that this operation by was requested by a user by executing an ads command.
 * returns true if update was done and false otherwise.
 */
export async function checkAndUpdateAzdata(currentAzdata?: IAzdataTool, userRequested: boolean = false): Promise<boolean> {
	if (currentAzdata !== undefined) {
		const newSemVersion = await discoverLatestAvailableAzdataVersion();
		const currentSemVersion = await currentAzdata.getSemVersion();
		Logger.log(loc.foundAzdataVersionToUpdateTo(newSemVersion.raw, currentSemVersion.raw));
		if (MIN_AZDATA_VERSION.compare(currentSemVersion) === 1) {
			if (newSemVersion.compare(MIN_AZDATA_VERSION) >= 0) {
				return await promptToUpdateAzdata(newSemVersion.raw, userRequested, true);
			} else {
				// This should never happen - it means that the currently available version to download
				// is < the version we require. If this was to happen it'd imply something is wrong with
				// the version JSON or the minimum required version.
				// Regardless, there's nothing we can do and so we just bail out at this point and tell the user
				// they have to install it manually (hopefully it's available and wasn't a publishing mistake)
				vscode.window.showInformationMessage(loc.requiredVersionNotAvailable(MIN_AZDATA_VERSION.raw, newSemVersion.raw));
				Logger.log(loc.requiredVersionNotAvailable(newSemVersion.raw, currentSemVersion.raw));
			}
		}
		else if (newSemVersion.compare(currentSemVersion) === 1) {
			return await promptToUpdateAzdata(newSemVersion.raw, userRequested);
		} else {
			Logger.log(loc.currentlyInstalledVersionIsLatest((await currentAzdata.getSemVersion()).raw));
		}
	} else {
		Logger.log(loc.updateCheckSkipped);
		Logger.log(loc.noAzdata);
		await vscode.commands.executeCommand('setContext', azdataFound, false);
	}
	return false;
}

/**
 * prompt user to install Azdata.
 * @param userRequested - if true this operation was requested in response to a user issued command, if false it was issued at startup by system
 * returns true if installation was done and false otherwise.
 */
async function promptToInstallAzdata(userRequested: boolean = false): Promise<boolean> {
	let response: string | undefined = loc.yes;
	const config = <AzdataDeployOption>getConfig(azdataInstallKey);
	if (userRequested) {
		Logger.show();
		Logger.log(loc.userRequestedInstall);
	}
	if (config === AzdataDeployOption.dontPrompt && !userRequested) {
		Logger.log(loc.skipInstall(config));
		return false;
	}
	const responses = userRequested
		? [loc.yes, loc.no]
		: [loc.yes, loc.askLater, loc.doNotAskAgain];
	if (config === AzdataDeployOption.prompt) {
		Logger.log(loc.promptForAzdataInstallLog);
		response = await vscode.window.showErrorMessage(loc.promptForAzdataInstall, ...responses);
		Logger.log(loc.userResponseToInstallPrompt(response));
	}
	if (response === loc.doNotAskAgain) {
		await setConfig(azdataInstallKey, AzdataDeployOption.dontPrompt);
	} else if (response === loc.yes) {
		try {
			await installAzdata();
			vscode.window.showInformationMessage(loc.azdataInstalled);
			Logger.log(loc.azdataInstalled);
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
 * prompt user to update Azdata.
 * @param newVersion - provides the new version that the user will be prompted to update to
 * @param userRequested - if true this operation was requested in response to a user issued command, if false it was issued at startup by system
 * returns true if update was done and false otherwise.
 * @param required - Whether this update is required. If true then we will always show the prompt and warn the user if they decline it
 */
async function promptToUpdateAzdata(newVersion: string, userRequested: boolean = false, required = false): Promise<boolean> {
	if (required) {
		let response: string | undefined = loc.yes;
		const config = <AzdataDeployOption>getConfig(azdatarequiredUpdateKey);
		if (userRequested) {
			Logger.show();
			Logger.log(loc.userRequestedUpdate);
		}
		if (config === AzdataDeployOption.dontPrompt && !userRequested) {
			Logger.log(loc.skipRequiredUpdate(config));
			return false;
		}
		const responses = userRequested
			? [loc.yes, loc.no]
			: [loc.yes, loc.askLater, loc.doNotAskAgain];
		Logger.log(loc.promptForRequiredAzdataUpdateLog(MIN_AZDATA_VERSION.raw, newVersion));
		response = await vscode.window.showInformationMessage(loc.promptForRequiredAzdataUpdate(MIN_AZDATA_VERSION.raw, newVersion), ...responses);
		Logger.log(loc.userResponseToUpdatePrompt(response));
		if (response === loc.doNotAskAgain) {
			await setConfig(azdatarequiredUpdateKey, AzdataDeployOption.dontPrompt);
		} else if (response === loc.yes) {
			return updateAzdata(newVersion);
		} else {
			vscode.window.showWarningMessage(loc.missingRequiredVersion(MIN_AZDATA_VERSION.raw));
		}
	} else {
		let response: string | undefined = loc.yes;
		const config = <AzdataDeployOption>getConfig(azdataUpdateKey);
		if (userRequested) {
			Logger.show();
			Logger.log(loc.userRequestedUpdate);
		}
		if (config === AzdataDeployOption.dontPrompt && !userRequested) {
			Logger.log(loc.skipUpdate(config));
			return false;
		}
		const responses = userRequested
			? [loc.yes, loc.no]
			: [loc.yes, loc.askLater, loc.doNotAskAgain];
		if (config === AzdataDeployOption.prompt) {
			Logger.log(loc.promptForAzdataUpdateLog(newVersion));
			response = await vscode.window.showInformationMessage(loc.promptForAzdataUpdate(newVersion), ...responses);
			Logger.log(loc.userResponseToUpdatePrompt(response));
		}
		if (response === loc.doNotAskAgain) {
			await setConfig(azdataUpdateKey, AzdataDeployOption.dontPrompt);
		} else if (response === loc.yes) {
			return updateAzdata(newVersion);
		}
	}
	return false;
}

/**
 *	Returns true if Eula has been accepted.
 *
 * @param memento The memento that stores the eulaAccepted state
 */
export function isEulaAccepted(memento: vscode.Memento): boolean {
	return !!memento.get<boolean>(eulaAccepted);
}

/**
 * Prompts user to accept EULA. Stores and returns the user response to EULA prompt.
 * @param memento - memento where the user response is stored.
 * @param userRequested - if true this operation was requested in response to a user issued command, if false it was issued at startup by system
 * @param requireUserAction - if the prompt is required to be acted upon by the user. This is typically 'true' when this method is called to address an Error when the EULA needs to be accepted to proceed.
 * pre-requisite, the calling code has to ensure that the eula has not yet been previously accepted by the user.
 * returns true if the user accepted the EULA.
 */
export async function promptForEula(memento: vscode.Memento, userRequested: boolean = false, requireUserAction: boolean = false): Promise<boolean> {
	let response: string | undefined = loc.no;
	const config = <AzdataDeployOption>getConfig(azdataAcceptEulaKey);
	if (userRequested) {
		Logger.show();
		Logger.log(loc.userRequestedAcceptEula);
	}
	const responses = userRequested
		? [loc.accept, loc.decline]
		: [loc.accept, loc.askLater, loc.doNotAskAgain];
	if (config === AzdataDeployOption.prompt || userRequested) {
		Logger.show();
		Logger.log(loc.promptForEulaLog(microsoftPrivacyStatementUrl, eulaUrl));
		response = requireUserAction
			? await vscode.window.showErrorMessage(loc.promptForEula(microsoftPrivacyStatementUrl, eulaUrl), ...responses)
			: await vscode.window.showInformationMessage(loc.promptForEula(microsoftPrivacyStatementUrl, eulaUrl), ...responses);
		Logger.log(loc.userResponseToEulaPrompt(response));
	}
	if (response === loc.doNotAskAgain) {
		await setConfig(azdataAcceptEulaKey, AzdataDeployOption.dontPrompt);
	} else if (response === loc.accept) {
		await memento.update(eulaAccepted, true); // save a memento that eula was accepted
		await vscode.commands.executeCommand('setContext', eulaAccepted, true); // save a context key that eula was accepted so that command for accepting eula is no longer available in commandPalette
		return true;
	}
	return false;
}

/**
 * Downloads the Windows installer and runs it
 */
async function downloadAndInstallAzdataWin32(): Promise<void> {
	const downLoadLink = await getPlatformDownloadLink();
	const downloadFolder = os.tmpdir();
	const downloadLogs = path.join(downloadFolder, 'ads_azdata_install_logs.log');
	const downloadedFile = await HttpClient.downloadFile(downLoadLink, downloadFolder);

	try {
		await executeSudoCommand(`msiexec /qn /i "${downloadedFile}" /lvx "${downloadLogs}"`);
	} catch (err) {
		throw new Error(`${err.message}. See logs at ${downloadLogs} for more details.`);
	}
}

/**
 * Runs commands to install azdata on MacOS
 */
async function installAzdataDarwin(): Promise<void> {
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release']);
	await executeCommand('brew', ['update']);
	await executeCommand('brew', ['install', 'azdata-cli']);
}

/**
 * Runs commands to update azdata on MacOS
 */
async function updateAzdataDarwin(): Promise<void> {
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release']);
	await executeCommand('brew', ['update']);
	await executeCommand('brew', ['upgrade', 'azdata-cli']);
}

/**
 * Runs commands to install azdata on Linux
 */
async function installAzdataLinux(): Promise<void> {
	// https://docs.microsoft.com/en-us/sql/big-data-cluster/deploy-install-azdata-linux-package
	// Get packages needed for install process
	await executeSudoCommand('apt-get update');
	await executeSudoCommand('apt-get install gnupg ca-certificates curl wget software-properties-common apt-transport-https lsb-release -y');
	// Download and install the signing key
	await executeSudoCommand('curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc.gpg > /dev/null');
	// Add the azdata repository information
	const release = (await executeCommand('lsb_release', ['-rs'])).stdout.trim();
	await executeSudoCommand(`add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/${release}/mssql-server-2019.list)"`);
	// Update repository information and install azdata
	await executeSudoCommand('apt-get update');
	await executeSudoCommand('apt-get install -y azdata-cli');
}

/**
 */
async function findSpecificAzdata(): Promise<IAzdataTool> {
	const path = await ((process.platform === 'win32') ? searchForCmd('azdata.cmd') : searchForCmd('azdata'));
	const versionOutput = await executeAzdataCommand(`"${path}"`, ['--version']);
	return new AzdataTool(path, parseVersion(versionOutput.stdout));
}

function getConfig(key: string): AzdataDeployOption | undefined {
	const config = vscode.workspace.getConfiguration(azdataConfigSection);
	const value = <AzdataDeployOption>config.get<AzdataDeployOption>(key);
	Logger.log(loc.azdataUserSettingRead(key, value));
	return value;
}

async function setConfig(key: string, value: string): Promise<void> {
	const config = vscode.workspace.getConfiguration(azdataConfigSection);
	await config.update(key, value, vscode.ConfigurationTarget.Global);
	Logger.log(loc.azdataUserSettingUpdated(key, value));
}

/**
 * Gets the latest azdata version available for a given platform
 */
export async function discoverLatestAvailableAzdataVersion(): Promise<SemVer> {
	Logger.log(loc.checkingLatestAzdataVersion);
	switch (process.platform) {
		case 'darwin':
			return await discoverLatestStableAzdataVersionDarwin();
		// case 'linux':
		// ideally we would not to discover linux package availability using the apt/apt-get/apt-cache package manager commands.
		// However, doing discovery that way required apt update to be performed which requires sudo privileges. At least currently this code path
		// gets invoked on extension start up and prompt user for sudo privileges is annoying at best. So for now basing linux discovery also on a releaseJson file.
		default:
			return await getPlatformReleaseVersion();
	}
}

/**
 * Parses out the azdata version from the raw azdata version output
 * @param raw The raw version output from azdata --version
 */
function parseVersion(raw: string): string {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation, with the first line being the version of azdata itself.
	const lines = raw.split(os.EOL);
	return lines[0].trim();
}

/**
 * Gets the latest azdata version for MacOs clients
 */
async function discoverLatestStableAzdataVersionDarwin(): Promise<SemVer> {
	// set brew tap to azdata-cli repository
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release']);
	await executeCommand('brew', ['update']);
	let brewInfoAzdataCliJson;
	// Get the package version 'info' about 'azdata-cli' from 'brew' as a json object
	const brewInfoOutput = (await executeCommand('brew', ['info', 'azdata-cli', '--json'])).stdout;
	try {
		brewInfoAzdataCliJson = JSON.parse(brewInfoOutput);
	} catch (e) {
		throw Error(`failed to parse the JSON contents output of: 'brew info azdata-cli --json', text being parsed: '${brewInfoOutput}', error:${getErrorMessage(e)}`);
	}
	// Get the 'info' about 'azdata-cli' from 'brew' as a json object
	const azdataPackageVersionInfo: AzdataDarwinPackageVersionInfo = brewInfoAzdataCliJson.shift();
	Logger.log(loc.latestAzdataVersionAvailable(azdataPackageVersionInfo.versions.stable));
	return new SemVer(azdataPackageVersionInfo.versions.stable);
}

async function executeAzdataCommand(command: string, args: string[], additionalEnvVars: azdataExt.AdditionalEnvVars = {}): Promise<ProcessOutput> {
	additionalEnvVars = Object.assign(additionalEnvVars, { 'ACCEPT_EULA': 'yes' });
	const debug = vscode.workspace.getConfiguration(azdataConfigSection).get(debugConfigKey);
	if (debug) {
		args.push('--debug');
	}
	return executeCommand(command, args, additionalEnvVars);
}

/**
 * Gets the latest azdata version for linux clients
 * This method requires sudo permission so not suitable to be run during startup.
 */
// async function discoverLatestStableAzdataVersionLinux(): Promise<SemVer> {
// 	// Update repository information and install azdata
// 	await executeSudoCommand('apt-get update');
// 	const output = (await executeCommand('apt', ['list', 'azdata-cli', '--upgradeable'])).stdout;
// 	// the packageName (with version) string is the second space delimited token on the 2nd line
// 	const packageName = output.split('\n')[1].split(' ')[1];
// 	// the version string is the first part of the package sting before '~'
// 	const version = packageName.split('~')[0];
// 	Logger.log(loc.latestAzdataVersionAvailable(version));
// 	return new SemVer(version);
// }
