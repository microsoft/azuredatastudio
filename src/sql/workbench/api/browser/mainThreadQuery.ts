/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { SqlMainContext, MainThreadQueryShape, ExtHostQueryShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { Disposable, IDisposable, combinedDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { IResultMessage, IQueryService, IFetchResponse } from 'sql/platform/query/common/queryService';
import { values } from 'vs/base/common/collections';
import { URI } from 'vs/base/common/uri';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import type * as azdata from 'azdata';

interface QueryEvents {
	onQueryComplete: Emitter<void>;
	onBatchStart: Emitter<void>;
	onBatchComplete: Emitter<void>;
	onResultSetAvailable: Emitter<void>;
	onResultSetUpdated: Emitter<void>;
	onMessage: Emitter<IResultMessage | IResultMessage[]>;
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
			onQueryComplete: new Emitter<void>(),
			onBatchStart: new Emitter<any>(),
			onBatchComplete: new Emitter<any>(),
			onResultSetAvailable: new Emitter<any>(),
			onResultSetUpdated: new Emitter<any>(),
			onMessage: new Emitter<IResultMessage>()
		};
		this._queryEvents.set(handle, emitters);
		const disposable = this.queryService.registerProvider({
			id: providerId,
			onMessage: emitters.onMessage.event,
			onQueryComplete: emitters.onQueryComplete.event,
			onBatchStart: emitters.onBatchStart.event,
			onBatchComplete: emitters.onBatchComplete.event,
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

	public $onQueryComplete(handle: number): void {
		this._queryEvents.get(handle)?.onQueryComplete.fire();
	}

	public $onBatchStart(handle: number): void {
		this._queryEvents.get(handle)?.onBatchStart.fire();
	}

	public $onBatchComplete(handle: number): void {
		this._queryEvents.get(handle)?.onBatchComplete.fire();
	}

	public $onResultSetAvailable(handle: number): void {
		this._queryEvents.get(handle)?.onResultSetAvailable.fire();
	}

	public $onResultSetUpdated(handle: number): void {
		this._queryEvents.get(handle)?.onResultSetUpdated.fire();
	}

	public $onQueryMessage(messagesMap: [number, azdata.QueryExecuteMessageParams[]][]): void {
		for (const [handle, messages] of messagesMap) {
			this._queryEvents.get(handle)?.onMessage.fire(messages.map(m => ({ message: m.message.message, isError: m.message.isError })));
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
