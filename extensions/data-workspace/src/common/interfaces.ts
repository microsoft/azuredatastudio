/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dataworkspace from 'dataworkspace';
import * as vscode from 'vscode';

/**
 * Defines the project provider registry
 */
export interface IProjectProviderRegistry {
	/**
	 * Registers a new project provider
	 * @param provider The project provider
	 */
	registerProvider(provider: dataworkspace.IProjectProvider): vscode.Disposable;

	/**
	 * Gets all the registered providers
	 */
	readonly providers: dataworkspace.IProjectProvider[];
}

/**
 * Defines the project service
 */
export interface IProjectService {
	/**
	 * Gets all supported project types
	 */
	getProjectTypes(): Promise<dataworkspace.IProjectType[]>;

	/**
	 * Gets the project files in current workspace
	 */
	getProjectsInWorkspace(): Promise<string[]>;

	/**
	 * Gets the project provider by project file
	 * @param projectFilePath The full path of the project file
	 */
	getProjectProvider(projectFilePath: string): Promise<dataworkspace.IProjectProvider | undefined>;
}

/**
 * Represents the item for the project tree
 */
export interface ProjectTreeItem {
	/**
	 * Gets the tree data provider
	 */
	treeDataProvider: vscode.TreeDataProvider<any>;

	/**
	 * Gets the raw element returned by the tree data provider
	 */
	element: any;
}

export interface DataWorkspace {
	projects: string[];
}
