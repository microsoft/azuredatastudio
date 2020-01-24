/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from 'vs/base/common/uuid';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

export enum QueryStatus {
	Succeeded = 0,
	Failed = 1,
	Nothing = 2
}

/**
 * Contains information about a query that was ran
 */
export class QueryHistoryInfo {

	public database: string;

	public status: QueryStatus;

	public readonly id = generateUuid();

	constructor(
		public queryText: string,
		public connectionProfile: IConnectionProfile,
		public startTime: Date,
		status?: QueryStatus) {
		this.database = connectionProfile ? connectionProfile.databaseName : '';
		this.status = status;
	}
}
