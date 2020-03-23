/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ConnectionProvider } from './connectionProvider';
import * as vscode from 'vscode';

export class QueryProvider implements azdata.QueryProvider {
	public static readonly providerId = 'sqlite';
	public readonly providerId = QueryProvider.providerId;

	private queryComplete?: (result: azdata.QueryExecuteCompleteNotificationResult) => any;
	private onBatchStart?: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any;
	private onBatchComplete?: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any;
	private resultSetAvailable?: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any;
	// private resultSetUpdated?: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any;
	// private onMessage?: (message: azdata.QueryExecuteMessageParams) => any;

	private readonly results: { [key: string]: { [column: string]: string | number | null }[] } = {};

	constructor(private readonly connections: ConnectionProvider) {

	}

	cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult> {
		throw new Error('Method not implemented.');
	}

	async runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions | undefined): Promise<void> {
		if (this.connections.databases[ownerUri]) {
			const content = (await vscode.workspace.openTextDocument(vscode.Uri.parse(ownerUri))).getText();
			this.connections.databases[ownerUri].all(content, (err, rows: { [column: string]: string | number | null }[]) => {
				this.results[ownerUri] = rows;
				this.onBatchStart!({ batchSummary: { id: 0 } as any, ownerUri });
				this.resultSetAvailable!({ ownerUri, resultSetSummary: { id: 0, complete: true, rowCount: rows.length, batchId: 0, columnInfo: Object.keys(rows[0]).map(v => ({ columnName: v })) as any } });
				this.onBatchComplete!({ batchSummary: { id: 0 } as any, ownerUri });
				this.queryComplete!({ ownerUri } as any);
			});
		} else {
			throw new Error('Connection not found');
		}
	}

	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	runQueryString(ownerUri: string, queryString: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> {
		throw new Error('Method not implemented.');
	}

	parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> {
		throw new Error('Method not implemented.');
	}

	async getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Promise<azdata.QueryExecuteSubsetResult> {
		return { resultSubset: { rowCount: rowData.rowsCount, rows: this.results[rowData.ownerUri].map(v => Object.values(v).map(c => ({ displayValue: String(c), isNull: c === null }))) } } as any;
	}

	disposeQuery(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> {
		throw new Error('Method not implemented.');
	}

	setQueryExecutionOptions(ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	registerOnQueryComplete(handler: (result: azdata.QueryExecuteCompleteNotificationResult) => any): void {
		this.queryComplete = handler;
	}

	registerOnBatchStart(handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void {
		this.onBatchStart = handler;
	}

	registerOnBatchComplete(handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void {
		this.onBatchComplete = handler;
	}

	registerOnResultSetAvailable(handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void {
		this.resultSetAvailable = handler;
	}

	registerOnResultSetUpdated(handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void {
		// this.resultSetUpdated = handler;
	}

	registerOnMessage(handler: (message: azdata.QueryExecuteMessageParams) => any): void {
		// this.onMessage = handler;
	}

	commitEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		throw new Error('Method not implemented.');
	}

	deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	disposeEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		throw new Error('Method not implemented.');
	}

	revertRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		throw new Error('Method not implemented.');
	}

	getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> {
		throw new Error('Method not implemented.');
	}

	registerOnEditSessionReady(handler: (ownerUri: string, success: boolean, message: string) => any): void {
		//
	}
}
