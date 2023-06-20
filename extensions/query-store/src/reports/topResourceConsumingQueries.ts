/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { QueryStoreReport } from './common/queryStoreReport';
import { createOneComponentFlexContainer, createTwoComponentHorizontalFlexContainer } from './common/utils';


export class TopResourceConsumingQueries extends QueryStoreReport {
	constructor(extensionContext: vscode.ExtensionContext) {
		super('Top Resource Consuming Queries', 'Top 25 resource consumers for database WideWorldImporters', extensionContext);
	}

	public override async open(): Promise<void> {
		await super.open();
	}

	public override async createTopSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const leftComponent = view.modelBuilder.text().withProps({
			value: 'left'
		}).component();
		const leftContainer = await createOneComponentFlexContainer(view, leftComponent, 'chartreuse');

		const rightComponent = view.modelBuilder.text().withProps({
			value: 'right'
		}).component();

		const rightContainer = await createOneComponentFlexContainer(view, rightComponent, 'coral');

		return createTwoComponentHorizontalFlexContainer(view, leftContainer, rightContainer);
	}

	public override async createBottomSection(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const bottomText = view.modelBuilder.text().withProps({
			value: 'bottom'
		}).component();

		return createOneComponentFlexContainer(view, bottomText, 'darkturquoise');
	}
}
