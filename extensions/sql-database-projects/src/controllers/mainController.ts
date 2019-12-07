/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { SqlDatabaseProjectTreeViewProvider } from './databaseProjectTreeViewProvider';

const SQL_DATABASE_PROJECTS_VIEW_ID = 'sqlDatabaseProjectsView';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	protected _context: vscode.ExtensionContext;

	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this._context;
	}

	public deactivate(): void {
	}

	public activate(): Promise<boolean> {
		this.initializeDatabaseProjects();
		return Promise.resolve(true);
	}

	private async initializeDatabaseProjects(): Promise<void> {
		// init commands
		vscode.commands.registerCommand('sqlDatabaseProjects.new', () => { console.log('"New Database Project" called.'); });
		vscode.commands.registerCommand('sqlDatabaseProjects.open', () => { console.log('"Open Database Project" called.'); });

		// init view
		const dbProjectTreeViewProvider = new SqlDatabaseProjectTreeViewProvider();
		await dbProjectTreeViewProvider.initialized;

		this.extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider(SQL_DATABASE_PROJECTS_VIEW_ID, dbProjectTreeViewProvider));
	}

	public dispose(): void {
		this.deactivate();
	}
}
