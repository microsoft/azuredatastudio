/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRange } from 'vs/editor/common/core/range';

export interface IColumn {
	columnName: string;
	isXml?: boolean;
	isJson?: boolean;
}

export interface ResultSetSummary {
	id: number;
	batchId: number;
	rowCount: number;
	columnInfo: IColumn[];
	complete: boolean;
}

export interface BatchStartSummary {
	id: number;
	executionStart: string;
	range?: IRange;
}

export interface BatchSummary extends BatchStartSummary {
	hasError: boolean;
	resultSetSummaries: ResultSetSummary[];
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
}
