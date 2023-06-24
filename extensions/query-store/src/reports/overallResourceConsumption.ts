/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { BaseQueryStoreReport } from './baseQueryStoreReport';
import { QueryStoreView } from './queryStoreView';


export class OverallResourceConsumption extends BaseQueryStoreReport {
	duration: QueryStoreView;
	execution: QueryStoreView;
	cpuTime: QueryStoreView;
	logicalReads: QueryStoreView;

	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.overallResourceConsumption, constants.overallResourceConsumptionToolbarLabel(databaseName), false, extensionContext);
		this.duration = new QueryStoreView('Duration', 'chartreuse');
		this.execution = new QueryStoreView('Execution Count', 'coral');
		this.cpuTime = new QueryStoreView('CPU Time', 'darkturquoise');
		this.logicalReads = new QueryStoreView('Logical Reads', 'forestgreen');
	}

	public override async createViews(view: azdata.ModelView): Promise<azdata.FlexContainer[]> {
		const durationContainer = await this.duration.createViewContainer(view);
		const executionCountContainer = await this.execution.createViewContainer(view);
		const cpuTimeContainer = await this.cpuTime.createViewContainer(view);
		const logicalReadsContainer = await this.logicalReads.createViewContainer(view);

		return [durationContainer, executionCountContainer, cpuTimeContainer, logicalReadsContainer];
	}
}
