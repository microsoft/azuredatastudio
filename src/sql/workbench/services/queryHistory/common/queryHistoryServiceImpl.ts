/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryService';

import { IQueryModelService, IQueryEvent } from 'sql/workbench/services/query/common/queryModel';
import { IModelService } from 'vs/editor/common/services/modelService';
import { URI } from 'vs/base/common/uri';
import { Range } from 'vs/editor/common/core/range';
import { QueryHistoryInfo, QueryStatus } from 'sql/workbench/services/queryHistory/common/queryHistoryInfo';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { find } from 'vs/base/common/arrays';

/**
 * Service that collects the results of executed queries
 */
export class QueryHistoryService extends Disposable implements IQueryHistoryService {
	_serviceBrand: any;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _infos: QueryHistoryInfo[] = [];
	private _onInfosUpdated: Emitter<QueryHistoryInfo[]> = new Emitter<QueryHistoryInfo[]>();
	private _onQueryHistoryCaptureChanged: Emitter<boolean> = new Emitter<boolean>();
	private _captureEnabled;
	// EVENTS //////////////////////////////////////////////////////////////
	public get onInfosUpdated(): Event<QueryHistoryInfo[]> { return this._onInfosUpdated.event; }
	public get onQueryHistoryCaptureChanged(): Event<boolean> { return this._onQueryHistoryCaptureChanged.event; }
	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		@IQueryModelService _queryModelService: IQueryModelService,
		@IModelService _modelService: IModelService,
		@IConnectionManagementService _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		super();

		this._captureEnabled = !!this._configurationService.getValue<boolean>('queryHistory.captureEnabled');

		this._register(this._configurationService.onDidChangeConfiguration((e: IConfigurationChangeEvent) => {
			if (find(e.affectedKeys, x => x === 'queryHistory.captureEnabled')) {
				this.updateCaptureEnabled();
			}
		}));

		this._register(_queryModelService.onQueryEvent((e: IQueryEvent) => {
			if (this._captureEnabled && e.type === 'queryStop') {
				const uri: URI = URI.parse(e.uri);
				// VS Range is 1 based so offset values by 1. The endLine we get back from SqlToolsService is incremented
				// by 1 from the original input range sent in as well so take that into account and don't modify
				const text: string = e.queryInfo.range && e.queryInfo.range.length > 0 ?
					_modelService.getModel(uri).getValueInRange(new Range(
						e.queryInfo.range[0].startLineNumber,
						e.queryInfo.range[0].startColumn,
						e.queryInfo.range[0].endLineNumber,
						e.queryInfo.range[0].endColumn)) :
					// If no specific selection get the entire text
					_modelService.getModel(uri).getValue();

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
	 * Whether Query History capture is currently enabled
	 */
	public get captureEnabled(): boolean {
		return this._captureEnabled;
	}

	/**
	 * Gets all the current query history infos
	 */
	public getQueryHistoryInfos(): QueryHistoryInfo[] {
		return this._infos;
	}

	/**
	 * Deletes infos from the cache with the same ID as the given QueryHistoryInfo
	 * @param info The QueryHistoryInfo to delete
	 */
	public deleteQueryHistoryInfo(info: QueryHistoryInfo): void {
		this._infos = this._infos.filter(i => i.id !== info.id);
		this._onInfosUpdated.fire(this._infos);
	}

	/**
	 * Clears all infos from the cache
	 */
	public clearQueryHistory(): void {
		this._infos = [];
		this._onInfosUpdated.fire(this._infos);
	}

	public async toggleCaptureEnabled(): Promise<void> {
		const captureEnabled = !!this._configurationService.getValue<boolean>('queryHistory.captureEnabled');
		await this._configurationService.updateValue('queryHistory.captureEnabled', !captureEnabled);
	}

	private updateCaptureEnabled(): void {
		const currentCaptureEnabled = this._captureEnabled;
		this._captureEnabled = !!this._configurationService.getValue<boolean>('queryHistory.captureEnabled');
		if (currentCaptureEnabled !== this._captureEnabled) {
			this._onQueryHistoryCaptureChanged.fire(this._captureEnabled);
		}
	}

	/**
	 * Method to force initialization of the service so that it can start tracking query events
	 */
	public start(): void {

	}
}
