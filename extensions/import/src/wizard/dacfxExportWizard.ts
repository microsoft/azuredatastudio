/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { ExportConfigPage } from './pages/exportConfigPage';
import { ImportDataModel } from './api/models';
import { SqlOpsDataClient } from 'dataprotocol-client';

const localize = nls.loadMessageBundle();

export class DacFxExportWizard {
	private wizard: sqlops.window.modelviewdialog.Wizard;
	private connection: sqlops.connection.Connection;
	private connectionstring: string;

	constructor() {
	}

	public async start(p: any, ...args: any[]) {
		let model = <ImportDataModel>{};

		let profile = <sqlops.IConnectionProfile>p.connectionProfile;
		if (profile) {
			model.serverId = profile.id;
			model.database = profile.databaseName;
		}

		this.connection = await sqlops.connection.getCurrentConnection();
		if (!this.connection) {
			vscode.window.showErrorMessage(localize('import.needConnection', 'Please connect to a server before using this wizard.'));
			return;
		}

		this.connectionstring = await this.getConnectionString(model.database);
		this.wizard = sqlops.window.modelviewdialog.createWizard('Export Data-tier Application Wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxExport.page1Name', 'Specify database'));

		let exportConfigPage: ExportConfigPage;

		page1.registerContent(async (view) => {
			exportConfigPage = new ExportConfigPage(this, page1, model, view);
			await exportConfigPage.start().then(() => {
				exportConfigPage.setupNavigationValidator();
				exportConfigPage.onPageEnter();
			});
		});

		this.wizard.pages = [page1];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.doneButton.label = "Export";
		this.wizard.doneButton.onClick(async () => await this.export(this.connectionstring));
		this.wizard.open();
	}

	private async getConnectionString(database: string) {
		let connectionstring = await sqlops.connection.getConnectionString(this.connection.connectionId, true);
		let splitted = connectionstring.split(';');

		// set datbase to appropriate value instead of master
		let temp = splitted.find(s => s.startsWith('Initial Catalog'));
		splitted[splitted.indexOf(temp)] = 'Initial Catalog=' + database;

		return splitted.join(';');
	}

	private async export(connectionstring: string) {
		let service = await DacFxExportWizard.getService();
		let result = await service.exportBacpac(connectionstring);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.saveErrorMessage', "Export failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	public static async getService(): Promise<sqlops.DacFxServicesProvider> {
		let currentConnection = await sqlops.connection.getCurrentConnection();
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}
}





