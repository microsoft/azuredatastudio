/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';
import { JobData } from './jobData';

const localize = nls.loadMessageBundle();

export class JobStepData implements IAgentDialogData {

	// Error Messages
	private static readonly CreateStepErrorMessage_JobNameIsEmpty = localize('stepData.jobNameRequired', 'Job name must be provided');
	private static readonly CreateStepErrorMessage_StepNameIsEmpty = localize('stepData.stepNameRequired', 'Step name must be provided');

	public dialogMode: AgentDialogMode;
	public ownerUri: string;
	public jobId: string;
	public jobName: string;
	public script: string;
	public scriptName: string;
	public stepName: string;
	public subSystem: string;
	public id: number;
	public failureAction: string;
	public successAction: string;
	public successStepId: number;
	public failStepId: number;
	public command: string;
	public commandExecutionSuccessCode: number;
	public databaseName: string;
	public databaseUserName: string;
	public server: string;
	public outputFileName: string;
	public appendToLogFile: boolean;
	public appendToStepHist: boolean;
	public writeLogToTable: boolean;
	public appendLogToTable: boolean;
	public retryAttempts: number;
	public retryInterval: number;
	public proxyName: string;
	private jobModel: JobData;
	private viaJobDialog: boolean;

	constructor(ownerUri:string, jobModel?: JobData, viaJobDialog: boolean = false) {
		this.ownerUri = ownerUri;
		this.jobName = jobModel.name;
		this.jobModel = jobModel;
		this.viaJobDialog = viaJobDialog;
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		let result: any;
		// if it's called via the job dialog, add it to the
		// job model
		if (this.viaJobDialog) {
			if (this.jobModel) {
				Promise.resolve(this);
				return;
			}
		} else {
			// has to be a create step
			result = await agentService.createJobStep(this.ownerUri, JobStepData.convertToAgentJobStepInfo(this));
		}
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('jobStepData.saveErrorMessage', "Step update failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	public validate(): { valid: boolean, errorMessages: string[] } {
		let validationErrors: string[] = [];

		if (!(this.stepName && this.stepName.trim())) {
			validationErrors.push(JobStepData.CreateStepErrorMessage_StepNameIsEmpty);
		}

		if (!(this.jobName && this.jobName.trim())) {
			validationErrors.push(JobStepData.CreateStepErrorMessage_JobNameIsEmpty);
		}

		return {
			valid: validationErrors.length === 0,
			errorMessages: validationErrors
		};
	}

	public static convertToJobStepData(jobStepInfo: sqlops.AgentJobStepInfo, jobData: JobData) {
		let stepData = new JobStepData(jobData.ownerUri, jobData);
		stepData.ownerUri = jobData.ownerUri;
		stepData.jobId = jobStepInfo.jobId;
		stepData.jobName = jobStepInfo.jobName;
		stepData.script = jobStepInfo.script;
		stepData.scriptName = jobStepInfo.scriptName,
		stepData.stepName = jobStepInfo.stepName,
		stepData.subSystem = jobStepInfo.subSystem,
		stepData.id = jobStepInfo.id,
		stepData.failureAction = jobStepInfo.failureAction,
		stepData.successAction = jobStepInfo.successAction,
		stepData.failStepId = jobStepInfo.failStepId,
		stepData.successStepId = jobStepInfo.successStepId,
		stepData.command = jobStepInfo.command,
		stepData.commandExecutionSuccessCode = jobStepInfo.commandExecutionSuccessCode,
		stepData.databaseName = jobStepInfo.databaseName,
		stepData.databaseUserName = jobStepInfo.databaseUserName,
		stepData.server = jobStepInfo.server,
		stepData.outputFileName = jobStepInfo.outputFileName,
		stepData.appendToLogFile = jobStepInfo.appendToLogFile,
		stepData.appendToStepHist = jobStepInfo.appendToStepHist,
		stepData.writeLogToTable = jobStepInfo.writeLogToTable,
		stepData.appendLogToTable = jobStepInfo.appendLogToTable,
		stepData.retryAttempts = jobStepInfo.retryAttempts,
		stepData.retryInterval = jobStepInfo.retryInterval,
		stepData.proxyName = jobStepInfo.proxyName;
		stepData.dialogMode = AgentDialogMode.EDIT;
		stepData.viaJobDialog = true;
		return stepData;
	}

	public static convertToAgentJobStepInfo(jobStepData: JobStepData): sqlops.AgentJobStepInfo {
		let result: sqlops.AgentJobStepInfo = {
			jobId: jobStepData.jobId,
			jobName: jobStepData.jobName,
			script: jobStepData.script,
			scriptName: jobStepData.scriptName,
			stepName: jobStepData.stepName,
			subSystem: jobStepData.subSystem,
			id: jobStepData.id,
			failureAction: jobStepData.failureAction,
			successAction: jobStepData.successAction,
			failStepId: jobStepData.failStepId,
			successStepId: jobStepData.successStepId,
			command: jobStepData.command,
			commandExecutionSuccessCode: jobStepData.commandExecutionSuccessCode,
			databaseName: jobStepData.databaseName,
			databaseUserName: jobStepData.databaseUserName,
			server: jobStepData.server,
			outputFileName: jobStepData.outputFileName,
			appendToLogFile: jobStepData.appendToLogFile,
			appendToStepHist: jobStepData.appendToStepHist,
			writeLogToTable: jobStepData.writeLogToTable,
			appendLogToTable: jobStepData.appendLogToTable,
			retryAttempts: jobStepData.retryAttempts,
			retryInterval: jobStepData.retryInterval,
			proxyName: jobStepData.proxyName
		};
		return result;
	}

}