/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { WizardController } from './wizard/wizardController';
import { AssessmentResultsDialog } from './dialog/assessmentResults/assessmentResultsDialog';
import { promises as fs } from 'fs';
import * as loc from './models/strings';
import { MigrationNotebookInfo, NotebookPathHelper } from './constants/notebookPathHelper';
import { IconPathHelper } from './constants/iconPathHelper';
import { DashboardWidget } from './dashboard/sqlServerDashboard';
import { MigrationLocalStorage } from './models/migrationLocalStorage';

class SQLMigration {

	constructor(private readonly context: vscode.ExtensionContext) {
		NotebookPathHelper.setExtensionContext(context);
		IconPathHelper.setExtensionContext(context);
		MigrationLocalStorage.setExtensionContext(context);
	}

	async start(): Promise<void> {
		await this.registerCommands();
	}

	async registerCommands(): Promise<void> {
		const commandDisposables: vscode.Disposable[] = [ // Array of disposables returned by registerCommand
			vscode.commands.registerCommand('sqlmigration.start', async () => {
				let activeConnection = await azdata.connection.getCurrentConnection();
				let connectionId: string = '';
				if (!activeConnection) {
					const connection = await azdata.connection.openConnectionDialog();
					if (connection) {
						connectionId = connection.connectionId;
					}
				} else {
					connectionId = activeConnection.connectionId;
				}
				const wizardController = new WizardController(this.context);
				await wizardController.openWizard(connectionId);
			}),

			vscode.commands.registerCommand('sqlmigration.testDialog', async () => {
				let dialog = new AssessmentResultsDialog('ownerUri', undefined!, 'Assessment Dialog');
				await dialog.openDialog();
			}),

			vscode.commands.registerCommand('sqlmigration.openNotebooks', async () => {
				const input = vscode.window.createQuickPick<MigrationNotebookInfo>();
				input.placeholder = loc.NOTEBOOK_QUICK_PICK_PLACEHOLDER;

				input.items = NotebookPathHelper.getAllMigrationNotebooks();

				input.onDidAccept(async (e) => {
					const selectedNotebook = input.selectedItems[0];
					if (selectedNotebook) {
						try {
							azdata.nb.showNotebookDocument(vscode.Uri.parse(`untitled: ${selectedNotebook.label}`), {
								preview: false,
								initialContent: (await fs.readFile(selectedNotebook.notebookPath)).toString(),
								initialDirtyState: false
							});
						} catch (e) {
							vscode.window.showErrorMessage(`${loc.NOTEBOOK_OPEN_ERROR} - ${e.toString()}`);
						}
						input.hide();
					}
				});

				input.show();
			})
		];

		this.context.subscriptions.push(...commandDisposables);
	}

	stop(): void {

	}
}

let sqlMigration: SQLMigration;
export async function activate(context: vscode.ExtensionContext) {
	sqlMigration = new SQLMigration(context);
	await sqlMigration.registerCommands();
	let widget = new DashboardWidget();
	widget.register();
}

export function deactivate(): void {
	sqlMigration.stop();
}
