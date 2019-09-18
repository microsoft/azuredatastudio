/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import * as Utils from 'sql/platform/connection/common/utils';
import { SaveFormat } from 'sql/workbench/parts/grid/common/interfaces';
import { Deferred } from 'sql/base/common/promise';
import { IQueryPlanInfo } from 'sql/platform/query/common/queryModel';
import { ResultSerializer } from 'sql/workbench/parts/query/common/resultSerializer';

import Severity from 'vs/base/common/severity';
import * as nls from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import * as types from 'vs/base/common/types';
import { Disposable } from 'vs/base/common/lifecycle';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Emitter, Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';
import { URI } from 'vs/base/common/uri';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IGridDataProvider, getResultsString } from 'sql/platform/query/common/gridDataProvider';
import { getErrorMessage } from 'vs/base/common/errors';

export interface IEditSessionReadyEvent {
	ownerUri: string;
	success: boolean;
	message: string;
}

export interface IQueryMessage extends azdata.IResultMessage {
	selection?: azdata.ISelectionData;
}

/*
* Query Runner class which handles running a query, reports the results to the content manager,
* and handles getting more rows from the service layer and disposing when the content is closed.
*/
export default class QueryRunner extends Disposable {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _resultLineOffset: number;
	private _resultColumnOffset: number;
	private _totalElapsedMilliseconds: number = 0;
	private _isExecuting: boolean = false;
	private _hasCompleted: boolean = false;
	private _batchSets: azdata.BatchSummary[] = [];
	private _messages: IQueryMessage[] = [];
	private registered = false;

	private _isQueryPlan: boolean = false;
	public get isQueryPlan(): boolean { return this._isQueryPlan; }
	private _planXml = new Deferred<string>();
	public get planXml(): Thenable<string> { return this._planXml.promise; }

	private _onMessage = this._register(new Emitter<IQueryMessage>());
	public get onMessage(): Event<IQueryMessage> { return this._onMessage.event; } // this is the only way typemoq can moq this... needs investigation @todo anthonydresser 5/2/2019

	private _onResultSet = this._register(new Emitter<azdata.ResultSetSummary>());
	public readonly onResultSet = this._onResultSet.event;

	private _onResultSetUpdate = this._register(new Emitter<azdata.ResultSetSummary>());
	public readonly onResultSetUpdate = this._onResultSetUpdate.event;

	private _onQueryStart = this._register(new Emitter<void>());
	public readonly onQueryStart: Event<void> = this._onQueryStart.event;

	private _onQueryEnd = this._register(new Emitter<string>());
	public get onQueryEnd(): Event<string> { return this._onQueryEnd.event; }

	private _onBatchStart = this._register(new Emitter<azdata.BatchSummary>());
	public readonly onBatchStart: Event<azdata.BatchSummary> = this._onBatchStart.event;

	private _onBatchEnd = this._register(new Emitter<azdata.BatchSummary>());
	public readonly onBatchEnd: Event<azdata.BatchSummary> = this._onBatchEnd.event;

	private _onEditSessionReady = this._register(new Emitter<IEditSessionReadyEvent>());
	public readonly onEditSessionReady = this._onEditSessionReady.event;

	private _onQueryPlanAvailable = this._register(new Emitter<IQueryPlanInfo>());
	public readonly onQueryPlanAvailable = this._onQueryPlanAvailable.event;

	private _onVisualize = this._register(new Emitter<azdata.ResultSetSummary>());
	public readonly onVisualize = this._onVisualize.event;

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
	public get batchSets(): azdata.BatchSummary[] {
		return this._batchSets.slice(0);
	}

	/**
	 * For public use only, for private use, directly access the member
	 */
	public get messages(): IQueryMessage[] {
		return this._messages.slice(0);
	}

	// PUBLIC METHODS ======================================================

	/**
	 * Cancels the running query, if there is one
	 */
	public cancelQuery(): Thenable<azdata.QueryCancelResult> {
		return this._queryManagementService.cancelQuery(this.uri);
	}

	/**
	 * Runs the query with the provided query
	 * @param input Query string to execute
	 */
	public runQuery(input: string, runOptions?: azdata.ExecutionPlanOptions): Thenable<void>;
	/**
	 * Runs the query by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQuery(input: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void>;
	public runQuery(input, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
		return this.doRunQuery(input, false, runOptions);
	}

	/**
	 * Runs the current SQL statement by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQueryStatement(input: azdata.ISelectionData): Thenable<void> {
		return this.doRunQuery(input, true);
	}

	/**
	 * Implementation that runs the query with the provided query
	 * @param input Query string to execute
	 */
	private doRunQuery(input: string, runCurrentStatement: boolean, runOptions?: azdata.ExecutionPlanOptions): Thenable<void>;
	private doRunQuery(input: azdata.ISelectionData, runCurrentStatement: boolean, runOptions?: azdata.ExecutionPlanOptions): Thenable<void>;
	private doRunQuery(input, runCurrentStatement: boolean, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
		if (this.isExecuting) {
			return Promise.resolve(undefined);
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
			this._resultColumnOffset = input ? input.startColumn : 0;
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;
			// TODO issue #228 add statusview callbacks here

			this._onQueryStart.fire();

			// Send the request to execute the query
			return runCurrentStatement
				? this._queryManagementService.runQueryStatement(this.uri, input.startLine, input.startColumn).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e))
				: this._queryManagementService.runQuery(this.uri, input, runOptions).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e));
		} else if (types.isString(input)) {
			// Update internal state to show that we're executing the query
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;

			this._onQueryStart.fire();

			return this._queryManagementService.runQueryString(this.uri, input).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e));
		} else {
			return Promise.reject('Unknown input');
		}
	}

	private handleSuccessRunQueryResult() {
		// this isn't exact, but its the best we can do
		this._queryStartTime = new Date();
		// The query has started, so lets fire up the result pane
		if (!this.registered) {
			this.registered = true;
			this._queryManagementService.registerRunner(this, this.uri);
		}
	}

	private handleFailureRunQueryResult(error: any) {
		// Attempting to launch the query failed, show the error message
		const eol = getEolString(this._textResourcePropertiesService, this.uri);
		if (error instanceof Error) {
			error = error.message;
		}
		let message = nls.localize('query.ExecutionFailedError', "Execution failed due to an unexpected error: {0}\t{1}", eol, error);
		this.handleMessage(<azdata.QueryExecuteMessageParams>{
			ownerUri: this.uri,
			message: {
				isError: true,
				message: message
			}
		});
		this.handleQueryComplete(<azdata.QueryExecuteCompleteNotificationResult>{ ownerUri: this.uri });
	}

	/**
	 * Handle a QueryComplete from the service layer
	 */
	public handleQueryComplete(result: azdata.QueryExecuteCompleteNotificationResult): void {
		// this also isn't exact but its the best we can do
		this._queryEndTime = new Date();

		// Store the batch sets we got back as a source of "truth"
		this._isExecuting = false;
		this._hasCompleted = true;
		this._batchSets = result.batchSummaries ? result.batchSummaries : [];

		this._batchSets.map(batch => {
			if (batch.selection) {
				batch.selection.startLine += this._resultLineOffset;
				batch.selection.startColumn += this._resultColumnOffset;
				batch.selection.endLine += this._resultLineOffset;
				batch.selection.endColumn += this._resultColumnOffset;
			}
		});

		let timeStamp = Utils.parseNumAsTimeString(this._totalElapsedMilliseconds);
		// We're done with this query so shut down any waiting mechanisms

		let message = {
			message: nls.localize('query.message.executionTime', "Total execution time: {0}", timeStamp),
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
	public handleBatchStart(result: azdata.QueryExecuteBatchNotificationParams): void {
		let batch = result.batchSummary;

		// Recalculate the start and end lines, relative to the result line offset
		if (batch.selection) {
			batch.selection.startLine += this._resultLineOffset;
			batch.selection.startColumn += this._resultColumnOffset;
			batch.selection.endLine += this._resultLineOffset;
			batch.selection.endColumn += this._resultColumnOffset;
		}

		// Set the result sets as an empty array so that as result sets complete we can add to the list
		batch.resultSetSummaries = [];

		// Store the batch
		this._batchSets[batch.id] = batch;

		let message = {
			// account for index by 1
			message: nls.localize('query.message.startQuery', "Started executing query at Line {0}", batch.selection.startLine + 1),
			time: new Date(batch.executionStart).toLocaleTimeString(),
			selection: batch.selection,
			isError: false
		};
		this._messages.push(message);
		this._onMessage.fire(message);
		this._onBatchStart.fire(batch);
	}

	/**
	 * Handle a BatchComplete from the service layer
	 */
	public handleBatchComplete(result: azdata.QueryExecuteBatchNotificationParams): void {
		let batch: azdata.BatchSummary = result.batchSummary;

		// Store the batch again to get the rest of the data
		this._batchSets[batch.id] = batch;
		let executionTime = <number>(Utils.parseTimeString(batch.executionElapsed) || 0);
		this._totalElapsedMilliseconds += executionTime;
		if (executionTime > 0) {
			// send a time message in the format used for query complete
			this.sendBatchTimeMessage(batch.id, Utils.parseNumAsTimeString(executionTime));
		}

		this._onBatchEnd.fire(batch);
	}

	/**
	 * Handle a ResultSetComplete from the service layer
	 */
	public handleResultSetAvailable(result: azdata.QueryExecuteResultSetNotificationParams): void {
		if (result && result.resultSetSummary) {
			let resultSet = result.resultSetSummary;
			let batchSet: azdata.BatchSummary;
			if (!resultSet.batchId) {
				// Missing the batchId or processing batchId==0. In this case, default to always using the first batch in the list
				// or create one in the case the DMP extension didn't obey the contract perfectly
				if (this._batchSets.length > 0) {
					batchSet = this._batchSets[0];
				} else {
					batchSet = <azdata.BatchSummary>{
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
			// check if this result has show plan, this needs work, it won't work for any other provider
			let hasShowPlan = !!result.resultSetSummary.columnInfo.find(e => e.columnName === 'Microsoft SQL Server 2005 XML Showplan');
			if (hasShowPlan) {
				this._isQueryPlan = true;
				this.getQueryRows(0, 1, result.resultSetSummary.batchId, result.resultSetSummary.id).then(e => {
					if (e.resultSubset.rows) {
						this._planXml.resolve(e.resultSubset.rows[0][0].displayValue);
					}
				});
			}
			// we will just ignore the set if we already have it
			// ideally this should never happen
			if (batchSet && !batchSet.resultSetSummaries[resultSet.id]) {
				// Store the result set in the batch and emit that a result set has completed
				batchSet.resultSetSummaries[resultSet.id] = resultSet;
				this._onResultSet.fire(resultSet);
			}
		}
	}

	public handleResultSetUpdated(result: azdata.QueryExecuteResultSetNotificationParams): void {
		if (result && result.resultSetSummary) {
			let resultSet = result.resultSetSummary;
			let batchSet: azdata.BatchSummary;
			batchSet = this._batchSets[resultSet.batchId];
			// handle getting queryPlanxml if we need too
			// check if this result has show plan, this needs work, it won't work for any other provider
			let hasShowPlan = !!result.resultSetSummary.columnInfo.find(e => e.columnName === 'Microsoft SQL Server 2005 XML Showplan');
			if (hasShowPlan) {
				this._isQueryPlan = true;
				this.getQueryRows(0, 1, result.resultSetSummary.batchId, result.resultSetSummary.id).then(e => {
					if (e.resultSubset.rows) {
						let planXmlString = e.resultSubset.rows[0][0].displayValue;
						this._planXml.resolve(e.resultSubset.rows[0][0].displayValue);
						// fire query plan available event if execution is completed
						if (result.resultSetSummary.complete) {
							this._onQueryPlanAvailable.fire({
								providerId: mssqlProviderName,
								fileUri: result.ownerUri,
								planXml: planXmlString
							});
						}
					}
				});
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
	public handleMessage(obj: azdata.QueryExecuteMessageParams): void {
		let message = obj.message;
		message.time = new Date(message.time).toLocaleTimeString();
		this._messages.push(message);

		// Send the message to the results pane
		this._onMessage.fire(message);
	}

	/**
	 * Get more data rows from the current resultSets from the service layer
	 */
	public getQueryRows(rowStart: number, numberOfRows: number, batchIndex: number, resultSetIndex: number): Thenable<azdata.QueryExecuteSubsetResult> {
		let rowData: azdata.QueryExecuteSubsetParams = <azdata.QueryExecuteSubsetParams>{
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
			this._onQueryStart.fire();
			this._queryManagementService.registerRunner(this, ownerUri);
		}, error => {
			// Attempting to launch the query failed, show the error message

			// TODO issue #228 add statusview callbacks here
			this._isExecuting = false;
			this._notificationService.error(nls.localize('query.initEditExecutionFailed', "Initialize edit data session failed: ") + error);
		});
	}

	/**
	 * Retrieves a number of rows from an edit session
	 * @param rowStart     The index of the row to start returning (inclusive)
	 * @param numberOfRows The number of rows to return
	 */
	public getEditRows(rowStart: number, numberOfRows: number): Thenable<azdata.EditSubsetResult> {
		const self = this;
		let rowData: azdata.EditSubsetParams = {
			ownerUri: this.uri,
			rowCount: numberOfRows,
			rowStartIndex: rowStart
		};

		return new Promise<azdata.EditSubsetResult>((resolve, reject) => {
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
				// let errorMessage = nls.localize('query.moreRowsFailedError', "Something went wrong getting more rows:");
				// self._notificationService.notify({
				// 	severity: Severity.Error,
				// 	message: `${errorMessage} ${error}`
				// });
				reject(error);
			});
		});
	}

	public handleEditSessionReady(ownerUri: string, success: boolean, message: string): void {
		this._onEditSessionReady.fire({ ownerUri, success, message });
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		return this._queryManagementService.updateCell(ownerUri, rowId, columnId, newValue);
	}

	public commitEdit(ownerUri): Thenable<void> {
		return this._queryManagementService.commitEdit(ownerUri);
	}

	public createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		return this._queryManagementService.createRow(ownerUri).then(result => {
			return result;
		});
	}

	public deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		return this._queryManagementService.deleteRow(ownerUri, rowId);
	}

	public revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
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
		let provider = this.getGridDataProvider(batchId, resultId);
		provider.copyResults(selection, includeHeaders);
	}


	public getColumnHeaders(batchId: number, resultId: number, range: Slick.Range): string[] {
		let headers: string[] = undefined;
		let batchSummary: azdata.BatchSummary = this._batchSets[batchId];
		if (batchSummary !== undefined) {
			let resultSetSummary = batchSummary.resultSetSummaries[resultId];
			headers = resultSetSummary.columnInfo.slice(range.fromCell, range.toCell + 1).map((info, i) => {
				return info.columnName;
			});
		}
		return headers;
	}

	private sendBatchTimeMessage(batchId: number, executionTime: string): void {
		// get config copyRemoveNewLine option from vscode config
		let showBatchTime = this._configurationService.getValue<boolean>('sql.showBatchTime');
		if (showBatchTime) {
			let message: IQueryMessage = {
				batchId: batchId,
				message: nls.localize('elapsedBatchTime', "Batch execution time: {0}", executionTime),
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

	public getGridDataProvider(batchId: number, resultSetId: number): IGridDataProvider {
		return this.instantiationService.createInstance(QueryGridDataProvider, this, batchId, resultSetId);
	}

	public notifyVisualizeRequested(batchId: number, resultSetId: number): void {
		let result: azdata.ResultSetSummary = {
			batchId: batchId,
			id: resultSetId,
			columnInfo: this.batchSets[batchId].resultSetSummaries[resultSetId].columnInfo,
			complete: true,
			rowCount: this.batchSets[batchId].resultSetSummaries[resultSetId].rowCount
		};
		this._onVisualize.fire(result);
	}
}

export class QueryGridDataProvider implements IGridDataProvider {

	constructor(
		private queryRunner: QueryRunner,
		private batchId: number,
		private resultSetId: number,
		@INotificationService private _notificationService: INotificationService,
		@IClipboardService private _clipboardService: IClipboardService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ITextResourcePropertiesService private _textResourcePropertiesService: ITextResourcePropertiesService
	) {
	}

	getRowData(rowStart: number, numberOfRows: number): Thenable<azdata.QueryExecuteSubsetResult> {
		return this.queryRunner.getQueryRows(rowStart, numberOfRows, this.batchId, this.resultSetId);
	}

	copyResults(selection: Slick.Range[], includeHeaders?: boolean): void {
		this.copyResultsAsync(selection, includeHeaders);
	}

	private async copyResultsAsync(selection: Slick.Range[], includeHeaders?: boolean): Promise<void> {
		try {
			let results = await getResultsString(this, selection, includeHeaders);
			this._clipboardService.writeText(results);
		} catch (error) {
			this._notificationService.error(nls.localize('copyFailed', "Copy failed with error {0}", getErrorMessage(error)));
		}
	}
	getEolString(): string {
		return getEolString(this._textResourcePropertiesService, this.queryRunner.uri);
	}
	shouldIncludeHeaders(includeHeaders: boolean): boolean {
		return shouldIncludeHeaders(includeHeaders, this._configurationService);
	}
	shouldRemoveNewLines(): boolean {
		return shouldRemoveNewLines(this._configurationService);
	}
	getColumnHeaders(range: Slick.Range): string[] {
		return this.queryRunner.getColumnHeaders(this.batchId, this.resultSetId, range);
	}

	get canSerialize(): boolean {
		return true;
	}

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Thenable<void> {
		return this.queryRunner.serializeResults(this.batchId, this.resultSetId, format, selection);
	}
}


export function getEolString(textResourcePropertiesService: ITextResourcePropertiesService, uri: string): string {
	return textResourcePropertiesService.getEOL(URI.parse(uri), 'sql');
}

export function shouldIncludeHeaders(includeHeaders: boolean, configurationService: IConfigurationService): boolean {
	if (includeHeaders !== undefined) {
		// Respect the value explicity passed into the method
		return includeHeaders;
	}
	// else get config option from vscode config
	includeHeaders = configurationService.getValue<boolean>('sql.copyIncludeHeaders');
	return !!includeHeaders;
}

export function shouldRemoveNewLines(configurationService: IConfigurationService): boolean {
	// get config copyRemoveNewLine option from vscode config
	let removeNewLines = configurationService.getValue<boolean>('sql.copyRemoveNewLine');
	return !!removeNewLines;
}
