/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import QueryRunner from 'sql/platform/query/common/queryRunner';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as azdata from 'azdata';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import * as TelemetryUtils from 'sql/platform/telemetry/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Event, Emitter } from 'vs/base/common/event';
import { keys } from 'vs/base/common/map';
import { ILogService } from 'vs/platform/log/common/log';

export const SERVICE_ID = 'queryManagementService';

export const IQueryManagementService = createDecorator<IQueryManagementService>(SERVICE_ID);

export interface IQueryManagementService {
	_serviceBrand: undefined;

	onHandlerAdded: Event<string>;

	addQueryRequestHandler(queryType: string, runner: IQueryRequestHandler): IDisposable;
	isProviderRegistered(providerId: string): boolean;
	getRegisteredProviders(): string[];
	registerRunner(runner: QueryRunner, uri: string): void;

	cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult>;
	runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void>;
	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void>;
	runQueryString(ownerUri: string, queryString: string): Thenable<void>;
	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult>;
	parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult>;
	getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult>;
	disposeQuery(ownerUri: string): Thenable<void>;
	saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult>;
	setQueryExecutionOptions(uri: string, options: azdata.QueryExecutionOptions): Thenable<void>;

	// Callbacks
	onQueryComplete(result: azdata.QueryExecuteCompleteNotificationResult): void;
	onBatchStart(batchInfo: azdata.QueryExecuteBatchNotificationParams): void;
	onBatchComplete(batchInfo: azdata.QueryExecuteBatchNotificationParams): void;
	onResultSetAvailable(resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void;
	onResultSetUpdated(resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void;
	onMessage(message: azdata.QueryExecuteMessageParams): void;

	// Edit Data Callbacks
	onEditSessionReady(ownerUri: string, success: boolean, message: string): void;

	// Edit Data Functions
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void>;
	disposeEdit(ownerUri: string): Thenable<void>;
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult>;
	commitEdit(ownerUri): Thenable<void>;
	createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult>;
	deleteRow(ownerUri: string, rowId: number): Thenable<void>;
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult>;
	revertRow(ownerUri: string, rowId: number): Thenable<void>;
	getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult>;
}

/*
 * An object that can handle basic request-response actions related to queries
 */
export interface IQueryRequestHandler {
	cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult>;
	runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void>;
	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void>;
	runQueryString(ownerUri: string, queryString: string): Thenable<void>;
	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult>;
	parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult>;
	getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult>;
	disposeQuery(ownerUri: string): Thenable<void>;
	saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult>;
	setQueryExecutionOptions(ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void>;

	// Edit Data actions
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void>;
	disposeEdit(ownerUri: string): Thenable<void>;
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult>;
	commitEdit(ownerUri): Thenable<void>;
	createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult>;
	deleteRow(ownerUri: string, rowId: number): Thenable<void>;
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult>;
	revertRow(ownerUri: string, rowId: number): Thenable<void>;
	getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult>;
}

export class QueryManagementService implements IQueryManagementService {
	public _serviceBrand: undefined;

	private _requestHandlers = new Map<string, IQueryRequestHandler>();
	private _onHandlerAddedEmitter = new Emitter<string>();
	// public for testing only
	public _queryRunners = new Map<string, QueryRunner>();

	// public for testing only
	public _handlerCallbackQueue: ((run: QueryRunner) => void)[] = [];

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ITelemetryService private _telemetryService: ITelemetryService,
		@ILogService private logService: ILogService
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
		this._onHandlerAddedEmitter.fire(queryType);

		return {
			dispose: () => {
			}
		};
	}

	public get onHandlerAdded(): Event<string> {
		return this._onHandlerAddedEmitter.event;
	}

	public isProviderRegistered(providerId: string): boolean {
		let handler = this._requestHandlers.get(providerId);
		return !!handler;
	}

	public getRegisteredProviders(): string[] {
		return Array.from(keys(this._requestHandlers));
	}

	private addTelemetry(eventName: string, ownerUri: string, runOptions?: azdata.ExecutionPlanOptions): void {
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
		TelemetryUtils.addTelemetry(this._telemetryService, this.logService, eventName, data);
	}

	private _runAction<T>(uri: string, action: (handler: IQueryRequestHandler) => Thenable<T>, fallBackToDefaultProvider: boolean = false): Thenable<T> {
		let providerId: string = this._connectionService.getProviderIdFromUri(uri);

		if (!providerId && fallBackToDefaultProvider) {
			providerId = this._connectionService.getDefaultProviderId();
		}

		if (!providerId) {
			return Promise.reject(new Error('Connection is required in order to interact with queries'));
		}
		let handler = this._requestHandlers.get(providerId);
		if (handler) {
			return action(handler);
		} else {
			return Promise.reject(new Error('No Handler Registered'));
		}
	}

	public cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult> {
		this.addTelemetry(TelemetryKeys.CancelQuery, ownerUri);
		return this._runAction(ownerUri, (runner) => {
			return runner.cancelQuery(ownerUri);
		});
	}
	public runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
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
		this.addTelemetry(TelemetryKeys.RunQueryString, ownerUri);
		return this._runAction(ownerUri, (runner) => {
			return runner.runQueryString(ownerUri, queryString);
		});
	}
	public runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.runQueryAndReturn(ownerUri, queryString);
		});
	}
	public parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.parseSyntax(ownerUri, query);
		});
	}
	public getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> {
		return this._runAction(rowData.ownerUri, (runner) => {
			return runner.getQueryRows(rowData);
		});
	}
	public disposeQuery(ownerUri: string): Thenable<void> {
		this._queryRunners.delete(ownerUri);
		return this._runAction(ownerUri, (runner) => {
			return runner.disposeQuery(ownerUri);
		});
	}
	public setQueryExecutionOptions(ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.setQueryExecutionOptions(ownerUri, options);
		}, true);
	}

	public saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> {
		return this._runAction(requestParams.ownerUri, (runner) => {
			return runner.saveResults(requestParams);
		});
	}

	public onQueryComplete(result: azdata.QueryExecuteCompleteNotificationResult): void {
		this._notify(result.ownerUri, (runner: QueryRunner) => {
			runner.handleQueryComplete(result);
		});
	}
	public onBatchStart(batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		this._notify(batchInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleBatchStart(batchInfo);
		});
	}

	public onBatchComplete(batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		this._notify(batchInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleBatchComplete(batchInfo);
		});
	}

	public onResultSetAvailable(resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		this._notify(resultSetInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleResultSetAvailable(resultSetInfo);
		});
	}

	public onResultSetUpdated(resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		this._notify(resultSetInfo.ownerUri, (runner: QueryRunner) => {
			runner.handleResultSetUpdated(resultSetInfo);
		});
	}

	public onMessage(message: azdata.QueryExecuteMessageParams): void {
		this._notify(message.ownerUri, (runner: QueryRunner) => {
			runner.handleMessage(message);
		});
	}

	// Edit Data Functions
	public initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
		});
	}

	public onEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		this._notify(ownerUri, (runner: QueryRunner) => {
			runner.handleEditSessionReady(ownerUri, success, message);
		});
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.updateCell(ownerUri, rowId, columnId, newValue);
		});
	}

	public commitEdit(ownerUri: string): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.commitEdit(ownerUri);
		});
	}

	public createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
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

	public revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		return this._runAction(ownerUri, (runner) => {
			return runner.revertCell(ownerUri, rowId, columnId);
		});
	}

	public revertRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._runAction(ownerUri, (runner) => {
			return runner.revertRow(ownerUri, rowId);
		});
	}

	public getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> {
		return this._runAction(rowData.ownerUri, (runner) => {
			return runner.getEditRows(rowData);
		});
	}
}
