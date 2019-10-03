/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AlertDialog } from './dialogs/alertDialog';
import { JobDialog } from './dialogs/jobDialog';
import { OperatorDialog } from './dialogs/operatorDialog';
import { ProxyDialog } from './dialogs/proxyDialog';
import { JobStepDialog } from './dialogs/jobStepDialog';
import { PickScheduleDialog } from './dialogs/pickScheduleDialog';
import { JobData } from './data/jobData';
import { AgentUtils, exists } from './agentUtils';
import { NotebookDialog, NotebookDialogOptions } from './dialogs/notebookDialog';


const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export class TemplateMapObject {
	notebookInfo: azdata.AgentNotebookInfo;
	fileUri: vscode.Uri;
	tempPath: string;
	ownerUri: string;
}
export class MainController {

	protected _context: vscode.ExtensionContext;
	private jobDialog: JobDialog;
	private jobStepDialog: JobStepDialog;
	private alertDialog: AlertDialog;
	private operatorDialog: OperatorDialog;
	private proxyDialog: ProxyDialog;
	private notebookDialog: NotebookDialog;
	private notebookTemplateMap = new Map<string, TemplateMapObject>();
	// PUBLIC METHODS //////////////////////////////////////////////////////
	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public static showNotYetImplemented(): void {
		vscode.window.showInformationMessage(
			localize('mainController.notImplemented', "This feature is under development.  Check-out the latest insiders build if you'd like to try out the most recent changes!"));
	}

	/**
	 * Activates the extension
	 */
	public activate(): void {
		vscode.commands.registerCommand('agent.openJobDialog', async (ownerUri: string, jobInfo: azdata.AgentJobInfo) => {
			if (!this.jobDialog || (this.jobDialog && !this.jobDialog.isOpen)) {
				this.jobDialog = new JobDialog(ownerUri, jobInfo);
			}
			if (!this.jobDialog.isOpen) {
				this.jobDialog.dialogName ? await this.jobDialog.openDialog(this.jobDialog.dialogName) : await this.jobDialog.openDialog();
			}
		});
		vscode.commands.registerCommand('agent.openNewStepDialog', (ownerUri: string, server: string, jobInfo: azdata.AgentJobInfo, jobStepInfo: azdata.AgentJobStepInfo) => {
			AgentUtils.getAgentService().then(async (agentService) => {
				let jobData: JobData = new JobData(ownerUri, jobInfo, agentService);
				let dialog = new JobStepDialog(ownerUri, server, jobData, jobStepInfo, false);
				dialog.dialogName ? await dialog.openDialog(dialog.dialogName) : await dialog.openDialog();
			});
		});
		vscode.commands.registerCommand('agent.openPickScheduleDialog', async (ownerUri: string, jobName: string) => {
			let dialog = new PickScheduleDialog(ownerUri, jobName);
			await dialog.showDialog();
		});
		vscode.commands.registerCommand('agent.openAlertDialog', async (ownerUri: string, jobInfo: azdata.AgentJobInfo, alertInfo: azdata.AgentAlertInfo) => {
			if (!this.alertDialog || (this.alertDialog && !this.alertDialog.isOpen)) {
				await AgentUtils.getAgentService().then(async (agentService) => {
					let jobData: JobData = new JobData(ownerUri, jobInfo, agentService);
					this.alertDialog = new AlertDialog(ownerUri, jobData, alertInfo, false);
				});
			}
			if (!this.alertDialog.isOpen) {
				this.alertDialog.dialogName ? await this.alertDialog.openDialog(this.alertDialog.dialogName) : await this.alertDialog.openDialog();
			}
		});
		vscode.commands.registerCommand('agent.openOperatorDialog', async (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo) => {
			if (!this.operatorDialog || (this.operatorDialog && !this.operatorDialog.isOpen)) {
				this.operatorDialog = new OperatorDialog(ownerUri, operatorInfo);
			}
			if (!this.operatorDialog.isOpen) {
				this.operatorDialog.dialogName ? await this.operatorDialog.openDialog(this.operatorDialog.dialogName) : await this.operatorDialog.openDialog();
			}
		});

		vscode.commands.registerCommand('agent.reuploadTemplate', async (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo) => {
			let nbEditor = azdata.nb.activeNotebookEditor;
			// await nbEditor.document.save();
			let templateMap = this.notebookTemplateMap.get(nbEditor.document.uri.toString());
			let vsEditor = await vscode.workspace.openTextDocument(templateMap.fileUri);
			let content = vsEditor.getText();
			await fs.writeFile(templateMap.tempPath, content);
			AgentUtils.getAgentService().then(async (agentService) => {
				let result = await agentService.updateNotebook(templateMap.ownerUri, templateMap.notebookInfo.name, templateMap.notebookInfo, templateMap.tempPath);
				if (result.success) {
					vscode.window.showInformationMessage(localize('agent.templateUploadSuccessful', 'Template updated successfully'));
				}
				else {
					vscode.window.showInformationMessage(localize('agent.templateUploadError', 'Template update failure'));
				}
			});

		});

		vscode.commands.registerCommand('agent.openProxyDialog', async (ownerUri: string, proxyInfo: azdata.AgentProxyInfo, credentials: azdata.CredentialInfo[]) => {
			if (!this.proxyDialog || (this.proxyDialog && !this.proxyDialog.isOpen)) {
				this.proxyDialog = new ProxyDialog(ownerUri, proxyInfo, credentials);
			}
			if (!this.proxyDialog.isOpen) {
				this.proxyDialog.dialogName ? await this.proxyDialog.openDialog(this.proxyDialog.dialogName) : await this.proxyDialog.openDialog();
			}
			this.proxyDialog.dialogName ? await this.proxyDialog.openDialog(this.proxyDialog.dialogName) : await this.proxyDialog.openDialog();
		});

		vscode.commands.registerCommand('agent.openNotebookEditorFromJsonString', async (filename: string, jsonNotebook: string, notebookInfo?: azdata.AgentNotebookInfo, ownerUri?: string) => {
			const tempfilePath = path.join(os.tmpdir(), 'mssql_notebooks', filename + '.ipynb');
			if (!await exists(path.join(os.tmpdir(), 'mssql_notebooks'))) {
				await fs.mkdir(path.join(os.tmpdir(), 'mssql_notebooks'));
			}
			if (await exists(tempfilePath)) {
				await fs.unlink(tempfilePath);
			}
			try {
				await fs.writeFile(tempfilePath, jsonNotebook);
				let uri = vscode.Uri.parse(`untitled:${path.basename(tempfilePath)}`);
				if (notebookInfo) {
					this.notebookTemplateMap.set(uri.toString(), { notebookInfo: notebookInfo, fileUri: uri, ownerUri: ownerUri, tempPath: tempfilePath });
					vscode.commands.executeCommand('setContext', 'agent:trackedTemplate', true);
				}
				await azdata.nb.showNotebookDocument(uri, {
					initialContent: jsonNotebook,
					initialDirtyState: false
				});
				vscode.commands.executeCommand('setContext', 'agent:trackedTemplate', false);
			}
			catch (e) {
				vscode.window.showErrorMessage(e);
			}
		});

		vscode.commands.registerCommand('agent.openNotebookDialog', async (ownerUri: any, notebookInfo: azdata.AgentNotebookInfo) => {

			/*
			There are four entry points to this commands:
			1. Explorer context menu:
				The first arg becomes a vscode URI
				the second argument is undefined
			2. Notebook toolbar:
				both the args are undefined
			3. Agent New Notebook Action
				the first arg is database OwnerUri
				the second arg is undefined
			4. Agent Edit Notebook Action
				the first arg is database OwnerUri
				the second arg is notebookInfo from database
			*/
			if (!ownerUri || ownerUri instanceof vscode.Uri) {
				let path: string;
				if (!ownerUri) {
					if (azdata.nb.activeNotebookEditor.document.isDirty) {
						vscode.window.showErrorMessage(localize('agent.unsavedFileSchedulingError', 'Save file before scheduling'), { modal: true });
						return;
					}
					path = azdata.nb.activeNotebookEditor.document.fileName;
				} else {
					path = ownerUri.fsPath;
				}

				let connection = await this.getConnectionFromUser();
				ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
				this.notebookDialog = new NotebookDialog(ownerUri, <NotebookDialogOptions>{ filePath: path, connection: connection });
				if (!this.notebookDialog.isOpen) {
					this.notebookDialog.dialogName ? await this.notebookDialog.openDialog(this.notebookDialog.dialogName) : await this.notebookDialog.openDialog();
				}
			}
			else {
				if (!this.notebookDialog || (this.notebookDialog && !this.notebookDialog.isOpen)) {
					this.notebookDialog = new NotebookDialog(ownerUri, <NotebookDialogOptions>{ notebookInfo: notebookInfo });
				}
				if (!this.notebookDialog.isOpen) {
					this.notebookDialog.dialogName ? await this.notebookDialog.openDialog(this.notebookDialog.dialogName) : await this.notebookDialog.openDialog();
				}
			}
		});
	}

	public async getConnectionFromUser(): Promise<azdata.connection.Connection> {
		let connection: azdata.connection.Connection = null;

		let connections = await azdata.connection.getActiveConnections();
		if (!connections || connections.length === 0) {
			connection = await azdata.connection.openConnectionDialog();
		}
		else {
			let sqlConnectionsPresent: boolean;
			for (let i = 0; i < connections.length; i++) {
				if (connections[i].providerName === 'MSSQL') {
					sqlConnectionsPresent = true;
					break;
				}
			}
			let connectionNames: azdata.connection.Connection[] = [];
			let connectionDisplayString: string[] = [];
			for (let i = 0; i < connections.length; i++) {
				let currentConnectionString = connections[i].options.server + ' (' + connections[i].options.user + ')';
				connectionNames.push(connections[i]);
				connectionDisplayString.push(currentConnectionString);
			}
			connectionDisplayString.push(localize('agent.AddNewConnection', 'Add new connection'));
			let connectionName = await vscode.window.showQuickPick(connectionDisplayString, { placeHolder: localize('agent.selectConnection', 'Select a connection') });
			if (connectionDisplayString.indexOf(connectionName) !== -1) {
				if (connectionName === localize('agent.AddNewConnection', 'Add new connection')) {
					connection = await azdata.connection.openConnectionDialog();
				}
				else {
					connection = connections[connectionDisplayString.indexOf(connectionName)];
				}
			}
			else {
				vscode.window.showErrorMessage(localize('agent.selectValidConnection', 'Please select a valid connection'), { modal: true });
			}
		}
		return connection;
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}
}
