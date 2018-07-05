/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData } from '../interfaces';

export class AlertData implements IAgentDialogData {
	ownerUri: string;
	id: number;
	name: string;
	delayBetweenResponses: number;
	eventDescriptionKeyword: string;
	eventSource: string;
	hasNotification: number;
	includeEventDescription: string;
	isEnabled: boolean;
	jobId: string;
	jobName: string;
	lastOccurrenceDate: string;
	lastResponseDate: string;
	messageId: number;
	notificationMessage: string;
	occurrenceCount: number;
	performanceCondition: string;
	severity: number;
	databaseName: string;
	countResetDate: string;
	categoryName: string;
	alertType: string;
	wmiEventNamespace: string;
	wmiEventQuery: string;

	constructor(ownerUri:string) {
		this.ownerUri = ownerUri;
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		let result = await agentService.createAlert(this.ownerUri,  this.toAgentAlertInfo());
		if (!result || !result.success) {
			// TODO handle error here
		}
	}

	public toAgentAlertInfo(): sqlops.AgentAlertInfo {
		return {
			id: this.id,
			name: this.name,
			delayBetweenResponses: this.delayBetweenResponses,
			eventDescriptionKeyword: this.eventDescriptionKeyword,
			eventSource: this.eventSource,
			hasNotification: this.hasNotification,
			includeEventDescription: sqlops.NotifyMethods.none, // this.includeEventDescription,
			isEnabled: this.isEnabled,
			jobId: this.jobId,
			jobName: this.jobName,
			lastOccurrenceDate: this.lastOccurrenceDate,
			lastResponseDate: this.lastResponseDate,
			messageId: this.messageId,
			notificationMessage: this.notificationMessage,
			occurrenceCount: this.occurrenceCount,
			performanceCondition: this.performanceCondition,
			severity: this.severity,
			databaseName: this.databaseName,
			countResetDate: this.countResetDate,
			categoryName: this.categoryName,
			alertType: sqlops.AlertType.sqlServerEvent, //this.alertType,
			wmiEventNamespace: this.wmiEventNamespace,
			wmiEventQuery: this.wmiEventQuery
		};
	}
}
