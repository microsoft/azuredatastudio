/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';

export class CreateStepData {
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
		agentService.createJobStep(this.ownerUri, {
			jobId: '',
			stepId: '',
			stepName: this.name,
			message: '',
			runDate: '',
			runStatus: 1,
		}).then(result => {
			console.info(result.step.stepName);
		});
	}
}