/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { deploymentConfigurationKey, azdataAutoInstallKey, azdataAutoUpgradeKey } from './constants';
const localize = nls.loadMessageBundle();

export const searchingForAzdata = localize('azdata.searchingForAzdata', "Searching for existing azdata installation...");
export function foundExistingAzdata(path: string, version: string): string { return localize('azdata.foundExistingAzdata', "Found existing azdata installation at {0} (v{1})", path, version); }
export const notFoundExistingAzdata = localize('azdata.notFoundExistingAzdata', "Could not find existing azdata installation. Upgrade cannot be performed. Try installing instead");
export function downloadingProgressMb(currentMb: string, totalMb: string): string { return localize('azdata.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb); }
export const downloadFinished = localize('azdata.downloadFinished', "Download finished");
export const installingAzdata = localize('azdata.installingAzdata', "Installing azdata...");
export const upgradingAzdata = localize('azdata.upgradingAzdata', "Upgrading azdata...");
export const azdataInstalled = localize('azdata.azdataInstalled', "azdata was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const azdataUpgraded = localize('azdata.azdataUpgraded', "azdata was successfully upgraded.");
export const cancel = localize('azdata.cancel', "Cancel");
export const yes = localize('azdata.yes', "Yes");
export const no = localize('azdata.no', "No");
export const always = localize('azdata.always', "Always");
export const never = localize('azdata.never', "Never");
export function downloadingTo(name: string, location: string): string { return localize('azdata.downloadingTo', "Downloading {0} to {1}", name, location); }
export function executingCommand(command: string, args: string[]): string { return localize('azdata.executingCommand', "Executing command \"{0} {1}\"", command, args?.join(' ')); }
export function stdoutOutput(stdout: string): string { return localize('azdata.stdoutOutput', "stdout: {0}", stdout); }
export function stderrOutput(stderr: string): string { return localize('azdata.stderrOutput', "stderr: {0}", stderr); }
export const checkingLatestAzdataVersion = localize('azdata.checkingLatestAzdataVersion', "Checking for latest available version of azdata");
export function gettingFilenameOfUrl(url: string): string { return localize('azdata.gettingFilenameOfUrl', "Getting filename of resource at URL {0}", url); }
export function gettingTextContentsOfUrl(url: string): string { return localize('azdata.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url); }
export function gotFilenameOfUrl(url: string, filename: string): string { return localize('azdata.gotFilenameOfUrl', "Got filename {0} from URL {1}", filename, url); }

export function foundAzdataVersionToUpgradeTo(newVersion: string, currentVersion: string): string { return localize('azdata.versionForUpgrade', "Found version: {0} that azdata-cli can be upgraded to from current version: {1}.", newVersion, currentVersion); }
export function latestAzdataVersionAvailable(version: string): string { return localize('azdata.latestAzdataVersionAvailable', "Latest available azdata version: {0}.", version); }

export function promptForAzdataUpgrade(version: string): string { return localize('azdata.promptForAzdataUpgrade', "An updated version of azdata ( {0} ) is available, do you wish to install it now?", version); }
export function couldNotFindAzdata(err: any): string { return localize('azdata.couldNotFindAzdata', "Could not find azdata. Error: {0}", err.message ?? err); }
export const couldNotFindAzdataWithPrompt = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find azdata, install it now? If not then some features will not be able to function.");
export const foundAzdataUpgradePrompt = localize('azdata.foundAzdataUpgradePrompt', "Found an upgrade available for azdata, upgrade it now?");
export const downloadError = localize('azdata.downloadError', "Error while downloading");
export function installError(err: any): string { return localize('azdata.installError', "Error installing azdata: {0}", err.message ?? err); }
export function upgradeError(err: any): string { return localize('azdata.upgradeError', "Error upgrading azdata: {0}", err.message ?? err); }
export function platformUnsupported(platform: string): string { return localize('azdata.platformUnsupported', "Platform '{0}' is currently unsupported", platform); }
export function unexpectedCommandError(errMsg: string): string { return localize('azdata.unexpectedCommandError', "Unexpected error executing command: {0}", errMsg); }
export function unexpectedExitCode(code: number, stderr: string): string { return localize('azdata.unexpectedExitCode', "Unexpected exit code from command ({0}), stderr: '${1}'", code, stderr); }
export function updateError(err: any): string { return localize('azdata.updateError', "Error updating azdata: {0}", err.message ?? err); }
export function skipInstall(config: string): string { return localize('azdata.skipInstall', "Skipping installation of azdata, since the operation was not user requested and config option: {0}.{1} is {2}", deploymentConfigurationKey, azdataAutoInstallKey, config); }
export function skipUpgrade(config: string): string { return localize('azdata.skipUpgrade', "Skipping upgrade of azdata, since the operation was not user requested and config option: {0}.{1} is {2}", deploymentConfigurationKey, azdataAutoUpgradeKey, config); }
export function autoDeployConfig(configName: string, configValue: string): string { return localize('azdata.autoDeployConfig', "Azdata auto deployment setting: {0}.{1} is {2}", deploymentConfigurationKey, configName, configValue); }
export function userResponseToInstallPrompt(response: string | undefined): string { return localize('azdata.userResponseInstall', "User Response on prompt to install azdata: {0}", response); }
export function userResponseToUpgradePrompt(response: string | undefined): string { return localize('azdata.userResponseUpgrade', "User Response on prompt to upgrade azdata: {0}", response); }
export const userRequestedInstall = localize('azdata.userRequestedInstall', "User requested to install azdata using 'Install Azdata' command");
export const userRequestedUpgrade = localize('azdata.userRequestedUpgrade', "User requested to upgrade azdata using 'Upgrade Azdata' command");
