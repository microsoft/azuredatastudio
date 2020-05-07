/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IQueryMessage, ResultSetSubset } from 'sql/workbench/services/query/common/query';
import { DataService } from 'sql/workbench/services/query/common/dataService';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import {
	EditUpdateCellResult,
	EditSessionReadyParams,
	EditSubsetResult,
	EditCreateRowResult,
	EditRevertCellResult,
	ExecutionPlanOptions,
	queryeditor
} from 'azdata';
import { QueryInfo } from 'sql/workbench/services/query/common/queryModelService';
import { IRange } from 'vs/editor/common/core/range';

export const SERVICE_ID = 'queryModelService';

export const IQueryModelService = createDecorator<IQueryModelService>(SERVICE_ID);

export interface IQueryPlanInfo {
	providerId: string;
	fileUri: string;
	planXml: string;
}

export interface IQueryInfo {
	range: IRange[];
	messages: IQueryMessage[];
}

export interface IQueryEvent {
	type: queryeditor.QueryEventType;
	uri: string;
	queryInfo: IQueryInfo;
	params?: any;
}

/**
 * Interface for the logic of handling running queries and grid interactions for all URIs.
 */
export interface IQueryModelService {
	_serviceBrand: undefined;

	getQueryRunner(uri: string): QueryRunner | undefined;

	getQueryRows(uri: string, rowStart: number, numberOfRows: number, batchId: number, resultId: number): Promise<ResultSetSubset | undefined>;
	runQuery(uri: string, range: IRange | undefined, runOptions?: ExecutionPlanOptions): void;
	runQueryStatement(uri: string, range: IRange | undefined): void;
	runQueryString(uri: string, selection: string | undefined): void;
	cancelQuery(input: QueryRunner | string): void;
	disposeQuery(uri: string): void;
	isRunningQuery(uri: string): boolean;

	getDataService(uri: string): DataService;
	refreshResultsets(uri: string): void;
	sendGridContentEvent(uri: string, eventName: string): void;
	resizeResultsets(uri: string): void;
	onLoaded(uri: string): void;

	copyResults(uri: string, selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): void;
	showCommitError(error: string): void;

	onRunQueryStart: Event<string>;
	onRunQueryUpdate: Event<string>;
	onRunQueryComplete: Event<string>;
	onQueryEvent: Event<IQueryEvent>;

	// Edit Data Functions
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit?: number, queryString?: string): void;
	disposeEdit(ownerUri: string): Promise<void>;
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Promise<EditUpdateCellResult | undefined>;
	commitEdit(ownerUri: string): Promise<void>;
	createRow(ownerUri: string): Promise<EditCreateRowResult | undefined>;
	deleteRow(ownerUri: string, rowId: number): Promise<void>;
	revertCell(ownerUri: string, rowId: number, columnId: number): Promise<EditRevertCellResult | undefined>;
	revertRow(ownerUri: string, rowId: number): Promise<void>;
	getEditRows(ownerUri: string, rowStart: number, numberOfRows: number): Promise<EditSubsetResult | undefined>;

	_getQueryInfo(uri: string): QueryInfo | undefined;
	// Edit Data Callbacks
	onEditSessionReady: Event<EditSessionReadyParams>;
}
