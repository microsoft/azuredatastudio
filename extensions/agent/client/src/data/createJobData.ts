/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';

export class CreateJobData {
	public ownerUri: string;
	public name: string;
	public enabled: boolean;
	public description:string;
	public categoryId:number;
	public owner: string;

	constructor(ownerUri:string) {
		this.ownerUri = ownerUri;
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		agentService.createJob(this.ownerUri, {
			name: this.name,
			owner: 'redmond\\alanren',
			description:'',
			currentExecutionStatus: 0,
			lastRunOutcome: 0,
			currentExecutionStep: '',
			enabled: this.enabled,
			hasTarget: true,
			hasSchedule: false,
			hasStep: false,
			runnable: true,
			category: '',
			categoryId: 1,
			categoryType: 1,
			lastRun: '',
			nextRun: '',
			jobId: '',
		}).then(result => {
			console.info(result.job.name);
		});
	}
}