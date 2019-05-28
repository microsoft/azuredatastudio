/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryModelService, IQueryEvent } from 'sql/platform/query/common/queryModel';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import * as azdata from 'azdata';
import { QueryEditorInput } from 'sql/workbench/parts/query/common/queryEditorInput';
import { DataService } from 'sql/workbench/parts/grid/services/dataService';
import { Event } from 'vs/base/common/event';
import { QueryInfo } from 'sql/platform/query/common/queryModelService';

export class TestQueryModelService implements IQueryModelService {
	_serviceBrand: any;
	getQueryRunner(uri: string): QueryRunner {
		throw new Error('Method not implemented.');
	}
	getConfig(): Promise<{ [key: string]: any; }> {
		throw new Error('Method not implemented.');
	}
	getShortcuts(): Promise<any> {
		throw new Error('Method not implemented.');
	}
	getQueryRows(uri: string, rowStart: number, numberOfRows: number, batchId: number, resultId: number): Thenable<azdata.ResultSetSubset> {
		throw new Error('Method not implemented.');
	}
	runQuery(uri: string, selection: azdata.ISelectionData, queryInput: QueryEditorInput, runOptions?: azdata.ExecutionPlanOptions): void {
		throw new Error('Method not implemented.');
	}
	runQueryStatement(uri: string, selection: azdata.ISelectionData, queryInput: QueryEditorInput): void {
		throw new Error('Method not implemented.');
	}
	runQueryString(uri: string, selection: string, queryInput: QueryEditorInput) {
		throw new Error('Method not implemented.');
	}
	cancelQuery(input: string | QueryRunner): void {
		throw new Error('Method not implemented.');
	}
	disposeQuery(uri: string): void {
		throw new Error('Method not implemented.');
	}
	isRunningQuery(uri: string): boolean {
		throw new Error('Method not implemented.');
	}
	getDataService(uri: string): DataService {
		throw new Error('Method not implemented.');
	}
	refreshResultsets(uri: string): void {
		throw new Error('Method not implemented.');
	}
	sendGridContentEvent(uri: string, eventName: string): void {
		throw new Error('Method not implemented.');
	}
	resizeResultsets(uri: string): void {
		throw new Error('Method not implemented.');
	}
	onAngularLoaded(uri: string): void {
		throw new Error('Method not implemented.');
	}
	copyResults(uri: string, selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): void {
		throw new Error('Method not implemented.');
	}
	showWarning(uri: string, message: string): void {
		throw new Error('Method not implemented.');
	}
	showError(uri: string, message: string): void {
		throw new Error('Method not implemented.');
	}
	showCommitError(error: string): void {
		throw new Error('Method not implemented.');
	}
	get onRunQueryStart(): Event<string> {
		throw new Error('Method not implemented.');
	}

	get onRunQueryComplete(): Event<string> {
		throw new Error('Method not implemented.');
	}

	get onQueryEvent(): Event<IQueryEvent> {
		throw new Error('Method not implemented.');
	}
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): void {
		throw new Error('Method not implemented.');
	}
	disposeEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		throw new Error('Method not implemented.');
	}
	commitEdit(ownerUri: any): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		throw new Error('Method not implemented.');
	}
	deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		throw new Error('Method not implemented.');
	}
	revertRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	getEditRows(ownerUri: string, rowStart: number, numberOfRows: number): Thenable<azdata.EditSubsetResult> {
		throw new Error('Method not implemented.');
	}
	_getQueryInfo(uri: string): QueryInfo {
		throw new Error('Method not implemented.');
	}
	onEditSessionReady: Event<azdata.EditSessionReadyParams>;
}
