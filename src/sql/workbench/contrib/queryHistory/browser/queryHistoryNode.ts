/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryHistoryInfo } from 'sql/workbench/services/queryHistory/common/queryHistoryInfo';

/**
 * Wrapper around a QueryHistoryInfo for displaying in the panel TreeView
 */
export class QueryHistoryNode {

	public hasChildren: boolean = false;

	public children: QueryHistoryNode[] = [];

	constructor(
		public info: QueryHistoryInfo) { }
}
