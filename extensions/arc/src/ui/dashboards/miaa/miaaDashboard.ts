/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Dashboard } from '../../components/dashboard';
import { MiaaDashboardOverviewPage } from './miaaDashboardOverviewPage';

export class MiaaDashboard extends Dashboard {

	constructor(title: string) {
		super(title);
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new MiaaDashboardOverviewPage(modelView);
		return [
			overviewPage.tab
		];
	}

}
