/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dataworkspace from 'dataworkspace';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IconPathHelper } from '../common/iconHelper';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { Project } from '../models/project';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';

export class SqlDatabaseProjectProvider implements dataworkspace.IProjectProvider {
	constructor(private projectController: ProjectsController) {

	}

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
			id: constants.emptySqlDatabaseProjectTypeId,
			projectFileExtension: constants.sqlprojExtension.replace(/\./g, ''),
			displayName: constants.emptyProjectTypeDisplayName,
			description: constants.emptyProjectTypeDescription,
			icon: IconPathHelper.colorfulSqlProject
		},
		{
			id: constants.edgeSqlDatabaseProjectTypeId,
			projectFileExtension: constants.sqlprojExtension.replace(/\./g, ''),
			displayName: constants.edgeProjectTypeDisplayName,
			description: constants.edgeProjectTypeDescription,
			icon: IconPathHelper.sqlEdgeProject
		}];
	}

	/**
	 * Create a project
	 * @param name name of the project
	 * @param location the parent directory
	 * @param projectTypeId the ID of the project/template
	 * @returns Uri of the newly created project file
	 */
	async createProject(name: string, location: vscode.Uri, projectTypeId: string): Promise<vscode.Uri> {
		const projectFile = await this.projectController.createNewProject({
			newProjName: name,
			folderUri: location,
			projectTypeId: projectTypeId
		});

		return vscode.Uri.file(projectFile);
	}

	/**
	 * Gets the supported project types
	 */
	getProjectToolbarActions(): dataworkspace.IProjectAction[] {
		return [{
			id: constants.addItemAction,
			icon: IconPathHelper.add,
			run: async (treeItem): Promise<any> => await this.projectController.addItemPromptFromNode(treeItem)
		},
		{
			id: constants.schemaCompareAction,
			icon: IconPathHelper.schemaCompare,
			run: async (treeItem): Promise<any> => await this.projectController.schemaCompare(treeItem)
		},
		{
			id: constants.buildAction,
			icon: IconPathHelper.build,
			run: async (treeItem): Promise<any> => await this.projectController.buildProject(treeItem)
		},
		{
			id: constants.publishAction,
			icon: IconPathHelper.publish,
			toolbarSeparatorAfter: true,
			run: async (treeItem): Promise<any> => await this.projectController.publishProject(treeItem)
		},
		{
			id: constants.targetPlatformAction,
			icon: IconPathHelper.targetPlatform,
			run: async (treeItem): Promise<any> => await this.projectController.changeTargetPlatform(treeItem)
		}];
	}
}
