/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assign } from 'vs/base/common/objects';
import { IssueType, ISettingSearchResult, IssueReporterExtensionData } from 'vs/platform/issue/common/issue';

export interface IssueReporterData {
	issueType?: IssueType;
	issueDescription?: string;

	versionInfo?: any;
	systemInfo?: any;
	processInfo?: any;
	workspaceInfo?: any;

	includeSystemInfo?: boolean;
	includeWorkspaceInfo?: boolean;
	includeProcessInfo?: boolean;
	includeExtensions?: boolean;
	includeSearchedExtensions?: boolean;
	includeSettingsSearchDetails?: boolean;

	numberOfThemeExtesions?: number;
	allExtensions?: IssueReporterExtensionData[];
	enabledNonThemeExtesions?: IssueReporterExtensionData[];
	extensionsDisabled?: boolean;
	fileOnExtension?: boolean;
	selectedExtension?: IssueReporterExtensionData;
	actualSearchResults?: ISettingSearchResult[];
	query?: string;
	filterResultCount?: number;
}

export class IssueReporterModel {
	private _data: IssueReporterData;

	constructor(initialData?: IssueReporterData) {
		const defaultData = {
			includeSystemInfo: true,
			includeWorkspaceInfo: true,
			includeProcessInfo: true,
			includeExtensions: true,
			includeSearchedExtensions: true,
			includeSettingsSearchDetails: true
		};

		this._data = initialData ? assign(defaultData, initialData) : defaultData;
	}

	getData(): IssueReporterData {
		return this._data;
	}

	update(newData: IssueReporterData): void {
		assign(this._data, newData);
	}

	// {{SQL CARBON EDIT}}
	serialize(): string {
		return `
Issue Type: <b>${this.getIssueTypeTitle()}</b>

${this._data.issueDescription}

Azure Data Studio version: ${this._data.versionInfo && this._data.versionInfo.vscodeVersion}
OS version: ${this._data.versionInfo && this._data.versionInfo.os}

${this.getInfos()}
<!-- generated by issue reporter -->`;
	}

	fileOnExtension(): boolean {
		const fileOnExtensionSupported = this._data.issueType === IssueType.Bug
			|| this._data.issueType === IssueType.PerformanceIssue
			|| this._data.issueType === IssueType.FeatureRequest;

		return !!(fileOnExtensionSupported && this._data.fileOnExtension);
	}

	private getExtensionVersion(): string {
		if (this.fileOnExtension() && this._data.selectedExtension) {
			return `\nExtension version: ${this._data.selectedExtension.version}`;
		} else {
			return '';
		}
	}

	private getIssueTypeTitle(): string {
		if (this._data.issueType === IssueType.Bug) {
			return 'Bug';
		} else if (this._data.issueType === IssueType.PerformanceIssue) {
			return 'Performance Issue';
		} else if (this._data.issueType === IssueType.SettingsSearchIssue) {
			return 'Settings Search Issue';
		} else {
			return 'Feature Request';
		}
	}

	private getInfos(): string {
		let info = '';

		if (this._data.issueType === IssueType.Bug || this._data.issueType === IssueType.PerformanceIssue) {
			if (this._data.includeSystemInfo) {
				info += this.generateSystemInfoMd();
			}
		}

		if (this._data.issueType === IssueType.PerformanceIssue) {

			if (this._data.includeProcessInfo) {
				info += this.generateProcessInfoMd();
			}

			if (this._data.includeWorkspaceInfo) {
				info += this.generateWorkspaceInfoMd();
			}
		}

		if (this._data.issueType === IssueType.Bug || this._data.issueType === IssueType.PerformanceIssue) {
			if (this._data.includeExtensions) {
				info += this.generateExtensionsMd();
			}
		}

		if (this._data.issueType === IssueType.SettingsSearchIssue) {
			if (this._data.includeSearchedExtensions) {
				info += this.generateExtensionsMd();
			}

			if (this._data.includeSettingsSearchDetails) {
				info += this.generateSettingSearchResultsMd();
				info += '\n' + this.generateSettingsSearchResultDetailsMd();
			}
		}

		return info;
	}

	private generateSystemInfoMd(): string {
		let md = `<details>
<summary>System Info</summary>

|Item|Value|
|---|---|
`;

		Object.keys(this._data.systemInfo).forEach(k => {
			const data = typeof this._data.systemInfo[k] === 'object'
				? Object.keys(this._data.systemInfo[k]).map(key => `${key}: ${this._data.systemInfo[k][key]}`).join('<br>')
				: this._data.systemInfo[k];

			md += `|${k}|${data}|\n`;
		});

		md += '\n</details>';

		return md;
	}

	private generateProcessInfoMd(): string {
		return `<details>
<summary>Process Info</summary>

\`\`\`
${this._data.processInfo}
\`\`\`

</details>
`;
	}

	private generateWorkspaceInfoMd(): string {
		return `<details>
<summary>Workspace Info</summary>

\`\`\`
${this._data.workspaceInfo};
\`\`\`

</details>
`;
	}

	private generateExtensionsMd(): string {
		if (this._data.extensionsDisabled) {
			return 'Extensions disabled';
		}

		const themeExclusionStr = this._data.numberOfThemeExtesions ? `\n(${this._data.numberOfThemeExtesions} theme extensions excluded)` : '';

		if (!this._data.enabledNonThemeExtesions) {
			return 'Extensions: none' + themeExclusionStr;
		}

		let tableHeader = `Extension|Author (truncated)|Version
---|---|---`;
		const table = this._data.enabledNonThemeExtesions.map(e => {
			return `${e.name}|${e.publisher.substr(0, 3)}|${e.version}`;
		}).join('\n');

		return `<details><summary>Extensions (${this._data.enabledNonThemeExtesions.length})</summary>

${tableHeader}
${table}
${themeExclusionStr}

</details>`;
	}

	private generateSettingsSearchResultDetailsMd(): string {
		return `
Query: ${this._data.query}
Literal matches: ${this._data.filterResultCount}`;
	}

	private generateSettingSearchResultsMd(): string {
		if (!this._data.actualSearchResults) {
			return '';
		}

		if (!this._data.actualSearchResults.length) {
			return `No fuzzy results`;
		}

		let tableHeader = `Setting|Extension|Score
---|---|---`;
		const table = this._data.actualSearchResults.map(setting => {
			return `${setting.key}|${setting.extensionId}|${String(setting.score).slice(0, 5)}`;
		}).join('\n');

		return `<details><summary>Results</summary>

${tableHeader}
${table}

</details>`;
	}
}