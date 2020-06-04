/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryManagementService, IQueryRequestHandler, ExecutionPlanOptions } from 'sql/workbench/services/query/common/queryManagement';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import * as azdata from 'azdata';
import { IRange } from 'vs/editor/common/core/range';
import { ResultSetSubset } from 'sql/workbench/services/query/common/query';

export class TestQueryManagementService implements IQueryManagementService {
	_serviceBrand: undefined;
	onHandlerAdded: Event<string>;
	addQueryRequestHandler(queryType: string, runner: IQueryRequestHandler): IDisposable {
		throw new Error('Method not implemented.');
	}
	isProviderRegistered(providerId: string): boolean {
		throw new Error('Method not implemented.');
	}
	getRegisteredProviders(): string[] {
		throw new Error('Method not implemented.');
	}
	registerRunner(runner: QueryRunner, uri: string): void {
		return;
	}
	async cancelQuery(ownerUri: string): Promise<azdata.QueryCancelResult> {
		return { messages: undefined };
	}
	async runQuery(ownerUri: string, range: IRange, runOptions?: ExecutionPlanOptions): Promise<void> {
		return;
	}
	runQueryStatement(ownerUri: string, line: number, column: number): Promise<void> {
		throw new Error('Method not implemented.');
	}
	runQueryString(ownerUri: string, queryString: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	runQueryAndReturn(ownerUri: string, queryString: string): Promise<azdata.SimpleExecuteResult> {
		throw new Error('Method not implemented.');
	}
	parseSyntax(ownerUri: string, query: string): Promise<azdata.SyntaxParseResult> {
		throw new Error('Method not implemented.');
	}
	getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Promise<ResultSetSubset> {
		throw new Error('Method not implemented.');
	}
	async disposeQuery(ownerUri: string): Promise<void> {
		return;
	}
	saveResults(requestParams: azdata.SaveResultsRequestParams): Promise<azdata.SaveResultRequestResult> {
		throw new Error('Method not implemented.');
	}
	setQueryExecutionOptions(uri: string, options: azdata.QueryExecutionOptions): Promise<void> {
		throw new Error('Method not implemented.');
	}
	onQueryComplete(result: azdata.QueryExecuteCompleteNotificationResult): void {
		throw new Error('Method not implemented.');
	}
	onBatchStart(batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		throw new Error('Method not implemented.');
	}
	onBatchComplete(batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		throw new Error('Method not implemented.');
	}
	onResultSetAvailable(resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		throw new Error('Method not implemented.');
	}
	onResultSetUpdated(resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		throw new Error('Method not implemented.');
	}
	onMessage(message: Map<string, azdata.QueryExecuteMessageParams[]>): void {
		throw new Error('Method not implemented.');
	}
	onEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		throw new Error('Method not implemented.');
	}
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	disposeEdit(ownerUri: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Promise<azdata.EditUpdateCellResult> {
		throw new Error('Method not implemented.');
	}
	commitEdit(ownerUri: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	createRow(ownerUri: string): Promise<azdata.EditCreateRowResult> {
		throw new Error('Method not implemented.');
	}
	deleteRow(ownerUri: string, rowId: number): Promise<void> {
		throw new Error('Method not implemented.');
	}
	revertCell(ownerUri: string, rowId: number, columnId: number): Promise<azdata.EditRevertCellResult> {
		throw new Error('Method not implemented.');
	}
	revertRow(ownerUri: string, rowId: number): Promise<void> {
		throw new Error('Method not implemented.');
	}
	getEditRows(rowData: azdata.EditSubsetParams): Promise<azdata.EditSubsetResult> {
		throw new Error('Method not implemented.');
	}

}
