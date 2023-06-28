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
	private duration: QueryStoreView;
	private executionCount: QueryStoreView;
	private cpuTime: QueryStoreView;
	private logicalReads: QueryStoreView;

	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.overallResourceConsumption, constants.overallResourceConsumptionToolbarLabel(databaseName), /*resizeable*/ false, extensionContext);
		this.duration = new QueryStoreView(constants.duration, 'chartreuse');
		this.executionCount = new QueryStoreView(constants.executionCount, 'coral');
		this.cpuTime = new QueryStoreView(constants.cpuTime, 'darkturquoise');
		this.logicalReads = new QueryStoreView(constants.logicalReads, 'forestgreen');
	}

	public override async createViews(view: azdata.ModelView): Promise<azdata.FlexContainer[]> {
		const durationContainer = await this.duration.createViewContainer(view);
		const executionCountContainer = await this.executionCount.createViewContainer(view);
		const cpuTimeContainer = await this.cpuTime.createViewContainer(view);
		const logicalReadsContainer = await this.logicalReads.createViewContainer(view);

		return [durationContainer, executionCountContainer, cpuTimeContainer, logicalReadsContainer];
	}
}
