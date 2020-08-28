/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as os from 'os';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, executeSudoCommand, ExitCodeError } from './common/childProcess';
import { HttpClient } from './common/httpClient';
import Logger from './common/logger';
import { getErrorMessage, searchForCmd } from './common/utils';
import * as loc from './localizedConstants';

export const azdataHostname = 'https://aka.ms';
export const azdataUri = 'azdata-msi';
export const azdataReleaseJson = 'azdata/release.json';

/**
 * Interface for an object to interact with the azdata tool installed on the box.
 */
export interface IAzdataTool extends azdataExt.IAzdataApi {
	path: string,
	cachedVersion: SemVer

	/**
	 * Executes azdata with the specified arguments (e.g. --version) and returns the result
	 * @param args The args to pass to azdata
	 * @param parseResult A function used to parse out the raw result into the desired shape
	 */
	executeCommand<R>(args: string[], additionalEnvVars?: { [key: string]: string }): Promise<azdataExt.AzdataOutput<R>>
}

/**
 * An object to interact with the azdata tool installed on the box.
 */
export class AzdataTool implements IAzdataTool {
	public cachedVersion: SemVer;
	constructor(public path: string, version: string) {
		this.cachedVersion = new SemVer(version);
	}

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

	/**
	 * Gets the output of running '--version' command on the azdata tool.
	 * It also updates the cachedVersion property based on the return value from the tool.
	 */
	public async version(): Promise<azdataExt.AzdataOutput<string>> {
		const output = await executeCommand(`"${this.path}"`, ['--version']);
		this.cachedVersion = new SemVer(parseVersion(output.stdout));
		return {
			logs: [],
			stdout: output.stdout.split(os.EOL),
			stderr: output.stderr.split(os.EOL),
			result: ''
		};
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
		Logger.log(loc.foundExistingAzdata(azdata.path, azdata.cachedVersion.raw));
		return azdata;
	} catch (err) {
		Logger.log(loc.couldNotFindAzdata(err));
		throw err;
	}
}

/**
 * runs the commands to install azdata, downloading the installation package if needed
 */
export async function installAzdata(): Promise<void> {
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
		Logger.log(loc.azdataInstalled);
	} finally {
		statusDisposable.dispose();
	}
}

/**
 * Upgrades the azdata using os appropriate method
 */
export async function upgradeAzdata(): Promise<void> {
	const statusDisposable = vscode.window.setStatusBarMessage(loc.upgradingAzdata);
	Logger.show();
	Logger.log(loc.upgradingAzdata);
	try {
		switch (process.platform) {
			case 'win32':
				await downloadAndInstallAzdataWin32();
				break;
			case 'darwin':
				await upgradeAzdataDarwin();
				break;
			case 'linux':
				await installAzdataLinux();
				break;
			default:
				throw new Error(loc.platformUnsupported(process.platform));
		}
		Logger.log(loc.azdataUpgraded);
	} finally {
		statusDisposable.dispose();
	}
}

/**
 * Checks whether a newer version of azdata is available - and if it is prompts the user to download and
 * install it.
 * @param currentAzdata The current version of azdata to check . This function  is a no-o if currentAzdata is undefined.
 * returns true if an upgrade was performed and false otherwise.
 */
export async function checkAndUpgradeAzdata(currentAzdata: IAzdataTool | undefined): Promise<boolean> {
	if (currentAzdata !== undefined) {
		const newVersion = await discoverLatestAvailableAzdataVersion();
		if (newVersion.compare(currentAzdata.cachedVersion) === 1) {
			//update if available and user wants it.
			const response = await vscode.window.showInformationMessage(loc.promptForAzdataUpgrade(newVersion.raw), loc.yes, loc.no);
			if (response === loc.yes) {
				await upgradeAzdata();
				return true;
			}
		} else {
			Logger.log(loc.currentlyInstalledVersionIsLatest(newVersion.raw, currentAzdata.cachedVersion.raw));
		}
	} else {
		Logger.log(loc.upgradeCheckSkipped);
	}
	return false;
}


/**
 * Downloads the Windows installer and runs it
 */
async function downloadAndInstallAzdataWin32(): Promise<void> {
	const downloadFolder = os.tmpdir();
	const downloadedFile = await HttpClient.downloadFile(`${azdataHostname}/${azdataUri}`, downloadFolder);
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
 * Runs commands to upgrade azdata on MacOS
 */
async function upgradeAzdataDarwin(): Promise<void> {
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
	const promise = ((process.platform === 'win32') ? searchForCmd('azdata.cmd') : searchForCmd('azdata'));
	const path = `"${await promise}"`; // throws if azdata is not found
	const versionOutput = await executeCommand(`${path}`, ['--version']);
	return new AzdataTool(path, parseVersion(versionOutput.stdout));
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
			return await discoverLatestAzdataVersionFromJson();
	}
}

/**
 * Gets the latest azdata version from a json document published by azdata release
 */
async function discoverLatestAzdataVersionFromJson(): Promise<SemVer> {
	// get version information for current platform from http://aka.ms/azdata/release.json
	const fileContents = await HttpClient.getTextContent(`${azdataHostname}/${azdataReleaseJson}`);
	let azdataReleaseInfo;
	try {
		azdataReleaseInfo = JSON.parse(fileContents);
	} catch (e) {
		throw Error(`failed to parse the JSON of contents at: ${azdataHostname}/${azdataReleaseJson}, text being parsed: '${fileContents}', error:${getErrorMessage(e)}`);
	}
	const version = azdataReleaseInfo[process.platform]['version'];
	Logger.log(loc.latestAzdataVersionAvailable(version));
	return new SemVer(version);
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
	const azdataPackageVersionInfo: AzdataDarwinPackageVersionInfo = brewInfoAzdataCliJson.shift();
	Logger.log(loc.foundAzdataVersionToUpgradeTo(azdataPackageVersionInfo.versions.stable));
	return new SemVer(azdataPackageVersionInfo.versions.stable);
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
// 	Logger.log(loc.foundAzdataVersionToUpgradeTo(version));
// 	return new SemVer(version);
// }
