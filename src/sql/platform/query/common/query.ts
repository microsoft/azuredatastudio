/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IQueryEditorConfiguration {
	readonly results: {
		readonly saveAsCsv: {
			readonly includeHeaders: boolean,
			readonly delimiter: string,
			readonly lineSeperator: string,
			readonly textIdentifier: string,
			readonly encoding: string
		},
		readonly saveAsXml: {
			readonly formatted: boolean,
			readonly encoding: string
		},
		readonly streaming: boolean,
		readonly copyIncludeHeaders: boolean,
		readonly copyRemoveNewLine: boolean
	},
	readonly messages: {
		readonly showBatchTime: boolean,
		readonly wordwrap: boolean
	},
	readonly chart: {
		readonly defaultChartType: 'bar' | 'doughnut' | 'horizontalBar' | 'line' | 'pie' | 'scatter' | 'timeSeries',
	},
	readonly tabColorMode: 'off' | 'border' | 'fill',
	readonly showConnectionInfoInTitle: boolean;
	readonly promptToSaveGeneratedFiles: boolean;
}
