/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as GridContentEvents from 'sql/workbench/parts/grid/common/gridContentEvents';
import * as LocalizedConstants from 'sql/workbench/parts/query/common/localizedConstants';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { DataService } from 'sql/workbench/parts/grid/common/dataService';
import { IQueryModelService, IQueryEvent } from 'sql/platform/query/common/queryModel';
import { QueryInput } from 'sql/workbench/parts/query/common/queryInput';

import * as azdata from 'azdata';

import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Event, Emitter } from 'vs/base/common/event';
import * as strings from 'vs/base/common/strings';
import * as types from 'vs/base/common/types';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';

const selectionSnippetMaxLen = 100;

export interface QueryEvent {
	type: string;
	data: any;
}

/**
 * Holds information about the state of a query runner
 */
export class QueryInfo {
	public queryRunner: QueryRunner;
	public dataService: DataService;
	public queryEventQueue: QueryEvent[];
	public selection: Array<azdata.ISelectionData>;
	public queryInput: QueryInput;
	public selectionSnippet: string;

	// Notes if the angular components have obtained the DataService. If not, all messages sent
	// via the data service will be lost.
	public dataServiceReady: boolean;

	constructor() {
		this.dataServiceReady = false;
		this.queryEventQueue = [];
		this.selection = [];
	}
}

/**
 * Handles running queries and grid interactions for all URIs. Interacts with each URI's results grid via a DataService instance
 */
export class QueryModelService implements IQueryModelService {
	_serviceBrand: undefined;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _queryInfoMap: Map<string, QueryInfo>;
	private _onRunQueryStart: Emitter<string>;
	private _onRunQueryUpdate: Emitter<string>;
	private _onRunQueryComplete: Emitter<string>;
	private _onQueryEvent: Emitter<IQueryEvent>;
	private _onEditSessionReady: Emitter<azdata.EditSessionReadyParams>;

	// EVENTS /////////////////////////////////////////////////////////////
	public get onRunQueryStart(): Event<string> { return this._onRunQueryStart.event; }
	public get onRunQueryUpdate(): Event<string> { return this._onRunQueryUpdate.event; }
	public get onRunQueryComplete(): Event<string> { return this._onRunQueryComplete.event; }
	public get onQueryEvent(): Event<IQueryEvent> { return this._onQueryEvent.event; }
	public get onEditSessionReady(): Event<azdata.EditSessionReadyParams> { return this._onEditSessionReady.event; }

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@INotificationService private _notificationService: INotificationService
	) {
		this._queryInfoMap = new Map<string, QueryInfo>();
		this._onRunQueryStart = new Emitter<string>();
		this._onRunQueryUpdate = new Emitter<string>();
		this._onRunQueryComplete = new Emitter<string>();
		this._onQueryEvent = new Emitter<IQueryEvent>();
		this._onEditSessionReady = new Emitter<azdata.EditSessionReadyParams>();
	}

	// IQUERYMODEL /////////////////////////////////////////////////////////
	public getDataService(uri: string): DataService {
		let dataService = this._getQueryInfo(uri).dataService;
		if (!dataService) {
			throw new Error('Could not find data service for uri: ' + uri);
		}

		return dataService;
	}

	/**
	 * Force all grids to re-render. This is needed to re-render the grids when switching
	 * between different URIs.
	 */
	public refreshResultsets(uri: string): void {
		this._fireGridContentEvent(uri, GridContentEvents.RefreshContents);
	}

	/**
	 * Resize the grid UI to fit the current screen size.
	 */
	public resizeResultsets(uri: string): void {
		this._fireGridContentEvent(uri, GridContentEvents.ResizeContents);
	}

	public sendGridContentEvent(uri: string, eventName: string): void {
		this._fireGridContentEvent(uri, eventName);
	}

	/**
	 * To be called by an angular component's DataService when the component has finished loading.
	 * Sends all previously enqueued query events to the DataService and signals to stop enqueuing
	 * any further events. This prevents QueryEvents from getting lost if they are sent before
	 * angular is listening for them.
	 */
	public onAngularLoaded(uri: string) {
		let info = this._getQueryInfo(uri);
		info.dataServiceReady = true;
		this._sendQueuedEvents(uri);
	}

	/**
	 * Get more data rows from the current resultSets from the service layer
	 */
	public getQueryRows(uri: string, rowStart: number, numberOfRows: number, batchId: number, resultId: number): Thenable<azdata.ResultSetSubset> {
		return this._getQueryInfo(uri).queryRunner.getQueryRows(rowStart, numberOfRows, batchId, resultId).then(results => {
			return results.resultSubset;
		});
	}

	public getEditRows(uri: string, rowStart: number, numberOfRows: number): Thenable<azdata.EditSubsetResult> {
		return this._queryInfoMap.get(uri).queryRunner.getEditRows(rowStart, numberOfRows).then(results => {
			return results;
		});
	}

	public getConfig(): Promise<{ [key: string]: any }> {
		return undefined;
	}

	public getShortcuts(): Promise<any> {
		return undefined;
	}

	public copyResults(uri: string, selection: Slick.Range[], batchId: number, resultId: number, includeHeaders?: boolean): void {
		this._queryInfoMap.get(uri).queryRunner.copyResults(selection, batchId, resultId, includeHeaders);
	}

	public setEditorSelection(uri: string, index: number): void {
		let info: QueryInfo = this._queryInfoMap.get(uri);
		if (info && info.queryInput) {
			info.queryInput.updateSelection(info.selection[index]);
		}
	}

	public showWarning(uri: string, message: string): void {
	}

	public showError(uri: string, message: string): void {
	}

	public showCommitError(error: string): void {
		this._notificationService.notify({
			severity: Severity.Error,
			message: nls.localize('commitEditFailed', "Commit row failed: ") + error
		});
	}

	public isRunningQuery(uri: string): boolean {
		return !this._queryInfoMap.has(uri)
			? false
			: this._getQueryInfo(uri).queryRunner.isExecuting;
	}

	/**
	 * Run a query for the given URI with the given text selection
	 */
	public runQuery(uri: string, selection: azdata.ISelectionData, queryInput: QueryInput, runOptions?: azdata.ExecutionPlanOptions): void {
		this.doRunQuery(uri, selection, queryInput, false, runOptions);
	}

	/**
	 * Run the current SQL statement for the given URI
	 */
	public runQueryStatement(uri: string, selection: azdata.ISelectionData, queryInput: QueryInput): void {
		this.doRunQuery(uri, selection, queryInput, true);
	}

	/**
	 * Run the current SQL statement for the given URI
	 */
	public runQueryString(uri: string, selection: string, queryInput: QueryInput): void {
		this.doRunQuery(uri, selection, queryInput, true);
	}

	/**
	 * Run Query implementation
	 */
	private doRunQuery(uri: string, selection: azdata.ISelectionData | string, queryInput: QueryInput,
		runCurrentStatement: boolean, runOptions?: azdata.ExecutionPlanOptions): void {
		// Reuse existing query runner if it exists
		let queryRunner: QueryRunner;
		let info: QueryInfo;

		if (this._queryInfoMap.has(uri)) {
			info = this._getQueryInfo(uri);
			let existingRunner: QueryRunner = info.queryRunner;

			// If the query is already in progress, don't attempt to send it
			if (existingRunner.isExecuting) {
				return;
			}

			// If the query is not in progress, we can reuse the query runner
			queryRunner = existingRunner;
			info.selection = [];
			info.selectionSnippet = undefined;
		} else {
			// We do not have a query runner for this editor, so create a new one
			// and map it to the results uri
			info = this.initQueryRunner(uri);
			queryRunner = info.queryRunner;
		}

		info.queryInput = queryInput;

		if (types.isString(selection)) {
			// Run the query string in this case
			if (selection.length < selectionSnippetMaxLen) {
				info.selectionSnippet = selection;
			} else {
				info.selectionSnippet = selection.substring(0, selectionSnippetMaxLen - 3) + '...';
			}
			queryRunner.runQuery(selection, runOptions);
		} else if (runCurrentStatement) {
			queryRunner.runQueryStatement(selection);
		} else {
			queryRunner.runQuery(selection, runOptions);
		}
	}

	private initQueryRunner(uri: string): QueryInfo {
		let queryRunner = this._instantiationService.createInstance(QueryRunner, uri);
		let info = new QueryInfo();
		queryRunner.onResultSet(e => {
			this._fireQueryEvent(uri, 'resultSet', e);
		});
		queryRunner.onBatchStart(b => {
			let link = undefined;
			let messageText = LocalizedConstants.runQueryBatchStartMessage;
			if (b.selection) {
				if (info.selectionSnippet) {
					// This indicates it's a query string. Do not include line information since it'll be inaccurate, but show some of the
					// executed query text
					messageText = nls.localize('runQueryStringBatchStartMessage', "Started executing query \"{0}\"", info.selectionSnippet);
				} else {
					link = {
						text: strings.format(LocalizedConstants.runQueryBatchStartLine, b.selection.startLine + 1)
					};
				}
			}
			let message = {
				message: messageText,
				batchId: b.id,
				isError: false,
				time: new Date().toLocaleTimeString(),
				link: link
			};
			this._fireQueryEvent(uri, 'message', message);
			info.selection.push(this._validateSelection(b.selection));
		});
		queryRunner.onMessage(m => {
			this._fireQueryEvent(uri, 'message', m);
		});
		queryRunner.onQueryEnd(totalMilliseconds => {
			this._onRunQueryComplete.fire(uri);

			// fire extensibility API event
			let event: IQueryEvent = {
				type: 'queryStop',
				uri: uri,
				queryInfo:
				{
					selection: info.selection,
					messages: info.queryRunner.messages
				}
			};
			this._onQueryEvent.fire(event);

			// fire UI event
			this._fireQueryEvent(uri, 'complete', totalMilliseconds);
		});
		queryRunner.onQueryStart(() => {
			this._onRunQueryStart.fire(uri);

			// fire extensibility API event
			let event: IQueryEvent = {
				type: 'queryStart',
				uri: uri,
				queryInfo:
				{
					selection: info.selection,
					messages: info.queryRunner.messages
				}
			};
			this._onQueryEvent.fire(event);

			this._fireQueryEvent(uri, 'start');
		});
		queryRunner.onResultSetUpdate(() => {
			this._onRunQueryUpdate.fire(uri);

			let event: IQueryEvent = {
				type: 'queryUpdate',
				uri: uri,
				queryInfo:
				{
					selection: info.selection,
					messages: info.queryRunner.messages
				}
			};
			this._onQueryEvent.fire(event);

			this._fireQueryEvent(uri, 'update');
		});

		queryRunner.onQueryPlanAvailable(planInfo => {
			// fire extensibility API event
			let event: IQueryEvent = {
				type: 'executionPlan',
				uri: planInfo.fileUri,
				queryInfo:
				{
					selection: info.selection,
					messages: info.queryRunner.messages
				},
				params: planInfo
			};
			this._onQueryEvent.fire(event);
		});

		queryRunner.onVisualize(resultSetInfo => {
			let event: IQueryEvent = {
				type: 'visualize',
				uri: uri,
				queryInfo:
				{
					selection: info.selection,
					messages: info.queryRunner.messages
				},
				params: resultSetInfo
			};
			this._onQueryEvent.fire(event);
		});

		info.queryRunner = queryRunner;
		info.dataService = this._instantiationService.createInstance(DataService, uri);
		this._queryInfoMap.set(uri, info);
		return info;
	}

	public cancelQuery(input: QueryRunner | string): void {
		let queryRunner: QueryRunner;

		if (typeof input === 'string') {
			if (this._queryInfoMap.has(input)) {
				queryRunner = this._getQueryInfo(input).queryRunner;
			}
		} else {
			queryRunner = input;
		}

		if (queryRunner === undefined || !queryRunner.isExecuting) {
			// TODO: Cannot cancel query as no query is running.
			return;
		}

		// Switch the spinner to canceling, which will be reset when the query execute sends back its completed event
		// TODO indicate on the status bar that the query is being canceled

		// Cancel the query
		queryRunner.cancelQuery().then(success => undefined, error => {
			// On error, show error message and notify that the query is complete so that buttons and other status indicators
			// can be correct
			this._notificationService.notify({
				severity: Severity.Error,
				message: strings.format(LocalizedConstants.msgCancelQueryFailed, error)
			});
			this._fireQueryEvent(queryRunner.uri, 'complete', 0);
		});

	}

	public disposeQuery(ownerUri: string): void {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			queryRunner.disposeQuery();
		}
		// remove our info map
		if (this._queryInfoMap.has(ownerUri)) {
			this._queryInfoMap.delete(ownerUri);
		}
	}

	// EDIT DATA METHODS /////////////////////////////////////////////////////
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): void {
		// Reuse existing query runner if it exists
		let queryRunner: QueryRunner;
		let info: QueryInfo;

		if (this._queryInfoMap.has(ownerUri)) {
			info = this._getQueryInfo(ownerUri);
			let existingRunner: QueryRunner = info.queryRunner;

			// If the initialization is already in progress
			if (existingRunner.isExecuting) {
				return;
			}

			queryRunner = existingRunner;
		} else {
			info = new QueryInfo();

			// We do not have a query runner for this editor, so create a new one
			// and map it to the results uri
			queryRunner = this._instantiationService.createInstance(QueryRunner, ownerUri);
			const resultSetEventType = 'resultSet';
			queryRunner.onResultSet(resultSet => {
				this._fireQueryEvent(ownerUri, resultSetEventType, resultSet);
			});
			queryRunner.onResultSetUpdate(resultSetSummary => {
				this._fireQueryEvent(ownerUri, resultSetEventType, resultSetSummary);
			});
			queryRunner.onBatchStart(batch => {
				let link = undefined;
				let messageText = LocalizedConstants.runQueryBatchStartMessage;
				if (batch.selection) {
					if (info.selectionSnippet) {
						// This indicates it's a query string. Do not include line information since it'll be inaccurate, but show some of the
						// executed query text
						messageText = nls.localize('runQueryStringBatchStartMessage', "Started executing query \"{0}\"", info.selectionSnippet);
					} else {
						link = {
							text: strings.format(LocalizedConstants.runQueryBatchStartLine, batch.selection.startLine + 1)
						};
					}
				}
				let message = {
					message: messageText,
					batchId: batch.id,
					isError: false,
					time: new Date().toLocaleTimeString(),
					link: link
				};
				this._fireQueryEvent(ownerUri, 'message', message);
			});
			queryRunner.onMessage(message => {
				this._fireQueryEvent(ownerUri, 'message', message);
			});
			queryRunner.onQueryEnd(totalMilliseconds => {
				this._onRunQueryComplete.fire(ownerUri);
				// fire extensibility API event
				let event: IQueryEvent = {
					type: 'queryStop',
					uri: ownerUri,
					queryInfo:
					{
						selection: info.selection,
						messages: info.queryRunner.messages
					},
				};
				this._onQueryEvent.fire(event);

				// fire UI event
				this._fireQueryEvent(ownerUri, 'complete', totalMilliseconds);
			});
			queryRunner.onQueryStart(() => {
				this._onRunQueryStart.fire(ownerUri);
				// fire extensibility API event
				let event: IQueryEvent = {
					type: 'queryStart',
					uri: ownerUri,
					queryInfo:
					{
						selection: info.selection,
						messages: info.queryRunner.messages
					},
				};
				this._onQueryEvent.fire(event);

				// fire UI event
				this._fireQueryEvent(ownerUri, 'start');
			});
			queryRunner.onEditSessionReady(e => {
				this._onEditSessionReady.fire(e);
				this._fireQueryEvent(e.ownerUri, 'editSessionReady');
			});

			info.queryRunner = queryRunner;
			info.dataService = this._instantiationService.createInstance(DataService, ownerUri);
			this._queryInfoMap.set(ownerUri, info);
		}

		if (queryString) {
			if (queryString.length < selectionSnippetMaxLen) {
				info.selectionSnippet = queryString;
			} else {
				info.selectionSnippet = queryString.substring(0, selectionSnippetMaxLen - 3) + '...';
			}
		}

		queryRunner.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
	}

	public cancelInitializeEdit(input: QueryRunner | string): void {
		// TODO: Implement query cancellation service
	}

	public disposeEdit(ownerUri: string): Thenable<void> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.disposeEdit(ownerUri);
		}
		return Promise.resolve(null);
	}

	public updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.updateCell(ownerUri, rowId, columnId, newValue).then((result) => result, error => {
				this._notificationService.notify({
					severity: Severity.Error,
					message: nls.localize('updateCellFailed', "Update cell failed: ") + error.message
				});
				return Promise.reject(error);
			});
		}
		return Promise.resolve(null);
	}

	public commitEdit(ownerUri): Thenable<void> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.commitEdit(ownerUri).then(() => { }, error => {
				this._notificationService.notify({
					severity: Severity.Error,
					message: nls.localize('commitEditFailed', "Commit row failed: ") + error.message
				});
				return Promise.reject(error);
			});
		}
		return Promise.resolve(null);
	}

	public createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.createRow(ownerUri);
		}
		return Promise.resolve(null);
	}

	public deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.deleteRow(ownerUri, rowId);
		}
		return Promise.resolve(null);
	}

	public revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.revertCell(ownerUri, rowId, columnId);
		}
		return Promise.resolve(null);
	}

	public revertRow(ownerUri: string, rowId: number): Thenable<void> {
		// Get existing query runner
		let queryRunner = this.internalGetQueryRunner(ownerUri);
		if (queryRunner) {
			return queryRunner.revertRow(ownerUri, rowId);
		}
		return Promise.resolve(null);
	}

	public getQueryRunner(ownerUri): QueryRunner {
		let queryRunner: QueryRunner = undefined;
		if (this._queryInfoMap.has(ownerUri)) {
			queryRunner = this._getQueryInfo(ownerUri).queryRunner;
		}
		// return undefined if not found or is already executing
		return queryRunner;
	}

	// PRIVATE METHODS //////////////////////////////////////////////////////

	private internalGetQueryRunner(ownerUri): QueryRunner {
		let queryRunner: QueryRunner = undefined;
		if (this._queryInfoMap.has(ownerUri)) {
			let existingRunner = this._getQueryInfo(ownerUri).queryRunner;
			// If the query is not already executing then set it up
			if (!existingRunner.isExecuting) {
				queryRunner = this._getQueryInfo(ownerUri).queryRunner;
			}
		}
		// return undefined if not found or is already executing
		return queryRunner;
	}

	private _fireGridContentEvent(uri: string, type: string): void {
		let info: QueryInfo = this._getQueryInfo(uri);

		if (info && info.dataServiceReady) {
			let service: DataService = this.getDataService(uri);
			if (service) {
				// There is no need to queue up these events like there is for the query events because
				// if the DataService is not yet ready there will be no grid content to update
				service.gridContentObserver.next(type);
			}
		}
	}

	private _fireQueryEvent(uri: string, type: string, data?: any) {
		let info: QueryInfo = this._getQueryInfo(uri);

		if (info.dataServiceReady) {
			let service: DataService = this.getDataService(uri);
			service.queryEventObserver.next({
				type: type,
				data: data
			});
		} else {
			let queueItem: QueryEvent = { type: type, data: data };
			info.queryEventQueue.push(queueItem);
		}
	}

	private _sendQueuedEvents(uri: string): void {
		let info: QueryInfo = this._getQueryInfo(uri);
		while (info.queryEventQueue.length > 0) {
			let event: QueryEvent = info.queryEventQueue.shift();
			this._fireQueryEvent(uri, event.type, event.data);
		}
	}

	public _getQueryInfo(uri: string): QueryInfo {
		return this._queryInfoMap.get(uri);
	}

	// TODO remove this funciton and its usages when #821 in vscode-mssql is fixed and
	// the SqlToolsService version is updated in this repo - coquagli 4/19/2017
	private _validateSelection(selection: azdata.ISelectionData): azdata.ISelectionData {
		if (!selection) {
			selection = <azdata.ISelectionData>{};
		}
		selection.endColumn = selection ? Math.max(0, selection.endColumn) : 0;
		selection.endLine = selection ? Math.max(0, selection.endLine) : 0;
		selection.startColumn = selection ? Math.max(0, selection.startColumn) : 0;
		selection.startLine = selection ? Math.max(0, selection.startLine) : 0;
		return selection;
	}
}
