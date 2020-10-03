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

// UI
export const OkButtonText = localize('dataworkspace.ok', "OK");
export const BrowseButtonText = localize('dataworkspace.browse', "Browse");
export const DefaultInputWidth = '400px';
export const DefaultButtonWidth = '100px';

// New Project Dialog
export const NewProjectDialogTitle = localize('dataworkspace.NewProjectDialogTitle', "New Project");
export const ProjectTypeSelectorTitle = localize('dataworkspace.ProjectTypeSelectorTitle', "Project type");
export const ProjectNameTitle = localize('dataworkspace.projectNameTitle', "Project name");
export const ProjectLocationTitle = localize('dataworkspace.projectLocationTitle', "Location");
export const ProjectParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.projectParentDirectoryNotExistError', "The selected location: '{0}' does not exist or is not a directory.", location); };
export const ProjectDirectoryAlreadyExistError = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };

//Open Project Dialog
export const OpenProjectDialogTitle = localize('dataworkspace.openProjectDialogTitle', "Open Project");




