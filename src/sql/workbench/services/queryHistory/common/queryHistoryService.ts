/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { QueryHistoryInfo } from 'sql/workbench/services/queryHistory/common/queryHistoryInfo';
import { Event } from 'vs/base/common/event';

export const SERVICE_ID = 'queryHistoryService';

export const IQueryHistoryService = createDecorator<IQueryHistoryService>(SERVICE_ID);

/**
 * Service that collects the results of executed queries
 */
export interface IQueryHistoryService {
	_serviceBrand: any;

	/**
	 * Event fired whenever the collection of stored QueryHistoryInfo's is updated
	 */
	onInfosUpdated: Event<QueryHistoryInfo[]>;
	/**
	 * Event fired whenever the Query History capture state has changed
	 */
	onQueryHistoryCaptureChanged: Event<boolean>;

	/**
	 * Whether Query History capture is currently enabled
	 */
	readonly captureEnabled: boolean;

	/**
	 * Gets the current list of Query History Info objects that have been collected
	 */
	getQueryHistoryInfos(): QueryHistoryInfo[];
	/**
	 * Deletes all QueryHistoryInfo's from the collection that have the same id as the specified one
	 * @param info The QueryHistoryInfo to delete
	 */
	deleteQueryHistoryInfo(info: QueryHistoryInfo): void;
	/**
	 * Clears all Query History - removing all collected items
	 */
	clearQueryHistory(): void;
	/**
	 * Toggles whether Query History capture is enabled
	 */
	toggleCaptureEnabled(): Promise<void>;
	/**
	 * Starts the Query History Service
	 */
	start(): void;
}
