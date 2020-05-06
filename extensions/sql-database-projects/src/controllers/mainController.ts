/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as templates from '../templates/templates';
import * as constants from '../common/constants';
import * as path from 'path';

import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { getErrorMessage } from '../common/utils';
import { ProjectsController } from './projectController';
import { BaseProjectTreeItem } from '../models/tree/baseTreeItem';
import { NetCoreTool } from '../tools/netcoreTool';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;
	protected dbProjectTreeViewProvider: SqlDatabaseProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();
	protected projectsController: ProjectsController;
	protected netcoreTool: NetCoreTool;

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this.projectsController = new ProjectsController(this.dbProjectTreeViewProvider);
		this.netcoreTool = new NetCoreTool();
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this._context;
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

		vscode.commands.registerCommand('sqlDatabaseProjects.build', async (node: BaseProjectTreeItem) => { await this.projectsController.build(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.deploy', async (node: BaseProjectTreeItem) => { await this.projectsController.deploy(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.import', async (node: BaseProjectTreeItem) => { await this.projectsController.import(node); });


		vscode.commands.registerCommand('sqlDatabaseProjects.newScript', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPrompt(node, templates.script); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newTable', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPrompt(node, templates.table); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newView', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPrompt(node, templates.view); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newStoredProcedure', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPrompt(node, templates.storedProcedure); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newItem', async (node: BaseProjectTreeItem) => { await this.projectsController.addItemPrompt(node); });
		vscode.commands.registerCommand('sqlDatabaseProjects.newFolder', async (node: BaseProjectTreeItem) => { await this.projectsController.addFolderPrompt(node); });

		// init view
		this.extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider(SQL_DATABASE_PROJECTS_VIEW_ID, this.dbProjectTreeViewProvider));

		await templates.loadTemplates(path.join(this._context.extensionPath, 'resources', 'templates'));

		// ensure .net core is installed
		this.netcoreTool.findOrInstallNetCore();
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
	public async createNewProject(): Promise<void> {
		try {
			let newProjName = await vscode.window.showInputBox({
				prompt: constants.newDatabaseProjectName,
				value: `DatabaseProject${this.projectsController.projects.length + 1}`
				// TODO: Smarter way to suggest a name.  Easy if we prompt for location first, but that feels odd...
			});

			if (!newProjName) {
				// TODO: is this case considered an intentional cancellation (shouldn't warn) or an error case (should warn)?
				vscode.window.showErrorMessage(constants.projectNameRequired);
				return;
			}

			let selectionResult = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
			});

			if (!selectionResult) {
				vscode.window.showErrorMessage(constants.projectLocationRequired);
				return;
			}

			// TODO: what if the selected folder is outside the workspace?

			const newProjFolderUri = (selectionResult as vscode.Uri[])[0];
			console.log(newProjFolderUri.fsPath);
			const newProjFilePath = await this.projectsController.createNewProject(newProjName as string, newProjFolderUri as vscode.Uri);
			await this.projectsController.openProject(vscode.Uri.file(newProjFilePath));
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public dispose(): void {
		this.deactivate();
	}
}
