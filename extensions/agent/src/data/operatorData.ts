/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

export class OperatorData implements IAgentDialogData {
	public dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
	ownerUri: string;
	name: string;
	id: number;
	emailAddress: string;
	enabled: boolean;
	lastEmailDate: string;
	lastNetSendDate: string;
	lastPagerDate: string;
	pagerAddress: string;
	categoryName: string;
	pagerDays: string;
	saturdayPagerEndTime: string;
	saturdayPagerStartTime: string;
	sundayPagerEndTime: string;
	sundayPagerStartTime: string;
	netSendAddress: string;
	weekdayPagerStartTime: string;
	weekdayPagerEndTime: string;

	constructor(ownerUri: string, operatorInfo: azdata.AgentOperatorInfo) {
		this.ownerUri = ownerUri;
		if (operatorInfo) {
			this.dialogMode = AgentDialogMode.EDIT;
			this.name = operatorInfo.name;
			this.id = operatorInfo.id;
			this.emailAddress = operatorInfo.emailAddress;
			this.enabled = operatorInfo.enabled;
			this.lastEmailDate = operatorInfo.lastEmailDate;
			this.lastNetSendDate = operatorInfo.lastNetSendDate;
			this.lastPagerDate = operatorInfo.lastPagerDate;
			this.pagerAddress = operatorInfo.pagerAddress;
			this.categoryName = operatorInfo.categoryName;
			this.pagerDays = operatorInfo.pagerDays.toString();
			this.saturdayPagerEndTime = operatorInfo.saturdayPagerEndTime;
			this.saturdayPagerStartTime = operatorInfo.saturdayPagerStartTime;
			this.sundayPagerEndTime = operatorInfo.sundayPagerEndTime;
			this.sundayPagerStartTime = operatorInfo.sundayPagerStartTime;
			this.netSendAddress = operatorInfo.netSendAddress;
			this.weekdayPagerStartTime = operatorInfo.weekdayPagerStartTime;
			this.weekdayPagerEndTime = operatorInfo.weekdayPagerEndTime;
		}
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		let result = await agentService.createOperator(this.ownerUri, this.toAgentOperatorInfo());
		if (!result || !result.success) {
			// TODO handle error here
		}
	}

	public toAgentOperatorInfo(): azdata.AgentOperatorInfo {
		return {
			name: this.name,
			id: this.id,
			emailAddress: this.emailAddress,
			enabled: this.enabled,
			lastEmailDate: this.lastEmailDate,
			lastNetSendDate: this.lastNetSendDate,
			lastPagerDate: this.lastPagerDate,
			pagerAddress: this.pagerAddress,
			categoryName: this.categoryName,
			pagerDays: azdata.WeekDays.weekDays, //this.pagerDays,
			saturdayPagerEndTime: this.saturdayPagerEndTime,
			saturdayPagerStartTime: this.saturdayPagerStartTime,
			sundayPagerEndTime: this.sundayPagerEndTime,
			sundayPagerStartTime: this.sundayPagerStartTime,
			netSendAddress: this.netSendAddress,
			weekdayPagerStartTime: this.weekdayPagerStartTime,
			weekdayPagerEndTime: this.weekdayPagerEndTime
		};
	}
}
