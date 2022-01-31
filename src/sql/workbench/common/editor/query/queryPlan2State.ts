/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { IDisposable } from 'vs/base/common/lifecycle';

export class QueryPlan2State implements IDisposable {
	graphs: azdata.ExecutionPlanGraph[] = [];
	dispose() {
		this.graphs = [];
	}
}
