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
import { MiaaModel } from '../../../models/miaaModel';
import { MiaaComputeAndStoragePage } from './miaaComputeAndStoragePage';

export class MiaaDashboard extends Dashboard {

	constructor(private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super(loc.miaaDashboard(_miaaModel.info.name), 'ArcMiaaDashboard');
	}

	public override async showDashboard(): Promise<void> {
		await super.showDashboard();
		// Kick off the model refreshes but don't wait on it since that's all handled with callbacks anyways
		this._controllerModel.refresh(false, this._controllerModel.info.namespace).catch(err => console.log(`Error refreshing controller model for MIAA dashboard ${err}`));
		this._miaaModel.refresh().catch(err => console.log(`Error refreshing MIAA model for MIAA dashboard ${err}`));
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new MiaaDashboardOverviewPage(modelView, this.dashboard, this._controllerModel, this._miaaModel);
		const connectionStringsPage = new MiaaConnectionStringsPage(modelView, this.dashboard, this._miaaModel);
		const computeAndStoragePage = new MiaaComputeAndStoragePage(modelView, this.dashboard, this._miaaModel);
		return [
			overviewPage.tab,
			{
				title: loc.settings,
				tabs: [
					connectionStringsPage.tab,
					computeAndStoragePage.tab
				]
			},
		];
	}

}
