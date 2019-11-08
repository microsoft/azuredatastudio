/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

export class PickScheduleData implements IAgentDialogData {
	public dialogMode: AgentDialogMode = AgentDialogMode.VIEW;
	public ownerUri: string;
	public schedules: azdata.AgentJobScheduleInfo[];
	public selectedSchedule: azdata.AgentJobScheduleInfo;
	private jobName: string;
	private initialized: boolean;

	constructor(ownerUri: string, jobName: string) {
		this.ownerUri = ownerUri;
		this.jobName = jobName;
	}

	public async initialize(): Promise<azdata.AgentJobScheduleInfo[] | undefined> {
		let agentService = await AgentUtils.getAgentService();
		try {
			let result = await agentService.getJobSchedules(this.ownerUri);
			this.initialized = true;
			if (result && result.success) {
				this.schedules = result.schedules;
				return this.schedules;
			}
			return undefined;
		} catch (error) {
			throw error;
		}
	}

	public async save() {
		this.selectedSchedule.jobName = this.jobName;
	}

	public isInitialized() {
		return this.initialized;
	}
}
