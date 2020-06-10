/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Dashboard } from '../../components/dashboard';
import { MiaaDashboardOverviewPage } from './miaaDashboardOverviewPage';
import { ControllerModel } from '../../../models/controllerModel';
import * as loc from '../../../localizedConstants';
import { MiaaConnectionStringsPage } from './miaaConnectionStringsPage';

export class MiaaDashboard extends Dashboard {

	constructor(private _controllerModel: ControllerModel) {
		super(loc.miaaDashboard);
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new MiaaDashboardOverviewPage(modelView, this._controllerModel);
		const connectionStringsPage = new MiaaConnectionStringsPage(modelView, this._controllerModel);
		return [
			overviewPage.tab,
			{
				title: loc.settings,
				tabs: [
					connectionStringsPage.tab
				]
			},
		];
	}

}
