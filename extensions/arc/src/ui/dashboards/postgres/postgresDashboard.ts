/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { PostgresOverviewPage } from './postgresOverviewPage';
import { PostgresConnectionStringsPage } from './postgresConnectionStringsPage';
import { Dashboard } from '../../components/dashboard';
import { PostgresSupportRequestPage } from './postgresSupportRequestPage';
import { PostgresComputeAndStoragePage } from './postgresComputeAndStoragePage';

export class PostgresDashboard extends Dashboard {
	constructor(private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(loc.postgresDashboard(_postgresModel.info.name), 'ArcPgDashboard');
	}

	public override async showDashboard(): Promise<void> {
		await super.showDashboard();

		// Kick off the model refresh but don't wait on it since that's all handled with callbacks anyways
		this._controllerModel.refresh(false, this._controllerModel.info.namespace).catch(err => console.log(`Error refreshing controller model for Postgres dashboard ${err}`));
		this._postgresModel.refresh().catch(err => console.log(`Error refreshing Postgres model for Postgres dashboard ${err}`));
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new PostgresOverviewPage(modelView, this.dashboard, this._controllerModel, this._postgresModel);
		const connectionStringsPage = new PostgresConnectionStringsPage(modelView, this.dashboard, this._postgresModel);
		const computeAndStoragePage = new PostgresComputeAndStoragePage(modelView, this.dashboard, this._postgresModel);
		const supportRequestPage = new PostgresSupportRequestPage(modelView, this.dashboard, this._controllerModel, this._postgresModel);

		return [
			overviewPage.tab,
			{
				title: loc.settings,
				tabs: [
					connectionStringsPage.tab,
					computeAndStoragePage.tab
				]
			},
			{
				title: loc.supportAndTroubleshooting,
				tabs: [
					supportRequestPage.tab
				]
			}
		];
	}
}
