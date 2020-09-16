/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dataworkspace from 'dataworkspace';
import * as vscode from 'vscode';
import { sqlprojExtension, projectTypeDisplayName } from '../common/constants';
import { IconPathHelper } from '../common/iconHelper';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { Project } from '../models/project';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';

export class SqlDatabaseProjectProvider implements dataworkspace.IProjectProvider {

	/**
	 * Gets the project tree data provider
	 * @param projectFile The project file Uri
	 */
	async getProjectTreeDataProvider(projectFilePath: vscode.Uri): Promise<vscode.TreeDataProvider<BaseProjectTreeItem>> {
		const provider = new SqlDatabaseProjectTreeViewProvider();
		const project = await Project.openProject(projectFilePath.fsPath);
		provider.load([project]);
		return provider;
	}

	/**
	 * Callback method when a project has been removed from the workspace view
	 * @param projectFile The Uri of the project file
	 */
	RemoveProject(projectFile: vscode.Uri): Promise<void> {
		// No resource release needed
		console.log(`project file unloaded: ${projectFile.fsPath}`);
		return Promise.resolve();
	}

	/**
	 * Gets the supported project types
	 */
	get supportedProjectTypes(): dataworkspace.IProjectType[] {
		return [{
			projectFileExtension: sqlprojExtension.replace(/\./g, ''),
			displayName: projectTypeDisplayName,
			icon: IconPathHelper.databaseProject
		}];
	}
}
