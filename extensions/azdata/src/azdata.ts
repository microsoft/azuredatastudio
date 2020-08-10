/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as vscode from 'vscode';
import { SemVer } from 'semver';
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
	version: SemVer
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
		outputChannel.appendLine(loc.foundExistingAzdata(azdata.path, azdata.version.raw));
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
 * Checks whether a newer version of azdata is available - and if it is prompts the user to download and
 * install it.
 * @param currentAzdata The current version of azdata to check again
 * @param outputChannel Channel used to display diagnostic information
 */
export async function checkForAzdataUpdate(currentAzdata: IAzdata, outputChannel: vscode.OutputChannel): Promise<void> {
	const newVersion = await getLatestAzdataVersion(outputChannel);
	switch (process.platform) {
		case 'win32':
			if (newVersion.compare(currentAzdata.version) === 1) {
				const response = await vscode.window.showInformationMessage(loc.promptForAzdataUpgrade(newVersion.raw), loc.yes, loc.no);
				if (response === loc.yes) {
					await downloadAndInstallAzdata(outputChannel);
				}
			}
			break;
	}
}

/**
 * Gets the latest azdata version available
 * @param outputChannel Channel used to display diagnostic information
 */
async function getLatestAzdataVersion(outputChannel: vscode.OutputChannel): Promise<SemVer> {
	outputChannel.appendLine(loc.checkingLatestAzdataVersion);
	switch (process.platform) {
		case 'win32':
			return await getLatestAzdataVersionWin32(outputChannel);
	}
	return new SemVer('20.0.0'); // TODO Implement other platforms
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
	return findSpecificAzdata(`"${await promise}"`, outputChannel);
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
function parseVersion(raw: string): SemVer {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation, with the first line being the version of azdata itself.
	const lines = raw.split(os.EOL);
	return new SemVer(lines[0].trim());
}
