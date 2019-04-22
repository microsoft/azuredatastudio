/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { AlertDialog } from './dialogs/alertDialog';
import { JobDialog } from './dialogs/jobDialog';
import { OperatorDialog } from './dialogs/operatorDialog';
import { ProxyDialog } from './dialogs/proxyDialog';
import { JobStepDialog } from './dialogs/jobStepDialog';
import { PickScheduleDialog } from './dialogs/pickScheduleDialog';
import { JobData } from './data/jobData';
import { AgentUtils } from './agentUtils';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export class MainController {
	protected _context: vscode.ExtensionContext;

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
			let dialog = new JobDialog(ownerUri, jobInfo);
			dialog.dialogName ? await dialog.openDialog(dialog.dialogName) : await dialog.openDialog();
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
		vscode.commands.registerCommand('agent.openAlertDialog', (ownerUri: string, jobInfo: azdata.AgentJobInfo, alertInfo: azdata.AgentAlertInfo) => {
			AgentUtils.getAgentService().then(async (agentService) => {
				let jobData: JobData = new JobData(ownerUri, jobInfo, agentService);
				let dialog = new AlertDialog(ownerUri, jobData, alertInfo, false);
				dialog.dialogName ? await dialog.openDialog(dialog.dialogName) : await dialog.openDialog();
			});
		});
		vscode.commands.registerCommand('agent.openOperatorDialog', async (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo) => {
			let dialog = new OperatorDialog(ownerUri, operatorInfo);
			dialog.dialogName ? await dialog.openDialog(dialog.dialogName) : await dialog.openDialog();
		});
		vscode.commands.registerCommand('agent.openProxyDialog', async (ownerUri: string, proxyInfo: azdata.AgentProxyInfo, credentials: azdata.CredentialInfo[]) => {
			let dialog = new ProxyDialog(ownerUri, proxyInfo, credentials);
			dialog.dialogName ? await dialog.openDialog(dialog.dialogName) : await dialog.openDialog();
		});
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}
}
