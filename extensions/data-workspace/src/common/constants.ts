/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const ExtensionActivationError = (extensionId: string, err: any): string => { return localize('activateExtensionFailed', "Failed to load the project provider extension '{0}'. Error message: {1}", extensionId, err.message ?? err); };
export const UnknownProjectsError = (projectFiles: string[]): string => { return localize('UnknownProjectsError', "No provider was found for the following projects: {0}", projectFiles.join(EOL)); };

export const SelectProjectFileActionName = localize('SelectProjectFileActionName', "Select");
export const AllProjectTypes = localize('AllProjectTypes', "All Project Types");
export const ProviderNotFoundForProjectTypeError = (projectType: string): string => { return localize('UnknownProjectTypeError', "No provider was found for project type with id: '{0}'", projectType); };
export const RestartConfirmation = localize('dataworkspace.restartConfirmation', "Azure Data Studio needs to be restarted for the project to be added to the workspace. Restart now?");
export const projectFailedToLoad = (project: string, error: string) => { return localize('projectFailedToLoad', "Project '{0}' failed to load: {1}  To view more details, [open the developer console](command:workbench.action.toggleDevTools).", project, error) };
export const fileDoesNotExist = (name: string): string => { return localize('fileDoesNotExist', "File '{0}' doesn't exist", name); };
export const projectNameNull = localize('projectNameNull', "Project name is null");
export const noPreviousData = (tableName: string): string => { return localize('noPreviousData', "Prior {0} for the current project will appear here, please run to see the results.", tableName); };
export const gitCloneMessage = (url: string): string => { return localize('gitCloneMessage', "Cloning git repository '{0}'...", url); };
export const gitCloneError = localize('gitCloneError', "Error during git clone. View git output for more details");
export const openedProjectsUndefinedAfterRefresh = localize('openedProjectsUndefinedAfterRefresh', "List of opened projects should not be undefined after refresh from disk.");
export const dragAndDropNotSupported = localize('dragAndDropNotSupported', "This project type does not support drag and drop.");
export const onlyMovingOneFileIsSupported = localize('onlyMovingOneFileIsSupported', "Only moving one file at a time is supported.");
export const noProjectProvidingExtensionsInstalled = localize('noProjectProvidingExtensionsInstalled', "No database project extensions are installed. Please install a database project extension to use this feature.");

// UI
export const OkButtonText = localize('dataworkspace.ok', "OK");
export const BrowseButtonText = localize('dataworkspace.browse', "Browse");
export const BrowseEllipsis = localize('dataworkspace.browseEllipsis', "Browse...");
export const BrowseEllipsisWithIcon = `$(folder) ${BrowseEllipsis}`;
export const OpenButtonText = localize('dataworkspace.open', "Open");
export const CreateButtonText = localize('dataworkspace.create', "Create");
export const Select = localize('dataworkspace.select', "Select");
export const WorkspaceFileExtension = '.code-workspace';
export const DefaultInputWidth = '400px';
export const DefaultButtonWidth = '80px';
export const DataWorkspaceOutputChannel = 'Data Workspace';

// New Project Dialog
export const NewProjectDialogTitle = localize('dataworkspace.NewProjectDialogTitle', "Create new database project");
export const TypeTitle = localize('dataworkspace.Type', "Type");
export const ProjectNameTitle = localize('dataworkspace.projectNameTitle', "Name");
export const ProjectNamePlaceholder = localize('dataworkspace.projectNamePlaceholder', "Enter project name");
export const EnterProjectName = localize('dataworkspace.enterProjectName', "Enter Project Name");
export const ProjectLocationTitle = localize('dataworkspace.projectLocationTitle', "Location");
export const ProjectLocationPlaceholder = localize('dataworkspace.projectLocationPlaceholder', "Select location to create project");
export const ProjectParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.projectParentDirectoryNotExistError', "The selected project location '{0}' does not exist or is not a directory.", location); };
export const ProjectDirectoryAlreadyExistError = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };
export const ProjectDirectoryAlreadyExistErrorShort = (projectName: string) => { return localize('dataworkspace.projectDirectoryAlreadyExistErrorShort', "Directory '{0}' already exists in the selected location, please choose another", projectName); };
export const SelectProjectType = localize('dataworkspace.selectProjectType', "Select Database Project Type");
export const SelectProjectLocation = localize('dataworkspace.selectProjectLocation', "Select Project Location");
export const NameCannotBeEmpty = localize('dataworkspace.nameCannotBeEmpty', "Name cannot be empty");
export const TargetPlatform = localize('dataworkspace.targetPlatform', "Target Platform");
export const SdkStyleProject = localize('dataworkspace.sdkStyleProject', "SDK-style project");
export const LearnMore = localize('dataworkspace.learnMore', "Learn More");
export const YesRecommended = localize('dataworkspace.yesRecommended', "Yes (Recommended)");
export const No = localize('dataworkspace.no', "No");
export const Yes = localize('dataworkspace.yes', "Yes");
export const SdkLearnMorePlaceholder = localize('dataworkspace.sdkLearnMorePlaceholder', "Click \"Learn More\" button for more information about SDK-style projects");
export const Default = localize('dataworkspace.default', "Default");
export const SelectTargetPlatform = localize('dataworkspace.selectTargetPlatform', "Select Target Platform");
export const LocalDevInfo = (target: string) => localize('LocalDevInfo', "Click \"Learn more\" button for more information about local development experience to {0}", target);
export const undefinedFilenameErrorMessage = localize('undefinedFilenameErrorMessage', "Undefined name");
export const filenameEndingIsPeriodErrorMessage = localize('filenameEndingInPeriodErrorMessage', "File name cannot end with a period");
export const whitespaceFilenameErrorMessage = localize('whitespaceFilenameErrorMessage', "File name cannot be whitespace");
export const invalidFileCharsErrorMessage = localize('invalidFileCharsErrorMessage', "Invalid file characters");
export const reservedWindowsFilenameErrorMessage = localize('reservedWindowsFilenameErrorMessage', "This file name is reserved for use by Windows. Choose another name and try again");
export const reservedValueErrorMessage = localize('reservedValueErrorMessage', "Reserved file name. Choose another name and try again");
export const trailingWhitespaceErrorMessage = localize('trailingWhitespaceErrorMessage', "File name cannot start or end with whitespace");
export const tooLongFilenameErrorMessage = localize('tooLongFilenameErrorMessage', "File name cannot be over 255 characters");
export const confirmCreateProjectWithBuildTaskDialogName = localize('confirmCreateProjectWithBuildTaskDialogName', "Do you want to configure SQL project build as the default build configuration for this folder?");

//Open Existing Dialog
export const OpenExistingDialogTitle = localize('dataworkspace.openExistingDialogTitle', "Open Existing Project");
export const FileNotExistError = (fileType: string, filePath: string): string => { return localize('dataworkspace.fileNotExistError', "The selected {0} file '{1}' does not exist or is not a file.", fileType, filePath); };
export const CloneParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.cloneParentDirectoryNotExistError', "The selected clone path '{0}' does not exist or is not a directory.", location); };
export const Project = localize('dataworkspace.project', "Project");
export const LocationSelectorTitle = localize('dataworkspace.locationSelectorTitle', "Location");
export const ProjectFilePlaceholder = localize('dataworkspace.projectFilePlaceholder', "Select project file");
export const WorkspacePlaceholder = localize('dataworkspace.workspacePlaceholder', "Select workspace ({0}) file", WorkspaceFileExtension);
export const ProjectAlreadyOpened = (path: string): string => { return localize('dataworkspace.projectAlreadyOpened', "Project '{0}' is already opened.", path); };
export const Local = localize('dataworksapce.local', 'Local');
export const RemoteGitRepo = localize('dataworkspace.remoteGitRepo', "Remote git repository");
export const GitRepoUrlTitle = localize('dataworkspace.gitRepoUrlTitle', "Git repository URL");
export const GitRepoUrlPlaceholder = localize('dataworkspace.gitRepoUrlPlaceholder', "Enter remote git repository URL");
export const LocalClonePathTitle = localize('dataworkspace.localClonePathTitle', "Local clone path");
export const LocalClonePathPlaceholder = localize('dataworkspace.localClonePathPlaceholder', "Select location to clone repository locally");
export const ProjectFileTitle = localize('dataworkspace.projectFileTitle', "Project file");

// Workspace settings for saving new projects
export const ProjectConfigurationKey = 'projects';
export const ProjectSaveLocationKey = 'defaultProjectSaveLocation';

// Dashboard dialog
export const Refresh = localize('dataworksapce.refresh', 'Refresh');

export namespace cssStyles {
	export const title = { 'font-size': '18px', 'font-weight': '600' };
	export const tableHeader = { 'text-align': 'left', 'font-weight': '500', 'font-size': '13px', 'user-select': 'text' };
	export const tableRow = { 'border-top': 'solid 1px #ccc', 'border-bottom': 'solid 1px #ccc', 'border-left': 'none', 'border-right': 'none' };
}
