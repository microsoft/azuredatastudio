/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SemVer } from 'semver';
import * as vscode from 'vscode';
import * as which from 'which';
import { azdataHostname, AzdataLatestVersionInfo, azdataReleaseJson } from '../azdata';
import { HttpClient } from '../common/httpClient';
import * as loc from '../localizedConstants';
import { executeCommand, executeSudoCommand } from './childProcess';
/**
 * Searches for the first instance of the specified executable in the PATH environment variable
 * @param exe The executable to search for
 */
export function searchForCmd(exe: string): Promise<string> {
	// Note : This is separated out to allow for easy test stubbing
	return new Promise<string>((resolve, reject) => which(exe, (err, path) => err ? reject(err) : resolve(path)));
}

/**
 * Gets the latest azdata version available for a given platform
 * @param outputChannel Channel used to display diagnostic information
 */
export async function discoverLatestAvailableAzdataVersion(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	outputChannel.appendLine(loc.checkingLatestAzdataVersion);
	switch (process.platform) {
		case 'linux':
			return await discoverLatestStableAzdataVersionLinux(outputChannel);
		case 'darwin':
			return await discoverLatestStableAzdataVersionDarwin(outputChannel);
		default:
			return await discoverLatestAzdataVersionFromJson(outputChannel);
	}
}

/**
 * Gets the latest azdata version from a json document published by azdata release
 * @param outputChannel Channel used to display diagnostic information
 */
async function discoverLatestAzdataVersionFromJson(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	// get version information for current platform from http://aka.ms/azdata/release.json
	const fileContents = await HttpClient.getTextContent(`${azdataHostname}/${azdataReleaseJson}`, outputChannel);
	const versionString = JSON.parse(fileContents)[process.platform]['version'];
	return new SemVer(versionString);
}

/**
 * Gets the latest azdata version for MacOs clients
 * @param outputChannel Channel used to display diagnostic information
 */
async function discoverLatestStableAzdataVersionDarwin(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	// set brew tap to azdata-cli repository
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release'], outputChannel);
	// Get the 'info' about 'azdata-cli' from 'brew' as a json object
	const azdataInfo: AzdataLatestVersionInfo = (JSON.parse((await executeCommand('brew', ['info', 'azdata-cli', '--json'], outputChannel)).stdout)).shift();
	return new SemVer(azdataInfo.versions.stable);
}

/**
 * Gets the latest azdata version for linux clients
 * @param outputChannel Channel used to display diagnostic information
 */
async function discoverLatestStableAzdataVersionLinux(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	// https://docs.microsoft.com/en-us/sql/big-data-cluster/deploy-install-azdata-linux-package
	// Get packages needed for install process
	await executeSudoCommand('apt-get update', outputChannel);
	await executeSudoCommand('apt-get install gnupg ca-certificates curl wget software-properties-common apt-transport-https lsb-release -y', outputChannel);
	// Download and install the signing key
	await executeSudoCommand('curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc.gpg > /dev/null', outputChannel);
	// Add the azdata repository information
	const release = (await executeCommand('lsb_release', ['-rs'], outputChannel)).stdout.trim();
	await executeSudoCommand(`add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/${release}/mssql-server-2019.list)"`, outputChannel);
	// Update repository information and install azdata
	await executeSudoCommand('apt-get update', outputChannel);
	const output = (await executeSudoCommand('apt list azdata-cli --upgradeable', outputChannel)).stdout;
	// the version string is the second spade delimited token on the 2nd line
	const version = output.split('\n')[1].split(' ')[1];
	return new SemVer(version);
}
