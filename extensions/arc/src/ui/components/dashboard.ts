/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export abstract class Dashboard {

	private dashboard!: azdata.window.ModelViewDashboard;

	constructor(protected title: string) { }

	public async showDashboard(): Promise<void> {
		this.dashboard = this.createDashboard();
		await this.dashboard.open();
	}

	protected createDashboard(): azdata.window.ModelViewDashboard {
		const dashboard = azdata.window.createModelViewDashboard(this.title);
		dashboard.registerTabs(async modelView => {
			return await this.registerTabs(modelView);
		});
		return dashboard;
	}

	protected abstract async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]>;
}
