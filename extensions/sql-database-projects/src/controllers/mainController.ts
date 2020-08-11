/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as templates from '../templates/templates';
import * as constants from '../common/constants';
import * as path from 'path';
import * as glob from 'fast-glob';

import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { getErrorMessage } from '../common/utils';
import { ProjectsController } from './projectController';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { NetCoreTool } from '../tools/netcoreTool';
import { Project } from '../models/project';
import { FileNode, FolderNode } from '../models/tree/fileFolderTreeItem';
import { IconPathHelper } from '../common/iconHelper';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected dbProjectTreeViewProvider: SqlDatabaseProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();
	protected projectsController: ProjectsController;
	protected netcoreTool: NetCoreTool;

	public constructor(private context: vscode.ExtensionContext) {
		this.projectsController = new ProjectsController(this.dbProjectTreeViewProvider);
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

	public async activate(): Promise<void> {
		await this.initializeDatabaseProjects();
	}

	private async initializeDatabaseProjects(): Promise<void> {
		// init commands
		vscode.commands.registerCommand('sqlDatabaseProjects.new', async () => { await this.createNewProject(); });
		vscode.commands.registerCommand('sqlDatabaseProjects.open', async () => { await this.openProjectFromFile(); });
		vscode.commands.registerCommand('sqlDatabaseProjects.close', (node: BaseProjectTreeItem) => { this.projectsController.closeProject(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.properties', async (node: BaseProjectTreeItem) => { await vscode.window.showErrorMessage(`Properties not yet implemented: ${node.uri.path}`); }); // TODO

		vscode.commands.registerCommand('sqlDatabaseProjects.build', async (node: BaseProjectTreeItem) => { await this.projectsController.buildProject(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.publish', async (node: BaseProjectTreeItem) => { await this.projectsController.publishProject(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.schemaCompare', async (node: BaseProjectTreeItem) => { await this.projectsController.schemaCompare(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.importDatabase', async (profile: azdata.IConnectionProfile) => { await this.projectsController.importNewDatabaseProject(profile); });

		vscode.commands.registerCommand('sqlDatabaseProjects.newScript', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.script); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newTable', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.table); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newView', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.view); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newStoredProcedure', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node, templates.storedProcedure); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newItem', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPromptFromNode(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newFolder', async (node: BaseProjectTreeItem) => { await this.projectsController.addFolderPrompt(node); });

		vscode.commands.registerCommand('sqlDatabaseProjects.addDatabaseReference', async (node: BaseProjectTreeItem) => { await this.projectsController.addDatabaseReference(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.openContainingFolder', async (node: BaseProjectTreeItem) => { await this.projectsController.openContainingFolder(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.delete', async (node: BaseProjectTreeItem) => { await this.projectsController.delete(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.exclude', async (node: FileNode | FolderNode) => { await this.projectsController.exclude(node); });

		IconPathHelper.setExtensionContext(this.extensionContext);

		// init view
		const treeView = vscode.window.createTreeView(SQL_DATABASE_PROJECTS_VIEW_ID, { treeDataProvider: this.dbProjectTreeViewProvider });
		this.dbProjectTreeViewProvider.setTreeView(treeView);

		this.extensionContext.subscriptions.push(treeView);

		await templates.loadTemplates(path.join(this.context.extensionPath, 'resources', 'templates'));

		// ensure .net core is installed
		await this.netcoreTool.findOrInstallNetCore();

		// load any sql projects that are open in workspace folder
		await this.loadProjectsInWorkspace();
	}

	public async loadProjectsInWorkspace(): Promise<void> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders?.length) {
			await Promise.all(workspaceFolders.map(async (workspaceFolder) => {
				await this.loadProjectsInFolder(workspaceFolder.uri.fsPath);
			}));
		}
	}

	public async loadProjectsInFolder(folderPath: string): Promise<void> {
		// path needs to use forward slashes for glob to work
		let escapedPath = glob.escapePath(folderPath.replace(/\\/g, '/'));
		let sqlprojFilter = path.posix.join(escapedPath, '**', '*.sqlproj');
		let results = await glob(sqlprojFilter);

		for (let f in results) {
			// open the project, but don't switch focus to the file explorer viewlet
			await this.projectsController.openProject(vscode.Uri.file(results[f]), false);
		}
	}

	/**
	 * Prompts the user to select a .sqlproj file to open
	 * TODO: define behavior once projects are automatically opened from workspace
	 */
	public async openProjectFromFile(): Promise<void> {
		try {
			let filter: { [key: string]: string[] } = {};

			filter[constants.sqlDatabaseProject] = ['sqlproj'];

			let files: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({ filters: filter });

			if (files) {
				for (const file of files) {
					await this.projectsController.openProject(file);
				}
			}
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	/**
	 * Creates a new SQL database project from a template, prompting the user for a name and location
	 */
	public async createNewProject(): Promise<Project | undefined> {
		try {
			let newProjName = await vscode.window.showInputBox({
				prompt: constants.newDatabaseProjectName,
				value: `DatabaseProject${this.projectsController.projects.length + 1}`
				// TODO: Smarter way to suggest a name.  Easy if we prompt for location first, but that feels odd...
			});

			newProjName = newProjName?.trim();

			if (!newProjName) {
				// TODO: is this case considered an intentional cancellation (shouldn't warn) or an error case (should warn)?
				vscode.window.showErrorMessage(constants.projectNameRequired);
				return undefined;
			}

			let selectionResult = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: vscode.workspace.workspaceFolders ? (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri : undefined
			});

			if (!selectionResult) {
				vscode.window.showErrorMessage(constants.projectLocationRequired);
				return undefined;
			}

			// TODO: what if the selected folder is outside the workspace?

			const newProjFolderUri = (selectionResult as vscode.Uri[])[0];
			const newProjFilePath = await this.projectsController.createNewProject(<string>newProjName, newProjFolderUri, true);
			const proj = await this.projectsController.openProject(vscode.Uri.file(newProjFilePath));

			return proj;
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
			return undefined;
		}
	}

	public dispose(): void {
		this.deactivate();
	}
}
