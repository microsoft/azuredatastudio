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
import { PostgresComputeStoragePage } from './postgresComputeStoragePage';
import { PostgresConnectionStringsPage } from './postgresConnectionStringsPage';
import { PostgresBackupPage } from './postgresBackupPage';
import { PostgresPropertiesPage } from './postgresPropertiesPage';
import { PostgresNetworkingPage } from './postgresNetworkingPage';
import { Dashboard } from '../../components/dashboard';
import { PostgresDiagnoseAndSolveProblemsPage } from './postgresDiagnoseAndSolveProblemsPage';
import { PostgresSupportRequestPage } from './postgresSupportRequestPage';

export class PostgresDashboard extends Dashboard {
	constructor(private _context: vscode.ExtensionContext, private _controllerModel: ControllerModel, private _postgresModel: PostgresModel) {
		super(loc.postgresDashboard);
	}

	protected async registerTabs(modelView: azdata.ModelView): Promise<(azdata.DashboardTab | azdata.DashboardTabGroup)[]> {
		const overviewPage = new PostgresOverviewPage(modelView, this._controllerModel, this._postgresModel);
		const computeStoragePage = new PostgresComputeStoragePage(modelView);
		const connectionStringsPage = new PostgresConnectionStringsPage(modelView, this._postgresModel);
		const backupPage = new PostgresBackupPage(modelView);
		const propertiesPage = new PostgresPropertiesPage(modelView, this._controllerModel, this._postgresModel);
		const networkingPage = new PostgresNetworkingPage(modelView);
		const diagnoseAndSolveProblemsPage = new PostgresDiagnoseAndSolveProblemsPage(modelView, this._context, this._postgresModel);
		const supportRequestPage = new PostgresSupportRequestPage(modelView, this._controllerModel, this._postgresModel);

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
			},
			{
				title: loc.supportAndTroubleshooting,
				tabs: [
					diagnoseAndSolveProblemsPage.tab,
					supportRequestPage.tab
				]
			}
		];
	}
}
