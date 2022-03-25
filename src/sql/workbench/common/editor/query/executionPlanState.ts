/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';

export class ExecutionPlanState {
	graphs: azdata.executionPlan.ExecutionPlanGraph[] = [];
	clearExecutionPlanState() {
		this.graphs = [];
	}
}
