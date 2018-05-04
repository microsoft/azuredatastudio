/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { DataService } from 'sql/parts/grid/services/dataService';
import { ISlickRange } from 'angular2-slickgrid';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import {
	ISelectionData,
	ResultSetSubset,
	EditUpdateCellResult,
	EditSessionReadyParams,
	EditSubsetResult,
	EditCreateRowResult,
	EditRevertCellResult,
	ExecutionPlanOptions
} from 'sqlops';

export const SERVICE_ID = 'queryModelService';

export const IQueryModelService = createDecorator<IQueryModelService>(SERVICE_ID);

/**
 * Interface for the logic of handling running queries and grid interactions for all URIs.
 */
export interface IQueryModelService {
	_serviceBrand: any;

	getConfig(): Promise<{ [key: string]: any }>;
	getShortcuts(): Promise<any>;
	getQueryRows(uri: string, rowStart: number, numberOfRows: number, batchId: number, resultId: number): Thenable<ResultSetSubset>;
	runQuery(uri: string, selection: ISelectionData, title: string, queryInput: QueryInput, runOptions?: ExecutionPlanOptions): void;
	runQueryStatement(uri: string, selection: ISelectionData, title: string, queryInput: QueryInput): void;
	runQueryString(uri: string, selection: string, title: string, queryInput: QueryInput);
	cancelQuery(input: QueryRunner | string): void;
	disposeQuery(uri: string): void;
	isRunningQuery(uri: string): boolean;

	getDataService(uri: string): DataService;
	refreshResultsets(uri: string): void;
	sendGridContentEvent(uri: string, eventName: string): void;
	resizeResultsets(uri: string): void;
	onAngularLoaded(uri: string): void;

	copyResults(uri: string, selection: ISlickRange[], batchId: number, resultId: number, includeHeaders?: boolean): void;
	setEditorSelection(uri: string, index: number): void;
	showWarning(uri: string, message: string): void;
	showError(uri: string, message: string): void;
	showCommitError(error: string): void;

	onRunQueryStart: Event<string>;
	onRunQueryComplete: Event<string>;


	// Edit Data Functions
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): void;
	disposeEdit(ownerUri: string): Thenable<void>;
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<EditUpdateCellResult>;
	commitEdit(ownerUri): Thenable<void>;
	createRow(ownerUri: string): Thenable<EditCreateRowResult>;
	deleteRow(ownerUri: string, rowId: number): Thenable<void>;
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<EditRevertCellResult>;
	revertRow(ownerUri: string, rowId: number): Thenable<void>;
	getEditRows(ownerUri: string, rowStart: number, numberOfRows: number): Thenable<EditSubsetResult>;

	// Edit Data Callbacks
	onEditSessionReady: Event<EditSessionReadyParams>;
}
