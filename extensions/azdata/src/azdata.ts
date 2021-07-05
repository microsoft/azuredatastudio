/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as fs from 'fs';
import * as os from 'os';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, ExitCodeError, ProcessOutput } from './common/childProcess';
import Logger from './common/logger';
import { NoAzdataError, searchForCmd } from './common/utils';
import { azdataConfigSection, azdataFound, debugConfigKey } from './constants';
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
	executeCommand<R>(args: string[], additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<R>>
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
				additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<void>> => {
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
				return this.executeCommand<void>(args, additionalEnvVars);
			},
			endpoint: {
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.DcEndpointListResult[]>> => {
					return this.executeCommand<azdataExt.DcEndpointListResult[]>(['arc', 'dc', 'endpoint', 'list'], additionalEnvVars);
				}
			},
			config: {
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.DcConfigListResult[]>> => {
					return this.executeCommand<azdataExt.DcConfigListResult[]>(['arc', 'dc', 'config', 'list'], additionalEnvVars);
				},
				show: (additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.DcConfigShowResult>> => {
					return this.executeCommand<azdataExt.DcConfigShowResult>(['arc', 'dc', 'config', 'show'], additionalEnvVars);
				}
			}
		},
		postgres: {
			server: {
				delete: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<void>> => {
					return this.executeCommand<void>(['arc', 'postgres', 'server', 'delete', '-n', name, '--force'], additionalEnvVars);
				},
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerListResult[]>> => {
					return this.executeCommand<azdataExt.PostgresServerListResult[]>(['arc', 'postgres', 'server', 'list'], additionalEnvVars);
				},
				show: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.PostgresServerShowResult>> => {
					return this.executeCommand<azdataExt.PostgresServerShowResult>(['arc', 'postgres', 'server', 'show', '-n', name], additionalEnvVars);
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
					additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<void>> => {
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
					return this.executeCommand<void>(argsArray, additionalEnvVars);
				}
			}
		},
		sql: {
			mi: {
				delete: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<void>> => {
					return this.executeCommand<void>(['arc', 'sql', 'mi', 'delete', '-n', name], additionalEnvVars);
				},
				list: (additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiListResult[]>> => {
					return this.executeCommand<azdataExt.SqlMiListResult[]>(['arc', 'sql', 'mi', 'list'], additionalEnvVars);
				},
				show: (name: string, additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<azdataExt.SqlMiShowResult>> => {
					return this.executeCommand<azdataExt.SqlMiShowResult>(['arc', 'sql', 'mi', 'show', '-n', name], additionalEnvVars);
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
	public async executeCommand<R>(args: string[], additionalEnvVars?: azdataExt.AdditionalEnvVars): Promise<azdataExt.AzdataOutput<R>> {
		try {
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
		Logger.log(loc.foundExistingAzdata(await azdata.getPath(), (await azdata.getSemVersion()).raw));
		return azdata;
	} catch (err) {
		Logger.log(loc.couldNotFindAzdata(err));
		Logger.log(loc.noAzdata);
		throw err;
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

async function executeAzdataCommand(command: string, args: string[], additionalEnvVars: azdataExt.AdditionalEnvVars = {}): Promise<ProcessOutput> {
	additionalEnvVars = Object.assign(additionalEnvVars, { 'ACCEPT_EULA': 'yes' });
	const debug = vscode.workspace.getConfiguration(azdataConfigSection).get(debugConfigKey);
	if (debug) {
		args.push('--debug');
	}
	return executeCommand(command, args, additionalEnvVars);
}

/**
 */
async function findSpecificAzdata(): Promise<IAzdataTool> {
	const path = await ((process.platform === 'win32') ? searchForCmd('az.cmd') : searchForCmd('az'));
	const versionOutput = await executeAzdataCommand(`"${path}"`, ['--version']);
	return new AzdataTool(path, parseVersion(versionOutput.stdout));
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
