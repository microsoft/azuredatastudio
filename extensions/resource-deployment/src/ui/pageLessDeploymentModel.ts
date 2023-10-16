/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeploymentProvider, instanceOfCommandDeploymentProvider, instanceOfDialogDeploymentProvider, instanceOfDownloadDeploymentProvider, instanceOfNotebookDeploymentProvider, instanceOfWebPageDeploymentProvider } from '../interfaces';
import { DeploymentInputDialog } from './deploymentInputDialog';
import { ResourceTypeModel } from './resourceTypeModel';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();


export class PageLessDeploymentModel extends ResourceTypeModel {

	initialize(): void {
		this.wizard.setPages([]);
	}

	async onOk(): Promise<void> {
		let provider: DeploymentProvider = this.wizard.provider;
		if (instanceOfDialogDeploymentProvider(provider)) {
			const dialog = new DeploymentInputDialog(this.wizard.notebookService, this.wizard.platformService, this.wizard.toolsService, provider.dialog);
			dialog.open();
		} else if (instanceOfNotebookDeploymentProvider(provider)) {
			this.wizard.notebookService.openNotebook(provider.notebook);
		} else if (instanceOfDownloadDeploymentProvider(provider)) {
			const downloadUrl = provider.downloadUrl;
			const taskName = localize('resourceDeployment.DownloadAndLaunchTaskName', "Download and launch installer, URL: {0}", downloadUrl);
			azdata.tasks.startBackgroundOperation({
				displayName: taskName,
				description: taskName,
				isCancelable: false,
				operation: op => {
					op.updateStatus(azdata.TaskStatus.InProgress, localize('resourceDeployment.DownloadingText', "Downloading from: {0}", downloadUrl));
					this.wizard.resourceTypeService.download(downloadUrl).then(async (downloadedFile) => {
						op.updateStatus(azdata.TaskStatus.InProgress, localize('resourceDeployment.DownloadCompleteText', "Successfully downloaded: {0}", downloadedFile));
						op.updateStatus(azdata.TaskStatus.InProgress, localize('resourceDeployment.LaunchingProgramText', "Launching: {0}", downloadedFile));
						await this.wizard.platformService.runCommand(downloadedFile, { sudo: true });
						op.updateStatus(azdata.TaskStatus.Succeeded, localize('resourceDeployment.ProgramLaunchedText', "Successfully launched: {0}", downloadedFile));
					}, (error) => {
						op.updateStatus(azdata.TaskStatus.Failed, error);
					});
				}
			});
		} else if (instanceOfWebPageDeploymentProvider(provider)) {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(provider.webPageUrl));
		} else if (instanceOfCommandDeploymentProvider(provider)) {
			vscode.commands.executeCommand(provider.command);
		}
	}
}
