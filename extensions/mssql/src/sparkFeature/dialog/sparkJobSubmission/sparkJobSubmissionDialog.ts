/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as utils from '../../../utils';
import * as LocalizedConstants from '../../../localizedConstants';

import { AppContext } from '../../../appContext';
import { SparkJobSubmissionModel } from './sparkJobSubmissionModel';
import { SparkConfigurationTab } from './sparkConfigurationTab';
import { SparkJobSubmissionInput } from './sparkJobSubmissionService';
import { SparkAdvancedTab } from './sparkAdvancedTab';
import { SqlClusterConnection } from '../../../objectExplorerNodeProvider/connection';

const localize = nls.loadMessageBundle();

export class SparkJobSubmissionDialog {
	private _dialog: azdata.window.Dialog;
	private _dataModel: SparkJobSubmissionModel;
	private _sparkConfigTab: SparkConfigurationTab;
	private _sparkAdvancedTab: SparkAdvancedTab;

	constructor(
		private sqlClusterConnection: SqlClusterConnection,
		private appContext: AppContext,
		private outputChannel: vscode.OutputChannel) {
		if (!this.sqlClusterConnection || !this.appContext || !this.outputChannel) {
			throw new Error(localize('sparkJobSubmission.SparkJobSubmissionDialogInitializeError',
				"Parameters for SparkJobSubmissionDialog is illegal"));
		}
	}

	public async openDialog(path?: string): Promise<void> {
		this._dialog = azdata.window.createModelViewDialog(localize('sparkJobSubmission.DialogTitleNewJob', "New Job"));

		this._dataModel = new SparkJobSubmissionModel(this.sqlClusterConnection, this._dialog, this.appContext);

		this._sparkConfigTab = new SparkConfigurationTab(this._dataModel, path);
		this._sparkAdvancedTab = new SparkAdvancedTab();

		this._dialog.content = [this._sparkConfigTab.tab, this._sparkAdvancedTab.tab];

		this._dialog.cancelButton.label = localize('sparkJobSubmission.DialogCancelButton', "Cancel");

		this._dialog.okButton.label = localize('sparkJobSubmission.DialogSubmitButton', "Submit");
		this._dialog.okButton.onClick(() => this.onClickOk());

		this._dialog.registerCloseValidator(() => this.handleValidate());

		azdata.window.openDialog(this._dialog);
	}

	private onClickOk(): void {
		let jobName = localize('sparkJobSubmission.SubmitSparkJob', "{0} Spark Job Submission:",
			this._sparkConfigTab.getSparkConfigValues().jobName);
		azdata.tasks.startBackgroundOperation(
			{
				connection: this.sqlClusterConnection.connection,
				displayName: jobName,
				description: jobName,
				isCancelable: false,
				operation: op => {
					void this.onSubmit(op);
				}
			}
		);
	}

	private async onSubmit(op: azdata.BackgroundOperation): Promise<void> {
		try {
			this.outputChannel.show();
			let msg = localize('sparkJobSubmission.SubmissionStartMessage',
				".......................... Submit Spark Job Start ..........................");
			this.outputChannel.appendLine(msg);
			// 1. Upload local file to HDFS for local source.
			if (this._dataModel.isMainSourceFromLocal) {
				try {
					this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionPrepareUploadingFile(this._dataModel.localFileSourcePath, this._dataModel.hdfsFolderDestinationPath)));
					op.updateStatus(azdata.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionPrepareUploadingFile(this._dataModel.localFileSourcePath, this._dataModel.hdfsFolderDestinationPath));
					await this._dataModel.uploadFile(this._dataModel.localFileSourcePath, this._dataModel.hdfsFolderDestinationPath);
					void vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionUploadingFileSucceeded);
					this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionUploadingFileSucceeded));
					op.updateStatus(azdata.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionUploadingFileSucceeded);
				} catch (error) {
					void vscode.window.showErrorMessage(LocalizedConstants.sparkJobSubmissionUploadingFileFailed(utils.getErrorMessage(error)));
					this.outputChannel.appendLine(this.addErrorTag(LocalizedConstants.sparkJobSubmissionUploadingFileFailed(utils.getErrorMessage(error))));
					op.updateStatus(azdata.TaskStatus.Failed, LocalizedConstants.sparkJobSubmissionUploadingFileFailed(utils.getErrorMessage(error)));
					this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
					return;
				}
			}

			// 2. Submit job to cluster.
			let submissionSettings: SparkJobSubmissionInput = this.getSubmissionInput();
			this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionPrepareSubmitJob(submissionSettings.config.jobName)));
			op.updateStatus(azdata.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionPrepareSubmitJob(submissionSettings.config.jobName));
			let livyBatchId = await this._dataModel.submitBatchJobByLivy(submissionSettings);
			void vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionSparkJobHasBeenSubmitted);
			this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionSparkJobHasBeenSubmitted));
			op.updateStatus(azdata.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionSparkJobHasBeenSubmitted);

			// 3. Get SparkHistory/YarnUI Url.
			try {
				let appId = await this._dataModel.getApplicationID(submissionSettings, livyBatchId);

				let sparkHistoryUrl = this._dataModel.generateSparkHistoryUIUrl(submissionSettings, appId);
				void vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryUrl));
				this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryUrl)));
				op.updateStatus(azdata.TaskStatus.Succeeded, LocalizedConstants.sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryUrl));

				/*
				// Spark Tracking URl is not working now.
				let sparkTrackingUrl = this._dataModel.generateSparkTrackingUIUrl(submissionSettings, appId);
				vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionTrackingLinkMessage(sparkTrackingUrl));
				this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionTrackingLinkMessage(sparkTrackingUrl)));
				op.updateStatus(azdata.TaskStatus.Succeeded, LocalizedConstants.sparkJobSubmissionTrackingLinkMessage(sparkTrackingUrl));
				*/

				let yarnUIUrl = this._dataModel.generateYarnUIUrl(submissionSettings, appId);
				void vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionYarnUIMessage(yarnUIUrl));
				this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionYarnUIMessage(yarnUIUrl)));
				op.updateStatus(azdata.TaskStatus.Succeeded, LocalizedConstants.sparkJobSubmissionYarnUIMessage(yarnUIUrl));
			} catch (error) {
				void vscode.window.showErrorMessage(LocalizedConstants.sparkJobSubmissionGetApplicationIdFailed(utils.getErrorMessage(error)));
				this.outputChannel.appendLine(this.addErrorTag(LocalizedConstants.sparkJobSubmissionGetApplicationIdFailed(utils.getErrorMessage(error))));
				op.updateStatus(azdata.TaskStatus.Failed, LocalizedConstants.sparkJobSubmissionGetApplicationIdFailed(utils.getErrorMessage(error)));
				this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
				return;
			}

			this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
		} catch (error) {
			void vscode.window.showErrorMessage(LocalizedConstants.sparkJobSubmissionSubmitJobFailed(utils.getErrorMessage(error)));
			this.outputChannel.appendLine(this.addErrorTag(LocalizedConstants.sparkJobSubmissionSubmitJobFailed(utils.getErrorMessage(error))));
			op.updateStatus(azdata.TaskStatus.Failed, LocalizedConstants.sparkJobSubmissionSubmitJobFailed(utils.getErrorMessage(error)));
			this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
		}
	}

	private async handleValidate(): Promise<boolean> {
		return this._sparkConfigTab.validate();
	}

	private getSubmissionInput(): SparkJobSubmissionInput {
		const generalConfig = this._sparkConfigTab.getSparkConfigValues();
		const advancedConfig = this._sparkAdvancedTab.getAdvancedConfigValues();
		return new SparkJobSubmissionInput(
			{
				sparkFile: this._dataModel.hdfsSubmitFilePath,
				...generalConfig,
				...advancedConfig
			});
	}

	private addInfoTag(info: string): string {
		return `[Info]  ${info}`;
	}

	private addErrorTag(error: string): string {
		return `[Error] ${error}`;
	}
}
