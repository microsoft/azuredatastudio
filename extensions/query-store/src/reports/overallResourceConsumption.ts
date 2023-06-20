/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { BaseQueryStoreReport } from './baseQueryStoreReport';
import { createOneComponentFlexContainer, createTwoComponentFlexContainer } from '../common/utils';


export class OverallResourceConsumption extends BaseQueryStoreReport {
	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.overallResourceConsumption, constants.overallResourceConsumptionToolbarLabel(databaseName), false, extensionContext);
	}

	public override async open(): Promise<void> {
		await super.open();
	}

	public override async createTopSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const durationComponent = view.modelBuilder.text().withProps({
			value: 'Duration'
		}).component();
		const leftContainer = await createOneComponentFlexContainer(view, durationComponent, 'chartreuse');

		const executionCountComponent = view.modelBuilder.text().withProps({
			value: 'Execution Count'
		}).component();

		const rightContainer = await createOneComponentFlexContainer(view, executionCountComponent, 'coral');

		return createTwoComponentFlexContainer(view, leftContainer, rightContainer, 'row');
	}

	public override async createBottomSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const cpuTimeComponent = view.modelBuilder.text().withProps({
			value: 'CPU Time'
		}).component();
		const leftContainer = await createOneComponentFlexContainer(view, cpuTimeComponent, 'darkturquoise');

		const logicalReadsComponent = view.modelBuilder.text().withProps({
			value: 'Logical Reads'
		}).component();

		const rightContainer = await createOneComponentFlexContainer(view, logicalReadsComponent, 'forestgreen');

		return createTwoComponentFlexContainer(view, leftContainer, rightContainer, 'row');
	}
}
