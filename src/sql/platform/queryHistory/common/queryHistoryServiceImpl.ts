/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryHistoryService } from 'sql/platform/queryHistory/common/queryHistoryService.ts';

import { IQueryModelService, IQueryEvent } from 'sql/platform/query/common/queryModel';
import { IModelService } from 'vs/editor/common/services/modelService';
import { URI } from 'vs/base/common/uri';
import { Range } from 'vs/editor/common/core/range';
import { QueryHistoryInfo, QueryStatus } from 'sql/platform/queryHistory/common/queryHistoryInfo';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

/**
 * Service that collects the results of executed queries
 */
export class QueryHistoryService extends Disposable implements IQueryHistoryService {
	_serviceBrand: any;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _infos: QueryHistoryInfo[] = [];
	private _onInfosUpdated: Emitter<QueryHistoryInfo[]> = new Emitter<QueryHistoryInfo[]>();

	// EVENTS //////////////////////////////////////////////////////////////
	public get onInfosUpdated(): Event<QueryHistoryInfo[]> { return this._onInfosUpdated.event; }

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		@IQueryModelService _queryModelService: IQueryModelService,
		@IModelService _modelService: IModelService,
		@IConnectionManagementService _connectionManagementService: IConnectionManagementService
	) {
		super();

		this._register(_queryModelService.onQueryEvent((e: IQueryEvent) => {
			if (e.type === 'queryStop') {
				const uri: URI = URI.parse(e.uri);
				// VS Range is 1 based so offset values by 1. The endLine we get back from SqlToolsService is incremented
				// by 1 from the original input range sent in as well so take that into account and don't modify
				const text: string = _modelService.getModel(uri).getValueInRange(new Range(
					e.queryInfo.selection[0].startLine + 1,
					e.queryInfo.selection[0].startColumn + 1,
					e.queryInfo.selection[0].endLine,
					e.queryInfo.selection[0].endColumn + 1));

				const newInfo = new QueryHistoryInfo(text, _connectionManagementService.getConnectionProfile(e.uri), new Date(), QueryStatus.Succeeded);

				// icon as required (for now logic is if any message has error query has error)
				let error: boolean = false;
				e.queryInfo.messages.forEach(x => error = error || x.isError);
				if (error) {
					newInfo.status = QueryStatus.Failed;
				}

				// Append new node to beginning of array so the newest ones are at the top
				this._infos.unshift(newInfo);
				this._onInfosUpdated.fire(this._infos);
			}
		}));
	}

	/**
	 * Gets all the current query history infos
	 */
	public getQueryHistoryInfos(): QueryHistoryInfo[] {
		return this._infos;
	}

	/**
	 * Deletes infos from the cache with the same ID as the given QueryHistoryInfo
	 * @param info TheQueryHistoryInfo to delete
	 */
	public deleteQueryHistoryInfo(info: QueryHistoryInfo) {
		this._infos = this._infos.filter(i => i.id !== info.id);
		this._onInfosUpdated.fire(this._infos);
	}

	/**
	 * Method to force initialization of the service so that it can start tracking query events
	 */
	public start(): void {

	}
}
