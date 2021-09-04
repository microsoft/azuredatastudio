/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ThemedIconPath } from 'azdata';
import * as dataworkspace from 'dataworkspace';
import * as sqldbproj from 'sqldbproj';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { IconPathHelper } from '../common/iconHelper';
import { SqlDatabaseProjectTreeViewProvider } from '../controllers/databaseProjectTreeViewProvider';
import { ProjectsController } from '../controllers/projectController';
import { Project } from '../models/project';
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
		const project = await Project.openProject(projectFilePath.fsPath);
		provider.load([project]);
		return provider;
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
			icon: IconPathHelper.colorfulSqlProject,
			targetPlatforms: Array.from(constants.targetPlatformToVersion.keys()),
			defaultTargetPlatform: constants.defaultTargetPlatform
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
	async createProject(name: string, location: vscode.Uri, projectTypeId: string, targetPlatform?: sqldbproj.SqlTargetPlatform): Promise<vscode.Uri> {
		const projectFile = await this.projectController.createNewProject({
			newProjName: name,
			folderUri: location,
			projectTypeId: projectTypeId,
			targetPlatform: targetPlatform
		});

		return vscode.Uri.file(projectFile);
	}

	/**
	 * Opens and loads a .sqlproj file
	 */
	openProject(projectFilePath: string): Promise<sqldbproj.ISqlProject> {
		return Project.openProject(projectFilePath);
	}

	/**
	 * Gets the project actions to be placed on the dashboard toolbar
	 */
	get projectToolbarActions(): (dataworkspace.IProjectAction | dataworkspace.IProjectActionGroup)[] {
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
	 * Gets the data to be displayed in the project dashboard
	 */
	getDashboardComponents(projectFile: string): dataworkspace.IDashboardTable[] {
		const width = 200;
		const publishInfo: dataworkspace.IDashboardTable = {
			name: constants.PublishHistory,
			columns: [{ displayName: constants.Status, width: width, type: 'icon' },
			{ displayName: constants.Date, width: width },
			{ displayName: constants.Time, width: width },
			{ displayName: constants.TargetPlatform, width: width },
			{ displayName: constants.TargetServer, width: width },
			{ displayName: constants.TargetDatabase, width: width }],
			data: this.projectController.getDashboardPublishData(projectFile)
		};

		const buildInfo: dataworkspace.IDashboardTable = {
			name: constants.BuildHistory,
			columns: [{ displayName: constants.Status, width: width, type: 'icon' },
			{ displayName: constants.Date, width: width },
			{ displayName: constants.Time, width: width },
			{ displayName: constants.TargetPlatform, width: width }],
			data: this.projectController.getDashboardBuildData(projectFile)
		};

		return [publishInfo, buildInfo];
	}

	get image(): ThemedIconPath {
		return IconPathHelper.dashboardSqlProj;
	}
}
