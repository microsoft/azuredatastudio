/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';

export class QueryPlan2State {
	graphs: azdata.ExecutionPlanGraph[] = [];
	clearQueryPlan2State() {
		this.graphs = [];
	}
}
