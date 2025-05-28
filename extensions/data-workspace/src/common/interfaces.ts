/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProjectProvider, IProjectType } from 'dataworkspace';
import * as vscode from 'vscode';

/**
 * Defines the project provider registry
 */
export interface IProjectProviderRegistry {
	/**
	 * Registers a new project provider
	 * @param provider The project provider
	 */
	registerProvider(provider: IProjectProvider, providerId: string): vscode.Disposable;

	/**
	 * Clear the providers
	 */
	clear(): void;

	/**
	 * Gets all the registered providers
	 */
	readonly providers: IProjectProvider[];

	/**
	 * Gets the project provider for the specified project extension
	 * @param extension The file extension of the project
	 */
	getProviderByProjectExtension(extension: string): IProjectProvider | undefined;

	/**
	 * Gets the project provider for the specified project type
	 * @param projectType The id of the project type
	 */
	getProviderByProjectType(projectType: string): IProjectProvider | undefined;
}

/**
 * Defines the project service
 */
export interface IWorkspaceService {
	/**
	 * Gets all supported project types
	 */
	getAllProjectTypes(): Promise<IProjectType[]>;

	/**
	 * Gets the project files in current workspace
	 * @param ext project extension to filter on. If this is passed in, this will only return projects with this file extension
	 * @param refreshFromDisk whether to rescan the folder for project files, or return the cached version. Defaults to false.
	 */
	getProjectsInWorkspace(ext?: string, refreshFromDisk?: boolean): Promise<vscode.Uri[]>;

	/**
	 * Gets the project provider by project file
	 * @param projectFileUri The Uri of the project file
	 */
	getProjectProvider(projectFileUri: vscode.Uri): Promise<IProjectProvider | undefined>;

	/**
	 * Adds the projects to workspace, if a project is not in the workspace folder, its containing folder will be added to the workspace
	 * @param projectFiles the list of project files to be added, the project file should be absolute path.
	 * @param workspaceFilePath The workspace file to create if a workspace isn't currently open
	 */
	addProjectsToWorkspace(projectFiles: vscode.Uri[], workspaceFilePath?: vscode.Uri): Promise<void>;

	/**
	 * Creates a new project from workspace
	 * @param name The name of the project
	 * @param location The location of the project
	 * @param projectTypeId The project type id
	 * @param projectTargetPlatform The target platform of the project
	 * @param sdkStyleProject Whether or not the project is SDK-style
	 * @param configureDefaultBuild Whether or not to configure the default build
	 */
	createProject(name: string, location: vscode.Uri, projectTypeId: string, projectTargetPlatform?: string, sdkStyleProject?: boolean, configureDefaultBuild?: boolean): Promise<vscode.Uri>;

	/**
	 * Clones git repository and adds projects to workspace
	 * @param url The url to clone from
	 * @param localClonePath local path to clone repository to
	 */
	gitCloneProject(url: string, localClonePath: string): Promise<void>;

	/**
	 * Event fires when projects in workspace changes
	 */
	readonly onDidWorkspaceProjectsChange: vscode.Event<void>;

	/**
	 * Verify that a workspace is open or if one isn't, ask user to pick whether a workspace should be automatically created
	 */
	validateWorkspace(): Promise<boolean>;
}
