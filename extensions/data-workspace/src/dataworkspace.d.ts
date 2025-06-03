/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'dataworkspace' {
	import * as azdata from 'azdata';
	import * as vscode from 'vscode';
	export const enum extension {
		name = 'Microsoft.data-workspace',
		vscodeName = 'ms-mssql.data-workspace-vscode'
	}

	/**
	 * dataworkspace extension
	 */
	export interface IExtension {
		/**
		 * Returns all the projects in the workspace
		 * @param ext project extension to filter on. If this is passed in, this will only return projects with this file extension
		 * @param refreshFromDisk whether to rescan the folder for project files, or return the cached version. Defaults to false.
		 */
		getProjectsInWorkspace(ext?: string, refreshFromDisk?: boolean): Promise<vscode.Uri[]>;

		/**
		 * Add projects to the workspace
		 * @param projectFiles Uris of project files to add
		 */
		addProjectsToWorkspace(projectFiles: vscode.Uri[]): Promise<void>;

		/**
		 * Change focus to Projects view
		 */
		showProjectsView(): void;

		/**
		 * Fires event to refresh the project tree. The tree is not guaranteed to be refreshed after this call returns
		 */
		refreshProjectsTree(): void;

		/**
		 * Returns the default location to save projects
		 */
		defaultProjectSaveLocation: vscode.Uri | undefined;

		/**
		  * Verifies that a workspace is open or if it should be automatically created
		  */
		validateWorkspace(): Promise<boolean>;

		/**
		 * Opens the new project dialog with only the specified project type
		 * @param projectType project type to open the dialog for
		 * @returns the uri of the created the project or undefined if no project was created
		 */
		openSpecificProjectNewProjectDialog(projectType: IProjectType): Promise<vscode.Uri | undefined>;

		/**
		 * Determines if a given character is a valid filename character
		 * @param c Character to validate
		 */
		isValidFilenameCharacter(c: string): boolean;

		/**
		 * Replaces invalid filename characters in a string with underscores
		 * @param s The string to be sanitized for a filename
		*/
		sanitizeStringForFilename(s: string): string;

		/**
		 * Returns true if the string is a valid filename
		 * Logic is copied from src\vs\base\common\extpath.ts
		 * @param name filename to check
		*/
		isValidBasename(name: string | null | undefined): boolean;

		/**
		 * Returns specific error message if file name is invalid otherwise returns undefined
		 * Logic is copied from src\vs\base\common\extpath.ts
		 * @param name filename to check
		 */
		isValidBasenameErrorMessage(name: string | null | undefined): string | undefined;
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
		 *
		 * @param name Create a project
		 * @param location the parent directory of the project
		 * @param projectTypeId the identifier of the selected project type
		 * @param projectTargetPlatform the target platform of the project
		 * @param sdkStyleProject whether or not a project is SDK-style
		 * @param configureDefaultBuild whether or not to configure default build
		 */
		createProject(name: string, location: vscode.Uri, projectTypeId: string, projectTargetPlatform?: string, sdkStyleProject?: boolean, configureDefaultBuild?: boolean): Promise<vscode.Uri>;

		/**
		 * Gets the project data corresponding to the project file, to be placed in the dashboard container
		 */
		getDashboardComponents(projectFile: string): IDashboardTable[];

		/**
		 * Gets the supported project types
		 */
		readonly supportedProjectTypes: IProjectType[];

		/**
		 * Gets the project actions to be placed on the dashboard toolbar
		 */
		readonly projectToolbarActions: (IProjectAction | IProjectActionGroup)[];

		/**
		 * Gets the project image to be used as background in dashboard container
		 */
		readonly image?: azdata.ThemedIconPath;

		/**
		 * Whether or not the tree data provider supports drag and drop
		 */
		readonly supportsDragAndDrop?: boolean;

		/**
		 * Moves a file from the source to target location. Must be implemented if supportsDragAndDrop is true
		 * @param projectUri
		 * @param source
		 * @param target
		 */
		moveFile?(projectUri: vscode.Uri, source: any, target: WorkspaceTreeItem): Promise<void>;
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
		readonly icon: azdata.IconPath;

		/**
		  * Gets the target platforms that can be selected when creating a new project
		 */
		readonly targetPlatforms?: string[];

		/**
		 * Gets the default target platform
		 */
		readonly defaultTargetPlatform?: string;

		/**
		 * Whether or not sdk style project is an option
		 */
		readonly sdkStyleOption?: boolean;

		/**
		 * Location where clicking on the Learn More next to SDK style checkbox will go. sdkStyleOption needs to be set to true to use this
		 */
		readonly sdkStyleLearnMoreUrl?: string

		/**
		 * Location where clicking on the Learn More to know more about project type will go
		 */
		readonly learnMoreUrl?: string

		/**
		 * Whether or not the project has a default build configuration
		 */
		readonly configureDefaultBuild?: boolean;
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

	export interface IProjectAction {
		/**
		 * id of the project action
		 */
		readonly id: string;

		/**
		 * icon path of the project action
		 */
		readonly icon?: azdata.IconPath;

		/**
		 * Run context for each project action
		 * @param treeItem The treeItem in a project's hierarchy, to be used to obtain a Project
		 */
		run(treeItem: WorkspaceTreeItem): void;
	}

	/**
	 * List of project actions that should be grouped and have a separator after the last action
	 */
	export interface IProjectActionGroup {
		actions: IProjectAction[];
	}

	/**
	 * Defines table to be presented in the dashboard container
	 */
	export interface IDashboardTable {
		/**
		 * name of the table
		 */
		name: string;

		/**
		 * column definitions
		 */
		columns: IDashboardColumnInfo[];

		/**
		 * project data
		 */
		data: (string | IconCellValue)[][];
	}

	/**
	 * Project dashboard table's column information
	 */
	export interface IDashboardColumnInfo {
		displayName: string;
		width: number | string;
		type?: IDashboardColumnType;
	}

	/**
	 * Cell value of an icon for the table data
	 */
	export interface IconCellValue {
		text: string;
		icon: azdata.IconPath;
	}

	/**
	 * Union type representing data types in dashboard table
	 */
	export type IDashboardColumnType = 'string' | 'icon';

}
