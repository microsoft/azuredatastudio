/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

export class ScheduleData implements IAgentDialogData {
	public dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
	public ownerUri: string;
	public schedules: sqlops.AgentJobScheduleInfo[];
	public selectedSchedule: sqlops.AgentJobScheduleInfo;

	constructor(ownerUri:string) {
		this.ownerUri = ownerUri;
	}

	public async initialize() {
		let agentService = await AgentUtils.getAgentService();
		let result = await agentService.getJobSchedules(this.ownerUri);
		if (result && result.success) {
			this.schedules = result.schedules;
		}
	}

	public async save() {
	}
}
