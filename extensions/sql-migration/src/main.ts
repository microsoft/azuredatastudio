/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { WizardController } from './wizard/wizardController';
import * as mssql from '../../mssql';
import { promises as fs } from 'fs';
import * as loc from './constants/strings';
import { MigrationNotebookInfo, NotebookPathHelper } from './constants/notebookPathHelper';
import { IconPathHelper } from './constants/iconPathHelper';
import { DashboardWidget } from './dashboard/sqlServerDashboard';
import { MigrationLocalStorage } from './models/migrationLocalStorage';
import { MigrationStateModel, SavedInfo } from './models/stateMachine';
import { SavedAssessmentDialog } from './dialog/assessmentResults/savedAssessmentDialog';

class SQLMigration {

	public stateModel!: MigrationStateModel;

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
		let serverName: string = '';
		if (!activeConnection) {
			const connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				connectionId = connection.connectionId;
				serverName = connection.options.server;
			}
		} else {
			connectionId = activeConnection.connectionId;
			serverName = activeConnection.serverName;
		}
		if (serverName) {
			const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
			if (api) {
				this.stateModel = new MigrationStateModel(this.context, connectionId, api.sqlMigration);
				this.context.subscriptions.push(this.stateModel);
				let savedInfo = this.checkSavedInfo(serverName);
				if (savedInfo) {
					this.stateModel.savedInfo = savedInfo;
					this.stateModel.serverName = serverName;
					let savedAssessmentDialog = new SavedAssessmentDialog(this.context, this.stateModel);
					await savedAssessmentDialog.openDialog();
				} else {
					const wizardController = new WizardController(this.context, this.stateModel);
					await wizardController.openWizard(connectionId);
				}
			}

		}



	}

	private checkSavedInfo(serverName: string): SavedInfo | undefined {
		let savedInfo: SavedInfo | undefined = this.context.globalState.get(`${this.stateModel.mementoString}.${serverName}`);
		if (savedInfo) {
			return savedInfo;
		} else {
			return undefined;
		}
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
