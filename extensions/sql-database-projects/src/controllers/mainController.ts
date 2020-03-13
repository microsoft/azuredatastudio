/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { getErrorMessage } from '../common/utils';
import { ProjectsController } from './projectController';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;
	protected dbProjectTreeViewProvider: SqlDatabaseProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();
	protected projectsController: ProjectsController;

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
		this.projectsController = new ProjectsController(this.dbProjectTreeViewProvider);
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
		vscode.commands.registerCommand('sqlDatabaseProjects.new', async () => { this.createNewProject(); });
		vscode.commands.registerCommand('sqlDatabaseProjects.open', async () => { this.openProjectFromFile(); });

		// init view
		this.extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider(SQL_DATABASE_PROJECTS_VIEW_ID, this.dbProjectTreeViewProvider));
	}

	/**
	 * Prompts the user to select a .sqlproj file to open
	 * TODO: define behavior once projects are automatically opened from workspace
	 */
	public async openProjectFromFile(): Promise<void> {
		try {
			let filter: { [key: string]: string[] } = {};

			filter[localize('sqlDatabaseProject', "SQL database project")] = ['sqlproj'];

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

	public async createNewProject(): Promise<void> {
		try {
			let newProjName = await vscode.window.showInputBox({
				prompt: 'New database project name:',
				value: `DatabaseProject${this.projectsController.projects.length + 1}`
				// TODO: Smarter way to suggest a name.  Easy if we prompt for location first, but that feels odd...
			});

			if (!newProjName || newProjName === '') {
				// TODO: is this case considered an intentional cancellation (shouldn't warn) or an error case (should warn)?
				vscode.window.showErrorMessage('Name is required to create a new database project name.');
				return;
			}

			let selectionResult = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
			});

			if (!selectionResult) {
				vscode.window.showErrorMessage('Location is required to create a new database project.');
				return;
			}

			if (selectionResult.length !== 1) {
				throw new Error(`One folder should be selected, but ${selectionResult.length} were.`);
			}

			// TODO: what if the selected folder is outside the workspace?

			const newProjUri = (selectionResult as vscode.Uri[])[0];
			console.log(newProjUri.fsPath);
			await this.projectsController.createNewProject(newProjName as string, newProjUri as vscode.Uri);
		}
		catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	public dispose(): void {
		this.deactivate();
	}
}
