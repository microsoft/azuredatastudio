/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';
import data = require('data');
import { TPromise } from 'vs/base/common/winjs.base';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export const SERVICE_ID = 'queryManagementService';

export const IQueryManagementService = createDecorator<IQueryManagementService>(SERVICE_ID);

export interface IQueryManagementService {
	_serviceBrand: any;

	addQueryRequestHandler(queryType: string, runner: IQueryRequestHandler): IDisposable;
	registerRunner(runner: QueryRunner, uri: string): void;

	cancelQuery(ownerUri: string): Thenable<data.QueryCancelResult>;
	runQuery(ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void>;
	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void>;
	runQueryString(ownerUri: string, queryString: string): Thenable<void>;
	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult>;
	getQueryRows(rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult>;
	disposeQuery(ownerUri: string): Thenable<void>;
	saveResults(requestParams: data.SaveResultsRequestParams): Thenable<data.SaveResultRequestResult>;

	// Callbacks
	onQueryComplete(result: data.QueryExecuteCompleteNotificationResult): void;
	onBatchStart(batchInfo: data.QueryExecuteBatchNotificationParams): void;
	onBatchComplete(batchInfo: data.QueryExecuteBatchNotificationParams): void;
	onResultSetComplete(resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams): void;
	onMessage(message: data.QueryExecuteMessageParams): void;

	// Edit Data Callbacks
	onEditSessionReady(ownerUri: string, success: boolean, message: string): void;

	// Edit Data Functions
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void>;
	disposeEdit(ownerUri: string): Thenable<void>;
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<data.EditUpdateCellResult>;
	commitEdit(ownerUri): Thenable<void>;
	createRow(ownerUri: string): Thenable<data.EditCreateRowResult>;
	deleteRow(ownerUri: string, rowId: number): Thenable<void>;
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult>;
	revertRow(ownerUri: string, rowId: number): Thenable<void>;
	getEditRows(rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult>;
}

/*
 * An object that can handle basic request-response actions related to queries
 */
export interface IQueryRequestHandler {
	cancelQuery(ownerUri: string): Thenable<data.QueryCancelResult>;
	runQuery(ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void>;
	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void>;
	runQueryString(ownerUri: string, queryString: string): Thenable<void>;
	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult>;
	getQueryRows(rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult>;
	disposeQuery(ownerUri: string): Thenable<void>;
	saveResults(requestParams: data.SaveResultsRequestParams): Thenable<data.SaveResultRequestResult>;

	// Edit Data actions
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void>;
	disposeEdit(ownerUri: string): Thenable<void>;
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<data.EditUpdateCellResult>;
	commitEdit(ownerUri): Thenable<void>;
	createRow(ownerUri: string): Thenable<data.EditCreateRowResult>;
	deleteRow(ownerUri: string, rowId: number): Thenable<void>;
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult>;
	revertRow(ownerUri: string, rowId: number): Thenable<void>;
	getEditRows(rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult>;
}

export class QueryManagementService implements IQueryManagementService {
	public static readonly DefaultQueryType = 'MSSQL';
	public _serviceBrand: any;

	private _requestHandlers = new Map<string, IQueryRequestHandler>();
	// public for testing only
	public _queryRunners = new Map<string, QueryRunner>();

	// public for testing only
	public _handlerCallbackQueue: ((run: QueryRunner) => void)[] = [];

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService
	) {
	}

	// Registers queryRunners with their uris to distribute notifications.
	// Ensures that notifications are handled in the correct order by handling
	// enqueued handlers first.
	// public for testing only
	public registerRunner(runner: QueryRunner, uri: string): void {
		// If enqueueOrRun was called before registerRunner for the current query,
		// _handlerCallbackQueue will be non-empty. Run all handlers in the queue first
		// so that notifications are handled in order they arrived
		while (this._handlerCallbackQueue.length > 0) {
			let handler = this._handlerCallbackQueue.shift();
			handler(runner);
		}

		// Set the runner for any other handlers if the runner is in use by the
		// current query or a subsequent query
		if (!runner.hasCompleted) {
			this._queryRunners.set(uri, runner);
		}
	}

	// Handles logic to run the given handlerCallback at the appropriate time. If the given runner is
	// undefined, the handlerCallback is put on the _handlerCallbackQueue to be run once the runner is set
	// public for testing only
	private enqueueOrRun(handlerCallback: (runnerParam: QueryRunner) => void, runner: QueryRunner): void {
		if (runner === undefined) {
			this._handlerCallbackQueue.push(handlerCallback);
		} else {
			handlerCallback(runner);
		}
	}

	private _notify(ownerUri: string, sendNotification: (runner: QueryRunner) => void): void {
		let runner = this._queryRunners.get(ownerUri);
		this.enqueueOrRun(sendNotification, runner);
	}

	public addQueryRequestHandler(queryType: string, handler: IQueryRequestHandler): IDisposable {
		this._requestHandlers.set(queryType, handler);

		return {
			dispose: () => {
			}
		};
	}

	private addTelemetry(eventName: string, ownerUri: string, runOptions?: data.ExecutionPlanOptions): void {
		let providerId: string = this._connectionService.getProviderIdFromUri(ownerUri);
		let data: TelemetryUtils.IConnectionTelemetryData = {
			provider: providerId,
		};
		if (runOptions) {
			data = Object.assign({}, data, {
				displayEstimatedQueryPlan: runOptions.displayEstimatedQueryPlan,
				displayActualQueryPlan: runOptions.displayActualQueryPlan
			});
		}
		TelemetryUtils.addTelemetry(this._telemetryService, eventName, data);
	}

	private _runAction<T>(uri: string, action: (handler: IQueryRequestHandler) => Thenable<T>): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId) {
			return TPromise.wrapError(new Error('Connection is required in order to interact with queries'));
		}
		let handler = this._requestHandlers.get(providerId);
		if (handler) {
			return action(handler);
		} else {
			return TPromise.wrapError(new Error('No Handler Registered'));
		}
	}

	public cancelQuery(ownerUri: string): Thenable<data.QueryCancelResult> {
		this.addTelemetry(TelemetryKeys.CancelQuery, ownerUri);
		return this._runAction(ownerUri, (runner) => {
			return runner.cancelQuery(ownerUri);
		});
	}
	public runQuery(ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void> {
		this.addTelemetry(TelemetryKeys.RunQuery, ownerUri, runOptions);
		return this._runAction(ownerUri, (runner) => {
			return runner.runQuery(ownerUri, selection, runOptions);
		});
	}
	public runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
		this.addTelemetry(TelemetryKeys.RunQueryStatement, ownerUri);
		return this._runAction(ownerUri, (runner) => {
			return runner.runQueryStatement(ownerUri, line, column);
		});
	}
	public runQueryString(ownerUri: string, queryString: string): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.runQueryString(ownerUri, queryString);
		});
	}
	public runQueryAndReturn(ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.runQueryAndReturn(ownerUri, queryString);
		});
	}
	public getQueryRows(rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult> {
		return this._runAction(rowData.ownerUri, (runner) => {
			return runner.getQueryRows(rowData);
		});
	}
	public disposeQuery(ownerUri: string): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.disposeQuery(ownerUri);
		});
	}

	public saveResults(requestParams: data.SaveResultsRequestParams): Thenable<data.SaveResultRequestResult> {
		return this._runAction(requestParams.ownerUri, (runner) => {
			return runner.saveResults(requestParams);
		});
	}

	public onQueryComplete(result: data.QueryExecuteCompleteNotificationResult): void {
		this._notify(result.ownerUri, (runner: QueryRunner) => {
			runner.handleQueryComplete(result);
		});
	}
	public onBatchStart(batchInfo: data.QueryExecuteBatchNotificationParams): void {
		this._notify(batchInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleBatchStart(batchInfo);
		});
	}

	public onBatchComplete(batchInfo: data.QueryExecuteBatchNotificationParams): void {
		this._notify(batchInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleBatchComplete(batchInfo);
		});
	}

	public onResultSetComplete(resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams): void {
		this._notify(resultSetInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleResultSetComplete(resultSetInfo);
		});
	}

	public onMessage(message: data.QueryExecuteMessageParams): void {
		this._notify(message.ownerUri, (runner: QueryRunner) => {
			runner.handleMessage(message);
		});
	}

	// Edit Data Functions
	public initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit);
		});
	}

	public onEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		this._notify(ownerUri, (runner: QueryRunner) => {
			runner.handleEditSessionReady(ownerUri, success, message);
		});
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<data.EditUpdateCellResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.updateCell(ownerUri, rowId, columnId, newValue);
		});
	}

	public commitEdit(ownerUri: string): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.commitEdit(ownerUri);
		});
	}

	public createRow(ownerUri: string): Thenable<data.EditCreateRowResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.createRow(ownerUri);
		});
	}

	public deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.deleteRow(ownerUri, rowId);
		});
	}

	public disposeEdit(ownerUri: string): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.disposeEdit(ownerUri);
		});
	}

	public revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.revertCell(ownerUri, rowId, columnId);
		});
	}

	public revertRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.revertRow(ownerUri, rowId);
		});
	}

	public getEditRows(rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult> {
		return this._runAction(rowData.ownerUri, (runner) => {
			return runner.getEditRows(rowData);
		});
	}
}