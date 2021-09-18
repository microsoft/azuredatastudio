/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { WizardController } from './wizard/wizardController';
import { promises as fs } from 'fs';
import * as loc from './constants/strings';
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
				await this.launchMigrationWizard();
			}),
			vscode.commands.registerCommand('sqlmigration.openNotebooks', async () => {
				const input = vscode.window.createQuickPick<MigrationNotebookInfo>();
				input.placeholder = loc.NOTEBOOK_QUICK_PICK_PLACEHOLDER;

				input.items = NotebookPathHelper.getAllMigrationNotebooks();

				this.context.subscriptions.push(input.onDidAccept(async (e) => {
					const selectedNotebook = input.selectedItems[0];
					if (selectedNotebook) {
						try {
							await azdata.nb.showNotebookDocument(vscode.Uri.parse(`untitled: ${selectedNotebook.label}`), {
								preview: false,
								initialContent: (await fs.readFile(selectedNotebook.notebookPath)).toString(),
								initialDirtyState: false
							});
						} catch (e) {
							void vscode.window.showErrorMessage(`${loc.NOTEBOOK_OPEN_ERROR} - ${e.toString()}`);
						}
						input.hide();
					}
				}));

				input.show();
			}),
			azdata.tasks.registerTask('sqlmigration.start', async () => {
				await this.launchMigrationWizard();
			}),
			azdata.tasks.registerTask('sqlmigration.newsupportrequest', async () => {
				await this.launchNewSupportRequest();
			}),
			azdata.tasks.registerTask('sqlmigration.sendfeedback', async () => {
				const actionId = 'workbench.action.openIssueReporter';
				const args = {
					extensionId: 'microsoft.sql-migration',
					issueTitle: loc.FEEDBACK_ISSUE_TITLE,
				};
				return await vscode.commands.executeCommand(actionId, args);
			}),
		];

		this.context.subscriptions.push(...commandDisposables);
	}

	async launchMigrationWizard(): Promise<void> {
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
	}

	async launchNewSupportRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			`https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest`));
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
