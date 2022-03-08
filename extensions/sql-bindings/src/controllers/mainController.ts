/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { launchAddSqlBindingQuickpick } from '../dialogs/addSqlBindingQuickpick';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {

	public constructor(private context: vscode.ExtensionContext) {
	}

	public get extensionContext(): vscode.ExtensionContext {
		return this.context;
	}

	public async activate(): Promise<void> {
		await this.initializeSqlBindings();
	}

	public deactivate(): void {
	}

	private async initializeSqlBindings(): Promise<void> {
		// init commands
		vscode.commands.registerCommand('sqlDatabaseProjects.addSqlBinding', async (uri: vscode.Uri | undefined) => { return launchAddSqlBindingQuickpick(uri); });
	}

	public dispose(): void {
		this.deactivate();
	}
}
