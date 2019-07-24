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
export class QueryHistoryNode {

	/**
	 * Does this node have children
	 */
	public hasChildren: boolean = false;

	/**
	 * Children of this node
	 */
	public children: QueryHistoryNode[];

	public database: string;

	public status: QueryStatus;

	constructor(
		public queryText: string,
		public connectionProfile: IConnectionProfile,
		public startTime: Date,
		public id: string = undefined,
		status?: QueryStatus) {
		this.database = connectionProfile ? connectionProfile.databaseName : '';
		this.id = this.id || generateUuid();
		this.status = status;
	}
}
