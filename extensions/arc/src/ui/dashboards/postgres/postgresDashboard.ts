/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { PostgresOverviewPage } from './postgresOverviewPage';
import { PostgresConnectionStringsPage } from './postgresConnectionStringsPage';
import { PostgresPropertiesPage } from './postgresPropertiesPage';
import { Dashboard } from '../../components/dashboard';
import { PostgresDiagnoseAndSolveProblemsPage } from './postgresDiagnoseAndSolveProblemsPage';
import { PostgresSupportRequestPage } from './postgresSupportRequestPage';
import { PostgresResourceHealthPage } from './postgresResourceHealthPage';

export class PostgresDashboard extends Dashboard {
	constructor(private _context: vscode.ExtensionContext, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(loc.postgresDashboard);
	}

	public async showDashboard(): Promise<void> {
		await super.showDashboard();

		// Kick off the model refresh but don't wait on it since that's all handled with callbacks anyways
		this._controllerModel.refresh().catch(err => console.log(`Error refreshing controller model for Postgres dashboard ${err}`));
		this._postgresModel.refresh().catch(err => console.log(`Error refreshing Postgres model for Postgres dashboard ${err}`));
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new PostgresOverviewPage(modelView, this._controllerModel, this._postgresModel);
		const connectionStringsPage = new PostgresConnectionStringsPage(modelView, this._postgresModel);
		const propertiesPage = new PostgresPropertiesPage(modelView, this._controllerModel, this._postgresModel);
		const resourceHealthPage = new PostgresResourceHealthPage(modelView, this._postgresModel);
		const diagnoseAndSolveProblemsPage = new PostgresDiagnoseAndSolveProblemsPage(modelView, this._context, this._postgresModel);
		const supportRequestPage = new PostgresSupportRequestPage(modelView, this._controllerModel, this._postgresModel);

		return [
			overviewPage.tab,
			{
				title: loc.settings,
				tabs: [
					connectionStringsPage.tab,
					propertiesPage.tab
				]
			},
			{
				title: loc.supportAndTroubleshooting,
				tabs: [
					resourceHealthPage.tab,
					diagnoseAndSolveProblemsPage.tab,
					supportRequestPage.tab
				]
			}
		];
	}
}
