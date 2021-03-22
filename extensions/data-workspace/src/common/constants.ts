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
export const CreateWorkspaceConfirmation = localize('dataworkspace.createWorkspaceConfirmation', "A workspace will be created and opened in order to open project. Azure Data Studio will restart and if there is a folder currently open, it will be closed.");
export const EnterWorkspaceConfirmation = localize('dataworkspace.enterWorkspaceConfirmation', "To open this workspace, Azure Data Studio will restart. If there is a workspace or folder currently open, it will be closed.");
export const WorkspaceContainsNotAddedProjects = localize('dataworkspace.workspaceContainsNotAddedProjects', "The current workspace contains one or more projects that have not been added to the workspace. Use the 'Open existing' dialog to add projects to the projects pane.");
export const LaunchOpenExisitingDialog = localize('dataworkspace.launchOpenExistingDialog', "Launch Open existing dialog");
export const DoNotShowAgain = localize('dataworkspace.doNotShowAgain', "Do not show again");
export const ProjectsFailedToLoad = localize('dataworkspace.projectsFailedToLoad', "Some projects failed to load. Please open console for more information");

// config settings
export const projectsConfigurationKey = 'projects';
export const showNotAddedProjectsMessageKey = 'showNotAddedProjectsInWorkspacePrompt';

// UI
export const OkButtonText = localize('dataworkspace.ok', "OK");
export const CancelButtonText = localize('dataworkspace.cancel', "Cancel");
export const BrowseButtonText = localize('dataworkspace.browse', "Browse");
export const WorkspaceFileExtension = '.code-workspace';
export const DefaultInputWidth = '400px';
export const DefaultButtonWidth = '80px';

// New Project Dialog
export const NewProjectDialogTitle = localize('dataworkspace.NewProjectDialogTitle', "Create new project");
export const TypeTitle = localize('dataworkspace.Type', "Type");
export const ProjectNameTitle = localize('dataworkspace.projectNameTitle', "Name");
export const ProjectNamePlaceholder = localize('dataworkspace.projectNamePlaceholder', "Enter project name");
export const ProjectLocationTitle = localize('dataworkspace.projectLocationTitle', "Location");
export const ProjectLocationPlaceholder = localize('dataworkspace.projectLocationPlaceholder', "Select location to create project");
export const AddProjectToCurrentWorkspace = localize('dataworkspace.AddProjectToCurrentWorkspace', "This project will be added to the current workspace.");
export const NewWorkspaceWillBeCreated = localize('dataworkspace.NewWorkspaceWillBeCreated', "A workspace will be created for this project.");
export const WorkspaceLocationTitle = localize('dataworkspace.workspaceLocationTitle', "Workspace location");
export const ProjectParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.projectParentDirectoryNotExistError', "The selected project location '{0}' does not exist or is not a directory.", location); };
export const ProjectDirectoryAlreadyExistError = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };
export const WorkspaceFileInvalidError = (workspace: string): string => { return localize('dataworkspace.workspaceFileInvalidError', "The selected workspace file path '{0}' does not have the required file extension {1}.", workspace, WorkspaceFileExtension); };
export const WorkspaceParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.workspaceParentDirectoryNotExistError', "The selected workspace location '{0}' does not exist or is not a directory.", location); };
export const WorkspaceFileAlreadyExistsError = (file: string): string => { return localize('dataworkspace.workspaceFileAlreadyExistsError', "The selected workspace file '{0}' already exists. To add the project to an existing workspace, use the Open Existing dialog to first open the workspace.", file); };

//Open Existing Dialog
export const OpenExistingDialogTitle = localize('dataworkspace.openExistingDialogTitle', "Open existing");
export const FileNotExistError = (fileType: string, filePath: string): string => { return localize('dataworkspace.fileNotExistError', "The selected {0} file '{1}' does not exist or is not a file.", fileType, filePath); };
export const CloneDirectoryNotExist = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };
export const CloneParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.cloneParentDirectoryNotExistError', "The selected clone path '{0}' does not exist or is not a directory.", location); };
export const Project = localize('dataworkspace.project', "Project");
export const Workspace = localize('dataworkspace.workspace', "Workspace");
export const LocationSelectorTitle = localize('dataworkspace.locationSelectorTitle', "Location");
export const ProjectFilePlaceholder = localize('dataworkspace.projectFilePlaceholder', "Select project (.sqlproj) file");
export const WorkspacePlaceholder = localize('dataworkspace.workspacePlaceholder', "Select workspace ({0}) file", WorkspaceFileExtension);
export const ProjectAlreadyOpened = (path: string): string => { return localize('dataworkspace.projectAlreadyOpened', "Project '{0}' is already opened.", path); };
export const Local = localize('dataworksapce.local', 'Local');
export const RemoteGitRepo = localize('dataworkspace.remoteGitRepo', "Remote git repository");
export const GitRepoUrlTitle = localize('dataworkspace.gitRepoUrlTitle', "Git repository URL");
export const GitRepoUrlPlaceholder = localize('dataworkspace.gitRepoUrlPlaceholder', "Enter remote git repository URL");
export const LocalClonePathTitle = localize('dataworkspace.localClonePathTitle', "Local clone path");
export const LocalClonePathPlaceholder = localize('dataworkspace.localClonePathPlaceholder', "Select location to clone repository locally");

// Workspace settings for saving new projects
export const ProjectConfigurationKey = 'projects';
export const ProjectSaveLocationKey = 'defaultProjectSaveLocation';
