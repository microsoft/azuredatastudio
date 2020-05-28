/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { PostgresOverviewPage } from './postgresOverviewPage';
import { PostgresComputeStoragePage } from './postgresComputeStoragePage';
import { PostgresConnectionStringsPage } from './postgresConnectionStringsPage';
import { PostgresBackupPage } from './postgresBackupPage';
import { PostgresPropertiesPage } from './postgresPropertiesPage';
import { PostgresNetworkingPage } from './postgresNetworkingPage';
import { Dashboard } from '../../components/dashboard';

export class PostgresDashboard extends Dashboard {
	constructor(title: string, private _controllerModel: ControllerModel, private _databaseModel: PostgresModel) {
		super(title);
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		await Promise.all([this._controllerModel.refresh(), this._databaseModel.refresh()]);

		const overviewPage = new PostgresOverviewPage(modelView, this._controllerModel, this._databaseModel);
		const computeStoragePage = new PostgresComputeStoragePage(modelView, this._controllerModel, this._databaseModel);
		const connectionStringsPage = new PostgresConnectionStringsPage(modelView, this._controllerModel, this._databaseModel);
		const backupPage = new PostgresBackupPage(modelView, this._controllerModel, this._databaseModel);
		const propertiesPage = new PostgresPropertiesPage(modelView, this._controllerModel, this._databaseModel);
		const networkingPage = new PostgresNetworkingPage(modelView, this._controllerModel, this._databaseModel);

		return [
			overviewPage.tab,
			{
				title: loc.settings,
				tabs: [
					computeStoragePage.tab,
					connectionStringsPage.tab,
					backupPage.tab,
					propertiesPage.tab
				]
			}, {
				title: loc.security,
				tabs: [
					networkingPage.tab
				]
			}
		];
	}
}
