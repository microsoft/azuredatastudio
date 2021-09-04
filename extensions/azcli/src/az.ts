/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azExt from 'az-ext';
import * as os from 'os';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, ProcessOutput } from './common/childProcess';
import Logger from './common/logger';
import { AzureCLIArcExtError, searchForCmd } from './common/utils';
import { azConfigSection, debugConfigKey, latestAzArcExtensionVersion } from './constants';
import * as loc from './localizedConstants';

/**
 * The latest Az CLI arcdata extension version for this extension to function properly
 */
export const LATEST_AZ_ARC_EXTENSION_VERSION = new SemVer(latestAzArcExtensionVersion);

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

	private _semVersion: SemVer;

	constructor(private _path: string, version: string) {
		this._semVersion = new SemVer(version);
	}

	/**
	 * The semVersion corresponding to this installation of az. version() method should have been run
	 * before fetching this value to ensure that correct value is returned. This is almost always correct unless
	 * Az has gotten reinstalled in the background after this IAzApi object was constructed.
	 */
	public async getSemVersion(): Promise<SemVer> {
		return this._semVersion;
	}

	/**
	 * gets the path where az tool is installed
	 */
	public async getPath(): Promise<string> {
		return this._path;
	}

	public arcdata = {
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
				additionalEnvVars?: azExt.AdditionalEnvVars): Promise<azExt.AzOutput<void>> => {
				const args = ['arcdata', 'dc', 'create',
					'--k8s-namespace', namespace,
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
				return this.executeCommand<void>(args, additionalEnvVars);
			},
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
		this._semVersion = new SemVer(parseVersion(output.stdout));
		return {
			stdout: output.stdout
			// stderr: output.stderr.split(os.EOL)
			// result: output.stdout
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
			const output = JSON.parse(result.stdout);
			return {
				stdout: <R>output
			};
		} catch (err) {
			throw err;
		}
	}
}

/**
 * Finds the existing installation of az, or throws an error if it couldn't find it
 * or encountered an unexpected error.
 * The promise is rejected when Az is not found.
 */
export async function findAz(): Promise<IAzTool> {
	Logger.log(loc.searchingForAz);
	try {
		const az = await findSpecificAz();
		Logger.log(loc.foundExistingAz(await az.getPath(), (await az.getSemVersion()).raw));
		return az;
	} catch (err) {
		Logger.log(loc.noAzureCLI);
		throw err;
	}
}

/**
 * Parses out the Azure CLI version from the raw az version output
 * @param raw The raw version output from az --version
 */
function parseVersion(raw: string): string {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation, with the first line holding the version of az itself.
	//
	// The output of az --version looks like:
	// azure-cli                         2.26.1
	// ...
	const start = raw.search('azure-cli');
	const end = raw.search('core');
	raw = raw.slice(start, end).replace('azure-cli', '');
	return raw.trim();
}

/**
 * Parses out the arcdata extension version from the raw az version output
 * @param raw The raw version output from az --version
 */
function parseArcExtensionVersion(raw: string): string {
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
	const start = raw.search('arcdata');
	if (start === -1) {
		vscode.window.showErrorMessage(loc.arcdataExtensionNotInstalled);
		throw new AzureCLIArcExtError();
	} else {
		raw = raw.slice(start + 7);
		raw = raw.split(os.EOL)[0].trim();
	}
	return raw.trim();
}

async function executeAzCommand(command: string, args: string[], additionalEnvVars: azExt.AdditionalEnvVars = {}): Promise<ProcessOutput> {
	const debug = vscode.workspace.getConfiguration(azConfigSection).get(debugConfigKey);
	if (debug) {
		args.push('--debug');
	}
	return executeCommand(command, args, additionalEnvVars);
}

/**
 */
async function findSpecificAz(): Promise<IAzTool> {
	const path = await ((process.platform === 'win32') ? searchForCmd('az.cmd') : searchForCmd('az'));
	const versionOutput = await executeAzCommand(`"${path}"`, ['--version']);
	const version = parseArcExtensionVersion(versionOutput.stdout);
	const semVersion = new SemVer(version);
	if (LATEST_AZ_ARC_EXTENSION_VERSION.compare(semVersion) === 1) {
		// If there is a greater version of az arc extension available, prompt to update
		vscode.window.showErrorMessage(loc.requiredArcDataVersionNotAvailable(latestAzArcExtensionVersion, version));
	} else if (LATEST_AZ_ARC_EXTENSION_VERSION.compare(semVersion) === -1) {
		// Current version should not be greater than latest version
		vscode.window.showErrorMessage(loc.unsupportedArcDataVersion(latestAzArcExtensionVersion, version));
	}
	return new AzTool(path, version);
}
