/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Dashboard } from '../../components/dashboard';
import { ControllerModel } from '../../../models/controllerModel';
import { ControllerDashboardOverviewPage } from './controllerDashboardOverviewPage';
import * as loc from '../../../localizedConstants';

export class ControllerDashboard extends Dashboard {

	constructor(private _controllerModel: ControllerModel) {
		super(loc.arcControllerDashboard(_controllerModel.info.name), 'ArcDataControllerDashboard');
	}

	public override async showDashboard(): Promise<void> {
		await super.showDashboard();
		// Kick off the model refresh but don't wait on it since that's all handled with callbacks anyways
		this._controllerModel.refresh(false, this._controllerModel.info.namespace).catch(err => console.log(`Error refreshing Controller dashboard ${err}`));
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new ControllerDashboardOverviewPage(modelView, this.dashboard, this._controllerModel);
		return [
			overviewPage.tab
		];
	}

}
