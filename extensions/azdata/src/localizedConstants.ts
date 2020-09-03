/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { azdataConfigSection, azdataInstallKey, azdataUpgradeKey } from './constants';
const localize = nls.loadMessageBundle();

export const searchingForAzdata = localize('azdata.searchingForAzdata', "Searching for existing Azure Data CLI installation...");
export const foundExistingAzdata = (path: string, version: string): string => localize('azdata.foundExistingAzdata', "Found existing Azure Data CLI installation of version (v{0}) at path:{1}", version, path);

export const downloadingProgressMb = (currentMb: string, totalMb: string): string => localize('azdata.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb);
export const downloadFinished = localize('azdata.downloadFinished', "Download finished");
export const installingAzdata = localize('azdata.installingAzdata', "Installing azdata...");
export const upgradingAzdata = localize('azdata.upgradingAzdata', "Upgrading azdata...");
export const azdataInstalled = localize('azdata.azdataInstalled', "Azure Data CLI was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const azdataUpgraded = (version: string) => localize('azdata.azdataUpgraded', "Azure Data CLI was successfully upgraded to version: ${0}.", version);
export const yes = localize('azdata.yes', "Yes");
export const no = localize('azdata.no', "No");
export const doNotAskAgain = localize('azdata.doNotAskAgain', "Don't Ask Again");
export const askLater = localize('azdata.askLater', "Ask Later");
export const downloadingTo = (name: string, location: string): string => localize('azdata.downloadingTo', "Downloading {0} to {1}", name, location);
export const executingCommand = (command: string, args: string[]): string => localize('azdata.executingCommand', "Executing command \"{0} {1}\"", command, args?.join(' '));
export const stdoutOutput = (stdout: string): string => localize('azdata.stdoutOutput', "stdout: {0}", stdout);
export const stderrOutput = (stderr: string): string => localize('azdata.stderrOutput', "stderr: {0}", stderr);
export const checkingLatestAzdataVersion = localize('azdata.checkingLatestAzdataVersion', "Checking for latest available version of azdata");
export const gettingTextContentsOfUrl = (url: string): string => localize('azdata.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url);
export const foundAzdataVersionToUpgradeTo = (newVersion: string, currentVersion: string): string => localize('azdata.versionForUpgrade', "Found version: {0} that Azure Data CLI can be upgraded to from current version: {1}.", newVersion, currentVersion);
export const latestAzdataVersionAvailable = (version: string): string => localize('azdata.latestAzdataVersionAvailable', "Latest available Azure Data CLI version: {0}.", version);
export const couldNotFindAzdata = (err: any): string => localize('azdata.couldNotFindAzdata', "Could not find azdata. Error: {0}", err.message ?? err);
export const currentlyInstalledVersionIsLatest = (currentVersion: string): string => localize('azdata.currentlyInstalledVersionIsLatest', "Currently installed version of azdata: {0} is same or newer than any other version available", currentVersion);
export const promptLog = (logEntry: string) => localize('azdata.promptLog', "Prompting the user to accept the following: {0}", logEntry);
export const promptForAzdataInstall = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find azdata, install it now? If not then some features will not be able to function.");
export const promptForAzdataInstallLog = promptLog(promptForAzdataInstall);
export const promptForAzdataUpgrade = (version: string): string => localize('azdata.promptForAzdataUpgrade', "A new version of Azure Data CLI ( {0} ) is available, do you wish to upgrade to it now?", version);
export const promptForAzdataUpgradeLog = (version: string): string => promptLog(promptForAzdataUpgrade(version));

export const downloadError = localize('azdata.downloadError', "Error while downloading");
export const installError = (err: any): string => localize('azdata.installError', "Error installing azdata: {0}", err.message ?? err);
export const upgradeError = (err: any): string => localize('azdata.upgradeError', "Error upgrading azdata: {0}", err.message ?? err);
export const platformUnsupported = (platform: string): string => localize('azdata.platformUnsupported', "Platform '{0}' is currently unsupported", platform);
export const unexpectedCommandError = (errMsg: string): string => localize('azdata.unexpectedCommandError', "Unexpected error executing command: {0}", errMsg);
export const unexpectedExitCode = (code: number, err: string): string => localize('azdata.unexpectedExitCode', "Unexpected exit code from command: {1} ({0})", code, err);
export const noAzdata = localize('azdata.NoAzdata', "No Azure Data CLI is available, execute command 'Azure Data CLI: Install' to unlock some functionality of Azure Data CLI to enable related features.");
export const skipInstall = (config: string): string => localize('azdata.skipInstall', "Skipping installation of azdata, since the operation was not user requested and config option: {0}.{1} is {2}", azdataConfigSection, azdataInstallKey, config);
export const skipUpgrade = (config: string): string => localize('azdata.skipUpgrade', "Skipping upgrade of azdata, since the operation was not user requested and config option: {0}.{1} is {2}", azdataConfigSection, azdataUpgradeKey, config);
export const azdataUserSettingLog = (configName: string, configValue: string): string => localize('azdata.azdataUserSettingLog', "Azure Data CLI user setting: {0}.{1} is {2}", azdataConfigSection, configName, configValue);
export const userResponseToInstallPrompt = (response: string | undefined): string => localize('azdata.userResponseInstall', "User Response on prompt to install azdata: {0}", response);
export const userResponseToUpgradePrompt = (response: string | undefined): string => localize('azdata.userResponseUpgrade', "User Response on prompt to upgrade azdata: {0}", response);
export const userRequestedInstall = localize('azdata.userRequestedInstall', "User requested to install Azure Data CLI using 'Azure Data CLI: Install' command");
export const userRequestedUpgrade = localize('azdata.userRequestedUpgrade', "User requested to upgrade Azure Data CLI using 'Azure Data CLI: Check for Upgrade' command");
export const userRequestedAcceptEula = localize('azdata.acceptEula', "User requested to invoke accept eula prompts 'Azure Data CLI: Accept Eula' command");
export const upgradeCheckSkipped = localize('azdata.updateCheckSkipped', "No check for new Azure Data CLI version availability performed as Azure Data CLI was not found to be installed");
export const eulaNotAccepted = localize('azdata.eulaNotAccepted', "Microsoft Privacy statement and Azure Data CLI license terms have not been accepted, execute command 'Azure Data CLI: Accept Eula' and accept the licence terms to unlock related functionality");
export const installManually = (expectedVersion: string, instructionsUrl: string) => localize('azdata.installManually', "Azure Data CLI is not installed. Version: {0} needs to be installed or some features may not work. Please install it manually using these [instructions]({1}). Restart ADS when installation is done.", expectedVersion, instructionsUrl);
export const installCorrectVersionManually = (currentVersion: string, expectedVersion: string, instructionsUrl: string) => localize('azdata.installCorrectVersionManually', "Azure Data CLI version: {0} is installed, version: {1} needs to be installed or some features may not work. Please uninstall the current version and then install the correct version manually using these [instructions]({2}). Restart ADS when installation is done.", currentVersion, expectedVersion, instructionsUrl);
export const promptForEula = (privacyStatementUrl: string, eulaUrl: string) => localize('azdata.promptForEula', "It is required to accept the [Microsoft Privacy Statement]({0}) and the [Azure Data CLI license terms]({1}) to use this extension. Declining this will result in some features not working.", privacyStatementUrl, eulaUrl);
export const promptForEulaLog = (privacyStatementUrl: string, eulaUrl: string) => promptLog(promptForEula(privacyStatementUrl, eulaUrl));
export const userResponseToEulaPrompt = (response: string | undefined) => localize('azdata.promptForEulaResponse', "User response to Eula prompt: {0}", response);
