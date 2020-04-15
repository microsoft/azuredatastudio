/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { DashboardPage } from '../../components/dashboardPage';
import { IconPathHelper } from '../../../constants';

export class MiaaDashboardOverviewPage extends DashboardPage {

	constructor(modelView: azdata.ModelView) {
		super(modelView);
	}

	public get title(): string {
		return loc.overview;
	}

	public get id(): string {
		return 'miaa-overview';
	}

	public get container(): azdata.Component {
		return this.modelView.modelBuilder.text().withProperties<azdata.TextComponentProperties>({ value: 'This is a test' }).component();
	}

	public get toolbarContainer(): azdata.ToolbarContainer {
		// Create New button
		const createNewButton = this.modelView.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: loc.createNew,
			iconPath: IconPathHelper.add
		}).component();

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: createNewButton }
			]
		).component();
	}

}
