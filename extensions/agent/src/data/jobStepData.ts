/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';
import { JobData } from './jobData';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class JobStepData implements IAgentDialogData {

	// Error Messages
	private static readonly CreateStepErrorMessage_JobNameIsEmpty = localize('stepData.jobNameRequired', 'Job name must be provided');
	private static readonly CreateStepErrorMessage_StepNameIsEmpty = localize('stepData.stepNameRequired', 'Step name must be provided');

	public dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
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
	public failStepId: number;
	public successStepId: number;
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

	constructor(ownerUri:string, jobModel?: JobData) {
		this.ownerUri = ownerUri;
		this.jobName = jobModel.name;
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		agentService.createJobStep(this.ownerUri, {
			jobId: this.jobId,
			jobName: this.jobName,
			script: this.script,
			scriptName: this.scriptName,
			stepName: this.stepName,
			subSystem: this.subSystem,
			id: this.id,
			failureAction: this.failureAction,
			successAction: this.successAction,
			failStepId: this.failStepId,
			successStepId: this.successStepId,
			command: this.command,
			commandExecutionSuccessCode: this.commandExecutionSuccessCode,
			databaseName: this.databaseName,
			databaseUserName: this.databaseUserName,
			server: this.server,
			outputFileName: this.outputFileName,
			appendToLogFile: this.appendToLogFile,
			appendToStepHist: this.appendToStepHist,
			writeLogToTable: this.writeLogToTable,
			appendLogToTable: this.appendLogToTable,
			retryAttempts: this.retryAttempts,
			retryInterval: this.retryInterval,
			proxyName: this.proxyName
		}).then(result => {
			if (result && result.success) {
				console.info(result);
			}
		});
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
		return stepData;
	}
}