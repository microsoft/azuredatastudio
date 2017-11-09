/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {
	BatchSummary,
	QueryCancelResult,
	QueryExecuteBatchNotificationParams,
	QueryExecuteCompleteNotificationResult,
	QueryExecuteResultSetCompleteNotificationParams,
	QueryExecuteMessageParams,
	QueryExecuteSubsetParams, QueryExecuteSubsetResult,
	EditSubsetParams, EditSubsetResult, EditUpdateCellResult, EditCreateRowResult,
	EditRevertCellResult, ISelectionData, IResultMessage, ExecutionPlanOptions
} from 'data';

import { EventEmitter } from 'events';
import * as Constants from 'sql/parts/query/common/constants';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import { ISlickRange } from 'angular2-slickgrid';
import * as Utils from 'sql/parts/connection/common/utils';
import { error as consoleError } from 'sql/base/common/log';

import { IMessageService } from 'vs/platform/message/common/message';
import Severity from 'vs/base/common/severity';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import * as nls from 'vs/nls';

import * as os from 'os';

/*
* Query Runner class which handles running a query, reports the results to the content manager,
* and handles getting more rows from the service layer and disposing when the content is closed.
*/
export default class QueryRunner {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _batchSets: BatchSummary[] = [];
	private _isExecuting: boolean;
	private _uri: string;
	private _title: string;
	private _resultLineOffset: number;
	private _totalElapsedMilliseconds: number;
	private _hasCompleted: boolean;
	public eventEmitter: EventEmitter = new EventEmitter();

	// CONSTRUCTOR /////////////////////////////////////////////////////////

	constructor(private _ownerUri: string,
		private _editorTitle: string,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IMessageService private _messageService: IMessageService,
		@IWorkspaceConfigurationService private _workspaceConfigurationService: IWorkspaceConfigurationService
	) {

		// Store the state
		this._uri = _ownerUri;
		this._title = _editorTitle;
		this._isExecuting = false;
		this._totalElapsedMilliseconds = 0;
		this._hasCompleted = false;
	}

	// PROPERTIES //////////////////////////////////////////////////////////

	get uri(): string {
		return this._uri;
	}

	set uri(uri: string) {
		this._uri = uri;
	}

	get title(): string {
		return this._title;
	}

	set title(title: string) {
		this._title = title;
	}

	get batchSets(): BatchSummary[] {
		return this._batchSets;
	}

	set batchSets(batchSets: BatchSummary[]) {
		this._batchSets = batchSets;
	}

	get isExecuting(): boolean {
		return this._isExecuting;
	}

	get hasCompleted(): boolean {
		return this._hasCompleted;
	}

	// PUBLIC METHODS ======================================================

	/**
	 * Cancels the running query, if there is one
	 */
	public cancelQuery(): Thenable<QueryCancelResult> {
		return this._queryManagementService.cancelQuery(this._uri);
	}

	/**
	 * Runs the query with the provided query
	 * @param input Query string to execute
	 */
	public runQuery(input: string, runOptions?: ExecutionPlanOptions): Thenable<void>;
	/**
	 * Runs the query by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQuery(input: ISelectionData, runOptions?: ExecutionPlanOptions): Thenable<void>;
	public runQuery(input, runOptions?: ExecutionPlanOptions): Thenable<void> {
		return this.doRunQuery(input, false, runOptions);
	}

	/**
	 * Runs the current SQL statement by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQueryStatement(input: ISelectionData): Thenable<void> {
		return this.doRunQuery(input, true);
	}

	/**
	 * Implementation that runs the query with the provided query
	 * @param input Query string to execute
	 */
	private doRunQuery(input: string, runCurrentStatement: boolean, runOptions?: ExecutionPlanOptions): Thenable<void>;
	private doRunQuery(input: ISelectionData, runCurrentStatement: boolean, runOptions?: ExecutionPlanOptions): Thenable<void>;
	private doRunQuery(input, runCurrentStatement: boolean, runOptions?: ExecutionPlanOptions): Thenable<void> {
		let ownerUri = this._uri;
		this.batchSets = [];
		this._hasCompleted = false;
		if (typeof input === 'object' || input === undefined) {
			// Update internal state to show that we're executing the query
			this._resultLineOffset = input ? input.startLine : 0;
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;
			// TODO issue #228 add statusview callbacks here

			// Send the request to execute the query
			return runCurrentStatement
				? this._queryManagementService.runQueryStatement(ownerUri, input.startLine, input.startColumn).then(this.handleSuccessRunQueryResult(), this.handleFailureRunQueryResult())
				: this._queryManagementService.runQuery(ownerUri, input, runOptions).then(this.handleSuccessRunQueryResult(), this.handleFailureRunQueryResult());
		} else if (typeof input === 'string') {
			// Update internal state to show that we're executing the query
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;

			return this._queryManagementService.runQueryString(ownerUri, input).then(this.handleSuccessRunQueryResult(), this.handleFailureRunQueryResult());
		} else {
			return Promise.reject('Unknown input');
		}
	}

	private handleSuccessRunQueryResult() {
		let self = this;
		return () => {
			// The query has started, so lets fire up the result pane
			self.eventEmitter.emit('start');
			self._queryManagementService.registerRunner(self, self._uri);
		};
	}

	private handleFailureRunQueryResult() {
		let self = this;
		return (error: any) => {
			// Attempting to launch the query failed, show the error message

			// TODO issue #228 add statusview callbacks here
			self._isExecuting = false;

			self._messageService.show(Severity.Error, nls.localize('query.ExecutionFailedError', 'Execution failed: {0}', error));
		};
	}

	/**
	 * Handle a QueryComplete from the service layer
	 */
	public handleQueryComplete(result: QueryExecuteCompleteNotificationResult): void {

		// Store the batch sets we got back as a source of "truth"
		this._isExecuting = false;
		this._hasCompleted = true;
		this._batchSets = result.batchSummaries ? result.batchSummaries : [];

		this._batchSets.map((batch) => {
			if (batch.selection) {
				batch.selection.startLine = batch.selection.startLine + this._resultLineOffset;
				batch.selection.endLine = batch.selection.endLine + this._resultLineOffset;
			}
		});

		// We're done with this query so shut down any waiting mechanisms
		this.eventEmitter.emit('complete', Utils.parseNumAsTimeString(this._totalElapsedMilliseconds));
	}

	/**
	 * Handle a BatchStart from the service layer
	 */
	public handleBatchStart(result: QueryExecuteBatchNotificationParams): void {
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
		this.eventEmitter.emit('batchStart', batch);
	}

	/**
	 * Handle a BatchComplete from the service layer
	 */
	public handleBatchComplete(result: QueryExecuteBatchNotificationParams): void {
		let batch: BatchSummary = result.batchSummary;

		// Store the batch again to get the rest of the data
		this._batchSets[batch.id] = batch;
		let executionTime = <number>(Utils.parseTimeString(batch.executionElapsed) || 0);
		this._totalElapsedMilliseconds += executionTime;
		if (executionTime > 0) {
			// send a time message in the format used for query complete
			this.sendBatchTimeMessage(batch.id, Utils.parseNumAsTimeString(executionTime));
		}
		this.eventEmitter.emit('batchComplete', batch);
	}

	/**
	 * Handle a ResultSetComplete from the service layer
	 */
	public handleResultSetComplete(result: QueryExecuteResultSetCompleteNotificationParams): void {
		if (result && result.resultSetSummary) {
			let resultSet = result.resultSetSummary;
			let batchSet: BatchSummary;
			if (!resultSet.batchId) {
				// Missing the batchId. In this case, default to always using the first batch in the list
				// or create one in the case the DMP extension didn't obey the contract perfectly
				if (this._batchSets.length > 0) {
					batchSet = this._batchSets[0];
				} else {
					batchSet = <BatchSummary>{
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
			if (batchSet) {
				// Store the result set in the batch and emit that a result set has completed
				batchSet.resultSetSummaries[resultSet.id] = resultSet;
				this.eventEmitter.emit('resultSet', resultSet);
			}
		}
	}

	/**
	 * Handle a Mssage from the service layer
	 */
	public handleMessage(obj: QueryExecuteMessageParams): void {
		let message = obj.message;
		message.time = new Date(message.time).toLocaleTimeString();

		// Send the message to the results pane
		this.eventEmitter.emit('message', message);
	}

	/**
	 * Get more data rows from the current resultSets from the service layer
	 */
	public getQueryRows(rowStart: number, numberOfRows: number, batchIndex: number, resultSetIndex: number): Thenable<QueryExecuteSubsetResult> {
		const self = this;
		let rowData: QueryExecuteSubsetParams = <QueryExecuteSubsetParams>{
			ownerUri: this.uri,
			resultSetIndex: resultSetIndex,
			rowsCount: numberOfRows,
			rowsStartIndex: rowStart,
			batchIndex: batchIndex
		};

		return new Promise<QueryExecuteSubsetResult>((resolve, reject) => {
			self._queryManagementService.getQueryRows(rowData).then(result => {
				resolve(result);
			}, error => {
				self._messageService.show(Severity.Error, nls.localize('query.gettingRowsFailedError', 'Something went wrong getting more rows: {0}', error));
				reject(error);
			});
		});
	}

	/*
	 * Handle a session ready event for Edit Data
	 */
	public initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> {
		const self = this;

		// Update internal state to show that we're executing the query
		this._isExecuting = true;
		this._totalElapsedMilliseconds = 0;
		// TODO issue #228 add statusview callbacks here

		return this._queryManagementService.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit).then(result => {
			// The query has started, so lets fire up the result pane
			self.eventEmitter.emit('start');
			self._queryManagementService.registerRunner(self, ownerUri);
		}, error => {
			// Attempting to launch the query failed, show the error message

			// TODO issue #228 add statusview callbacks here
			self._isExecuting = false;

			self._messageService.show(Severity.Error, nls.localize('query.initEditExecutionFailed', 'Init Edit Execution failed: ') + error);
		});
	}

	/**
	 * Retrieves a number of rows from an edit session
	 * @param rowStart     The index of the row to start returning (inclusive)
	 * @param numberOfRows The number of rows to return
	 */
	public getEditRows(rowStart: number, numberOfRows: number): Thenable<EditSubsetResult> {
		const self = this;
		let rowData: EditSubsetParams = {
			ownerUri: this.uri,
			rowCount: numberOfRows,
			rowStartIndex: rowStart
		};

		return new Promise<EditSubsetResult>((resolve, reject) => {
			self._queryManagementService.getEditRows(rowData).then(result => {
				if (!result.hasOwnProperty('rowCount')) {
					let error = `Nothing returned from subset query`;
					self._messageService.show(Severity.Error, error);
					reject(error);
				}
				resolve(result);
			}, error => {
				let errorMessage = nls.localize('query.moreRowsFailedError', 'Something went wrong getting more rows:');
				self._messageService.show(Severity.Error, `${errorMessage} ${error}`);
				reject(error);
			});
		});
	}

	public handleEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		this.eventEmitter.emit('editSessionReady', ownerUri, success, message);
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<EditUpdateCellResult> {
		return this._queryManagementService.updateCell(ownerUri, rowId, columnId, newValue);
	}

	public commitEdit(ownerUri): Thenable<void> {
		return this._queryManagementService.commitEdit(ownerUri);
	}

	public createRow(ownerUri: string): Thenable<EditCreateRowResult> {
		return this._queryManagementService.createRow(ownerUri).then(result => {
			return result;
		});
	}

	public deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._queryManagementService.deleteRow(ownerUri, rowId);
	}

	public revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<EditRevertCellResult> {
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
	 * @returns A promise that will be rejected if a problem occured
	 */
	public dispose(): Promise<void> {
		const self = this;
		return new Promise<void>((resolve, reject) => {
			self._queryManagementService.disposeQuery(self.uri).then(result => {
				resolve();
			}, error => {
				consoleError('Failed disposing query: ' + error);
				reject(error);
			});
		});
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
	copyResults(selection: ISlickRange[], batchId: number, resultId: number, includeHeaders?: boolean): void {
		const self = this;
		let copyString = '';

		// create a mapping of the ranges to get promises
		let tasks = selection.map((range, i) => {
			return () => {
				return self.getQueryRows(range.fromRow, range.toRow - range.fromRow + 1, batchId, resultId).then((result) => {
					if (self.shouldIncludeHeaders(includeHeaders)) {
						let columnHeaders = self.getColumnHeaders(batchId, resultId, range);
						if (columnHeaders !== undefined) {
							copyString += columnHeaders.join('\t') + os.EOL;
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
							copyString += os.EOL;
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
				WorkbenchUtils.executeCopy(copyString);
			});
		}
	}

	private shouldIncludeHeaders(includeHeaders: boolean): boolean {
		if (includeHeaders !== undefined) {
			// Respect the value explicity passed into the method
			return includeHeaders;
		}
		// else get config option from vscode config
		includeHeaders = WorkbenchUtils.getSqlConfigValue<boolean>(this._workspaceConfigurationService, Constants.copyIncludeHeaders);
		return !!includeHeaders;
	}

	private shouldRemoveNewLines(): boolean {
		// get config copyRemoveNewLine option from vscode config
		let removeNewLines: boolean = WorkbenchUtils.getSqlConfigValue<boolean>(this._workspaceConfigurationService, Constants.configCopyRemoveNewLine);
		return !!removeNewLines;
	}

	private getColumnHeaders(batchId: number, resultId: number, range: ISlickRange): string[] {
		let headers: string[] = undefined;
		let batchSummary: BatchSummary = this.batchSets[batchId];
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
		if (!inputString) {
			return 'null';
		}

		let outputString: string = inputString.replace(/(\r\n|\n|\r)/gm, '');
		return outputString;
	}

	private sendBatchTimeMessage(batchId: number, executionTime: string): void {
		// get config copyRemoveNewLine option from vscode config
		let showBatchTime: boolean = WorkbenchUtils.getSqlConfigValue<boolean>(this._workspaceConfigurationService, Constants.configShowBatchTime);
		if (showBatchTime) {
			let message: IResultMessage = {
				batchId: batchId,
				message: nls.localize('elapsedBatchTime', 'Batch execution time: {0}', executionTime),
				time: undefined,
				isError: false
			};
			// Send the message to the results pane
			this.eventEmitter.emit('message', message);
		}
	}

}
