/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { BaseQueryStoreReport } from './baseQueryStoreReport';
import { createOneComponentFlexContainer, createTwoComponentHorizontalFlexContainer } from '../common/utils';


export class OverallResourceConsumption extends BaseQueryStoreReport {
	constructor(extensionContext: vscode.ExtensionContext, databaseName: string) {
		super(constants.overallResourceConsumption, constants.overallResourceConsumptionToolbarLabel(databaseName), extensionContext);
	}

	public override async open(): Promise<void> {
		await super.open();
	}

	public override async createTopSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const leftComponent = view.modelBuilder.text().withProps({
			value: 'topLeft'
		}).component();
		const leftContainer = await createOneComponentFlexContainer(view, leftComponent, 'chartreuse');

		const rightComponent = view.modelBuilder.text().withProps({
			value: 'topRight'
		}).component();

		const rightContainer = await createOneComponentFlexContainer(view, rightComponent, 'coral');

		return createTwoComponentHorizontalFlexContainer(view, leftContainer, rightContainer);
	}

	public override async createBottomSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const leftComponent = view.modelBuilder.text().withProps({
			value: 'bottomLeft'
		}).component();
		const leftContainer = await createOneComponentFlexContainer(view, leftComponent, 'darkturquoise');

		const rightComponent = view.modelBuilder.text().withProps({
			value: 'bottomRight'
		}).component();

		const rightContainer = await createOneComponentFlexContainer(view, rightComponent, 'forestgreen');

		return createTwoComponentHorizontalFlexContainer(view, leftContainer, rightContainer);
	}
}
