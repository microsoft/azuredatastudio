/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { getErrorMessage } from './common/utils';
import { azCliInstallKey, azConfigSection } from './constants';
// import { azCliInstallKey } from './constants';
const localize = nls.loadMessageBundle();

export const az = localize('az.az', "Azure CLI");
export const searchingForAz = localize('az.searchingForAz', "Searching for existing Azure CLI installation...");
export const foundExistingAz = (path: string, versionAz: string, versionArc: string): string => localize('az.foundExistingAz', "Found existing Azure CLI installation of version (v{0}) at path:{1} with arcdata version: {2}.", versionAz, path, versionArc);
export const downloadingProgressMb = (currentMb: string, totalMb: string): string => localize('az.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb);
export const downloadFinished = localize('az.downloadFinished', "Download finished");
export const downloadingTo = (name: string, url: string, location: string): string => localize('az.downloadingTo', "Downloading {0} from {1} to {2}", name, url, location);
export const executingCommand = (command: string, args: string[]): string => localize('az.executingCommand', "Executing command: '{0} {1}'", command, args?.join(' '));
export const stdoutOutput = (stdout: string): string => localize('az.stdoutOutput', "stdout: {0}", stdout);
export const stderrOutput = (stderr: string): string => localize('az.stderrOutput', "stderr: {0}", stderr);
export const gettingTextContentsOfUrl = (url: string): string => localize('az.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url);
export const promptLog = (logEntry: string) => localize('az.promptLog', "Prompting the user to accept the following: {0}", logEntry);
export const downloadError = localize('az.downloadError', "Error while downloading");
export const platformUnsupported = (platform: string): string => localize('az.platformUnsupported', "Platform '{0}' is currently unsupported", platform);
export const unexpectedCommandError = (errMsg: string): string => localize('az.unexpectedCommandError', "Unexpected error executing command: {0}", errMsg);
export const unexpectedExitCode = (code: number, err: string): string => localize('az.unexpectedExitCode', "Unexpected exit code from command: {1} ({0})", code, err);
export const noReleaseVersion = (platform: string, releaseInfo: string): string => localize('az.noReleaseVersion', "No release version available for platform '{0}'\nRelease info: ${1}", platform, releaseInfo);
export const noDownloadLink = (platform: string, releaseInfo: string): string => localize('az.noDownloadLink', "No download link available for platform '{0}'\nRelease info: ${1}", platform, releaseInfo);
export const failedToParseReleaseInfo = (url: string, fileContents: string, err: any): string => localize('az.failedToParseReleaseInfo', "Failed to parse the JSON of contents at: {0}.\nFile contents:\n{1}\nError: {2}", url, fileContents, getErrorMessage(err));
export const endpointOrNamespaceRequired = localize('az.endpointOrNamespaceRequired', "Either an endpoint or a namespace must be specified");
export const arcdataExtensionNotInstalled = localize('az.arcdataExtensionNotInstalled', "This extension requires the Azure CLI extension 'arcdata' to be installed. Install the latest version using instructions from [here](https://docs.microsoft.com/azure/azure-arc/data/install-arcdata-extension).");
export const noAzureCLI = localize('az.noAzureCLI', "No Azure CLI is available. Install the latest version manually from [here](https://docs.microsoft.com/cli/azure/install-azure-cli) and then restart Azure Studio.");
export const requiredArcDataVersionNotAvailable = (requiredVersion: string, currentVersion: string): string => localize('az.requiredVersionNotAvailable', "This extension requires the Azure CLI extension 'arcdata' version >= {0} to be installed, but the current version available is only {1}. Install the correct version using instructions from [here](https://docs.microsoft.com/azure/azure-arc/data/install-arcdata-extension).", requiredVersion, currentVersion);
export const unsupportedArcDataVersion = (requiredVersion: string, currentVersion: string): string => localize('az.unsupportedArcDataVersion', "Your downloaded version {1} of the Azure CLI extension 'arcdata' is not yet supported. The latest version is is {0}. Install the correct version using instructions from [here](https://docs.microsoft.com/azure/azure-arc/data/install-arcdata-extension).", requiredVersion, currentVersion);
export const doNotAskAgain = localize('az.doNotAskAgain', "Don't Ask Again");
export const askLater = localize('az.askLater', "Ask Later");
export const azOutputParseErrorCaught = (command: string): string => localize('az.azOutputParseErrorCaught', "An error occurred while parsing the output of az command: {0}. The output is not JSON.", command);
export const parseVersionError = localize('az.parseVersionError', "An error occurred while parsing the output of az --version.");
export const installingAz = localize('az.installingAz', "Installing Azure CLI...");
export const installingArcdata = localize('az.installingArcdata', "Installing the Azure CLI arcdata extension...");
export const updatingAz = localize('az.updatingAz', "Updating Azure CLI...");
export const azInstalled = localize('az.azInstalled', "Azure CLI was successfully installed. Restarting Azure Studio is required to complete configuration - features will not be activated until this is done.");
export const arcdataInstalled = localize('az.arcdataInstalled', "The Azure CLI arcdata extension was successfully installed. Restarting Azure Studio is required to complete configuration - features will not be activated until this is done.");
export const yes = localize('az.yes', "Yes");
export const no = localize('az.no', "No");
export const accept = localize('az.accept', "Accept");
export const decline = localize('az.decline', "Decline");
export const checkingLatestAzVersion = localize('az.checkingLatestAzVersion', "Checking for latest available version of Azure CLI");
export const foundAzVersionToUpdateTo = (newVersion: string, currentVersion: string): string => localize('az.versionForUpdate', "Found version: {0} that Azure CLI can be updated to from current version: {1}.", newVersion, currentVersion);
export const latestAzVersionAvailable = (version: string): string => localize('az.latestAzVersionAvailable', "Latest available Azure CLI version: {0}.", version);
export const couldNotFindAz = (err: any): string => localize('az.couldNotFindAz', "Could not find Azure CLI. Error: {0}", err.message ?? err);
export const couldNotFindAzArc = (err: any): string => localize('az.couldNotFindAzArc', "Could not find the Azure CLI arcdata extension. Error: {0}", err.message ?? err);
export const currentlyInstalledVersionIsLatest = (currentVersion: string): string => localize('az.currentlyInstalledVersionIsLatest', "Currently installed version of Azure CLI: {0} is same or newer than any other version available", currentVersion);
export const promptForAzInstall = localize('az.couldNotFindAzWithPrompt', "Could not find Azure CLI, install it now? If not then some features will not be able to function.");
export const promptForAzInstallLog = promptLog(promptForAzInstall);
export const promptForArcdataInstall = localize('az.couldNotFindArcdataWithPrompt', "Could not find the Azure CLI arcdata extension, install it now? If not then some features will not be able to function.");
export const promptForArcdataInstallLog = promptLog(promptForArcdataInstall);
export const promptForAzUpdate = (version: string): string => localize('az.promptForAzUpdate', "A new version of Azure CLI ( {0} ) is available, do you wish to update to it now?", version);
export const promptForRequiredAzUpdate = (requiredVersion: string, latestVersion: string): string => localize('az.promptForRequiredAzUpdate', "This extension requires Azure CLI >= {0} to be installed, do you wish to update to the latest version ({1}) now? If you do not then some functionality may not work.", requiredVersion, latestVersion);
export const promptForAzUpdateLog = (version: string): string => promptLog(promptForAzUpdate(version));
export const promptForRequiredAzUpdateLog = (requiredVersion: string, latestVersion: string): string => promptLog(promptForRequiredAzUpdate(requiredVersion, latestVersion));
export const missingRequiredVersion = (requiredVersion: string): string => localize('az.missingRequiredVersion', "Azure CLI >= {0} is required for this feature. Run the 'Azure CLI: Check for Update' command to install this and then try again.", requiredVersion);
export const installError = (err: any): string => localize('az.installError', "Error installing Azure CLI and arcdata extension: {0}", err.message ?? err);
export const updateError = (err: any): string => localize('az.updateError', "Error updating Azure CLI: {0}", err.message ?? err);
export const noAz = localize('az.noAz', "No Azure CLI is available, run the command 'Azure CLI: Install' to enable the features that require it.");
export const noAzArc = localize('az.noAzArc', "No Azure CLI arcdata extension is available.");
export const noAzWithLink = localize('az.noAzWithLink', "No Azure CLI is available, [install the Azure CLI](command:az.install) to enable the features that require it.");
export const skipInstall = (config: string): string => localize('az.skipInstall', "Skipping installation of Azure CLI and arcdata extension, since the operation was not user requested and config option: {0}.{1} is {2}", azConfigSection, azCliInstallKey, config);
export const azUserSettingRead = (configName: string, configValue: string): string => localize('az.azUserSettingReadLog', "Azure CLI user setting: {0}.{1} read, value: {2}", azConfigSection, configName, configValue);
export const azUserSettingUpdated = (configName: string, configValue: string): string => localize('az.azUserSettingUpdatedLog', "Azure CLI user setting: {0}.{1} updated, newValue: {2}", azConfigSection, configName, configValue);
export const userResponseToInstallPrompt = (response: string | undefined): string => localize('az.userResponseInstall', "User Response on prompt to install Azure CLI: {0}", response);
export const userResponseToUpdatePrompt = (response: string | undefined): string => localize('az.userResponseUpdate', "User Response on prompt to update Azure CLI: {0}", response);
export const userRequestedInstall = localize('az.userRequestedInstall', "User requested to install Azure CLI and arcdata extension using 'Azure CLI: Install' command");
export const updateCheckSkipped = localize('az.updateCheckSkipped', "No check for new Azure CLI version availability performed as Azure CLI was not found to be installed");
export const releaseDateNotParsed = localize('arc.releaseDateNotParsed', "Release date could not be parsed.");
