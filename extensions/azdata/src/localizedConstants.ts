/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { deploymentConfigurationKey, azdataAutoInstallKey, azdataAutoUpgradeKey } from './constants';
const localize = nls.loadMessageBundle();

export const searchingForAzdata = localize('azdata.searchingForAzdata', "Searching for existing azdata installation...");
export const foundExistingAzdata = (path: string, version: string): string => localize('azdata.foundExistingAzdata', "Found existing azdata installation of version (v{0}) at path:{1}", version, path);
export const notFoundExistingAzdata = localize('azdata.notFoundExistingAzdata', "Could not find existing azdata installation. Upgrade cannot be performed. Try installing instead");

export const downloadingProgressMb = (currentMb: string, totalMb: string): string => localize('azdata.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb);
export const downloadFinished = localize('azdata.downloadFinished', "Download finished");
export const installingAzdata = localize('azdata.installingAzdata', "Installing azdata...");
export const upgradingAzdata = localize('azdata.upgradingAzdata', "Upgrading azdata...");
export const azdataInstalled = localize('azdata.azdataInstalled', "azdata was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const azdataUpgraded = localize('azdata.azdataUpgraded', "azdata was successfully upgraded.");
export const yes = localize('azdata.yes', "Yes");
export const no = localize('azdata.no', "No");
export const always = localize('azdata.always', "Always");
export const never = localize('azdata.never', "Never");
export const downloadingTo = (name: string, location: string): string => localize('azdata.downloadingTo', "Downloading {0} to {1}", name, location);
export const executingCommand = (command: string, args: string[]): string => localize('azdata.executingCommand', "Executing command \"{0} {1}\"", command, args?.join(' '));
export const stdoutOutput = (stdout: string): string => localize('azdata.stdoutOutput', "stdout: {0}", stdout);
export const stderrOutput = (stderr: string): string => localize('azdata.stderrOutput', "stderr: {0}", stderr);
export const checkingLatestAzdataVersion = localize('azdata.checkingLatestAzdataVersion', "Checking for latest available version of azdata");
export const gettingTextContentsOfUrl = (url: string): string => localize('azdata.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url);
export const foundAzdataVersionToUpgradeTo = (newVersion: string, currentVersion: string): string => localize('azdata.versionForUpgrade', "Found version: {0} that azdata-cli can be upgraded to from current version: {1}.", newVersion, currentVersion);
export const latestAzdataVersionAvailable = (version: string): string => localize('azdata.latestAzdataVersionAvailable', "Latest available azdata version: {0}.", version);
export const promptForAzdataUpgrade = (version: string): string => localize('azdata.promptForAzdataUpgrade', "An updated version of azdata ( {0} ) is available, do you wish to install it now?", version);
export const couldNotFindAzdata = (err: any): string => localize('azdata.couldNotFindAzdata', "Could not find azdata. Error: {0}", err.message ?? err);
export const couldNotFindAzdataWithPrompt = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find azdata, install it now? If not then some features will not be able to const.");
export const foundAzdataUpgradePrompt = localize('azdata.foundAzdataUpgradePrompt', "Found an upgrade available for azdata, upgrade it now?");
export const downloadError = localize('azdata.downloadError', "Error while downloading");
export const installError = (err: any): string => localize('azdata.installError', "Error installing azdata: {0}", err.message ?? err);
export const upgradeError = (err: any): string => localize('azdata.upgradeError', "Error upgrading azdata: {0}", err.message ?? err);
export const platformUnsupported = (platform: string): string => localize('azdata.platformUnsupported', "Platform '{0}' is currently unsupported", platform);
export const unexpectedCommandError = (errMsg: string): string => localize('azdata.unexpectedCommandError', "Unexpected error executing command: {0}", errMsg);
export const updateError = (err: any): string => localize('azdata.updateError', "Error updating azdata: {0}", err.message ?? err);
export const unexpectedExitCode = (code: number, err: string): string => localize('azdata.unexpectedExitCode', "Unexpected exit code from command: {1} ({0})", code, err);
export const noAzdata = localize('azdata.NoAzdata', "No azdata available");
export const skipInstall = (config: string): string => localize('azdata.skipInstall', "Skipping installation of azdata, since the operation was not user requested and config option: {0}.{1} is {2}", deploymentConfigurationKey, azdataAutoInstallKey, config);
export const skipUpgrade = (config: string): string => localize('azdata.skipUpgrade', "Skipping upgrade of azdata, since the operation was not user requested and config option: {0}.{1} is {2}", deploymentConfigurationKey, azdataAutoUpgradeKey, config);
export const autoDeployConfig = (configName: string, configValue: string): string => localize('azdata.autoDeployConfig', "Azdata auto deployment setting: {0}.{1} is {2}", deploymentConfigurationKey, configName, configValue);
export const userResponseToInstallPrompt = (response: string | undefined): string => localize('azdata.userResponseInstall', "User Response on prompt to install azdata: {0}", response);
export const userResponseToUpgradePrompt = (response: string | undefined): string => localize('azdata.userResponseUpgrade', "User Response on prompt to upgrade azdata: {0}", response);
export const userRequestedInstall = localize('azdata.userRequestedInstall', "User requested to install azdata using 'Install Azdata' command");
export const userRequestedUpgrade = localize('azdata.userRequestedUpgrade', "User requested to upgrade azdata using 'Upgrade Azdata' command");
