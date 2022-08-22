/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { IQueryInfo } from 'sql/workbench/services/query/common/queryModel';
import * as typeConverters from 'vs/workbench/api/common/extHostTypeConverters';

export namespace QueryInfo {

	export function to(queryInfo: IQueryInfo | undefined): azdata.queryeditor.QueryInfo | undefined {
		if (!queryInfo) {
			return undefined;
		}
		return {
			messages: queryInfo.messages,
			batchRanges: queryInfo.batchRanges.map(r => typeConverters.Range.to(r))
		};
	}
}
