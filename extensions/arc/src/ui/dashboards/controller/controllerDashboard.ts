/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Dashboard } from '../../components/dashboard';
import { ControllerModel } from '../../../models/controllerModel';
import { ControllerDashboardOverviewPage } from './controllerDashboardOverviewPage';

export class ControllerDashboard extends Dashboard {

	constructor(title: string, private _controllerModel: ControllerModel) {
		super(title);
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new ControllerDashboardOverviewPage(modelView, this._controllerModel);
		return [
			overviewPage.tab
		];
	}

}
