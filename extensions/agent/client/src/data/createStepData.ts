/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';

export class CreateStepData {
	public ownerUri: string;
	public jobId: string;
	public name: string;
	public type: string;
	public database: string;

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
			id: this.id,
			failureAction: '',
			successAction: '',
			failStepId: 0,
			successStepId: 0,
			command: '',
			commandExecutionSuccessCode: 0,
			databaseName: '',
			databaseUserName: '',
			server: '',
			outputFileName: '',
			appendToLogFile: false,
			appendToStepHist: false,
			writeLogToTable: false,
			appendLogToTable: false,
			retryAttempts: 0,
			retryInterval: 0,
			proxyName: ''
		}).then(result => {
			console.info(result.step.stepName);
		});
	}
}