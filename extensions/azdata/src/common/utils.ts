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
import { executeCommand } from './childProcess';
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
		case 'darwin':
			return await getLatestStableAzdataVersionDarwin(outputChannel);
		default:
			return await getLatestAzdataVersionJson(outputChannel);
	}
}

/**
 * Gets the latest azdata version from a json document published by azdata release
 * @param outputChannel Channel used to display diagnostic information
 */
async function getLatestAzdataVersionJson(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	// get version information for current platform from http://aka.ms/azdata/release.json
	const fileContents = await HttpClient.getTextContent(`${azdataHostname}/${azdataReleaseJson}`, outputChannel);
	const versionString = JSON.parse(fileContents)[process.platform]['version'];
	return new SemVer(versionString);
}

/**
 * Gets the latest azdata version for MacOs clients
 * @param outputChannel Channel used to display diagnostic information
 */
async function getLatestStableAzdataVersionDarwin(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	// set brew tap to azdata-cli repository
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release'], outputChannel);
	// Get the 'info' about 'azdata-cli' from 'brew' as a json object
	const azdataInfo: AzdataLatestVersionInfo = (JSON.parse((await executeCommand('brew', ['info', 'azdata-cli', '--json'], outputChannel)).stdout)).shift();
	return new SemVer(azdataInfo.versions.stable);
}
