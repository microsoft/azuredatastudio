/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import * as constants from '../constants';

export class QueryFeature {
	public registerProvider(): vscode.Disposable {

		let runQuery = (ownerUri: string, querySelection: azdata.ISelectionData, executionPlanOptions?: azdata.ExecutionPlanOptions): Thenable<void> => {
			return Promise.resolve(undefined);
		};

		let cancelQuery = (ownerUri: string): Thenable<azdata.QueryCancelResult> => {
			return Promise.resolve(undefined);
		};

		let runQueryStatement = (ownerUri: string, line: number, column: number): Thenable<void> => {
			return Promise.resolve();
		};

		let runQueryString = (ownerUri: string, query: string): Thenable<void> => {
			return Promise.resolve();
		};

		let runQueryAndReturn = (ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> => {
			return Promise.resolve(undefined);
		};

		let parseSyntax = (ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> => {
			return Promise.resolve(undefined);
		}

		let getQueryRows = (rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> => {
			return Promise.resolve(undefined);
		};

		let disposeQuery = (ownerUri: string): Thenable<void> => {
			return Promise.resolve();
		};

		let registerOnQueryComplete = (handler: (result: azdata.QueryExecuteCompleteNotificationResult) => any): void => {
		};

		let registerOnBatchStart = (handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void => {
		};

		let registerOnBatchComplete = (handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void => {
		};

		let registerOnResultSetAvailable = (handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void => {
		};

		let registerOnResultSetUpdated = (handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void => {
		}

		let registerOnMessage = (handler: (message: azdata.QueryExecuteMessageParams) => any): void => {
		};

		let saveResults = (requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> => {
			return Promise.resolve(undefined);
		};

		let setQueryExecutionOptions = (ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> => {
			return Promise.resolve();
		};

		// Edit Data Requests
		let commitEdit = (ownerUri: string): Thenable<void> => {
			return Promise.resolve();
		};

		let createRow = (ownerUri: string): Thenable<azdata.EditCreateRowResult> => {
			return Promise.resolve(undefined);
		};

		let deleteRow = (ownerUri: string, rowId: number): Thenable<void> => {
			return Promise.resolve();
		};

		let disposeEdit = (ownerUri: string): Thenable<void> => {
			return Promise.resolve();
		};

		let initializeEdit = (ownerUri: string, schemaName: string, objectName: string, objectType: string, LimitResults: number, queryString: string): Thenable<void> => {
			return Promise.resolve();
		};

		let revertCell = (ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> => {
			return Promise.resolve(undefined);
		};

		let revertRow = (ownerUri: string, rowId: number): Thenable<void> => {
			return Promise.resolve();
		};

		let updateCell = (ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> => {
			return Promise.resolve(undefined);
		};

		let getEditRows = (rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> => {
			return Promise.resolve(undefined);
		};

		// Edit Data Event Handlers
		let registerOnEditSessionReady = (handler: (ownerUri: string, success: boolean, message: string) => any): void => {
		};

		return azdata.dataprotocol.registerQueryProvider({
			providerId: constants.LiveShareProviderId,
			cancelQuery,
			commitEdit,
			createRow,
			deleteRow,
			disposeEdit,
			disposeQuery,
			getEditRows,
			getQueryRows,
			setQueryExecutionOptions,
			initializeEdit,
			registerOnBatchComplete,
			registerOnBatchStart,
			registerOnEditSessionReady,
			registerOnMessage,
			registerOnQueryComplete,
			registerOnResultSetAvailable,
			registerOnResultSetUpdated,
			revertCell,
			revertRow,
			runQuery,
			runQueryAndReturn,
			parseSyntax,
			runQueryStatement,
			runQueryString,
			saveResults,
			updateCell
		}, true);
	}
}