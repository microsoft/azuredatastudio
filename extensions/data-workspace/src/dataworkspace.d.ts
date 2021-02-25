/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'dataworkspace' {
	import * as vscode from 'vscode';
	export const enum extension {
		name = 'Microsoft.data-workspace'
	}

	/**
	 * dataworkspace extension
	 */
	export interface IExtension {
		/**
		 * Returns all the projects in the workspace
		 * @param ext project extension to filter on. If this is passed in, this will only return projects with this file extension
		 */
		getProjectsInWorkspace(ext?: string): vscode.Uri[];

		/**
		 * Add projects to the workspace
		 * @param projectFiles Uris of project files to add,
		 * @param workspaceFilePath workspace file to create if no workspace is open
		 */
		addProjectsToWorkspace(projectFiles: vscode.Uri[], workspaceFilePath?: vscode.Uri): Promise<void>;

		/**
		 * Change focus to Projects view
		 */
		showProjectsView(): void;

		/**
		 * Returns the default location to save projects
		 */
		defaultProjectSaveLocation: vscode.Uri | undefined;

		/**
	 	* Verifies that a workspace is open or if it should be automatically created
	 	*/
		validateWorkspace(): Promise<boolean>;
	}

	/**
	 * Defines the capabilities of project provider
	 */
	export interface IProjectProvider {
		/**
		 * Gets the tree data provider for the given project file
		 * @param projectFile The Uri of the project file
		 */
		getProjectTreeDataProvider(projectFile: vscode.Uri): Promise<vscode.TreeDataProvider<any>>;

		/**
		 * Notify the project provider extension that the specified project file has been removed from the data workspace
		 * @param projectFile The Uri of the project file
		 */
		RemoveProject(projectFile: vscode.Uri): Promise<void>;

		/**
		 *
		 * @param name Create a project
		 * @param location the parent directory of the project
		 * @param projectTypeId the identifier of the selected project type
		 */
		createProject(name: string, location: vscode.Uri, projectTypeId: string): Promise<vscode.Uri>;

		/**
		 * Gets the supported project types
		 */
		readonly supportedProjectTypes: IProjectType[];
	}

	/**
	 * Defines the project type
	 */
	export interface IProjectType {
		/**
		 * id of the project type
		 */
		readonly id: string;

		/**
		 * display name of the project type
		 */
		readonly displayName: string;

		/**
		 * description of the project type
		 */
		readonly description: string;

		/**
		 * project file extension, e.g. sqlproj
		 */
		readonly projectFileExtension: string;

		/**
		 * Gets the icon path of the project type
		 */
		readonly icon: string | vscode.Uri | { light: string | vscode.Uri, dark: string | vscode.Uri }
	}

	/**
	 * Represents the item for the workspace tree
	 */
	export interface WorkspaceTreeItem {
		/**
		 * Gets the tree data provider
		 */
		treeDataProvider: vscode.TreeDataProvider<any>;

		/**
		 * Gets the raw element returned by the tree data provider
		 */
		element: any;
	}
}
