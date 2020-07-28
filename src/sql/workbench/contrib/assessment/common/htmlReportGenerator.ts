/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as platform from 'vs/base/common/platform';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { escape } from 'vs/base/common/strings';
import { SqlAssessmentResult, SqlAssessmentResultItem } from 'azdata';
import { SqlAssessmentTargetType } from 'sql/workbench/api/common/sqlExtHostTypes';

export class HTMLReportBuilder {

	constructor(
		private _assessmentResult: SqlAssessmentResult,
		private _dateUpdated: number,
		private _connectionInfo: ConnectionManagementInfo
	) {
	}



	public Build(): string {
		let mainContent = `
		<html>
		<head>
			<title>SQL Assessment Report</title>
		</head>
		<body>
			<div class="header">
				<div>SQL Assessment Report</div>
			</div>
			<div style="font-style: italic;">${new Date(this._dateUpdated).toLocaleString(platform.locale)}</div>
			${this.buildVersionDetails()}
			<div style="margin-top: 20px;">
				${this.buildResultsSection()}
			</div>
			${this.buildStyleSection()}
		</body>
		</html>`;
		return mainContent;
	}

	private buildVersionDetails(): string {
		return `
		<div class="details">
			<div>
				<span>API Version: ${this._assessmentResult.apiVersion}</span><br />
				<span>Default Ruleset: ${this._assessmentResult.items[0].rulesetVersion}</span>
			</div>
			<div>
				<span>SQL Server: ${this._connectionInfo.serverInfo?.serverEdition} ${this._connectionInfo.serverInfo?.serverVersion}</span><br>
				<span>Instance name: ${this._connectionInfo.connectionProfile.serverName}</span>
			</div>
		</div>
		`;
	}

	private buildResultsSection(): string {
		let resultByTarget = [];
		this._assessmentResult.items.forEach(resultItem => {
			if (resultByTarget[resultItem.targetType] === undefined) {
				resultByTarget[resultItem.targetType] = [];
			}
			if (resultByTarget[resultItem.targetType][resultItem.targetName] === undefined) {
				resultByTarget[resultItem.targetType][resultItem.targetName] = [];
			}
			resultByTarget[resultItem.targetType][resultItem.targetName].push(resultItem);
		});

		let result = '';
		if (resultByTarget[SqlAssessmentTargetType.Server] !== undefined) {
			Object.keys(resultByTarget[SqlAssessmentTargetType.Server]).forEach(instanceName => {
				result += this.buildTargetAssessmentSection(resultByTarget[SqlAssessmentTargetType.Server][instanceName]);
			});
		}
		if (resultByTarget[SqlAssessmentTargetType.Database] !== undefined) {
			Object.keys(resultByTarget[SqlAssessmentTargetType.Database]).forEach(dbName => {
				result += this.buildTargetAssessmentSection(resultByTarget[SqlAssessmentTargetType.Database][dbName]);
			});

		}

		return result;
	}

	private buildTargetAssessmentSection(targetResults: SqlAssessmentResultItem[]): string {
		let content = `
		<div>
			<div class="target">Results for ${targetResults[0].targetType === SqlAssessmentTargetType.Server ? 'instance' : 'database'}: ${targetResults[0].targetName}</div>
			${this.buildSeveritySection('Errors', targetResults.filter(item => item.level === 'Error'))}
			${this.buildSeveritySection('Warnings', targetResults.filter(item => item.level === 'Warning'))}
			${this.buildSeveritySection('Informations', targetResults.filter(item => item.level === 'Information'))}
		</div>`;
		return content;
	}
	private buildSeveritySection(severityName: string, items: SqlAssessmentResultItem[]) {
		if (items.length === 0) {
			return '';
		}

		return `
		<div class="severityBlock">
			<div>${severityName}: ${items.length} item(s)</div>
			<table>
				<tr><th>Message</th><th>Help Link</th><th>Check ID</th></tr>
				${this.buildItemsRows(items)}
			</table>
		</div>`;
	}
	private buildItemsRows(items: SqlAssessmentResultItem[]): string {
		let content = '';
		items.forEach(item => {
			content += `<tr>
					<td>${escape(item.message)}</td>
					<td><a href='${item.helpLink}' target='_blank;'>Learn More</a></td>
					<td>${item.checkId}</td>
				</tr>`;
		});
		return content;
	}

	private buildStyleSection(): string {
		return `
		<style>
		* {
			color: #4a4a4a;
			font-family: "Segoe WPC", "Segoe UI", sans-serif;
			font-size: 14px;
		}

		body {
			margin: 20px;
		}

		div {
			margin-bottom: 10px;
		}

		.header>* {
			font-size: 30px;
			font-weight: bold;
			margin-top: 10px;
		}

		.target {
			font-size: 1.7em;
		}

		table {
			border-collapse: collapse;
			width: 100%;
			border: 1px solid silver;
			table-layout: fixed;
		}

		table th:nth-child(1) {
			width: 85%;
		}

		table th:nth-child(2) {
			width: 80px;
		}

		table th:nth-child(3) {
			width: 10%;
		}

		table td,
		table th {
			border-bottom: 1px solid silver;
			border-right: 1px dotted silver;
			padding: 3px 5px;
			white-space: normal;
			text-overflow: ellipsis;
			overflow: hidden;

		}

		table th {
			background-color: silver;
		}

		div.severityBlock>div {
			font-size: larger;
		}
	</style>
		`;
	}
}
