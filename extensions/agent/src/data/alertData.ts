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
import { JobData } from './jobData';

const localize = nls.loadMessageBundle();

export class AlertData implements IAgentDialogData {
	public static readonly AlertTypeSqlServerEventString: string = localize('alertData.DefaultAlertTypString', 'SQL Server event alert');
	public static readonly AlertTypePerformanceConditionString: string = localize('alertDialog.PerformanceCondition', 'SQL Server performance condition alert');
	public static readonly AlertTypeWmiEventString: string = localize('alertDialog.WmiEvent', 'WMI event alert');
	public static readonly DefaultAlertTypeString: string =  AlertData.AlertTypeSqlServerEventString;

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
	isEnabled: boolean = true;
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
	alertType: string = AlertData.DefaultAlertTypeString;
	wmiEventNamespace: string;
	wmiEventQuery: string;

	private viaJobDialog: boolean;
	private jobModel: JobData;

	constructor(
		ownerUri:string,
		alertInfo: sqlops.AgentAlertInfo,
		jobModel?: JobData,
		viaJobDialog: boolean = false
	) {
		this.ownerUri = ownerUri;
		this.viaJobDialog = viaJobDialog;
		this.jobModel = jobModel;
		this.jobName = this.jobName ? this.jobName : this.jobModel.name;

		if (alertInfo) {
			this.dialogMode = AgentDialogMode.EDIT;
			this.id = alertInfo.id;
			this.name = alertInfo.name;
			this.originalName = alertInfo.name;
			this.delayBetweenResponses = alertInfo.delayBetweenResponses;
			this.eventDescriptionKeyword = alertInfo.eventDescriptionKeyword;
			this.eventSource = alertInfo.eventSource;
			this.hasNotification = alertInfo.hasNotification;
			this.includeEventDescription = alertInfo.includeEventDescription ? alertInfo.includeEventDescription.toString() : null;
			this.isEnabled = alertInfo.isEnabled;
			this.jobId = alertInfo.jobId;
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
			this.alertType = alertInfo.alertType ? alertInfo.alertType.toString() : null;
			this.wmiEventNamespace = alertInfo.wmiEventNamespace;
			this.wmiEventQuery = alertInfo.wmiEventQuery;
		}
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		let result: any;
		// if it's called via the job dialog, add it to the
		// job model
		if (this.viaJobDialog) {
			if (this.jobModel) {
				Promise.resolve(this);
				return;
			}
		} else {
			// has to be a create alert
			result = await agentService.createAlert(this.ownerUri, this.toAgentAlertInfo());
		}
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
			alertType: AlertData.getAlertTypeFromString(this.alertType),
			wmiEventNamespace: this.wmiEventNamespace,
			wmiEventQuery: this.wmiEventQuery
		};
	}

	private static getAlertTypeFromString(alertTypeString: string): sqlops.AlertType {
		if (alertTypeString === AlertData.AlertTypePerformanceConditionString) {
			return sqlops.AlertType.sqlServerPerformanceCondition;
		} else if (alertTypeString === AlertData.AlertTypeWmiEventString) {
			return sqlops.AlertType.wmiEvent;
		} else {
			return sqlops.AlertType.sqlServerEvent;
		}
	}
}