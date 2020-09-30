/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const ExtensionActivationErrorMessage = (extensionId: string, err: any): string => { return localize('activateExtensionFailed', "Failed to load the project provider extension '{0}'. Error message: {1}", extensionId, err.message ?? err); };
export const UnknownProjectsErrorMessage = (projectFiles: string[]): string => { return localize('UnknownProjectsError', "No provider was found for the following projects: {0}", projectFiles.join(EOL)); };

export const SelectProjectFileActionName = localize('SelectProjectFileActionName', "Select");
export const AllProjectTypes = localize('AllProjectTypes', "All Project Types");

