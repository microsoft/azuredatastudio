/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';

import * as Constants from 'sql/parts/query/common/constants';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import * as Utils from 'sql/platform/connection/common/utils';
import { SaveFormat } from 'sql/parts/grid/common/interfaces';
import { Deferred } from 'sql/base/common/promise';

import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import * as types from 'vs/base/common/types';
import { EventEmitter } from 'sql/base/common/eventEmitter';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Emitter, Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ResultSerializer } from 'sql/platform/node/resultSerializer';
import { TPromise } from 'vs/base/common/winjs.base';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';
import { URI } from 'vs/base/common/uri';

export interface IEditSessionReadyEvent {
	ownerUri: string;
	success: boolean;
	message: string;
}

export const enum EventType {
	START = 'start',
	COMPLETE = 'complete',
	MESSAGE = 'message',
	BATCH_START = 'batchStart',
	BATCH_COMPLETE = 'batchComplete',
	RESULT_SET = 'resultSet',
	EDIT_SESSION_READY = 'editSessionReady'
}

export interface IEventType {
	start: void;
	complete: string;
	message: sqlops.IResultMessage;
	batchStart: sqlops.BatchSummary;
	batchComplete: sqlops.BatchSummary;
	resultSet: sqlops.ResultSetSummary;
	editSessionReady: IEditSessionReadyEvent;
}

export interface IGridMessage extends sqlops.IResultMessage {
	selection: sqlops.ISelectionData;
}

/*
* Query Runner class which handles running a query, reports the results to the content manager,
* and handles getting more rows from the service layer and disposing when the content is closed.
*/
export default class QueryRunner extends Disposable {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _resultLineOffset: number;
	private _totalElapsedMilliseconds: number = 0;
	private _isExecuting: boolean = false;
	private _hasCompleted: boolean = false;
	private _batchSets: sqlops.BatchSummary[] = [];
	private _messages: sqlops.IResultMessage[] = [];
	private _eventEmitter = new EventEmitter();

	private _isQueryPlan: boolean;
	public get isQueryPlan(): boolean { return this._isQueryPlan; }
	private _planXml = new Deferred<string>();
	public get planXml(): Thenable<string> { return this._planXml.promise; }

	private _onMessage = this._register(new Emitter<sqlops.IResultMessage>());
	public readonly onMessage = this._onMessage.event;

	private _onResultSet = this._register(new Emitter<sqlops.ResultSetSummary>());
	public readonly onResultSet = this._onResultSet.event;

	private _onResultSetUpdate = this._register(new Emitter<sqlops.ResultSetSummary>());
	public readonly onResultSetUpdate = this._onResultSetUpdate.event;

	private _onQueryStart = this._register(new Emitter<void>());
	public readonly onQueryStart: Event<void> = this._onQueryStart.event;

	private _onQueryEnd = this._register(new Emitter<string>());
	public readonly onQueryEnd: Event<string> = this._onQueryEnd.event;

	private _onBatchStart = this._register(new Emitter<sqlops.BatchSummary>());
	public readonly onBatchStart: Event<sqlops.BatchSummary> = this._onBatchStart.event;

	private _onBatchEnd = this._register(new Emitter<sqlops.BatchSummary>());
	public readonly onBatchEnd: Event<sqlops.BatchSummary> = this._onBatchEnd.event;

	private _queryStartTime: Date;
	public get queryStartTime(): Date {
		return this._queryStartTime;
	}
	private _queryEndTime: Date;
	public get queryEndTime(): Date {
		return this._queryEndTime;
	}

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		public uri: string,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@INotificationService private _notificationService: INotificationService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@ITextResourcePropertiesService private _textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super();
	}

	get isExecuting(): boolean {
		return this._isExecuting;
	}

	get hasCompleted(): boolean {
		return this._hasCompleted;
	}

	/**
	 * For public use only, for private use, directly access the member
	 */
	public get batchSets(): sqlops.BatchSummary[] {
		return this._batchSets.slice(0);
	}

	/**
	 * For public use only, for private use, directly access the member
	 */
	public get messages(): sqlops.IResultMessage[] {
		return this._messages.slice(0);
	}

	// PUBLIC METHODS ======================================================

	public addListener<K extends keyof IEventType>(event: K, f: (e: IEventType[K]) => void): IDisposable {
		return this._eventEmitter.addListener(event, f);
	}

	/**
	 * Cancels the running query, if there is one
	 */
	public cancelQuery(): Thenable<sqlops.QueryCancelResult> {
		return this._queryManagementService.cancelQuery(this.uri);
	}

	/**
	 * Runs the query with the provided query
	 * @param input Query string to execute
	 */
	public runQuery(input: string, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void>;
	/**
	 * Runs the query by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQuery(input: sqlops.ISelectionData, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void>;
	public runQuery(input, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void> {
		return this.doRunQuery(input, false, runOptions);
	}

	/**
	 * Runs the current SQL statement by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQueryStatement(input: sqlops.ISelectionData): Thenable<void> {
		return this.doRunQuery(input, true);
	}

	/**
	 * Implementation that runs the query with the provided query
	 * @param input Query string to execute
	 */
	private doRunQuery(input: string, runCurrentStatement: boolean, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void>;
	private doRunQuery(input: sqlops.ISelectionData, runCurrentStatement: boolean, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void>;
	private doRunQuery(input, runCurrentStatement: boolean, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void> {
		if (this.isExecuting) {
			return TPromise.as(undefined);
		}
		this._planXml = new Deferred<string>();
		this._batchSets = [];
		this._hasCompleted = false;
		this._queryStartTime = undefined;
		this._queryEndTime = undefined;
		this._messages = [];
		if (types.isObject(input) || types.isUndefinedOrNull(input)) {
			// Update internal state to show that we're executing the query
			this._resultLineOffset = input ? input.startLine : 0;
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;
			// TODO issue #228 add statusview callbacks here

			if (runOptions && (runOptions.displayActualQueryPlan || runOptions.displayEstimatedQueryPlan)) {
				this._isQueryPlan = true;
			} else {
				this._isQueryPlan = false;
			}

			// Send the request to execute the query
			return runCurrentStatement
				? this._queryManagementService.runQueryStatement(this.uri, input.startLine, input.startColumn).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e))
				: this._queryManagementService.runQuery(this.uri, input, runOptions).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e));
		} else if (types.isString(input)) {
			// Update internal state to show that we're executing the query
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;

			return this._queryManagementService.runQueryString(this.uri, input).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e));
		} else {
			return Promise.reject('Unknown input');
		}
	}

	private handleSuccessRunQueryResult() {
		// this isn't exact, but its the best we can do
		this._queryStartTime = new Date();
		// The query has started, so lets fire up the result pane
		this._onQueryStart.fire();
		this._eventEmitter.emit(EventType.START);
		this._queryManagementService.registerRunner(this, this.uri);
	}

	private handleFailureRunQueryResult(error: any) {
		// Attempting to launch the query failed, show the error message
		const eol = this.getEolString();
		let message = nls.localize('query.ExecutionFailedError', 'Execution failed due to an unexpected error: {0}\t{1}', eol, error);
		this.handleMessage(<sqlops.QueryExecuteMessageParams>{
			ownerUri: this.uri,
			message: {
				isError: true,
				message: message
			}
		});
		this.handleQueryComplete(<sqlops.QueryExecuteCompleteNotificationResult>{ ownerUri: this.uri });
	}

	/**
	 * Handle a QueryComplete from the service layer
	 */
	public handleQueryComplete(result: sqlops.QueryExecuteCompleteNotificationResult): void {
		// this also isn't exact but its the best we can do
		this._queryEndTime = new Date();

		// Store the batch sets we got back as a source of "truth"
		this._isExecuting = false;
		this._hasCompleted = true;
		this._batchSets = result.batchSummaries ? result.batchSummaries : [];

		this._batchSets.map(batch => {
			if (batch.selection) {
				batch.selection.startLine = batch.selection.startLine + this._resultLineOffset;
				batch.selection.endLine = batch.selection.endLine + this._resultLineOffset;
			}
		});

		let timeStamp = Utils.parseNumAsTimeString(this._totalElapsedMilliseconds);

		this._eventEmitter.emit(EventType.COMPLETE, timeStamp);
		// We're done with this query so shut down any waiting mechanisms

		let message = {
			message: nls.localize('query.message.executionTime', 'Total execution time: {0}', timeStamp),
			isError: false,
			time: undefined
		};
		this._messages.push(message);

		this._onQueryEnd.fire(timeStamp);
		this._onMessage.fire(message);
	}

	/**
	 * Handle a BatchStart from the service layer
	 */
	public handleBatchStart(result: sqlops.QueryExecuteBatchNotificationParams): void {
		let batch = result.batchSummary;

		// Recalculate the start and end lines, relative to the result line offset
		if (batch.selection) {
			batch.selection.startLine += this._resultLineOffset;
			batch.selection.endLine += this._resultLineOffset;
		}

		// Set the result sets as an empty array so that as result sets complete we can add to the list
		batch.resultSetSummaries = [];

		// Store the batch
		this._batchSets[batch.id] = batch;

		let message = {
			// account for index by 1
			message: nls.localize('query.message.startQuery', 'Started executing query at Line {0}', batch.selection.startLine + 1),
			time: new Date(batch.executionStart).toLocaleTimeString(),
			selection: batch.selection,
			isError: false
		};
		this._messages.push(message);
		this._eventEmitter.emit(EventType.BATCH_START, batch);
		this._onMessage.fire(message);
		this._onBatchStart.fire(batch);
	}

	/**
	 * Handle a BatchComplete from the service layer
	 */
	public handleBatchComplete(result: sqlops.QueryExecuteBatchNotificationParams): void {
		let batch: sqlops.BatchSummary = result.batchSummary;

		// Store the batch again to get the rest of the data
		this._batchSets[batch.id] = batch;
		let executionTime = <number>(Utils.parseTimeString(batch.executionElapsed) || 0);
		this._totalElapsedMilliseconds += executionTime;
		if (executionTime > 0) {
			// send a time message in the format used for query complete
			this.sendBatchTimeMessage(batch.id, Utils.parseNumAsTimeString(executionTime));
		}

		this._eventEmitter.emit(EventType.BATCH_COMPLETE, batch);
		this._onBatchEnd.fire(batch);
	}

	/**
	 * Handle a ResultSetComplete from the service layer
	 */
	public handleResultSetAvailable(result: sqlops.QueryExecuteResultSetNotificationParams): void {
		if (result && result.resultSetSummary) {
			let resultSet = result.resultSetSummary;
			let batchSet: sqlops.BatchSummary;
			if (!resultSet.batchId) {
				// Missing the batchId. In this case, default to always using the first batch in the list
				// or create one in the case the DMP extension didn't obey the contract perfectly
				if (this._batchSets.length > 0) {
					batchSet = this._batchSets[0];
				} else {
					batchSet = <sqlops.BatchSummary>{
						id: 0,
						selection: undefined,
						hasError: false,
						resultSetSummaries: []
					};
					this._batchSets[0] = batchSet;
				}
			} else {
				batchSet = this._batchSets[resultSet.batchId];
			}
			// handle getting queryPlanxml if we need too
			if (this.isQueryPlan) {
				// check if this result has show plan, this needs work, it won't work for any other provider
				let hasShowPlan = !!result.resultSetSummary.columnInfo.find(e => e.columnName === 'Microsoft SQL Server 2005 XML Showplan');
				if (hasShowPlan) {
					this.getQueryRows(0, 1, result.resultSetSummary.batchId, result.resultSetSummary.id).then(e => this._planXml.resolve(e.resultSubset.rows[0][0].displayValue));
				}
			}
			// we will just ignore the set if we already have it
			// ideally this should never happen
			if (batchSet && !batchSet.resultSetSummaries[resultSet.id]) {
				// Store the result set in the batch and emit that a result set has completed
				batchSet.resultSetSummaries[resultSet.id] = resultSet;
				this._eventEmitter.emit(EventType.RESULT_SET, resultSet);
				this._onResultSet.fire(resultSet);
			}
		}
	}

	public handleResultSetUpdated(result: sqlops.QueryExecuteResultSetNotificationParams): void {
		if (result && result.resultSetSummary) {
			let resultSet = result.resultSetSummary;
			let batchSet: sqlops.BatchSummary;
			batchSet = this._batchSets[resultSet.batchId];
			// handle getting queryPlanxml if we need too
			if (this.isQueryPlan) {
				// check if this result has show plan, this needs work, it won't work for any other provider
				let hasShowPlan = !!result.resultSetSummary.columnInfo.find(e => e.columnName === 'Microsoft SQL Server 2005 XML Showplan');
				if (hasShowPlan) {
					this.getQueryRows(0, 1, result.resultSetSummary.batchId, result.resultSetSummary.id).then(e => this._planXml.resolve(e.resultSubset.rows[0][0].displayValue));
				}
			}
			if (batchSet) {
				// Store the result set in the batch and emit that a result set has completed
				batchSet.resultSetSummaries[resultSet.id] = resultSet;
				this._onResultSetUpdate.fire(resultSet);
			}
		}
	}

	/**
	 * Handle a Mssage from the service layer
	 */
	public handleMessage(obj: sqlops.QueryExecuteMessageParams): void {
		let message = obj.message;
		message.time = new Date(message.time).toLocaleTimeString();
		this._messages.push(message);

		// Send the message to the results pane
		this._eventEmitter.emit(EventType.MESSAGE, message);
		this._onMessage.fire(message);
	}

	/**
	 * Get more data rows from the current resultSets from the service layer
	 */
	public getQueryRows(rowStart: number, numberOfRows: number, batchIndex: number, resultSetIndex: number): Thenable<sqlops.QueryExecuteSubsetResult> {
		let rowData: sqlops.QueryExecuteSubsetParams = <sqlops.QueryExecuteSubsetParams>{
			ownerUri: this.uri,
			resultSetIndex: resultSetIndex,
			rowsCount: numberOfRows,
			rowsStartIndex: rowStart,
			batchIndex: batchIndex
		};

		return this._queryManagementService.getQueryRows(rowData).then(r => r, error => {
			// this._notificationService.notify({
			// 	severity: Severity.Error,
			// 	message: nls.localize('query.gettingRowsFailedError', 'Something went wrong getting more rows: {0}', error)
			// });
			return error;
		});
	}

	/*
	 * Handle a session ready event for Edit Data
	 */
	public initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		// Update internal state to show that we're executing the query
		this._isExecuting = true;
		this._totalElapsedMilliseconds = 0;
		// TODO issue #228 add statusview callbacks here

		return this._queryManagementService.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit, queryString).then(result => {
			// The query has started, so lets fire up the result pane
			this._eventEmitter.emit(EventType.START);
			this._queryManagementService.registerRunner(this, ownerUri);
		}, error => {
			// Attempting to launch the query failed, show the error message

			// TODO issue #228 add statusview callbacks here
			this._isExecuting = false;
			this._notificationService.notify({
				severity: Severity.Error,
				message: nls.localize('query.initEditExecutionFailed', 'Init Edit Execution failed: ') + error
			});
		});
	}

	/**
	 * Retrieves a number of rows from an edit session
	 * @param rowStart     The index of the row to start returning (inclusive)
	 * @param numberOfRows The number of rows to return
	 */
	public getEditRows(rowStart: number, numberOfRows: number): Thenable<sqlops.EditSubsetResult> {
		const self = this;
		let rowData: sqlops.EditSubsetParams = {
			ownerUri: this.uri,
			rowCount: numberOfRows,
			rowStartIndex: rowStart
		};

		return new Promise<sqlops.EditSubsetResult>((resolve, reject) => {
			self._queryManagementService.getEditRows(rowData).then(result => {
				if (!result.hasOwnProperty('rowCount')) {
					let error = `Nothing returned from subset query`;
					self._notificationService.notify({
						severity: Severity.Error,
						message: error
					});
					reject(error);
				}
				resolve(result);
			}, error => {
				// let errorMessage = nls.localize('query.moreRowsFailedError', 'Something went wrong getting more rows:');
				// self._notificationService.notify({
				// 	severity: Severity.Error,
				// 	message: `${errorMessage} ${error}`
				// });
				reject(error);
			});
		});
	}

	public handleEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		this._eventEmitter.emit(EventType.EDIT_SESSION_READY, { ownerUri, success, message });
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<sqlops.EditUpdateCellResult> {
		return this._queryManagementService.updateCell(ownerUri, rowId, columnId, newValue);
	}

	public commitEdit(ownerUri): Thenable<void> {
		return this._queryManagementService.commitEdit(ownerUri);
	}

	public createRow(ownerUri: string): Thenable<sqlops.EditCreateRowResult> {
		return this._queryManagementService.createRow(ownerUri).then(result => {
			return result;
		});
	}

	public deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._queryManagementService.deleteRow(ownerUri, rowId);
	}

	public revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<sqlops.EditRevertCellResult> {
		return this._queryManagementService.revertCell(ownerUri, rowId, columnId).then(result => {
			return result;
		});
	}

	public revertRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._queryManagementService.revertRow(ownerUri, rowId);
	}

	public disposeEdit(ownerUri: string): Thenable<void> {
		return this._queryManagementService.disposeEdit(ownerUri);
	}

	/**
	 * Disposes the Query from the service client
	 */
	public disposeQuery(): void {
		this._queryManagementService.disposeQuery(this.uri).then(() => {
			this.dispose();
		});
	}

	public dispose() {
		this._batchSets = undefined;
		super.dispose();
	}

	get totalElapsedMilliseconds(): number {
		return this._totalElapsedMilliseconds;
	}

	/**
	 * Sends a copy request
	 * @param selection The selection range to copy
	 * @param batchId The batch id of the result to copy from
	 * @param resultId The result id of the result to copy from
	 * @param includeHeaders [Optional]: Should column headers be included in the copy selection
	 */
	copyResults(selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): void {
		const self = this;
		let copyString = '';
		const eol = this.getEolString();

		// create a mapping of the ranges to get promises
		let tasks = selection.map((range, i) => {
			return () => {
				return self.getQueryRows(range.fromRow, range.toRow - range.fromRow + 1, batchId, resultId).then((result) => {
					// If there was a previous selection separate it with a line break. Currently
					// when there are multiple selections they are never on the same line
					if (i > 0) {
						copyString += eol;
					}

					if (self.shouldIncludeHeaders(includeHeaders)) {
						let columnHeaders = self.getColumnHeaders(batchId, resultId, range);
						if (columnHeaders !== undefined) {
							copyString += columnHeaders.join('\t') + eol;
						}
					}

					// Iterate over the rows to paste into the copy string
					for (let rowIndex: number = 0; rowIndex < result.resultSubset.rows.length; rowIndex++) {
						let row = result.resultSubset.rows[rowIndex];
						let cellObjects = row.slice(range.fromCell, (range.toCell + 1));
						// Remove newlines if requested
						let cells = self.shouldRemoveNewLines()
							? cellObjects.map(x => self.removeNewLines(x.displayValue))
							: cellObjects.map(x => x.displayValue);
						copyString += cells.join('\t');
						if (rowIndex < result.resultSubset.rows.length - 1) {
							copyString += eol;
						}
					}
				});
			};
		});

		if (tasks.length > 0) {
			let p = tasks[0]();
			for (let i = 1; i < tasks.length; i++) {
				p = p.then(tasks[i]);
			}
			p.then(() => {
				this._clipboardService.writeText(copyString);
			});
		}
	}

	private getEolString(): string {
		return this._textResourcePropertiesService.getEOL(URI.parse(this.uri), 'sql');
	}

	private shouldIncludeHeaders(includeHeaders: boolean): boolean {
		if (includeHeaders !== undefined) {
			// Respect the value explicity passed into the method
			return includeHeaders;
		}
		// else get config option from vscode config
		includeHeaders = WorkbenchUtils.getSqlConfigValue<boolean>(this._configurationService, Constants.copyIncludeHeaders);
		return !!includeHeaders;
	}

	private shouldRemoveNewLines(): boolean {
		// get config copyRemoveNewLine option from vscode config
		let removeNewLines: boolean = WorkbenchUtils.getSqlConfigValue<boolean>(this._configurationService, Constants.configCopyRemoveNewLine);
		return !!removeNewLines;
	}

	private getColumnHeaders(batchId: number, resultId: number, range: Slick.Range): string[] {
		let headers: string[] = undefined;
		let batchSummary: sqlops.BatchSummary = this._batchSets[batchId];
		if (batchSummary !== undefined) {
			let resultSetSummary = batchSummary.resultSetSummaries[resultId];
			headers = resultSetSummary.columnInfo.slice(range.fromCell, range.toCell + 1).map((info, i) => {
				return info.columnName;
			});
		}
		return headers;
	}

	private removeNewLines(inputString: string): string {
		// This regex removes all newlines in all OS types
		// Windows(CRLF): \r\n
		// Linux(LF)/Modern MacOS: \n
		// Old MacOs: \r
		if (types.isUndefinedOrNull(inputString)) {
			return 'null';
		}

		let outputString: string = inputString.replace(/(\r\n|\n|\r)/gm, '');
		return outputString;
	}

	private sendBatchTimeMessage(batchId: number, executionTime: string): void {
		// get config copyRemoveNewLine option from vscode config
		let showBatchTime: boolean = WorkbenchUtils.getSqlConfigValue<boolean>(this._configurationService, Constants.configShowBatchTime);
		if (showBatchTime) {
			let message: sqlops.IResultMessage = {
				batchId: batchId,
				message: nls.localize('elapsedBatchTime', 'Batch execution time: {0}', executionTime),
				time: undefined,
				isError: false
			};
			this._messages.push(message);
			// Send the message to the results pane
			this._onMessage.fire(message);
		}
	}

	public serializeResults(batchId: number, resultSetId: number, format: SaveFormat, selection: Slick.Range[]) {
		return this.instantiationService.createInstance(ResultSerializer).saveResults(this.uri, { selection, format, batchIndex: batchId, resultSetNumber: resultSetId });
	}
}
