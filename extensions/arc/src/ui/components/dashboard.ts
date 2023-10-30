/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export abstract class Dashboard {

	protected dashboard!: azdata.window.ModelViewDashboard;

	constructor(protected title: string, protected readonly name: string) { }

	public async showDashboard(): Promise<void> {
		this.dashboard = this.createDashboard();
		await this.dashboard.open();
	}

	public async closeDashboard(): Promise<void> {
		await this.dashboard.close();
	}

	protected createDashboard(): azdata.window.ModelViewDashboard {
		const dashboard = azdata.window.createModelViewDashboard(this.title, this.name);
		dashboard.registerTabs(async modelView => {
			return await this.registerTabs(modelView);
		});
		return dashboard;
	}

	protected abstract registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]>;
}
