/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as templates from '../templates/templates';
import * as path from 'path';

import { ProjectsController } from './projectController';
import { NetCoreTool } from '../tools/netcoreTool';
import { IconPathHelper } from '../common/iconHelper';
import { WorkspaceTreeItem } from 'dataworkspace';
import { SqlDatabaseProjectProvider } from '../projectProvider/projectProvider';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected projectsController: ProjectsController;
	protected netcoreTool: NetCoreTool;

	public constructor(private context: vscode.ExtensionContext) {
		this.projectsController = new ProjectsController();
		this.netcoreTool = new NetCoreTool();
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.context;
	}

	public get projController(): ProjectsController {
		return this.projectsController;
	}

	public deactivate(): void {
	}

	public async activate(): Promise<SqlDatabaseProjectProvider> {
		await this.initializeDatabaseProjects();
		return new SqlDatabaseProjectProvider(this.projectsController);
	}

	private async initializeDatabaseProjects(): Promise<void> {
		// init commands
		vscode.commands.registerCommand('sqlDatabaseProjects.properties', async (node: WorkspaceTreeItem) => { await vscode.window.showErrorMessage(`Properties not yet implemented: ${node.element.uri.path}`); }); // TODO

		vscode.commands.registerCommand('sqlDatabaseProjects.build', async (node: WorkspaceTreeItem) => { await this.projectsController.buildProject(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.publish', async (node: WorkspaceTreeItem) => { this.projectsController.publishProject(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.schemaCompare', async (node: WorkspaceTreeItem) => { await this.projectsController.schemaCompare(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.createProjectFromDatabase', async (profile: azdataType.IConnectionProfile) => { await this.projectsController.createProjectFromDatabase(profile); });

		vscode.commands.registerCommand('sqlDatabaseProjects.newScript', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.script); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newPreDeploymentScript', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.preDeployScript); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newPostDeploymentScript', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.postDeployScript); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newTable', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.table); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newView', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.view); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newStoredProcedure', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.storedProcedure); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newExternalStreamingJob', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.externalStreamingJob); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newItem', async (node: WorkspaceTreeItem) => { await this.projectsController.addItemPromptFromNode(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newFolder', async (node: WorkspaceTreeItem) => { await this.projectsController.addFolderPrompt(node); });

		vscode.commands.registerCommand('sqlDatabaseProjects.addDatabaseReference', async (node: WorkspaceTreeItem) => { await this.projectsController.addDatabaseReference(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.openContainingFolder', async (node: WorkspaceTreeItem) => { await this.projectsController.openContainingFolder(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.editProjectFile', async (node: WorkspaceTreeItem) => { await this.projectsController.editProjectFile(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.delete', async (node: WorkspaceTreeItem) => { await this.projectsController.delete(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.exclude', async (node: WorkspaceTreeItem) => { await this.projectsController.exclude(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.changeTargetPlatform', async (node: WorkspaceTreeItem) => { await this.projectsController.changeTargetPlatform(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.validateExternalStreamingJob', async (node: WorkspaceTreeItem) => { await this.projectsController.validateExternalStreamingJob(node); });

		IconPathHelper.setExtensionContext(this.extensionContext);

		await templates.loadTemplates(path.join(this.context.extensionPath, 'resources', 'templates'));

		// ensure .net core is installed
		await this.netcoreTool.findOrInstallNetCore();
	}

	public dispose(): void {
		this.deactivate();
	}
}
