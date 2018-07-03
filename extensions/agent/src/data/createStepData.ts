/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { AgentUtils } from '../agentUtils';

export class CreateStepData {
	public ownerUri: string;
	public jobId: string; //
	public jobName: string;
	public script: string; //
	public scriptName: string;
	public stepName: string; //
	public subSystem: string; //
	public id: number;
	public failureAction: string; //
	public successAction: string; //
	public failStepId: number;
	public successStepId: number;
	public command: string;
	public commandExecutionSuccessCode: number;
	public databaseName: string; //
	public databaseUserName: string;
	public server: string;
	public outputFileName: string; //
	public appendToLogFile: boolean;
	public appendToStepHist: boolean;
	public writeLogToTable: boolean;
	public appendLogToTable: boolean;
	public retryAttempts: number; //
	public retryInterval: number; //
	public proxyName: string;

	constructor(ownerUri:string) {
		this.ownerUri = ownerUri;
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
			id: 1,
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
			console.info(result);
		});
	}
}