/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';
import { getErrorMessage } from '../common/utils';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;
	protected dbProjectTreeViewProvider: SqlDatabaseProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
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
		vscode.commands.registerCommand('sqlDatabaseProjects.open', async () => { this.openProjectFolder(); });

		// init view
		this.dbProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();

		this.extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider(SQL_DATABASE_PROJECTS_VIEW_ID, this.dbProjectTreeViewProvider));
	}

	public async openProjectFolder(): Promise<void> {
		try {
			let filter: { [key: string]: string[] } = {};

			filter[localize('sqlDatabaseProject', "SQL database project")] = ['sqlproj'];

			let file = await vscode.window.showOpenDialog({ filters: filter });

			if (file) {
				await this.dbProjectTreeViewProvider.openProject(file);
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
