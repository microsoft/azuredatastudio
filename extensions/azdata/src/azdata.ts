/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from 'vscode';
import { HttpClient } from './common/httpClient';
import * as loc from './localizedConstants';
import { executeCommand, executeSudoCommand } from './common/childProcess';
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
	outputChannel.show();
	outputChannel.appendLine(loc.installingAzdata);
	try {
		switch (process.platform) {
			case 'win32':
				await downloadAndInstallAzdataWin32(outputChannel);
				break;
			case 'darwin':
				await installAzdataDarwin(outputChannel);
				break;
			case 'linux':
				await installAzdataLinux(outputChannel);
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
 * @param outputChannel Channel used to display diagnostic information
 */
async function downloadAndInstallAzdataWin32(outputChannel: vscode.OutputChannel): Promise<void> {
	const downloadFolder = os.tmpdir();
	const downloadedFile = await HttpClient.download(`${azdataHostname}/${azdataUri}`, downloadFolder, outputChannel);
	await executeCommand('msiexec', ['/qn', '/i', downloadedFile], outputChannel);
}

/**
 * Runs commands to install azdata on MacOS
 */
async function installAzdataDarwin(outputChannel: vscode.OutputChannel): Promise<void> {
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release'], outputChannel);
	await executeCommand('brew', ['update'], outputChannel);
	await executeCommand('brew', ['install', 'azdata-cli'], outputChannel);
}

/**
 * Runs commands to install azdata on Linux
 */
async function installAzdataLinux(outputChannel: vscode.OutputChannel): Promise<void> {
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
	await executeSudoCommand('apt-get install -y azdata-cli', outputChannel);
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
 * Gets the version using a known azdata path
 * @param path The path to the azdata executable
 * @param outputChannel Channel used to display diagnostic information
 */
async function findSpecificAzdata(path: string, outputChannel: vscode.OutputChannel): Promise<IAzdata> {
	const versionOutput = await executeCommand(path, ['--version'], outputChannel);
	return {
		path: path,
		version: parseVersion(versionOutput.stdout)
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
