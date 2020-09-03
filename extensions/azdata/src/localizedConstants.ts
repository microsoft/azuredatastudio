/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const searchingForAzdata = localize('azdata.searchingForAzdata', "Searching for existing azdata installation...");
export const foundExistingAzdata = (path: string, version: string): string => localize('azdata.foundExistingAzdata', "Found existing azdata installation of version (v{0}) at path:{1}", version, path);
export const downloadingProgressMb = (currentMb: string, totalMb: string): string => localize('azdata.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb);
export const downloadFinished = localize('azdata.downloadFinished', "Download finished");
export const installingAzdata = localize('azdata.installingAzdata', "Installing azdata...");
export const upgradingAzdata = localize('azdata.upgradingAzdata', "Upgrading azdata...");
export const azdataInstalled = localize('azdata.azdataInstalled', "azdata was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const azdataUpgraded = localize('azdata.azdataUpgraded', "azdata was successfully upgraded.");
export const cancel = localize('azdata.cancel', "Cancel");
export const yes = localize('azdata.yes', "Yes");
export const no = localize('azdata.no', "No");
export const downloadingTo = (name: string, location: string): string => localize('azdata.downloadingTo', "Downloading {0} to {1}", name, location);
export const executingCommand = (command: string, args: string[]): string => localize('azdata.executingCommand', "Executing command \"{0} {1}\"", command, args?.join(' '));
export const stdoutOutput = (stdout: string): string => localize('azdata.stdoutOutput', "stdout : {0}", stdout);
export const stderrOutput = (stderr: string): string => localize('azdata.stderrOutput', "stderr : {0}", stderr);
export const checkingLatestAzdataVersion = localize('azdata.checkingLatestAzdataVersion', "Checking for latest version of azdata");
export const gettingTextContentsOfUrl = (url: string): string => localize('azdata.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url);
export const latestAzdataVersionAvailable = (version: string): string => localize('azdata.latestAzdataVersionAvailable', "Latest available azdata version: {0}.", version);
export const currentlyInstalledVersionIsLatest = (currentVersion: string): string => localize('azdata.currentlyInstalledVersionIsLatest', "Currently installed version of azdata: {0} is same or newer than any other version available", currentVersion);
export const promptForAzdataUpgrade = (version: string): string => localize('azdata.promptForAzdataUpgrade', "A new version of azdata ( {0} ) is available, do you wish to upgrade to it now?", version);
export const couldNotFindAzdata = (err: any): string => localize('azdata.couldNotFindAzdata', "Could not find azdata. Error : {0}", err.message ?? err);
export const couldNotFindAzdataWithPrompt = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find azdata, install it now? If not then some features will not be able to function.");
export const downloadError = localize('azdata.downloadError', "Error while downloading");
export const installError = (err: any): string => localize('azdata.installError', "Error installing azdata : {0}", err.message ?? err);
export const platformUnsupported = (platform: string): string => localize('azdata.platformUnsupported', "Platform '{0}' is currently unsupported", platform);
export const unexpectedCommandError = (errMsg: string): string => localize('azdata.unexpectedCommandError', "Unexpected error executing command : {0}", errMsg);
export const upgradeError = (err: any): string => localize('azdata.upgradeError', "Error upgrading azdata : {0}", err.message ?? err);
export const upgradeCheckSkipped = localize('azdata.updateCheckSkipped', "No check for new azdata version availability performed as azdata was not found to be installed");
export const unexpectedExitCode = (code: number, err: string): string => localize('azdata.unexpectedExitCode', "Unexpected exit code from command : {1} ({0})", code, err);
export const noAzdata = localize('azdata.noAzdata', "No azdata available");
export const eulaNotAccepted = localize('azdata.eulaNotAccepted', "Microsoft Privacy statement and Azure Data CLI license terms have not been accepted");
export const installManually = (expectedVersion: string, instructionsUrl: string) => localize('azdata.installManually', "azdata is not installed. Version: {0} needs to be installed or some features may not work. Please install it manually using these [instructions]({1}). Restart ADS when installation is done.", expectedVersion, instructionsUrl);
export const installCorrectVersionManually = (currentVersion: string, expectedVersion: string, instructionsUrl: string) => localize('azdata.installCorrectVersionManually', "azdata version: {0} is installed, version: {1} needs to be installed or some features may not work. Please uninstall the current version and then install the correct version manually using these [instructions]({2}). Restart ADS when installation is done.", currentVersion, expectedVersion, instructionsUrl);
export const promptForEula = (privacyStatementUrl: string, eulaUrl: string) => localize('azdata.promptForEula', "It is required to accept the [Microsoft Privacy Statement]({0}) and the [Azure Data CLI license terms]({1}) to use this extension. Declining this will result in some features not working.", privacyStatementUrl, eulaUrl);
export const promptForEulaLog = (privacyStatementUrl: string, eulaUrl: string) => localize('azdata.promptForEulaLog', "Prompting the user to accept the following: {0}", promptForEula(privacyStatementUrl, eulaUrl));
export const userResponseToEulaPrompt = (response: string | undefined) => localize('azdata.promptForEulaResponse', "User response to Eula prompt: {0}", response);
