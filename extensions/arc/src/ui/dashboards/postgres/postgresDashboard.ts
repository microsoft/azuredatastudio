/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ControllerModel } from '../../../models/controllerModel';
import { DatabaseModel } from '../../../models/databaseModel';
import { OverviewTab } from './tabs/overviewTab';
import { ComputeStorageTab } from './tabs/computeStorageTab';
import { ConnectionStringsTab } from './tabs/connectionStringsTab';
import { BackupTab } from './tabs/backupTab';
import { PropertiesTab } from './tabs/propertiesTab';
import { NetworkingTab } from './tabs/networkingTab';
import { Dashboard } from '../../components/dashboard';

export class PostgresDashboard extends Dashboard {
	private _overviewTab: OverviewTab;
	private _computeStorageTab: ComputeStorageTab;
	private _connectionStringsTab: ComputeStorageTab;
	private _backupTab: BackupTab;
	private _propertiesTab: PropertiesTab;
	private _networkingTab: NetworkingTab;

	constructor(title: string, private _controllerModel: ControllerModel, private _databaseModel: DatabaseModel) {
		super(title);
		this._overviewTab = new OverviewTab(_controllerModel, _databaseModel);
		this._computeStorageTab = new ComputeStorageTab(_controllerModel, _databaseModel);
		this._connectionStringsTab = new ConnectionStringsTab(_controllerModel, _databaseModel);
		this._backupTab = new BackupTab(_controllerModel, _databaseModel);
		this._propertiesTab = new PropertiesTab(_controllerModel, _databaseModel);
		this._networkingTab = new NetworkingTab(_controllerModel, _databaseModel);
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		await Promise.all([this._controllerModel.refresh(), this._databaseModel.refresh()]);
		return [
			await this._overviewTab.tab(modelView),
			{
				title: 'Settings',
				tabs: [
					await this._computeStorageTab.tab(modelView),
					await this._connectionStringsTab.tab(modelView),
					await this._backupTab.tab(modelView),
					await this._propertiesTab.tab(modelView)
				]
			}, {
				title: 'Security',
				tabs: [
					await this._networkingTab.tab(modelView)
				]
			}
		];
	}
}
