/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const searchingForAzdata = localize('azdata.searchingForAzdata', "Searching for existing azdata installation...");
export function foundExistingAzdata(path: string, version: string): string { return localize('azdata.foundExistingAzdata', "Found existing azdata installation at {0} (v{1})", path, version); }
export function downloadingProgressMb(currentMb: string, totalMb: string): string { return localize('azdata.downloadingProgressMb', "Downloading ({0} / {1} MB)", currentMb, totalMb); }
export const downloadFinished = localize('azdata.downloadFinished', "Download finished");
export const installingAzdata = localize('azdata.installingAzdata', "Installing azdata...");
export const upgradingAzdata = localize('azdata.upgradingAzdata', "Upgrading azdata...");
export const azdataInstalled = localize('azdata.azdataInstalled', "azdata was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const azdataUpgraded = localize('azdata.azdataUpgraded', "azdata was successfully upgraded.");
export const cancel = localize('azdata.cancel', "Cancel");
export const yes = localize('azdata.yes', "Yes");
export const no = localize('azdata.no', "No");
export function downloadingTo(name: string, location: string): string { return localize('azdata.downloadingTo', "Downloading {0} to {1}", name, location); }
export function executingCommand(command: string, args: string[]): string { return localize('azdata.executingCommand', "Executing command \"{0} {1}\"", command, args?.join(' ')); }
export function stdoutOutput(stdout: string): string { return localize('azdata.stdoutOutput', "stdout : {0}", stdout); }
export function stderrOutput(stderr: string): string { return localize('azdata.stderrOutput', "stderr : {0}", stderr); }
export const checkingLatestAzdataVersion = localize('azdata.checkingLatestAzdataVersion', "Checking for latest version of azdata");
export function gettingTextContentsOfUrl(url: string): string { return localize('azdata.gettingTextContentsOfUrl', "Getting text contents of resource at URL {0}", url); }
export function foundAzdataVersionToUpgradeTo(version: string): string { return localize('azdata.versionForUpgrade', "Found version {0} that azdata-cli can be upgraded to.", version); }
export function promptForAzdataUpgrade(version: string): string { return localize('azdata.promptForAzdataUpgrade', "An updated version of azdata ( {0} ) is available, do you wish to install it now?", version); }
export function couldNotFindAzdata(err: any): string { return localize('azdata.couldNotFindAzdata', "Could not find azdata. Error : {0}", err.message ?? err); }
export const couldNotFindAzdataWithPrompt = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find azdata, install it now? If not then some features will not be able to function.");
export const downloadError = localize('azdata.downloadError', "Error while downloading");
export function installError(err: any): string { return localize('azdata.installError', "Error installing azdata : {0}", err.message ?? err); }
export function platformUnsupported(platform: string): string { return localize('azdata.platformUnsupported', "Platform '{0}' is currently unsupported", platform); }
export function unexpectedCommandError(errMsg: string): string { return localize('azdata.unexpectedCommandError', "Unexpected error executing command : {0}", errMsg); }
export function updateError(err: any): string { return localize('azdata.updateError', "Error updating azdata : {0}", err.message ?? err); }
export function unexpectedExitCode(code: number, err: string): string { return localize('azdata.unexpectedExitCode', "Unexpected exit code from command : {1} ({0})", code, err); }
export const noAzdata = localize('azdata.NoAzdata', "No azdata available");
