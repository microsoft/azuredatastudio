/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SemVer } from 'semver';
import * as vscode from 'vscode';
import * as which from 'which';
import { HttpClient } from '../common/httpClient';
import * as loc from '../localizedConstants';
import { azdataHostname, azdataUri, AzdataLatestVersionInfo } from '../azdata';
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
		case 'win32':
			return await getLatestAzdataVersionWin32(outputChannel);
		case 'darwin':
			return await getLatestStableAzdataVersionDarwin(outputChannel);
	}
	return new SemVer('20.0.1'); // TODO Implement other platforms
}

/**
 * Gets the latest azdata version for Windows clients
 * @param outputChannel Channel used to display diagnostic information
 */
async function getLatestAzdataVersionWin32(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	// Get the filename of the resource for the aka.ms link that points to the latest azdata version.
	// We don't want to actually download the file since that's going to be unnecessary most of the time
	// so as an optimization just get the filename of the resource and check that.
	const filename = await HttpClient.getFilename(`${azdataHostname}/${azdataUri}`, outputChannel);
	// We expect the filename to be in a format similar to azdata-cli-20.0.0.msi,
	// so to parse out the version trim off the starting text and the extension
	const versionString = filename.replace(/^[^\d]*/, '').replace('.msi', '');
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
