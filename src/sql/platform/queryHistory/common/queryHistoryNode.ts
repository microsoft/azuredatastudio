/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from 'vs/base/common/uuid';


export class QueryHistoryNode {

	/**
	 * Does this node have children
	 */
	public hasChildren: boolean = false;

	/**
	 * Children of this node
	 */
	public children: QueryHistoryNode[];

	public success: boolean = true;

	constructor(
		public queryText: string,
		public connectionId: string,
		public startTime: Date,
		public id: string = undefined) {
		this.id = this.id || generateUuid();
	}
}
