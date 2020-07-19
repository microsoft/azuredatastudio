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
export const install = localize('azdata.install', "Install");
export const installingAzdata = localize('azdata.installingAzdata', "Installing azdata...");
export const azdataInstalled = localize('azdata.azdataInstalled', "azdata was successfully installed. Restarting Azure Data Studio is required to complete configuration - features will not be activated until this is done.");
export const cancel = localize('azdata.cancel', "Cancel");
export function downloadingTo(name: string, location: string): string { return localize('azdata.downloadingTo', "Downloading {0} to {1}", name, location); }
export function couldNotFindAzdata(err: any): string { return localize('azdata.couldNotFindAzdata', "Could not find azdata. Error : {0}", err.message ?? err); }
export const couldNotFindAzdataWithPrompt = localize('azdata.couldNotFindAzdataWithPrompt', "Could not find azdata, install it now? If not then some features will not be able to function.");
export const downloadError = localize('azdata.downloadError', "Error while downloading");
export function installError(err: any): string { return localize('azdata.installError', "Error installing azdata : {0}", err.message ?? err); }
export function executingCommand(command: string, args: string[]): string { return localize('azdata.executingCommand', "Executing command \"{0} {1}\"", command, args?.join(' ')); }
