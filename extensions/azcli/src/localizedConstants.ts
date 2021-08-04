/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { getErrorMessage } from './common/utils';
const localize = nls.loadMessageBundle();

export const az = localize('az.az', "Azure CLI");
export const searchingForAz = localize('az.searchingForAz', "Searching for existing Azure CLI installation...");
export const foundExistingAz = (path: string, version: string): string => localize('az.foundExistingAz', "Found existing Azure CLI installation of version (v{0}) at path:{1}", version, path);
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
export const arcdataExtensionNotInstalled = localize('az.arcdataExtensionNotInstalled', "This extension requires the Azure CLI extension 'arcdata' to be installed. Install the latest version manually from [here](https://docs.microsoft.com/azure/azure-arc/data/install-arcdata-extension) and then restart Azure Data Studio.");
export const noAzureCLI = localize('az.noAzureCLI', "No Azure CLI is available. Install the latest version manually from [here](https://docs.microsoft.com/cli/azure/install-azure-cli) and then restart Azure Data Studio.");
export const requiredArcDataVersionNotAvailable = (requiredVersion: string, currentVersion: string): string => localize('az.requiredVersionNotAvailable', "This extension requires the Azure CLI extension 'arcdata' version >= {0} to be installed, but the current version available is only {1}. Install the correct version manually from [here](https://docs.microsoft.com/azure/azure-arc/data/install-arcdata-extension) and then restart Azure Data Studio.", requiredVersion, currentVersion);
export const unsupportedArcDataVersion = (requiredVersion: string, currentVersion: string): string => localize('az.unsupportedArcDataVersion', "Your downloaded version {1} of the Azure CLI extension 'arcdata' is not yet supported. The latest version is is {0}. Install the correct version manually from [here](https://docs.microsoft.com/azure/azure-arc/data/install-arcdata-extension) and then restart Azure Data Studio.", requiredVersion, currentVersion);
export const doNotAskAgain = localize('az.doNotAskAgain', "Don't Ask Again");
export const askLater = localize('az.askLater', "Ask Later");
export const azOutputParseErrorCaught = (command: string): string => localize('az.azOutputParseErrorCaught', "An error occurred while parsing the output of az command: {0}. The output is not JSON.", command);
