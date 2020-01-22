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
		vscode.commands.registerCommand('sqlDatabaseProjects.new', () => { console.log('"New Database Project" called.'); });
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

	public dispose(): void {
		this.deactivate();
	}
}
