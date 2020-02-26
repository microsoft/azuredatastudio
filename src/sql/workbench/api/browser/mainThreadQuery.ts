/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { SqlMainContext, MainThreadQueryShape, ExtHostQueryShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { Disposable, IDisposable, combinedDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { IResultMessage, IQueryService, IFetchResponse, IQueryProviderEvent, IResultSetSummary, ColumnType } from 'sql/platform/query/common/queryService';
import { values } from 'vs/base/common/collections';
import { URI } from 'vs/base/common/uri';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import type * as azdata from 'azdata';

interface QueryEvents {
	onQueryComplete: Emitter<IQueryProviderEvent>;
	onBatchStart: Emitter<IQueryProviderEvent>;
	onBatchComplete: Emitter<IQueryProviderEvent>;
	onResultSetAvailable: Emitter<IQueryProviderEvent & IResultSetSummary>;
	onResultSetUpdated: Emitter<IQueryProviderEvent & IResultSetSummary>;
	onMessage: Emitter<IQueryProviderEvent & { messages: IResultMessage | IResultMessage[] }>;
}

@extHostNamedCustomer(SqlMainContext.MainThreadQuery)
export class MainThreadQuery extends Disposable implements MainThreadQueryShape {

	private _proxy: ExtHostQueryShape;
	private readonly _queryEvents = new Map<number, QueryEvents>();
	private readonly _registrations = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IQueryService private readonly queryService: IQueryService,
		@IQueryManagementService private readonly queryManagementService: IQueryManagementService
	) {
		super();
		this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostQuery);
	}


	////#region query
	public async $registerProvider(providerId: string, handle: number): Promise<void> {
		const emitters = {
			onQueryComplete: new Emitter<IQueryProviderEvent>(),
			onBatchStart: new Emitter<IQueryProviderEvent>(),
			onBatchComplete: new Emitter<IQueryProviderEvent>(),
			onResultSetAvailable: new Emitter<IQueryProviderEvent & IResultSetSummary>(),
			onResultSetUpdated: new Emitter<IQueryProviderEvent & IResultSetSummary>(),
			onMessage: new Emitter<IQueryProviderEvent & { messages: IResultMessage | IResultMessage[] }>()
		};
		this._queryEvents.set(handle, emitters);
		const disposable = this.queryService.registerProvider({
			id: providerId,
			onMessage: emitters.onMessage.event,
			onQueryComplete: emitters.onQueryComplete.event,
			// onBatchStart: emitters.onBatchStart.event,
			// onBatchComplete: emitters.onBatchComplete.event,
			onResultSetAvailable: emitters.onResultSetAvailable.event,
			onResultSetUpdated: emitters.onResultSetUpdated.event,
			runQuery: (connectionId: string, file: URI): Promise<void> => {
				return this._proxy.$runQuery(handle, connectionId); // for now we consider the connection to be the file but we shouldn't
			},
			fetchSubset: async (connectionId: string, resultSetId: number, batchId: number, offset: number, count: number): Promise<IFetchResponse> => {
				const response = await this._proxy.$getQueryRows(handle, { batchIndex: batchId, rowsStartIndex: offset, rowsCount: count, resultSetIndex: resultSetId, ownerUri: connectionId });
				return { rowCount: response.resultSubset.rowCount, rows: response.resultSubset.rows };
			}
		});

		this._registrations.set(handle,
			combinedDisposable(
				disposable,
				...values(emitters),
				toDisposable(() => this._queryEvents.delete(handle))
			)
		);
	}

	public $onQueryComplete(handle: number, result: azdata.QueryExecuteCompleteNotificationResult): void {
		this._queryEvents.get(handle)?.onQueryComplete.fire({ connectionId: result.ownerUri });
	}

	public $onBatchStart(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		this._queryEvents.get(handle)?.onBatchStart.fire({ connectionId: batchInfo.ownerUri });
	}

	public $onBatchComplete(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		this._queryEvents.get(handle)?.onBatchComplete.fire({ connectionId: batchInfo.ownerUri });
	}

	public $onResultSetAvailable(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		this._queryEvents.get(handle)?.onResultSetAvailable.fire({
			connectionId: resultSetInfo.ownerUri,
			id: resultSetInfo.resultSetSummary.id,
			batchId: resultSetInfo.resultSetSummary.batchId,
			rowCount: resultSetInfo.resultSetSummary.rowCount,
			columns: resultSetInfo.resultSetSummary.columnInfo.map(c => ({ title: c.columnName, type: c.isXml ? ColumnType.XML : c.isJson ? ColumnType.JSON : ColumnType.UNKNOWN })),
			completed: resultSetInfo.resultSetSummary.complete
		});
	}

	public $onResultSetUpdated(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		this._queryEvents.get(handle)?.onResultSetUpdated.fire({
			connectionId: resultSetInfo.ownerUri,
			id: resultSetInfo.resultSetSummary.id,
			batchId: resultSetInfo.resultSetSummary.batchId,
			rowCount: resultSetInfo.resultSetSummary.rowCount,
			columns: resultSetInfo.resultSetSummary.columnInfo.map(c => ({ title: c.columnName, type: c.isXml ? ColumnType.XML : c.isJson ? ColumnType.JSON : ColumnType.UNKNOWN })),
			completed: resultSetInfo.resultSetSummary.complete
		});
	}

	public $onQueryMessage(messagesMap: [number, [string, azdata.IResultMessage[]][]][]): void {
		for (const [handle, messagesUris] of messagesMap) {
			for (const [uri, messages] of messagesUris) {
				this._queryEvents.get(handle)?.onMessage.fire({ connectionId: uri, messages: messages });
			}
		}
	}
	//#endregion query

	public async $unregisterProvider(handle: number): Promise<void> {
		const disposable = this._registrations.get(handle);
		if (disposable) {
			disposable.dispose();
			this._registrations.delete(handle);
		}
	}

	// Query Management handlers
	public $onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this.queryManagementService.onEditSessionReady(ownerUri, success, message);
	}
}
