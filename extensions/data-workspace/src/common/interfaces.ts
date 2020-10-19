/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
	registerProvider(provider: IProjectProvider): vscode.Disposable;

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
	 */
	getProjectsInWorkspace(): vscode.Uri[];

	/**
	 * Gets the project provider by project file
	 * @param projectFileUri The Uri of the project file
	 */
	getProjectProvider(projectFileUri: vscode.Uri): Promise<IProjectProvider | undefined>;

	/**
	 * Adds the projects to workspace, if a project is not in the workspace folder, its containing folder will be added to the workspace
	 * @param projectFiles the list of project files to be added, the project file should be absolute path.
	 */
	addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void>;

	/**
	 * Remove the project from workspace
	 * @param projectFile The project file to be removed
	 */
	removeProject(projectFile: vscode.Uri): Promise<void>;

	/**
	 * Creates a new project from workspace
	 * @param name The name of the project
	 * @param location The location of the project
	 * @param projectTypeId The project type id
	 */
	createProject(name: string, location: vscode.Uri, projectTypeId: string): Promise<vscode.Uri>;

	readonly isProjectProviderAvailable: boolean;

	/**
	 * Event fires when projects in workspace changes
	 */
	readonly onDidWorkspaceProjectsChange: vscode.Event<void>;

	/**
	 * Verify that a workspace is open or it is ok to create a workspace if one needs to be created
	 */
	validateWorkspace(): Promise<boolean>;
}
