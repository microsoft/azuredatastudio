/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { QueryHistoryInfo } from 'sql/platform/queryHistory/common/queryHistoryInfo';
import { Event } from 'vs/base/common/event';

export const SERVICE_ID = 'queryHistoryService';

export const IQueryHistoryService = createDecorator<IQueryHistoryService>(SERVICE_ID);

/**
 * Service that collects the results of executed queries
 */
export interface IQueryHistoryService {
	_serviceBrand: any;

	onInfosUpdated: Event<QueryHistoryInfo[]>;

	getQueryHistoryInfos(): QueryHistoryInfo[];
	deleteQueryHistoryInfo(info: QueryHistoryInfo): void;
	start(): void;
}
