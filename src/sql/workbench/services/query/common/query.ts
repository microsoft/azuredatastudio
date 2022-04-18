/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IRange } from 'vs/editor/common/core/range';

export interface IColumn {
	columnName: string;
	isXml?: boolean;
	isJson?: boolean;
	columnSize?: number;
	dataTypeName?: string;
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
	hasRowCount?: boolean;
	messageType?: MessageType;
}

export enum MessageType {
	normal,
	queryStart,
	queryEnd
}

export interface IResultMessage {
	batchId?: number;
	isError: boolean;
	time?: string;
	message: string;
	hasRowCount?: boolean;
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

export interface IQueryResultsWriter {
	/**
	 * subscribes the writer to query runner callbacks like onMessage, onResultSet, etc.
	 */
	subscribeToQueryRunner(): void;
	/**
	 * Disposes the query results writer.
	 */
	dispose(): void;
	/**
	 * Clears out any previous query results.
	 */
	clear(): void;
	/**
	 * Setter for the query runner instance the writer will subscribe to.
	 */
	set queryRunner(runner: QueryRunner);
}
