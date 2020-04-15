/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ControllerModel } from './models/controllerModel';
import { DatabaseModel } from './models/databaseModel';
import { OverviewTab } from './tabs/overviewTab';
import { ComputeStorageTab } from './tabs/computeStorageTab';
import { ConnectionStringsTab } from './tabs/connectionStringsTab';
import { BackupTab } from './tabs/backupTab';
import { PropertiesTab } from './tabs/propertiesTab';
import { NetworkingTab } from './tabs/networkingTab';

export class PostgresDashboard {
	private _overviewTab: OverviewTab;
	private _computeStorageTab: ComputeStorageTab;
	private _connectionStringsTab: ComputeStorageTab;
	private _backupTab: BackupTab;
	private _propertiesTab: PropertiesTab;
	private _networkingTab: NetworkingTab;

	constructor(private _controllerModel: ControllerModel, private _databaseModel: DatabaseModel) {
		this._overviewTab = new OverviewTab(_controllerModel, _databaseModel);
		this._computeStorageTab = new ComputeStorageTab(_controllerModel, _databaseModel);
		this._connectionStringsTab = new ConnectionStringsTab(_controllerModel, _databaseModel);
		this._backupTab = new BackupTab(_controllerModel, _databaseModel);
		this._propertiesTab = new PropertiesTab(_controllerModel, _databaseModel);
		this._networkingTab = new NetworkingTab(_controllerModel, _databaseModel);
	}

	public async dashboard(view: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		//
		await Promise.all([this._controllerModel.refresh(), this._databaseModel.refresh()]);
		return [
			await this._overviewTab.tab(view),
			{
				title: 'Settings',
				tabs: [
					await this._computeStorageTab.tab(view),
					await this._connectionStringsTab.tab(view),
					await this._backupTab.tab(view),
					await this._propertiesTab.tab(view)
				]
			}, {
				title: 'Security',
				tabs: [
					await this._networkingTab.tab(view)
				]
			}
		];
	}
}
