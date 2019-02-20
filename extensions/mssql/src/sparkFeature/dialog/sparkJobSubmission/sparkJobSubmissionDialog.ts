/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as utils from '../../../utils';
import * as LocalizedConstants from '../../../localizedConstants';

import { AppContext } from '../../../appContext';
import { ApiWrapper } from '../../../apiWrapper';
import { SparkJobSubmissionModel } from './sparkJobSubmissionModel';
import { SparkConfigurationTab } from './sparkConfigurationTab';
import { SparkJobSubmissionInput } from './sparkJobSubmissionService';
import { SparkAdvancedTab } from './sparkAdvancedTab';
import { SqlClusterConnection } from '../../../objectExplorerNodeProvider/connection';

const localize = nls.loadMessageBundle();

export class SparkJobSubmissionDialog {
	private _dialog: sqlops.window.Dialog;
	private _dataModel: SparkJobSubmissionModel;
	private _sparkConfigTab: SparkConfigurationTab;
	private _sparkAdvancedTab: SparkAdvancedTab;
	private get apiWrapper(): ApiWrapper {
		return this.appContext.apiWrapper;
	}

	constructor(
		private sqlClusterConnection: SqlClusterConnection,
		private appContext: AppContext,
		private outputChannel: vscode.OutputChannel) {
		if (!this.sqlClusterConnection || !this.appContext || !this.outputChannel) {
			throw new Error(localize('sparkJobSubmission_SparkJobSubmissionDialogInitializeError',
				'Parameters for SparkJobSubmissionDialog is illegal'));
		}
	}

	public async openDialog(path?: string): Promise<void> {
		this._dialog = this.apiWrapper.createDialog(localize('sparkJobSubmission_DialogTitleNewJob', 'New Job'));

		this._dataModel = new SparkJobSubmissionModel(this.sqlClusterConnection, this._dialog, this.appContext);

		this._sparkConfigTab = new SparkConfigurationTab(this._dataModel, this.appContext, path);
		this._sparkAdvancedTab = new SparkAdvancedTab(this.appContext);

		this._dialog.content = [this._sparkConfigTab.tab, this._sparkAdvancedTab.tab];

		this._dialog.cancelButton.label = localize('sparkJobSubmission_DialogCancelButton', 'Cancel');

		this._dialog.okButton.label = localize('sparkJobSubmission_DialogSubmitButton', 'Submit');
		this._dialog.okButton.onClick(() => this.onClickOk());

		this._dialog.registerCloseValidator(() => this.handleValidate());

		await this.apiWrapper.openDialog(this._dialog);
	}

	private onClickOk(): void {
		let jobName = localize('sparkJobSubmission_SubmitSparkJob', '{0} Spark Job Submission:',
			this._sparkConfigTab.getInputValues()[0]);
		this.apiWrapper.startBackgroundOperation(
			{
				connection: this.sqlClusterConnection.connection,
				displayName: jobName,
				description: jobName,
				isCancelable: false,
				operation: op => {
					this.onSubmit(op);
				}
			}
		);
	}

	private async onSubmit(op: sqlops.BackgroundOperation): Promise<void> {
		try {
			this.outputChannel.show();
			let msg = localize('sparkJobSubmission_SubmissionStartMessage',
				'.......................... Submit Spark Job Start ..........................');
			this.outputChannel.appendLine(msg);
			// 1. Upload local file to HDFS for local source.
			if (this._dataModel.isMainSourceFromLocal) {
				try {
					this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionPrepareUploadingFile(this._dataModel.localFileSourcePath, this._dataModel.hdfsFolderDestinationPath)));
					op.updateStatus(sqlops.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionPrepareUploadingFile(this._dataModel.localFileSourcePath, this._dataModel.hdfsFolderDestinationPath));
					await this._dataModel.uploadFile(this._dataModel.localFileSourcePath, this._dataModel.hdfsFolderDestinationPath);
					vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionUploadingFileSucceeded);
					this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionUploadingFileSucceeded));
					op.updateStatus(sqlops.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionUploadingFileSucceeded);
				} catch (error) {
					vscode.window.showErrorMessage(LocalizedConstants.sparkJobSubmissionUploadingFileFailed(utils.getErrorMessage(error)));
					this.outputChannel.appendLine(this.addErrorTag(LocalizedConstants.sparkJobSubmissionUploadingFileFailed(utils.getErrorMessage(error))));
					op.updateStatus(sqlops.TaskStatus.Failed, LocalizedConstants.sparkJobSubmissionUploadingFileFailed(utils.getErrorMessage(error)));
					this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
					return;
				}
			}

			// 2. Submit job to cluster.
			let submissionSettings: SparkJobSubmissionInput = this.getSubmissionInput();
			this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionPrepareSubmitJob(submissionSettings.jobName)));
			op.updateStatus(sqlops.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionPrepareSubmitJob(submissionSettings.jobName));
			let livyBatchId = await this._dataModel.submitBatchJobByLivy(submissionSettings);
			vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionSparkJobHasBeenSubmitted);
			this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionSparkJobHasBeenSubmitted));
			op.updateStatus(sqlops.TaskStatus.InProgress, LocalizedConstants.sparkJobSubmissionSparkJobHasBeenSubmitted);

			// 3. Get SparkHistory/YarnUI Url.
			try {
				let appId = await this._dataModel.getApplicationID(submissionSettings, livyBatchId);

				let sparkHistoryUrl = this._dataModel.generateSparkHistoryUIUrl(submissionSettings, appId);
				vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryUrl));
				this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryUrl)));
				op.updateStatus(sqlops.TaskStatus.Succeeded, LocalizedConstants.sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryUrl));

				/*
				// Spark Tracking URl is not working now.
				let sparkTrackingUrl = this._dataModel.generateSparkTrackingUIUrl(submissionSettings, appId);
				vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionTrackingLinkMessage(sparkTrackingUrl));
				this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionTrackingLinkMessage(sparkTrackingUrl)));
				op.updateStatus(sqlops.TaskStatus.Succeeded, LocalizedConstants.sparkJobSubmissionTrackingLinkMessage(sparkTrackingUrl));
				*/

				let yarnUIUrl = this._dataModel.generateYarnUIUrl(submissionSettings, appId);
				vscode.window.showInformationMessage(LocalizedConstants.sparkJobSubmissionYarnUIMessage(yarnUIUrl));
				this.outputChannel.appendLine(this.addInfoTag(LocalizedConstants.sparkJobSubmissionYarnUIMessage(yarnUIUrl)));
				op.updateStatus(sqlops.TaskStatus.Succeeded, LocalizedConstants.sparkJobSubmissionYarnUIMessage(yarnUIUrl));
			} catch (error) {
				vscode.window.showErrorMessage(LocalizedConstants.sparkJobSubmissionGetApplicationIdFailed(utils.getErrorMessage(error)));
				this.outputChannel.appendLine(this.addErrorTag(LocalizedConstants.sparkJobSubmissionGetApplicationIdFailed(utils.getErrorMessage(error))));
				op.updateStatus(sqlops.TaskStatus.Failed, LocalizedConstants.sparkJobSubmissionGetApplicationIdFailed(utils.getErrorMessage(error)));
				this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
				return;
			}

			this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
		} catch (error) {
			vscode.window.showErrorMessage(LocalizedConstants.sparkJobSubmissionSubmitJobFailed(utils.getErrorMessage(error)));
			this.outputChannel.appendLine(this.addErrorTag(LocalizedConstants.sparkJobSubmissionSubmitJobFailed(utils.getErrorMessage(error))));
			op.updateStatus(sqlops.TaskStatus.Failed, LocalizedConstants.sparkJobSubmissionSubmitJobFailed(utils.getErrorMessage(error)));
			this.outputChannel.appendLine(LocalizedConstants.sparkJobSubmissionEndMessage);
		}
	}

	private async handleValidate(): Promise<boolean> {
		return this._sparkConfigTab.validate();
	}

	private getSubmissionInput(): SparkJobSubmissionInput {
		let generalConfig = this._sparkConfigTab.getInputValues();
		let advancedConfig = this._sparkAdvancedTab.getInputValues();
		return new SparkJobSubmissionInput(generalConfig[0], this._dataModel.hdfsSubmitFilePath, generalConfig[1], generalConfig[2],
			advancedConfig[0], advancedConfig[1], advancedConfig[2]);
	}

	private addInfoTag(info: string): string {
		return `[Info]  ${info}`;
	}

	private addErrorTag(error: string): string {
		return `[Error] ${error}`;
	}
}
