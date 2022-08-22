/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { LocalizedStrings } from './localized';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { htmlEscape } from './utils';

export class HTMLReportBuilder {
	constructor(
		private _assessmentResult: azdata.SqlAssessmentResult,
		private _dateUpdated: number,
		private _connectionInfo: azdata.connection.ConnectionProfile
	) {
	}

	public async build(): Promise<string> {
		const serverInfo = await azdata.connection.getServerInfo(this._connectionInfo.connectionId);

		let mainContent = `
		<html>
		<head>
			<title>${LocalizedStrings.REPORT_TITLE}</title>
		</head>
		<body>
			<div class="header">
				<div>${LocalizedStrings.REPORT_TITLE}</div>
			</div>
			<div style="font-style: italic;">${new Date(this._dateUpdated).toLocaleString(vscode.env.language)}</div>
			${this.buildVersionDetails(serverInfo)}
			<div style="margin-top: 20px;">
				${this.buildResultsSection()}
			</div>
			${this.buildStyleSection()}
		</body>
		</html>`;
		return mainContent;
	}

	private instanceName(serverInfo: azdata.ServerInfo): string {
		const serverName = this._connectionInfo.serverName;
		if (['local', '(local)'].indexOf(serverName.toLowerCase()) >= 0) {

			return serverInfo !== undefined
				? (<any>serverInfo)['machineName']
				: serverName;
		}
		return serverName;
	}

	private buildVersionDetails(serverInfo: azdata.ServerInfo): string {
		return `
		<div class="details">
			<div>
				<span>${LocalizedStrings.API_VERSION}: ${this._assessmentResult.apiVersion}</span><br />
				<span>${LocalizedStrings.DEFAULT_RULESET_VERSION}: ${this._assessmentResult.items[0].rulesetVersion}</span>
			</div>
			<div>
				<span>${LocalizedStrings.SECTION_TITLE_SQL_SERVER}: ${serverInfo.serverEdition} ${serverInfo.serverVersion}</span><br>
				<span>${LocalizedStrings.SERVER_INSTANCENAME}: ${this.instanceName(serverInfo)}</span>
			</div>
		</div>
		`;
	}

	private buildResultsSection(): string {
		let resultByTarget: { [targetType: number]: { [targetName: string]: azdata.SqlAssessmentResultItem[] } } = [];
		this._assessmentResult.items.forEach(resultItem => {
			if (resultByTarget[resultItem.targetType] === undefined) {
				resultByTarget[resultItem.targetType] = Object.create([]);
			}
			if (resultByTarget[resultItem.targetType][resultItem.targetName] === undefined) {
				resultByTarget[resultItem.targetType][resultItem.targetName] = [];
			}
			resultByTarget[resultItem.targetType][resultItem.targetName].push(resultItem);
		});

		let result = '';
		if (resultByTarget[azdata.sqlAssessment.SqlAssessmentTargetType.Server] !== undefined) {
			Object.keys(resultByTarget[azdata.sqlAssessment.SqlAssessmentTargetType.Server]).forEach(instanceName => {
				result += this.buildTargetAssessmentSection(resultByTarget[azdata.sqlAssessment.SqlAssessmentTargetType.Server][instanceName]);
			});
		}
		if (resultByTarget[azdata.sqlAssessment.SqlAssessmentTargetType.Database] !== undefined) {
			Object.keys(resultByTarget[azdata.sqlAssessment.SqlAssessmentTargetType.Database]).forEach(dbName => {
				result += this.buildTargetAssessmentSection(resultByTarget[azdata.sqlAssessment.SqlAssessmentTargetType.Database][dbName]);
			});

		}

		return result;
	}

	private buildTargetAssessmentSection(targetResults: azdata.SqlAssessmentResultItem[]): string {
		let content = `
		<div>
			<div class="target">${targetResults[0].targetType === azdata.sqlAssessment.SqlAssessmentTargetType.Server ? LocalizedStrings.RESULTS_FOR_INSTANCE : LocalizedStrings.RESULTS_FOR_DATABASE}: ${targetResults[0].targetName}</div>
			${this.buildSeveritySection(LocalizedStrings.REPORT_ERROR, targetResults.filter(item => item.level === 'Error'))}
			${this.buildSeveritySection(LocalizedStrings.REPORT_HIGH, targetResults.filter(item => item.level === 'High'))}
			${this.buildSeveritySection(LocalizedStrings.REPORT_WARNING, targetResults.filter(item => item.level === 'Warning'))}
			${this.buildSeveritySection(LocalizedStrings.REPORT_MEDIUM, targetResults.filter(item => item.level === 'Medium'))}
			${this.buildSeveritySection(LocalizedStrings.REPORT_LOW, targetResults.filter(item => item.level === 'Low'))}
			${this.buildSeveritySection(LocalizedStrings.REPORT_INFO, targetResults.filter(item => item.level === 'Information'))}
		</div>`;
		return content;
	}
	private buildSeveritySection(severityName: string, items: azdata.SqlAssessmentResultItem[]) {
		if (items.length === 0) {
			return '';
		}

		return `
		<div class="severityBlock">
			<div>${LocalizedStrings.REPORT_SEVERITY_MESSAGE(severityName, items.length)}</div>
			<table>
				<tr><th>${LocalizedStrings.MESSAGE_COLUMN_NAME}</th><th>${LocalizedStrings.HELP_LINK_COLUMN_NAME}</th><th>${LocalizedStrings.TAGS_COLUMN_NAME}</th><th>${LocalizedStrings.CHECKID_COLUMN_NAME}</th></tr>
				${this.buildItemsRows(items)}
			</table>
		</div>`;
	}
	private buildItemsRows(items: azdata.SqlAssessmentResultItem[]): string {
		let content = '';
		items.forEach(item => {
			content += `<tr>
					<td>${htmlEscape(item.message)}</td>
					<td><a href='${item.helpLink}' target='_blank;'>${LocalizedStrings.LEARN_MORE_LINK}</a></td>
					<td>${this.formatTags(item.tags)}</td>
					<td>${item.checkId}</td>
				</tr>`;
		});
		return content;
	}
	private formatTags(tags: string[]): string {
		return tags?.join(', ');
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
			width: 200px;
		}
		table th:nth-child(4) {
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
		@media print {
			body {
				margin: 0;
			}
			table th:nth-child(2),
			table td:nth-child(2) {
				display:none;
			}
			table th:nth-child(3) {
				width: 120px;
			}
			table th:nth-child(4) {
				width: 150px;
			}
		}
	</style>
		`;
	}
}
