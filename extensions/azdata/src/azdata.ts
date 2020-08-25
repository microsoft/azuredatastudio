/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from 'vscode';
import { HttpClient } from './common/httpClient';
import * as loc from './localizedConstants';
import { executeCommand, executeSudoCommand, ExitCodeError } from './common/childProcess';
import { searchForCmd } from './common/utils';
import * as azdataExt from 'azdata-ext';
import Logger from './common/logger';

export const azdataHostname = 'https://aka.ms';
export const azdataUri = 'azdata-msi';

export interface IAzdataTool extends azdataExt.IAzdataApi {
	path: string,
	toolVersion: string,
	/**
	 * Executes azdata with the specified arguments (e.g. --version) and returns the result
	 * @param args The args to pass to azdata
	 * @param parseResult A function used to parse out the raw result into the desired shape
	 */
	executeCommand<R>(args: string[], additionalEnvVars?: { [key: string]: string }): Promise<azdataExt.AzdataOutput<R>>
}

class AzdataTool implements IAzdataTool {
	constructor(public path: string, public toolVersion: string) { }

	public arc = {
		dc: {
			create: async (namespace: string, name: string, connectivityMode: string, resourceGroup: string, location: string, subscription: string, profileName?: string, storageClass?: string): Promise<azdataExt.AzdataOutput<void>> => {
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
				return this.executeCommand<void>(args);
			},
			endpoint: {
				list: async () => {
					return this.executeCommand<azdataExt.DcEndpointListResult[]>(['arc', 'dc', 'endpoint', 'list']);
				}
			},
			config: {
				list: async () => {
					return this.executeCommand<azdataExt.DcConfigListResult[]>(['arc', 'dc', 'config', 'list']);
				},
				show: async () => {
					return this.executeCommand<azdataExt.DcConfigShowResult>(['arc', 'dc', 'config', 'show']);
				}
			}
		},
		postgres: {
			server: {
				list: async () => {
					return this.executeCommand<azdataExt.PostgresServerListResult[]>(['arc', 'postgres', 'server', 'list']);
				},
				show: async (name: string) => {
					return this.executeCommand<azdataExt.PostgresServerShowResult>(['arc', 'postgres', 'server', 'show', '-n', name]);
				}
			}
		},
		sql: {
			mi: {
				delete: async (name: string) => {
					return this.executeCommand<void>(['arc', 'sql', 'mi', 'delete', '-n', name]);
				},
				list: async () => {
					return this.executeCommand<azdataExt.SqlMiListResult[]>(['arc', 'sql', 'mi', 'list']);
				},
				show: async (name: string) => {
					return this.executeCommand<azdataExt.SqlMiShowResult>(['arc', 'sql', 'mi', 'show', '-n', name]);
				}
			}
		}
	};

	public async login(endpoint: string, username: string, password: string): Promise<azdataExt.AzdataOutput<void>> {
		return this.executeCommand<void>(['login', '-e', endpoint, '-u', username], { 'AZDATA_PASSWORD': password });
	}

	public async version(): Promise<azdataExt.AzdataOutput<string>> {
		const output = await this.executeCommand<string>(['--version']);
		this.toolVersion = parseVersion(output.stdout[0]);
		return output;
	}

	public async executeCommand<R>(args: string[], additionalEnvVars?: { [key: string]: string }): Promise<azdataExt.AzdataOutput<R>> {
		try {
			const output = JSON.parse((await executeCommand(`"${this.path}"`, args.concat(['--output', 'json']), additionalEnvVars)).stdout);
			return {
				logs: <string[]>output.log,
				stdout: <string[]>output.stdout,
				stderr: <string[]>output.stderr,
				result: <R>output.result
			};
		} catch (err) {
			// Since the output is JSON we need to do some extra parsing here to get the correct stderr out.
			// The actual value we get is something like ERROR: { stderr: '...' } so we also need to trim
			// off the start that isn't a valid JSON blob
			if (err instanceof ExitCodeError) {
				err.stderr = JSON.parse(err.stderr.substring(err.stderr.indexOf('{'))).stderr;
			}
			throw err;
		}
	}
}

/**
 * Finds the existing installation of azdata, or throws an error if it couldn't find it
 * or encountered an unexpected error.
 */
export async function findAzdata(): Promise<IAzdataTool> {
	Logger.log(loc.searchingForAzdata);
	try {
		let azdata: IAzdataTool | undefined = undefined;
		switch (process.platform) {
			case 'win32':
				azdata = await findAzdataWin32();
				break;
			default:
				azdata = await findSpecificAzdata('azdata');
		}
		Logger.log(loc.foundExistingAzdata(azdata.path, azdata.toolVersion));
		return azdata;
	} catch (err) {
		Logger.log(loc.couldNotFindAzdata(err));
		throw err;
	}
}

/**
 * Downloads the appropriate installer and/or runs the command to install azdata
 */
export async function downloadAndInstallAzdata(): Promise<void> {
	const statusDisposable = vscode.window.setStatusBarMessage(loc.installingAzdata);
	Logger.show();
	Logger.log(loc.installingAzdata);
	try {
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
	} finally {
		statusDisposable.dispose();
	}
}

/**
 * Downloads the Windows installer and runs it
 */
async function downloadAndInstallAzdataWin32(): Promise<void> {
	const downloadFolder = os.tmpdir();
	const downloadedFile = await HttpClient.download(`${azdataHostname}/${azdataUri}`, downloadFolder);
	await executeCommand('msiexec', ['/qn', '/i', downloadedFile]);
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
 * Finds azdata specifically on Windows
 */
async function findAzdataWin32(): Promise<IAzdataTool> {
	const promise = searchForCmd('azdata.cmd');
	return findSpecificAzdata(await promise);
}

/**
 * Gets the version using a known azdata path
 * @param path The path to the azdata executable
 */
async function findSpecificAzdata(path: string): Promise<IAzdataTool> {
	const versionOutput = await executeCommand(`"${path}"`, ['--version']);
	return new AzdataTool(path, parseVersion(versionOutput.stdout));
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
