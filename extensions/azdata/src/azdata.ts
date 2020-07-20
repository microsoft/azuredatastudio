/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid';
import * as vscode from 'vscode';
import { HttpClient } from './common/httpClient';
import * as loc from './localizedConstants';
import { executeCommand } from './common/childProcess';
import { searchForCmd } from './common/utils';

export const azdataHostname = 'https://aka.ms';
export const azdataUri = 'azdata-msi';
/**
 * Information about an azdata installation
 */
export interface IAzdata {
	path: string,
	version: string
}

/**
 * Finds the existing installation of azdata, or throws an error if it couldn't find it
 * or encountered an unexpected error.
 * @param outputChannel Channel used to display diagnostic information
 */
export async function findAzdata(outputChannel: vscode.OutputChannel): Promise<IAzdata> {
	outputChannel.appendLine(loc.searchingForAzdata);
	try {
		let azdata: IAzdata | undefined = undefined;
		switch (process.platform) {
			case 'darwin':
				azdata = await findAzdataDarwin(outputChannel);
				break;
			case 'win32':
				azdata = await findAzdataWin32(outputChannel);
				break;
			default:
				azdata = await findSpecificAzdata('azdata', outputChannel);
		}
		outputChannel.appendLine(loc.foundExistingAzdata(azdata.path, azdata.version));
		return azdata;
	} catch (err) {
		outputChannel.appendLine(loc.couldNotFindAzdata(err));
		throw err;
	}
}

/**
 * Downloads the appropriate installer and/or runs the command to install azdata
 * @param outputChannel Channel used to display diagnostic information
 */
export async function downloadAndInstallAzdata(outputChannel: vscode.OutputChannel): Promise<void> {
	const statusDisposable = vscode.window.setStatusBarMessage(loc.installingAzdata);
	try {
		switch (process.platform) {
			case 'win32':
				await downloadAndInstallAzdataWin32(outputChannel);
				break;
			case 'darwin':
				await installAzdataDarwin();
				break;
			case 'linux':
				await installAzdataLinux();
				break;
		}
	} finally {
		statusDisposable.dispose();
	}
}

/**
 * Downloads the Windows installer and runs it
 * @param outputChannel Channel used to display diagnostic information
 */
async function downloadAndInstallAzdataWin32(outputChannel: vscode.OutputChannel): Promise<void> {
	const downloadPath = path.join(os.tmpdir(), `azdata-msi-${uuid.v4()}.msi`);
	outputChannel.appendLine(loc.downloadingTo('azdata-cli.msi', downloadPath));
	await HttpClient.download(`${azdataHostname}/${azdataUri}`, downloadPath, outputChannel);
	await executeCommand('msiexec', ['/i', downloadPath], outputChannel);
}

/**
 * Runs commands to install azdata on MacOS
 */
async function installAzdataDarwin(): Promise<void> {
	throw new Error('Not yet implemented');
}

/**
 * Runs commands to install azdata on Linux
 */
async function installAzdataLinux(): Promise<void> {
	throw new Error('Not yet implemented');
}

/**
 * Finds azdata specifically on Windows
 * @param outputChannel Channel used to display diagnostic information
 */
async function findAzdataWin32(outputChannel: vscode.OutputChannel): Promise<IAzdata> {
	const promise = searchForCmd('azdata.cmd');
	return findSpecificAzdata(await promise, outputChannel);
}

/**
 * Finds azdata specifically on MacOS
 * @param outputChannel Channel used to display diagnostic information
 */
async function findAzdataDarwin(_outputChannel: vscode.OutputChannel): Promise<IAzdata> {
	throw new Error('Not yet implemented');
}

/**
 * Gets the version using a known azdata path
 * @param path The path to the azdata executable
 * @param outputChannel Channel used to display diagnostic information
 */
async function findSpecificAzdata(path: string, outputChannel: vscode.OutputChannel): Promise<IAzdata> {
	const versionOutput = await executeCommand(path, ['--version'], outputChannel);
	return {
		path: path,
		version: parseVersion(versionOutput)
	};
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
