/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';

/**
 * This class holds the view and the graphs of the execution plans
 *  displayed in the results tab of a query editor
 */
export class ExecutionPlanState {

	private _graphs: azdata.executionPlan.ExecutionPlanGraph[] = [];
	public executionPlanFileViewUUID: string;

	public get graphs(): azdata.executionPlan.ExecutionPlanGraph[] {
		return this._graphs;
	}

	public set graphs(v: azdata.executionPlan.ExecutionPlanGraph[]) {
		this._graphs = v;
	}
}
