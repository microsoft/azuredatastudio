/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as temp from 'tmp';
import { AlertDialog } from './dialogs/alertDialog';
import { JobDialog } from './dialogs/jobDialog';
import { OperatorDialog } from './dialogs/operatorDialog';
import { ProxyDialog } from './dialogs/proxyDialog';
import { JobStepDialog } from './dialogs/jobStepDialog';
import { PickScheduleDialog } from './dialogs/pickScheduleDialog';
import { JobData } from './data/jobData';
import { AgentUtils } from './agentUtils';
import { NotebookDialog } from './dialogs/notebookDialog';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export class MainController {

	protected _context: vscode.ExtensionContext;
	private jobDialog: JobDialog;
	private jobStepDialog: JobStepDialog;
	private alertDialog: AlertDialog;
	private operatorDialog: OperatorDialog;
	private proxyDialog: ProxyDialog;
	private notebookDialog: NotebookDialog;

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
		vscode.commands.registerCommand('agent.openProxyDialog', async (ownerUri: string, proxyInfo: azdata.AgentProxyInfo, credentials: azdata.CredentialInfo[]) => {
			if (!this.proxyDialog || (this.proxyDialog && !this.proxyDialog.isOpen)) {
				this.proxyDialog = new ProxyDialog(ownerUri, proxyInfo, credentials);
			}
			if (!this.proxyDialog.isOpen) {
				this.proxyDialog.dialogName ? await this.proxyDialog.openDialog(this.proxyDialog.dialogName) : await this.proxyDialog.openDialog();
			}
			this.proxyDialog.dialogName ? await this.proxyDialog.openDialog(this.proxyDialog.dialogName) : await this.proxyDialog.openDialog();
		});
		vscode.commands.registerCommand('agent.openNotebookEditorFromJsonString', async (filename: string, jsonNotebook: string) => {
			const tempfilePath = path.join(os.tmpdir(), filename + '.ipynb');
			if (fs.existsSync(tempfilePath)) {
				fs.unlinkSync(tempfilePath);
			}
			fs.writeFile(tempfilePath, jsonNotebook, function (err) {
				if (err) {
					return console.log(err);
				}
				let uri = vscode.Uri.parse(`untitled:${path.basename(tempfilePath)}`);
				vscode.workspace.openTextDocument(tempfilePath).then((document) => {
					let initialContent = document.getText();
					azdata.nb.showNotebookDocument(uri, {
						preview: false,
						initialContent: initialContent,
						initialDirtyState: false
					});
				});
			});
			//await azdata.nb.showNotebookDocument(uri);
		});
		vscode.commands.registerCommand('agent.openNotebookDialog', async (ownerUri: string, notebookInfo: azdata.AgentNotebookInfo) => {
			if (!this.notebookDialog || (this.notebookDialog && !this.notebookDialog.isOpen)) {
				this.notebookDialog = new NotebookDialog(ownerUri, notebookInfo);
			}
			if (!this.notebookDialog.isOpen) {
				this.notebookDialog.dialogName ? await this.notebookDialog.openDialog(this.notebookDialog.dialogName) : await this.notebookDialog.openDialog();
			}
		});
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}
}
