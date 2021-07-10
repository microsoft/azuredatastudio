/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { getErrorMessage } from './common/utils';
import { azdataConfigSection, azdataInstallKey, azdataUpdateKey, azdatarequiredUpdateKey } from './constants';
const localize = nls.loadMessageBundle();

export const azdata = localize('azdata.azdata', "Azure Data CLI");
export const searchingForAzdata = localize('azdata.searchingForAzdata', "Searching for existing Azure Data CLI installation...");
export const foundExistingAzdata = (path: string, version: string): string => localize('azdata.foundExistingAzdata', "Found existing Azure Data CLI installation of version (v{0}) at path:{1}", version, path);

export const downloadingProgressMb = (currentMb: string, totalMb: string): string => localize('azdata.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb);
export const downloadFinished = localize('azdata.downloadFinished', "Download finished");
export const installingAzdata = localize('azdata.installingAzdata', "Installing Azure Data CLI...");
export const updatingAzdata = localize('azdata.updatingAzdata', "Updating Azure Data CLI...");
export const azdataInstalled = localize('azdata.azdataInstalled', "Azure Data CLI was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const azdataUpdated = (version: string) => localize('azdata.azdataUpdated', "Azure Data CLI was successfully updated to version: {0}.", version);
export const yes = localize('azdata.yes', "Yes");
export const no = localize('azdata.no', "No");
export const accept = localize('azdata.accept', "Accept");
export const decline = localize('azdata.decline', "Decline");
export const doNotAskAgain = localize('azdata.doNotAskAgain', "Don't Ask Again");
export const askLater = localize('azdata.askLater', "Ask Later");
export const downloadingTo = (name: string, url: string, location: string): string => localize('azdata.downloadingTo', "Downloading {0} from {1} to {2}", name, url, location);
export const executingCommand = (command: string, args: string[]): string => localize('azdata.executingCommand', "Executing command: '{0} {1}'", command, args?.join(' '));
export const stdoutOutput = (stdout: string): string => localize('azdata.stdoutOutput', "stdout: {0}", stdout);
export const stderrOutput = (stderr: string): string => localize('azdata.stderrOutput', "stderr: {0}", stderr);
export const checkingLatestAzdataVersion = localize('azdata.checkingLatestAzdataVersion', "Checking for latest available version of Azure Data CLI");
export const gettingTextContentsOfUrl = (url: string): string => localize('azdata.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url);
export const foundAzdataVersionToUpdateTo = (newVersion: string, currentVersion: string): string => localize('azdata.versionForUpdate', "Found version: {0} that Azure Data CLI can be updated to from current version: {1}.", newVersion, currentVersion);
export const latestAzdataVersionAvailable = (version: string): string => localize('azdata.latestAzdataVersionAvailable', "Latest available Azure Data CLI version: {0}.", version);
export const couldNotFindAzdata = (err: any): string => localize('azdata.couldNotFindAzdata', "Could not find Azure Data CLI. Error: {0}", err.message ?? err);
export const currentlyInstalledVersionIsLatest = (currentVersion: string): string => localize('azdata.currentlyInstalledVersionIsLatest', "Currently installed version of Azure Data CLI: {0} is same or newer than any other version available", currentVersion);
export const promptLog = (logEntry: string) => localize('azdata.promptLog', "Prompting the user to accept the following: {0}", logEntry);
export const promptForAzdataInstall = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find Azure Data CLI, install it now? If not then some features will not be able to function.");
export const promptForAzdataInstallLog = promptLog(promptForAzdataInstall);
export const promptForAzdataUpdate = (version: string): string => localize('azdata.promptForAzdataUpdate', "A new version of Azure Data CLI ( {0} ) is available, do you wish to update to it now?", version);
export const promptForRequiredAzdataUpdate = (requiredVersion: string, latestVersion: string): string => localize('azdata.promptForRequiredAzdataUpdate', "This extension requires Azure Data CLI >= {0} to be installed, do you wish to update to the latest version ({1}) now? If you do not then some functionality may not work.", requiredVersion, latestVersion);
export const requiredVersionNotAvailable = (requiredVersion: string, currentVersion: string): string => localize('azdata.requiredVersionNotAvailable', "This extension requires Azure Data CLI >= {0} to be installed, but the current version available is only {1}. Install the correct version manually from [here](https://docs.microsoft.com/sql/azdata/install/deploy-install-azdata) and then restart Azure Data Studio.", requiredVersion, currentVersion);
export const promptForAzdataUpdateLog = (version: string): string => promptLog(promptForAzdataUpdate(version));
export const promptForRequiredAzdataUpdateLog = (requiredVersion: string, latestVersion: string): string => promptLog(promptForRequiredAzdataUpdate(requiredVersion, latestVersion));
export const missingRequiredVersion = (requiredVersion: string): string => localize('azdata.missingRequiredVersion', "Azure Data CLI >= {0} is required for this feature. Run the 'Azure Data CLI: Check for Update' command to install this and then try again.", requiredVersion);
export const downloadError = localize('azdata.downloadError', "Error while downloading");
export const installError = (err: any): string => localize('azdata.installError', "Error installing Azure Data CLI: {0}", err.message ?? err);
export const updateError = (err: any): string => localize('azdata.updateError', "Error updating Azure Data CLI: {0}", err.message ?? err);
export const platformUnsupported = (platform: string): string => localize('azdata.platformUnsupported', "Platform '{0}' is currently unsupported", platform);
export const unexpectedCommandError = (errMsg: string): string => localize('azdata.unexpectedCommandError', "Unexpected error executing command: {0}", errMsg);
export const unexpectedExitCode = (code: number, err: string): string => localize('azdata.unexpectedExitCode', "Unexpected exit code from command: {1} ({0})", code, err);
export const noAzdata = localize('azdata.noAzdata', "No Azure Data CLI is available, run the command 'Azure Data CLI: Install' to enable the features that require it.");
export const noAzdataWithLink = localize('azdata.noAzdataWithLink', "No Azure Data CLI is available, [install the Azure Data CLI](command:azdata.install) to enable the features that require it.");
export const skipInstall = (config: string): string => localize('azdata.skipInstall', "Skipping installation of Azure Data CLI, since the operation was not user requested and config option: {0}.{1} is {2}", azdataConfigSection, azdataInstallKey, config);
export const skipUpdate = (config: string): string => localize('azdata.skipUpdate', "Skipping update of Azure Data CLI, since the operation was not user requested and config option: {0}.{1} is {2}", azdataConfigSection, azdataUpdateKey, config);
export const skipRequiredUpdate = (config: string): string => localize('azdata.skipRequiredUpdate', "Skipping required update of Azure Data CLI, since the operation was not user requested and config option: {0}.{1} is {2}", azdataConfigSection, azdatarequiredUpdateKey, config);
export const noReleaseVersion = (platform: string, releaseInfo: string): string => localize('azdata.noReleaseVersion', "No release version available for platform '{0}'\nRelease info: ${1}", platform, releaseInfo);
export const noDownloadLink = (platform: string, releaseInfo: string): string => localize('azdata.noDownloadLink', "No download link available for platform '{0}'\nRelease info: ${1}", platform, releaseInfo);
export const failedToParseReleaseInfo = (url: string, fileContents: string, err: any): string => localize('azdata.failedToParseReleaseInfo', "Failed to parse the JSON of contents at: {0}.\nFile contents:\n{1}\nError: {2}", url, fileContents, getErrorMessage(err));
export const azdataUserSettingRead = (configName: string, configValue: string): string => localize('azdata.azdataUserSettingReadLog', "Azure Data CLI user setting: {0}.{1} read, value: {2}", azdataConfigSection, configName, configValue);
export const azdataUserSettingUpdated = (configName: string, configValue: string): string => localize('azdata.azdataUserSettingUpdatedLog', "Azure Data CLI user setting: {0}.{1} updated, newValue: {2}", azdataConfigSection, configName, configValue);
export const userResponseToInstallPrompt = (response: string | undefined): string => localize('azdata.userResponseInstall', "User Response on prompt to install Azure Data CLI: {0}", response);
export const userResponseToUpdatePrompt = (response: string | undefined): string => localize('azdata.userResponseUpdate', "User Response on prompt to update Azure Data CLI: {0}", response);
export const userRequestedInstall = localize('azdata.userRequestedInstall', "User requested to install Azure Data CLI using 'Azure Data CLI: Install' command");
export const userRequestedUpdate = localize('azdata.userRequestedUpdate', "User requested to update Azure Data CLI using 'Azure Data CLI: Check for Update' command");
export const userRequestedAcceptEula = localize('azdata.acceptEula', "User requested to be prompted for accepting EULA by invoking 'Azure Data CLI: Accept EULA' command");
export const updateCheckSkipped = localize('azdata.updateCheckSkipped', "No check for new Azure Data CLI version availability performed as Azure Data CLI was not found to be installed");
export const eulaNotAccepted = localize('azdata.eulaNotAccepted', "Microsoft Privacy statement and Azure Data CLI license terms have not been accepted. Execute the command: [Azure Data CLI: Accept EULA](command:azdata.acceptEula) to accept EULA to enable the features that requires Azure Data CLI.");
export const promptForEula = (privacyStatementUrl: string, eulaUrl: string) => localize('azdata.promptForEula', "It is required to accept the [Microsoft Privacy Statement]({0}) and the [Azure Data CLI license terms]({1}) to use this extension. Declining this will result in some features not working.", privacyStatementUrl, eulaUrl);
export const promptForEulaLog = (privacyStatementUrl: string, eulaUrl: string) => promptLog(promptForEula(privacyStatementUrl, eulaUrl));
export const userResponseToEulaPrompt = (response: string | undefined) => localize('azdata.promptForEulaResponse', "User response to EULA prompt: {0}", response);
export const eulaAcceptedStateOnStartup = (eulaAccepted: boolean) => localize('azdata.eulaAcceptedStateOnStartup', "'EULA Accepted' state on startup: {0}", eulaAccepted);
export const endpointOrNamespaceRequired = localize('azdata.endpointOrNamespaceRequired', "Either an endpoint or a namespace must be specified");
