/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Disposable, commands, window } from 'vscode';

class SQLMigration {

	constructor(private readonly context: ExtensionContext) {
	}

	async start(): Promise<void> {

	}

	async registerCommands(): Promise<void> {
		const commandDisposables: Disposable[] = [ // Array of disposables returned by registerCommand
			commands.registerCommand('sqlmigration.start', () => {
				window.showInformationMessage('Command ran');
			}),
		];

		this.context.subscriptions.push(...commandDisposables);
	}

	stop(): void {

	}
}

let sqlMigration: SQLMigration;
export async function activate(context: ExtensionContext) {
	sqlMigration = new SQLMigration(context);
}

export function deactivate(): void {
	sqlMigration.stop();
}
