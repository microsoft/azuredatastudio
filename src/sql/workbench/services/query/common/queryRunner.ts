/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryManagementService, QueryCancelResult, ExecutionPlanOptions } from 'sql/workbench/services/query/common/queryManagement';
import * as Utils from 'sql/platform/connection/common/utils';
import { Deferred } from 'sql/base/common/promise';
import { IQueryPlanInfo } from 'sql/workbench/services/query/common/queryModel';
import { ResultSerializer, SaveFormat } from 'sql/workbench/services/query/common/resultSerializer';

import * as nls from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import * as types from 'vs/base/common/types';
import { Disposable } from 'vs/base/common/lifecycle';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Emitter, Event } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { URI } from 'vs/base/common/uri';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IGridDataProvider, getResultsString } from 'sql/workbench/services/query/common/gridDataProvider';
import { getErrorMessage } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { find } from 'vs/base/common/arrays';
import { IRange, Range } from 'vs/editor/common/core/range';
import { BatchSummary, IQueryMessage, ResultSetSummary, QueryExecuteSubsetParams, CompleteBatchSummary, IResultMessage, ResultSetSubset, BatchStartSummary } from './query';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';

/*
* Query Runner class which handles running a query, reports the results to the content manager,
* and handles getting more rows from the service layer and disposing when the content is closed.
*/
export default class QueryRunner extends Disposable {
	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _resultLineOffset?: number;
	private _resultColumnOffset?: number;
	protected _totalElapsedMilliseconds: number = 0;
	protected _isExecuting: boolean = false;
	private _hasCompleted: boolean = false;
	private _batchSets: BatchSummary[] = [];
	private _messages: IQueryMessage[] = [];
	private registered = false;

	private _isQueryPlan: boolean = false;
	public get isQueryPlan(): boolean { return this._isQueryPlan; }
	private _planXml = new Deferred<string>();
	public get planXml(): Promise<string> { return this._planXml.promise; }

	private _onMessage = this._register(new Emitter<IQueryMessage[]>());
	public get onMessage(): Event<IQueryMessage[]> { return this._onMessage.event; } // this is the only way typemoq can moq this... needs investigation @todo anthonydresser 5/2/2019

	private readonly _onResultSet = this._register(new Emitter<ResultSetSummary>());
	public readonly onResultSet = this._onResultSet.event;

	private readonly _onResultSetUpdate = this._register(new Emitter<ResultSetSummary>());
	public readonly onResultSetUpdate = this._onResultSetUpdate.event;

	protected readonly _onQueryStart = this._register(new Emitter<void>());
	public readonly onQueryStart: Event<void> = this._onQueryStart.event;

	private readonly _onQueryEnd = this._register(new Emitter<string>());
	public get onQueryEnd(): Event<string> { return this._onQueryEnd.event; }

	private readonly _onBatchStart = this._register(new Emitter<BatchStartSummary>());
	public readonly onBatchStart: Event<BatchStartSummary> = this._onBatchStart.event;

	private readonly _onBatchEnd = this._register(new Emitter<CompleteBatchSummary>());
	public readonly onBatchEnd: Event<CompleteBatchSummary> = this._onBatchEnd.event;

	private readonly _onQueryPlanAvailable = this._register(new Emitter<IQueryPlanInfo>());
	public readonly onQueryPlanAvailable = this._onQueryPlanAvailable.event;

	private readonly _onVisualize = this._register(new Emitter<ResultSetSummary>());
	public readonly onVisualize = this._onVisualize.event;

	private _queryStartTime?: Date;
	public get queryStartTime(): Date | undefined {
		return this._queryStartTime;
	}
	private _queryEndTime?: Date;
	public get queryEndTime(): Date | undefined {
		return this._queryEndTime;
	}

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		public uri: string,
		@IQueryManagementService protected readonly queryManagementService: IQueryManagementService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService,
		@ILogService private readonly logService: ILogService
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
	public get batchSets(): BatchSummary[] {
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
	public cancelQuery(): Promise<QueryCancelResult> {
		return this.queryManagementService.cancelQuery(this.uri);
	}

	/**
	 * Runs the query with the provided query
	 * @param input Query string to execute
	 */
	public runQuery(input: string, runOptions?: ExecutionPlanOptions): Promise<void>;
	/**
	 * Runs the query by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQuery(input: IRange | undefined, runOptions?: ExecutionPlanOptions): Promise<void>;
	public runQuery(input: string | IRange | undefined, runOptions?: ExecutionPlanOptions): Promise<void> {
		if (types.isString(input) || types.isUndefined(input)) {
			return this.doRunQuery(input, false, runOptions);
		} else {
			return this.doRunQuery(input, false, runOptions);
		}
	}

	/**
	 * Runs the current SQL statement by pulling the query from the document using the provided selection data
	 * @param input selection data
	 */
	public runQueryStatement(input: IRange): Promise<void> {
		return this.doRunQuery(input, true);
	}

	/**
	 * Implementation that runs the query with the provided query
	 * @param input Query string to execute
	 */
	private doRunQuery(input: string, runCurrentStatement: boolean, runOptions?: ExecutionPlanOptions): Promise<void>;
	private doRunQuery(input: IRange | undefined, runCurrentStatement: boolean, runOptions?: ExecutionPlanOptions): Promise<void>;
	private doRunQuery(input: string | IRange | undefined, runCurrentStatement: boolean, runOptions?: ExecutionPlanOptions): Promise<void> {
		if (this.isExecuting) {
			return Promise.resolve();
		}
		this._planXml = new Deferred<string>();
		this._batchSets = [];
		this._hasCompleted = false;
		this._queryStartTime = undefined;
		this._queryEndTime = undefined;
		this._messages = [];
		if (isRangeOrUndefined(input)) {
			// Update internal state to show that we're executing the query
			this._resultLineOffset = input ? input.startLineNumber : 0;
			this._resultColumnOffset = input ? input.startColumn : 0;
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;
			// TODO issue #228 add statusview callbacks here

			this._onQueryStart.fire();

			// Send the request to execute the query
			return runCurrentStatement
				? this.queryManagementService.runQueryStatement(this.uri, input.startLineNumber, input.startColumn).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e))
				: this.queryManagementService.runQuery(this.uri, input, runOptions).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e));
		} else {
			// Update internal state to show that we're executing the query
			this._isExecuting = true;
			this._totalElapsedMilliseconds = 0;

			this._onQueryStart.fire();

			return this.queryManagementService.runQueryString(this.uri, input).then(() => this.handleSuccessRunQueryResult(), e => this.handleFailureRunQueryResult(e));
		}
	}

	private handleSuccessRunQueryResult() {
		// this isn't exact, but its the best we can do
		this._queryStartTime = new Date();
		// The query has started, so lets fire up the result pane
		if (!this.registered) {
			this.registered = true;
			this.queryManagementService.registerRunner(this, this.uri);
		}
	}

	private handleFailureRunQueryResult(error: any) {
		// Attempting to launch the query failed, show the error message
		const eol = getEolString(this.textResourcePropertiesService, this.uri);
		if (error instanceof Error) {
			error = error.message;
		}
		let message = nls.localize('query.ExecutionFailedError', "Execution failed due to an unexpected error: {0}\t{1}", eol, error);
		this.handleMessage([{
			isError: true,
			message: message
		}]);
		this.handleQueryComplete();
	}

	/**
	 * Handle a QueryComplete from the service layer
	 */
	public handleQueryComplete(batchSummaries?: CompleteBatchSummary[]): void {
		// this also isn't exact but its the best we can do
		this._queryEndTime = new Date();

		// Store the batch sets we got back as a source of "truth"
		this._isExecuting = false;
		this._hasCompleted = true;
		this._batchSets = batchSummaries ? batchSummaries : [];

		this._batchSets.map(batch => {
			if (batch.range) {
				batch.range = new Range(batch.range.startLineNumber + this._resultLineOffset, batch.range.startColumn + this._resultColumnOffset, batch.range.endLineNumber + this._resultLineOffset, batch.range.endColumn + this._resultColumnOffset);
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
		this._onMessage.fire([message]);
	}

	/**
	 * Handle a BatchStart from the service layer
	 */
	public handleBatchStart(batch: BatchStartSummary): void {
		// Recalculate the start and end lines, relative to the result line offset
		if (batch.range) {
			batch.range = new Range(batch.range.startLineNumber + this._resultLineOffset, batch.range.startColumn + this._resultColumnOffset, batch.range.endLineNumber + this._resultLineOffset, batch.range.endColumn + this._resultColumnOffset);
		}

		// Store the batch
		this._batchSets[batch.id] = { ...batch, resultSetSummaries: [], hasError: false };

		let message: IQueryMessage = {
			// account for index by 1
			message: batch.range ? nls.localize('query.message.startQueryWithRange', "Started executing query at Line {0}", batch.range.startLineNumber) : nls.localize('query.message.startQuery', "Started executing batch {0}", batch.id),
			time: batch.executionStart,
			range: batch.range,
			isError: false
		};
		this._messages.push(message);
		this._onMessage.fire([message]);
		this._onBatchStart.fire(batch);
	}

	/**
	 * Handle a BatchComplete from the service layer
	 */
	public handleBatchComplete(batch: CompleteBatchSummary): void {
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
	public handleResultSetAvailable(resultSet?: ResultSetSummary): void {
		if (resultSet) {
			let batchSet: BatchSummary;
			if (!resultSet.batchId) {
				// Missing the batchId or processing batchId==0. In this case, default to always using the first batch in the list
				// or create one in the case the DMP extension didn't obey the contract perfectly
				if (this._batchSets.length > 0) {
					batchSet = this._batchSets[0];
				} else {
					batchSet = <BatchSummary>{
						id: 0,
						range: undefined,
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
			let hasShowPlan = !!find(resultSet.columnInfo, e => e.columnName === 'Microsoft SQL Server 2005 XML Showplan');
			if (hasShowPlan && resultSet.rowCount > 0) {
				this._isQueryPlan = true;

				this.getQueryRows(0, 1, resultSet.batchId, resultSet.id).then(e => {
					if (e.rows) {
						this._planXml.resolve(e.rows[0][0].displayValue);
					}
				}).catch((e) => this.logService.error(e));
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

	public handleResultSetUpdated(resultSet?: ResultSetSummary): void {
		if (resultSet) {
			let batchSet: BatchSummary;
			batchSet = this._batchSets[resultSet.batchId];
			// handle getting queryPlanxml if we need too
			// check if this result has show plan, this needs work, it won't work for any other provider
			let hasShowPlan = !!resultSet.columnInfo.find(e => e.columnName === 'Microsoft SQL Server 2005 XML Showplan');
			if (hasShowPlan) {
				this._isQueryPlan = true;
				this.getQueryRows(0, 1, resultSet.batchId, resultSet.id).then(e => {

					if (e.rows) {
						let planXmlString = e.rows[0][0].displayValue;
						this._planXml.resolve(e.rows[0][0].displayValue);
						// fire query plan available event if execution is completed
						if (resultSet.complete) {
							this._onQueryPlanAvailable.fire({
								providerId: mssqlProviderName,
								fileUri: this.uri,
								planXml: planXmlString
							});
						}
					}
				}).catch((e) => this.logService.error(e));
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
	public handleMessage(messages: IResultMessage[]): void {
		this._messages.push(...messages);

		// Send the message to the results pane
		this._onMessage.fire(messages);
	}

	/**
	 * Get more data rows from the current resultSets from the service layer
	 */
	public getQueryRows(rowStart: number, numberOfRows: number, batchIndex: number, resultSetIndex: number): Promise<ResultSetSubset> {
		let rowData: QueryExecuteSubsetParams = <QueryExecuteSubsetParams>{
			ownerUri: this.uri,
			resultSetIndex: resultSetIndex,
			rowsCount: numberOfRows,
			rowsStartIndex: rowStart,
			batchIndex: batchIndex
		};

		return this.queryManagementService.getQueryRows(rowData).then(r => r, error => {
			// this._notificationService.notify({
			// 	severity: Severity.Error,
			// 	message: nls.localize('query.gettingRowsFailedError', 'Something went wrong getting more rows: {0}', error)
			// });
			return error;
		});
	}

	/**
	 * Disposes the Query from the service client
	 */
	public async disposeQuery(): Promise<void> {
		await this.queryManagementService.disposeQuery(this.uri);
		this.dispose();
	}

	public dispose() {
		this._batchSets = undefined!;
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
	async copyResults(selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): Promise<void> {
		let provider = this.getGridDataProvider(batchId, resultId);
		return provider.copyResults(selection, includeHeaders);
	}


	public getColumnHeaders(batchId: number, resultId: number, range: Slick.Range): string[] | undefined {
		let headers: string[] | undefined = undefined;
		let batchSummary: BatchSummary = this._batchSets[batchId];
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
		let showBatchTime = this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').messages.showBatchTime;
		if (showBatchTime) {
			let message: IQueryMessage = {
				batchId: batchId,
				message: nls.localize('elapsedBatchTime', "Batch execution time: {0}", executionTime),
				time: undefined,
				isError: false
			};
			this._messages.push(message);
			// Send the message to the results pane
			this._onMessage.fire([message]);
		}
	}

	public serializeResults(batchId: number, resultSetId: number, format: SaveFormat, selection: Slick.Range[]) {
		return this.instantiationService.createInstance(ResultSerializer).saveResults(this.uri, { selection, format, batchIndex: batchId, resultSetNumber: resultSetId });
	}

	public getGridDataProvider(batchId: number, resultSetId: number): IGridDataProvider {
		return this.instantiationService.createInstance(QueryGridDataProvider, this, batchId, resultSetId);
	}

	public notifyVisualizeRequested(batchId: number, resultSetId: number): void {
		let result: ResultSetSummary = {
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

	getRowData(rowStart: number, numberOfRows: number): Promise<ResultSetSubset> {
		return this.queryRunner.getQueryRows(rowStart, numberOfRows, this.batchId, this.resultSetId);
	}

	copyResults(selection: Slick.Range[], includeHeaders?: boolean): Promise<void> {
		return this.copyResultsAsync(selection, includeHeaders);
	}

	private async copyResultsAsync(selection: Slick.Range[], includeHeaders?: boolean): Promise<void> {
		try {
			let results = await getResultsString(this, selection, includeHeaders);
			await this._clipboardService.writeText(results);
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
	getColumnHeaders(range: Slick.Range): string[] | undefined {
		return this.queryRunner.getColumnHeaders(this.batchId, this.resultSetId, range);
	}

	get canSerialize(): boolean {
		return true;
	}

	serializeResults(format: SaveFormat, selection: Slick.Range[]): Promise<void> {
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
	includeHeaders = configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.copyIncludeHeaders;
	return !!includeHeaders;
}

export function shouldRemoveNewLines(configurationService: IConfigurationService): boolean {
	// get config copyRemoveNewLine option from vscode config
	let removeNewLines = configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.copyRemoveNewLine;
	return !!removeNewLines;
}

function isRangeOrUndefined(input: string | IRange | undefined): input is IRange | undefined {
	return Range.isIRange(input) || types.isUndefinedOrNull(input);
}
