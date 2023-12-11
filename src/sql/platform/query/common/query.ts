/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IQueryEditorConfiguration {
	readonly results: {
		readonly saveAsCsv: {
			readonly includeHeaders: boolean;
			readonly delimiter: string;
			readonly lineSeperator: string;
			readonly textIdentifier: string;
			readonly encoding: string;
		};
		readonly saveAsExcel: {
			readonly includeHeaders: boolean;
			readonly freezeHeaderRow: boolean;
			readonly boldHeaderRow: boolean;
			readonly autoFilterHeaderRow: boolean;
			readonly autoSizeColumns: boolean;
		};
		readonly saveAsMarkdown: {
			readonly encoding: string;
			readonly includeHeaders: boolean;
			readonly lineSeparator: string;
		};
		readonly saveAsXml: {
			readonly formatted: boolean;
			readonly encoding: string;
		};
		readonly streaming: boolean;
		readonly copyIncludeHeaders: boolean;
		readonly copyRemoveNewLine: boolean;
		readonly skipNewLineAfterTrailingLineBreak: boolean;
		readonly optimizedTable: boolean;
		readonly inMemoryDataProcessingThreshold: number;
		readonly openAfterSave: boolean;
		readonly showActionBar: boolean;
		readonly showCopyCompletedNotification: boolean;
		readonly preferProvidersCopyHandler: boolean;
		readonly promptForLargeRowSelection: boolean;
	},
	readonly messages: {
		readonly showBatchTime: boolean;
		readonly wordwrap: boolean;
	};
	readonly chart: {
		readonly defaultChartType: 'bar' | 'doughnut' | 'horizontalBar' | 'line' | 'pie' | 'scatter' | 'timeSeries',
	};
	readonly tabColorMode: 'off' | 'border' | 'fill';
	readonly showConnectionInfoInTitle: boolean;
	readonly promptToSaveGeneratedFiles: boolean;
	readonly githubCopilotContextualizationEnabled: boolean;
}

export interface IResultGridConfiguration {
	fontFamily: string;
	fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
	fontSize: number;
	letterSpacing: number;
	rowHeight: number;
	cellPadding: number | number[];
	autoSizeColumns: boolean;
	maxColumnWidth: number;
	showJsonAsLink: boolean;
}
