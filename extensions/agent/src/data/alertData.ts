/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

const localize = nls.loadMessageBundle();

export class AlertData implements IAgentDialogData {
	ownerUri: string;
	dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
	id: number;
	name: string;
	originalName: string;
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

	constructor(ownerUri:string, alertInfo: sqlops.AgentAlertInfo) {
		this.ownerUri = ownerUri;

		if (alertInfo) {
			this.dialogMode = AgentDialogMode.EDIT;
			this.id = alertInfo.id;
			this.name = alertInfo.name;
			this.originalName = alertInfo.name;
			this.delayBetweenResponses = alertInfo.delayBetweenResponses;
			this.eventDescriptionKeyword = alertInfo.eventDescriptionKeyword;
			this.eventSource = alertInfo.eventSource;
			this.hasNotification = alertInfo.hasNotification;
			this.includeEventDescription = alertInfo.includeEventDescription.toString();
			this.isEnabled = alertInfo.isEnabled;
			this.jobId = alertInfo.jobId;
			this.jobName = alertInfo.jobName;
			this.lastOccurrenceDate = alertInfo.lastOccurrenceDate;
			this.lastResponseDate = alertInfo.lastResponseDate;
			this.messageId = alertInfo.messageId;
			this.notificationMessage = alertInfo.notificationMessage;
			this.occurrenceCount = alertInfo.occurrenceCount;
			this.performanceCondition = alertInfo.performanceCondition;
			this.severity = alertInfo.severity;
			this.databaseName = alertInfo.databaseName;
			this.countResetDate = alertInfo.countResetDate;
			this.categoryName = alertInfo.categoryName;
			this.alertType = alertInfo.alertType.toString();
			this.wmiEventNamespace = alertInfo.wmiEventNamespace;
			this.wmiEventQuery = alertInfo.wmiEventQuery;
		}
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		let result = this.dialogMode === AgentDialogMode.CREATE
			? await agentService.createAlert(this.ownerUri,  this.toAgentAlertInfo())
			: await agentService.updateAlert(this.ownerUri, this.originalName, this.toAgentAlertInfo());

		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.saveErrorMessage', "Alert update failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
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