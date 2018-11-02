/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

export class PickScheduleData implements IAgentDialogData {
	public dialogMode: AgentDialogMode = AgentDialogMode.VIEW;
	public ownerUri: string;
	public schedules: sqlops.AgentJobScheduleInfo[];
	public selectedSchedule: sqlops.AgentJobScheduleInfo;
	private jobName: string;

	constructor(ownerUri:string, jobName: string) {
		this.ownerUri = ownerUri;
		this.jobName = jobName;
	}

	public async initialize() {
		let agentService = await AgentUtils.getAgentService();
		let result = await agentService.getJobSchedules(this.ownerUri);
		if (result && result.success) {
			this.schedules = result.schedules;
		}
	}

	public async save() {
		this.selectedSchedule.jobName = this.jobName;
	}
}
