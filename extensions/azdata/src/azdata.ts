/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import { SemVer } from 'semver';
import * as vscode from 'vscode';
import { executeCommand, executeSudoCommand, ExitCodeError } from './common/childProcess';
import { HttpClient } from './common/httpClient';
import { discoverLatestAvailableAzdataVersion, searchForCmd } from './common/utils';
import { azdataAutoInstallKey, azdataAutoUpgradeKey, azdataHostname, azdataUri, deploymentConfigurationKey } from './constants';
import * as loc from './localizedConstants';
import { AzdataOutput } from './typings/azdata-ext';


const enum AzdataDeployOption {
	always = 'always',
	never = 'never',
	userPrompt = 'userPrompt'
}
/**
 * Information about an azdata installation
 */
export interface IAzdataTool {
	path: string,
	version: SemVer
	/**
	 * Executes azdata with the specified arguments (e.g. --version) and returns the result
	 * @param args The args to pass to azdata
	 * @param parseResult A function used to parse out the raw result into the desired shape
	 */
	executeCommand<R>(args: string[], parseResult: (result: any) => R[]): Promise<AzdataOutput<R>>
}

export class AzdataTool implements IAzdataTool {
	constructor(public path: string, public version: SemVer, private _outputChannel: vscode.OutputChannel) { }

	public async executeCommand<R>(args: string[], parseResult: (result: any) => R[]): Promise<AzdataOutput<R>> {
		const output = JSON.parse((await executeCommand(`"${this.path}"`, args.concat(['--output', 'json']), this._outputChannel)).stdout);
		return {
			logs: <string[]>output.log,
			stdout: <string[]>output.stdout,
			stderr: <string[]>output.stderr,
			result: parseResult(output.result)
		};
	}
}

export type AzdataLatestVersionInfo = {
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
 * @param outputChannel Channel used to display diagnostic information
 * The promise is rejected when Azdata is not found.
 */
export async function findAzdata(outputChannel: vscode.OutputChannel): Promise<IAzdataTool> {
	outputChannel.appendLine(loc.searchingForAzdata);
	try {
		let azdata: IAzdataTool | undefined = undefined;
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
export async function installAzdata(outputChannel: vscode.OutputChannel): Promise<void> {
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
 * Upgrades the azdata using os appropriate method
 * @param outputChannel Channel used to display diagnostic information
 */
export async function upgradeAzdata(outputChannel: vscode.OutputChannel): Promise<void> {
	const statusDisposable = vscode.window.setStatusBarMessage(loc.upgradingAzdata);
	outputChannel.show();
	outputChannel.appendLine(loc.upgradingAzdata);
	try {
		switch (process.platform) {
			case 'win32':
				await downloadAndInstallAzdataWin32(outputChannel);
				break;
			case 'darwin':
				await upgradeAzdataDarwin(outputChannel);
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
 * Checks whether azdata is installed - and if it is not then invokes the process of azdata installation.
 * @param outputChannel Channel used to display diagnostic information
 * @param userRequested true means that this operation by was requested by a user by executing an ads command.
 */
export async function checkAndInstallAzdata(outputChannel: vscode.OutputChannel, userRequested: boolean = false): Promise<IAzdataTool | undefined> {
	try {
		const azdata = await findAzdata(outputChannel); // find currently installed Azdata
		// Don't block on this since we want the extension to finish activating without needing user input
		checkAndUpgradeAzdata(azdata, outputChannel, userRequested).catch(err => {
			vscode.window.showWarningMessage(loc.updateError(err));
			outputChannel.appendLine(loc.updateError(err));
		}); //update if available and user wants it.
		return findAzdata(outputChannel); // now again find and return the currently installed azdata
	} catch (err) {
		// Don't block on this since we want the extension to finish activating without needing user input.
		// Calls will be made to handle azdata not being installed
		promptToInstallAzdata(outputChannel, userRequested).catch(e => console.log(`Unexpected error prompting to install azdata ${e}`));
	}
	return undefined;
}

/**
 * Checks whether a newer version of azdata is available - and if it is then invokes the process of azdata upgrade.
 * @param currentAzdata The current version of azdata to check again
 * @param outputChannel Channel used to display diagnostic information
 * @param userRequested true means that this operation by was requested by a user by executing an ads command.
 */
export async function checkAndUpgradeAzdata(currentAzdata: IAzdataTool, outputChannel: vscode.OutputChannel, userRequested: boolean = false): Promise<void> {
	const newVersion = await discoverLatestAvailableAzdataVersion(outputChannel);
	if (newVersion.compare(currentAzdata.version) === 1) {
		outputChannel.appendLine(loc.foundAzdataVersionToUpgradeTo(newVersion.raw, currentAzdata.version.raw));
		promptToUpgradeAzdata(outputChannel, userRequested).catch(e => console.log(`Unexpected error prompting to upgrade azdata ${e}`));
	}
}

async function promptToInstallAzdata(outputChannel: vscode.OutputChannel, userRequested: boolean = false): Promise<void> {
	let response: string | undefined = loc.yes;
	const config = <AzdataDeployOption>getConfig(azdataAutoInstallKey);
	outputChannel.appendLine(loc.autoDeployConfig(azdataAutoInstallKey, config));
	if (userRequested) {
		outputChannel.appendLine(loc.userRequestedInstall);
	}
	if (config === AzdataDeployOption.never && !userRequested) {
		outputChannel.appendLine(loc.skipInstall(config));
		return;
	}
	if (config === AzdataDeployOption.userPrompt) {
		response = await vscode.window.showErrorMessage(loc.couldNotFindAzdataWithPrompt, loc.yes, loc.no, loc.always, loc.never);
		outputChannel.appendLine(loc.userResponseToInstallPrompt(response));
	}
	if (response === loc.always || response === loc.never) {
		await setConfig(azdataAutoInstallKey, response);
	}
	if (response === loc.yes || response === loc.always) {
		try {
			await installAzdata(outputChannel);
			vscode.window.showInformationMessage(loc.azdataInstalled);
			outputChannel.appendLine(loc.azdataInstalled);
		} catch (err) {
			// Windows: 1602 is User cancelling installation/upgrade - not unexpected so don't display
			if (!(err instanceof ExitCodeError) || err.code !== 1602) {
				vscode.window.showWarningMessage(loc.installError(err));
				outputChannel.appendLine(loc.installError(err));
			}
		}
	}
}

async function promptToUpgradeAzdata(outputChannel: vscode.OutputChannel, userRequested: boolean = false): Promise<void> {
	let response: string | undefined = loc.yes;
	const config = <AzdataDeployOption>getConfig(azdataAutoUpgradeKey);
	outputChannel.appendLine(loc.autoDeployConfig(azdataAutoUpgradeKey, config));
	if (userRequested) {
		outputChannel.appendLine(loc.userRequestedUpgrade);
	}
	if (config === AzdataDeployOption.never && !userRequested) {
		outputChannel.appendLine(loc.skipUpgrade(config));
		return;
	}
	if (config === AzdataDeployOption.userPrompt) {
		response = await vscode.window.showInformationMessage(loc.foundAzdataUpgradePrompt, loc.yes, loc.no, loc.always, loc.never);
		outputChannel.appendLine(loc.userResponseToUpgradePrompt(response));
	}
	if (response === loc.always || response === loc.never) {
		await setConfig(azdataAutoUpgradeKey, response);
	}
	if (response === loc.yes || response === loc.always) {
		try {
			await upgradeAzdata(outputChannel);
			vscode.window.showInformationMessage(loc.azdataUpgraded);
			outputChannel.appendLine(loc.azdataUpgraded);
		} catch (err) {
			// Windows: 1602 is User cancelling installation/upgrade - not unexpected so don't display
			if (!(err instanceof ExitCodeError) || err.code !== 1602) {
				vscode.window.showWarningMessage(loc.upgradeError(err));
				outputChannel.appendLine(loc.installError(err));
			}
		}
	}
}

/**
 * Downloads the Windows installer and runs it
 * @param outputChannel Channel used to display diagnostic information
 */
async function downloadAndInstallAzdataWin32(outputChannel: vscode.OutputChannel): Promise<void> {
	const downloadFolder = os.tmpdir();
	const downloadedFile = await HttpClient.downloadFile(`${azdataHostname}/${azdataUri}`, outputChannel, downloadFolder);
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
 * Runs commands to upgrade azdata on MacOS
 */
async function upgradeAzdataDarwin(outputChannel: vscode.OutputChannel): Promise<void> {
	await executeCommand('brew', ['tap', 'microsoft/azdata-cli-release'], outputChannel);
	await executeCommand('brew', ['update'], outputChannel);
	await executeCommand('brew', ['upgrade', 'azdata-cli'], outputChannel);
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
async function findAzdataWin32(outputChannel: vscode.OutputChannel): Promise<IAzdataTool> {
	const promise = searchForCmd('azdata.cmd');
	return findSpecificAzdata(`"${await promise}"`, outputChannel);
}

/**
 * Gets the version using a known azdata path
 * @param path The path to the azdata executable
 * @param outputChannel Channel used to display diagnostic information
 */
async function findSpecificAzdata(path: string, outputChannel: vscode.OutputChannel): Promise<IAzdataTool> {
	const versionOutput = await executeCommand(path, ['--version'], outputChannel);
	return new AzdataTool(path, getVersionFromAzdataOutput(versionOutput.stdout), outputChannel);
}

/**
 * Parses out the azdata version from the raw azdata version output
 * @param raw The raw version output from azdata --version
 */
function getVersionFromAzdataOutput(raw: string): SemVer {
	// Currently the version is a multi-line string that contains other version information such
	// as the Python installation, with the first line being the version of azdata itself.
	const lines = raw.split(os.EOL);
	return new SemVer(lines[0].trim());
}


function getConfig(key: string) {
	const config = vscode.workspace.getConfiguration(deploymentConfigurationKey);
	return config.get<AzdataDeployOption>(key);
}

async function setConfig(key: string, value: string) {
	const config = vscode.workspace.getConfiguration(deploymentConfigurationKey);
	await config.update(key, value.toLocaleLowerCase(), vscode.ConfigurationTarget.Global);
}
