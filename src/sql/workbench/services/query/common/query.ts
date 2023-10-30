/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRange } from 'vs/editor/common/core/range';

export interface IColumn {
	columnName: string;
	isXml?: boolean;
	isJson?: boolean;
}

export type VisualizationType = 'bar' | 'count' | 'doughnut' | 'horizontalBar' | 'image' | 'line' | 'pie' | 'scatter' | 'table' | 'timeSeries';

export interface VisualizationOptions {
	type: VisualizationType
}

export interface ResultSetSummary {
	id: number;
	batchId: number;
	rowCount: number;
	columnInfo: IColumn[];
	complete: boolean;
	visualization?: VisualizationOptions;
}

export interface BatchStartSummary {
	id: number;
	executionStart: string;
	range?: IRange;
}

export interface BatchSummary extends BatchStartSummary {
	hasError: boolean;
	resultSetSummaries: ResultSetSummary[] | null;
}

export interface CompleteBatchSummary extends BatchSummary {
	executionElapsed: string;
	executionEnd: string;
}

export interface IQueryMessage {
	batchId?: number;
	isError: boolean;
	time?: string;
	message: string;
	range?: IRange;
}

export interface IResultMessage {
	batchId?: number;
	isError: boolean;
	time?: string;
	message: string;
}

export interface QueryExecuteSubsetParams {
	ownerUri: string;
	batchIndex: number;
	resultSetIndex: number;
	rowsStartIndex: number;
	rowsCount: number;
}

export interface ResultSetSubset {
	rowCount: number;
	rows: ICellValue[][];
}

export interface ICellValue {
	displayValue: string;
	isNull?: boolean;
	invariantCultureDisplayValue?: string;
}
