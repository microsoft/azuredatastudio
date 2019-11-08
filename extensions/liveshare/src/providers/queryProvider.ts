/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import * as constants from '../constants';
import { SharedService, SharedServiceProxy } from '../liveshare';

export class QueryProvider {
	private _sharedService: SharedService;
	private _sharedServiceProxy: SharedServiceProxy;
	private _onQueryCompleteHandler: (result: azdata.QueryExecuteCompleteNotificationResult) => any;

	public constructor(private _isHost: boolean) { }

	public initialize(isHost: boolean, service: SharedService | SharedServiceProxy) {
		if (this._isHost) {
			this._sharedService = <SharedService>service;
			this.registerProviderListener();
		} else {
			this._sharedServiceProxy = <SharedServiceProxy>service;
			this.registerProvider();
		}
	}

	public registerProviderListener() {
		this._sharedService.onRequest(constants.cancelQueryRequest, (args: any) => {
			return;
		});

		this._sharedService.onRequest(constants.runQueryRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.runQueryStatementRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.runQueryStringRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.runQueryAndReturnRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.parseSyntaxRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.getQueryRowsRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.disposeQueryRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.saveResultsRequest, (args: any) => {
			return true;
		});

		this._sharedService.onRequest(constants.setQueryExecutionOptionsRequest, (args: any) => {
			return true;
		});
	}

	public registerProvider(): vscode.Disposable {
		const self = this;
		let runQuery = (ownerUri: string, querySelection: azdata.ISelectionData, executionPlanOptions?: azdata.ExecutionPlanOptions): Thenable<void> => {
			if (self._onQueryCompleteHandler) {
				self._onQueryCompleteHandler({
					ownerUri: ownerUri,
					batchSummaries: []
				});
			}

			return self._sharedServiceProxy.request(constants.runQueryRequest, [{
				ownerUri: ownerUri,
				querySelection: querySelection,
				executionPlanOptions: executionPlanOptions
			}]);
		};

		let cancelQuery = (ownerUri: string): Thenable<azdata.QueryCancelResult> => {
			return self._sharedServiceProxy.request(constants.cancelQueryRequest, [{
				ownerUri: ownerUri
			}]);
		};

		let runQueryStatement = (ownerUri: string, line: number, column: number): Thenable<void> => {
			return self._sharedServiceProxy.request(constants.runQueryStatementRequest, [{
				ownerUri: ownerUri,
				line: line,
				column: column
			}]);
		};

		let runQueryString = (ownerUri: string, query: string): Thenable<void> => {
			return self._sharedServiceProxy.request(constants.runQueryStringRequest, [{
				ownerUri: ownerUri,
				query: query
			}]);
		};

		let runQueryAndReturn = (ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> => {
			return self._sharedServiceProxy.request(constants.runQueryAndReturnRequest, [{
				ownerUri: ownerUri,
				query: queryString
			}]);
		};

		let parseSyntax = (ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> => {
			return self._sharedServiceProxy.request(constants.parseSyntaxRequest, [{
				ownerUri: ownerUri,
				query: query
			}]);
		};

		let getQueryRows = (rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> => {
			return self._sharedServiceProxy.request(constants.getQueryRowsRequest, [{
				rowData: rowData
			}]);
		};

		let disposeQuery = (ownerUri: string): Thenable<void> => {
			return self._sharedServiceProxy.request(constants.disposeQueryRequest, [{
				ownerUri: ownerUri
			}]);
		};

		let registerOnQueryComplete = (handler: (result: azdata.QueryExecuteCompleteNotificationResult) => any): void => {
			self._onQueryCompleteHandler = handler;
		};

		let registerOnBatchStart = (handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void => {
		};

		let registerOnBatchComplete = (handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void => {
		};

		let registerOnResultSetAvailable = (handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void => {
		};

		let registerOnResultSetUpdated = (handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void => {
		};

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
