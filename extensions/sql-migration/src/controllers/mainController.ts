/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Controller } from '../models/controller';

export class MainController implements Controller {
	constructor(
		private readonly context: vscode.ExtensionContext,
	) {

	}

	async activate(): Promise<void> {
		return this.initialize();
	}

	async deactivate(): Promise<void> {

	}

	async initialize(): Promise<void> {
		this.registerCommands();
	}

	async registerCommands(): Promise<void> {
		const commandDisposables: vscode.Disposable[] = [ // Array of disposables returned by registerCommand
			vscode.commands.registerCommand('sqlmigration.start', () => {
				vscode.window.showInformationMessage('Command ran');
			}),
		];

		this.context.subscriptions.push(...commandDisposables);
	}

	dispose(): void {

	}

}
