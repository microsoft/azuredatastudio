/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ThemedIconPath } from 'azdata';
import * as dataworkspace from 'dataworkspace';
import * as sqldbproj from 'sqldbproj';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IconPathHelper } from '../common/iconHelper';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';

export class SqlDatabaseProjectProvider implements dataworkspace.IProjectProvider, sqldbproj.IExtension {
	constructor(private projectController: ProjectsController) {

	}

	/**
	 * Gets the project tree data provider
	 * @param projectFile The project file Uri
	 */
	async getProjectTreeDataProvider(projectFilePath: vscode.Uri): Promise<vscode.TreeDataProvider<BaseProjectTreeItem>> {
		const provider = new SqlDatabaseProjectTreeViewProvider();
		const project = await this.projectController.openProject(projectFilePath);
		provider.load([project]);
		return provider;
	}

	/**
	 * Callback method when a project has been removed from the workspace view
	 * @param projectFile The Uri of the project file
	 */
	RemoveProject(projectFile: vscode.Uri): Promise<void> {
		this.projectController.removeProject(projectFile);
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
	get projectActions(): (dataworkspace.IProjectAction | dataworkspace.IProjectActionGroup)[] {
		const addItemAction: dataworkspace.IProjectAction = {
			id: constants.addItemAction,
			icon: IconPathHelper.add,
			run: (treeItem: dataworkspace.WorkspaceTreeItem) => this.projectController.addItemPromptFromNode(treeItem)
		};

		const schemaCompareAction: dataworkspace.IProjectAction = {
			id: constants.schemaCompareAction,
			icon: IconPathHelper.schemaCompare,
			run: (treeItem: dataworkspace.WorkspaceTreeItem) => this.projectController.schemaCompare(treeItem)
		};

		const buildAction: dataworkspace.IProjectAction = {
			id: constants.buildAction,
			icon: IconPathHelper.build,
			run: (treeItem: dataworkspace.WorkspaceTreeItem) => this.projectController.buildProject(treeItem)
		};

		const publishAction: dataworkspace.IProjectAction = {
			id: constants.publishAction,
			icon: IconPathHelper.publish,
			run: (treeItem: dataworkspace.WorkspaceTreeItem) => this.projectController.publishProject(treeItem)
		};

		const changeTargetPlatformAction: dataworkspace.IProjectAction = {
			id: constants.changeTargetPlatformAction,
			icon: IconPathHelper.targetPlatform,
			run: (treeItem: dataworkspace.WorkspaceTreeItem) => this.projectController.changeTargetPlatform(treeItem)
		};

		let group: dataworkspace.IProjectActionGroup = { actions: [addItemAction, schemaCompareAction, buildAction, publishAction] };

		return [group, changeTargetPlatformAction];
	}

	/**
	 * returns array of currently open sql projects
	 */
	getProjects(): sqldbproj.ISqlProject[] {
		return this.projectController.projects;
	}

	/**
	 * Gets the data to be displayed in the project dashboard
	 */
	getDashboardComponents(projectFile: string): dataworkspace.IDashboardTable[] {
		const deployInfo: dataworkspace.IDashboardTable = {
			name: constants.Deployments,
			columns: [{ displayName: constants.ID, width: 100 },
			{ displayName: constants.Status, width: 250, type: 'icon' },
			{ displayName: constants.Target, width: 250 },
			{ displayName: constants.Time, width: 250 },
			{ displayName: constants.Date, width: 250 }],
			data: this.projectController.getDashboardDeployData(projectFile)
		};

		const buildInfo: dataworkspace.IDashboardTable = {
			name: constants.Builds,
			columns: [{ displayName: constants.ID, width: 100 },
			{ displayName: constants.Status, width: 250, type: 'icon' },
			{ displayName: constants.Target, width: 250 },
			{ displayName: constants.Time, width: 250 },
			{ displayName: constants.Date, width: 250 }],
			data: this.projectController.getDashboardBuildData(projectFile)
		};

		return [deployInfo, buildInfo];
	}

	get image(): ThemedIconPath {
		return IconPathHelper.dashboardSqlProj;
	}
}
