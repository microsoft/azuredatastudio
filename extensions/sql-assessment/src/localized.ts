/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const LocalizedStrings = {
	SECTION_TITLE_API: localize('asmt.section.api.title', "Info"),
	API_VERSION: localize('asmt.apiversion', "API Version"),
	DEFAULT_RULESET_VERSION: localize('asmt.rulesetversion', "Default Ruleset"),
	SECTION_TITLE_SQL_SERVER: localize('asmt.section.instance.title', "SQL Server Instance Details"),
	SERVER_VERSION: localize('asmt.serverversion', "Version"),
	SERVER_EDITION: localize('asmt.serveredition', "Edition"),
	SERVER_INSTANCENAME: localize('asmt.instancename', "Instance Name"),
	SERVER_OSVERSION: localize('asmt.osversion', "OS Version"),
	TARGET_COLUMN_NAME: localize('asmt.column.target', "Target"),
	SEVERITY_COLUMN_NAME: localize('asmt.column.severity', "Severity"),
	MESSAGE_COLUMN_NAME: localize('asmt.column.message', "Message"),
	CHECKID_COLUMN_NAME: localize('asmt.column.checkId', "Check ID"),
	TAGS_COLUMN_NAME: localize('asmt.column.tags', "Tags"),
	LEARN_MORE_LINK: localize('asmt.learnMore', "Learn More"),
	REPORT_TITLE: localize('asmt.sqlReportTitle', "SQL Assessment Report"),
	RESULTS_FOR_DATABASE: localize('asmt.sqlReport.resultForDatabase', "Results for database"),
	RESULTS_FOR_INSTANCE: localize('asmt.sqlReport.resultForInstance', "Results for server"),
	REPORT_ERROR: localize('asmt.sqlReport.Error', "Error"),
	REPORT_HIGH: localize('asmt.sqlReport.High', "High"),
	REPORT_WARNING: localize('asmt.sqlReport.Warning', "Warning"),
	REPORT_MEDIUM: localize('asmt.sqlReport.Medium', "Medium"),
	REPORT_LOW: localize('asmt.sqlReport.Low', "Low"),
	REPORT_INFO: localize('asmt.sqlReport.Info', "Information"),
	HELP_LINK_COLUMN_NAME: localize('asmt.column.helpLink', "Help Link"),
	REPORT_SEVERITY_MESSAGE: function (severity: string, count: number) {
		return localize('asmt.sqlReport.severityMsg', "{0}: {1} item(s)", severity, count);
	},
	ASSESSMENT_TAB_NAME: 'Assessment',
	HISTORY_TAB_NAME: 'History'
};
