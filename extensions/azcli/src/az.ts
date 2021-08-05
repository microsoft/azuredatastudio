/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import * as fs from 'fs';
import * as os from 'os';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, ExitCodeError, ProcessOutput } from './common/childProcess';
import Logger from './common/logger';
import { NoAzureCLIError, searchForCmd } from './common/utils';
import { azArcdataInstallKey, azConfigSection, azFound, azArcdataUpdateKey, debugConfigKey, latestAzArcExtensionVersion, azCliInstallKey } from './constants';
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
 * Finds and returns the existing installation of Azure CLI, or throws an error and returns undefined if it
 * can't find an installed Azure CLI or encountered an unexpected error.
 */
export async function findAz(): Promise<IAzTool | undefined> {
	Logger.log(loc.searchingForAz);
	try {
		const az = await findAzAndCheckArcdata();
		Logger.log(loc.foundExistingAz(await az.getPath(), (await az.getSemVersionAz()).raw));
		return az;
	} catch (err) {
		Logger.log(loc.noAzureCLI);
		return undefined;
	}
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
	const exp = new RegExp(/azure-cli\s*(\d*.\d*.\d*)/);
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
	const exp = new RegExp(/arcdata\s*(\d*.\d*.\d*)/);
	return exp.exec(raw)?.pop();
}

async function executeAzCommand(command: string, args: string[], additionalEnvVars: azExt.AdditionalEnvVars = {}): Promise<ProcessOutput> {
	const debug = vscode.workspace.getConfiguration(azConfigSection).get(debugConfigKey);
	if (debug) {
		args.push('--debug');
	}
	return executeCommand(command, args, additionalEnvVars);
}

function getConfig(key: string): AzDeployOption | undefined {
	const config = vscode.workspace.getConfiguration(azConfigSection);
	const value = <AzDeployOption>config.get<AzDeployOption>(key);
	return value;
}

async function setConfig(key: string, value: string): Promise<void> {
	const config = vscode.workspace.getConfiguration(azConfigSection);
	await config.update(key, value, vscode.ConfigurationTarget.Global);
}

/**
 * Finds and returns the user's locally installed Azure CLI tool. Checks to see if arcdata extension is
 * installed and updated. If no Azure CLI is found, error will be thrown.
 */
export async function findAzAndCheckArcdata(): Promise<IAzTool> {
	let response: string | undefined;
	const responses = [loc.askLater, loc.doNotAskAgain];
	let path = undefined;

	try {
		path = await ((process.platform === 'win32') ? searchForCmd('az.cmd') : searchForCmd('az'));
	} catch (err) {
		// If no Azure CLI was found, prompt to install
		const azInstallNeededConfig = <AzDeployOption>getConfig(azCliInstallKey);
		if (azInstallNeededConfig !== AzDeployOption.dontPrompt) {
			response = await vscode.window.showErrorMessage(loc.noAzureCLI, ...responses);
			if (response === loc.doNotAskAgain) {
				await setConfig(azCliInstallKey, AzDeployOption.dontPrompt);
			}
		}
		throw err;
	}

	const versionOutput = await executeAzCommand(`"${path}"`, ['--version']);

	let azVersion = undefined;
	let arcVersion = undefined;
	try {
		azVersion = parseVersion(versionOutput.stdout);
		arcVersion = parseArcExtensionVersion(versionOutput.stdout);
	} catch (err) {
		Logger.log(loc.parseVersionError);
		throw err;
	}

	if (arcVersion === undefined) {
		// If no arcdata was found, prompt to install
		const arcInstallNeededConfig = <AzDeployOption>getConfig(azArcdataInstallKey);
		if (arcInstallNeededConfig !== AzDeployOption.dontPrompt) {
			response = await vscode.window.showInformationMessage(loc.arcdataExtensionNotInstalled, ...responses);
			if (response === loc.doNotAskAgain) {
				await setConfig(azArcdataInstallKey, AzDeployOption.dontPrompt);
			}
		}
	} else {
		// If arcdata was found, check if it's up to date
		const semVersion = new SemVer(<string>arcVersion);
		const arcUpdateNeededConfig = <AzDeployOption>getConfig(azArcdataUpdateKey);

		if (LATEST_AZ_ARC_EXTENSION_VERSION.compare(semVersion) === 1 && arcUpdateNeededConfig !== AzDeployOption.dontPrompt) {
			// If there is a greater version of arcdata extension available, prompt to update
			response = await vscode.window.showInformationMessage(loc.requiredArcDataVersionNotAvailable(latestAzArcExtensionVersion, <string>arcVersion), ...responses);
			if (response === loc.doNotAskAgain) {
				await setConfig(azArcdataUpdateKey, AzDeployOption.dontPrompt);
			}
		} else if (LATEST_AZ_ARC_EXTENSION_VERSION.compare(semVersion) === -1) {
			// Current version should not be greater than latest version
			vscode.window.showErrorMessage(loc.unsupportedArcDataVersion(latestAzArcExtensionVersion, <string>arcVersion));
		}
	}

	return new AzTool(path, <string>azVersion, <string>arcVersion);
}
