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
	private exportConfigPage: ExportConfigPage;
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

		this.wizard = sqlops.window.modelviewdialog.createWizard('Export Data-tier Application Wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxExport.page1Name', 'Specify database'));

		page1.registerContent(async (view) => {
			this.exportConfigPage = new ExportConfigPage(this, page1, model, view);
			await this.exportConfigPage.start().then(() => {
				this.exportConfigPage.setupNavigationValidator();
				this.exportConfigPage.onPageEnter();
			});
		});

		this.wizard.pages = [page1];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.doneButton.label = "Export";
		this.wizard.doneButton.onClick(async () => await this.export());
		this.wizard.open();
	}

	private async export() {
		let connectionstring = await this.exportConfigPage.getConnectionString();
		let packageFileName = this.exportConfigPage.getFilePath();
		let service = await DacFxExportWizard.getService();
		let result = await service.exportBacpac(connectionstring, packageFileName);
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





