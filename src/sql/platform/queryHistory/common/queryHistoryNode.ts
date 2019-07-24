/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from 'vs/base/common/uuid';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';


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

	constructor(
		public queryText: string,
		public connectionProfile: IConnectionProfile,
		public startTime: Date,
		public id: string = undefined) {
		this.database = connectionProfile ? connectionProfile.databaseName : '';
		this.id = this.id || generateUuid();
	}
}
