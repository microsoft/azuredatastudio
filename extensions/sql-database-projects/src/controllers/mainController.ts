/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

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

	private initializeDatabaseProjects(): void {
		vscode.commands.registerCommand('sqlDatabaseProjects.new', () => { console.log('new database project called'); });
		vscode.commands.registerCommand('sqlDatabaseProjects.open', () => { console.log('open database project called'); });
	}

	public dispose(): void {
		this.deactivate();
	}
}
