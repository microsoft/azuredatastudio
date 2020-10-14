/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const ExtensionActivationError = (extensionId: string, err: any): string => { return localize('activateExtensionFailed', "Failed to load the project provider extension '{0}'. Error message: {1}", extensionId, err.message ?? err); };
export const UnknownProjectsError = (projectFiles: string[]): string => { return localize('UnknownProjectsError', "No provider was found for the following projects: {0}", projectFiles.join(EOL)); };

export const SelectProjectFileActionName = localize('SelectProjectFileActionName', "Select");
export const AllProjectTypes = localize('AllProjectTypes', "All Project Types");
export const ProviderNotFoundForProjectTypeError = (projectType: string): string => { return localize('UnknownProjectTypeError', "No provider was found for project type with id: '{0}'", projectType); };
export const WorkspaceRequiredMessage = localize('dataworkspace.workspaceRequiredMessage', "A workspace is required in order to use the project feature.");
export const OpenWorkspace = localize('dataworkspace.openWorkspace', "Open Workspace…");
export const CreateWorkspaceConfirmation = localize('dataworkspace.createWorkspaceConfirmation', "A new workspace will be created and opened in order to open project. The Extension Host will restart and if there is a folder currently open, it will be closed.");

// UI
export const OkButtonText = localize('dataworkspace.ok', "OK");
export const BrowseButtonText = localize('dataworkspace.browse', "Browse");
export const DefaultInputWidth = '400px';
export const DefaultButtonWidth = '80px';

// New Project Dialog
export const NewProjectDialogTitle = localize('dataworkspace.NewProjectDialogTitle', "Create new project");
export const ProjectTypeSelectorTitle = localize('dataworkspace.ProjectTypeSelectorTitle', "Type");
export const ProjectNameTitle = localize('dataworkspace.projectNameTitle', "Name");
export const ProjectNamePlaceholder = localize('dataworkspace.projectNamePlaceholder', "Enter project name");
export const ProjectLocationTitle = localize('dataworkspace.projectLocationTitle', "Location");
export const ProjectLoacationPlaceholder = localize('dataworkspace.projectLocationPlaceholder', "Select folder");
export const ProjectParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.projectParentDirectoryNotExistError', "The selected location: '{0}' does not exist or is not a directory.", location); };
export const ProjectDirectoryAlreadyExistError = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };

//Open Existing Project Dialog
export const OpenProjectDialogTitle = localize('dataworkspace.openProjectDialogTitle', "Open existing project");
export const ProjectFileNotExistError = (projectFilePath: string): string => { return localize('dataworkspace.projectFileNotExistError', "The selected project file: '{0}' does not exist or is not a file.", projectFilePath); };
export const LocalFileSystem = localize('dataworkspace.localFileSystem', "Local File");
export const LocationSelectorTitle = localize('dataworkspace.LocationSelectorTitle', "Location");
export const ProjectFileTitle = localize('dataworkspace.projectFileTitle', "Project file");
export const ProjectFilePlaceholder = localize('dataworkspace.projectFilePlaceholder', "Select project file");
