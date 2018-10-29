/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { ExportConfigPage } from './pages/exportConfigPage';
import { DacFxDataModel } from './api/models';
import { ExportSummaryPage } from './pages/exportSummaryPage';
import { DacFxExportPage } from './api/dacFxExportPage';

const localize = nls.loadMessageBundle();

export class DacFxExportWizard {
	private wizard: sqlops.window.modelviewdialog.Wizard;
	private connection: sqlops.connection.Connection;
	private exportConfigPage: ExportConfigPage;
	private summaryPage: ExportSummaryPage;
	private model: DacFxDataModel;

	constructor() {
	}

	public async start(p: any, ...args: any[]) {
		this.model = <DacFxDataModel>{};
		let pages: Map<number, DacFxExportPage> = new Map<number, DacFxExportPage>();

		let profile = <sqlops.IConnectionProfile>p.connectionProfile;
		if (profile) {
			this.model.serverId = profile.id;
			this.model.databaseName = profile.databaseName;
		}

		this.connection = await sqlops.connection.getCurrentConnection();
		if (!this.connection) {
			vscode.window.showErrorMessage(localize('dacFxExport.needConnection', 'Please connect to a server before using this wizard.'));
			return;
		}

		this.wizard = sqlops.window.modelviewdialog.createWizard('Export Data-tier Application Wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxExport.page1Name', 'Specify database'));
		let page2 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxExport.page2Name', 'Summary'));

		page1.registerContent(async (view) => {
			this.exportConfigPage = new ExportConfigPage(this, page1, this.model, view);
			pages.set(0, this.exportConfigPage);
			await this.exportConfigPage.start().then(() => {
				this.exportConfigPage.setupNavigationValidator();
				this.exportConfigPage.onPageEnter();
			});
		});

		page2.registerContent(async (view) => {
			this.summaryPage = new ExportSummaryPage(this, page2, this.model, view, this.exportConfigPage);
			pages.set(1, this.summaryPage);
			await this.summaryPage.start();
		});

		this.wizard.onPageChanged(async (event) => {
			let idx = event.newPage;

			let page = pages.get(idx);

			if (page) {
				page.setupNavigationValidator();
				page.onPageEnter();
			}
		});

		this.wizard.onPageChanged(async (event) => {
			let idx = event.lastPage;

			let page = pages.get(idx);
			if (page) {
				page.onPageLeave();
			}
		});

		this.wizard.pages = [page1, page2];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.doneButton.label = localize('dacFxExport.exportButton', 'Export');
		this.wizard.doneButton.onClick(async () => await this.export());
		this.wizard.open();
	}

	private async export() {
		let connectionstring = await this.getConnectionString();
		let packageFileName = this.model.filePath;
		let service = await DacFxExportWizard.getService();
		let result = await service.exportBacpac(connectionstring, packageFileName);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.saveErrorMessage', "Export failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		} else {
			vscode.window.showInformationMessage(
				localize('alertData.saveInfoMessage', "Export {0} succeeded", packageFileName));
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

	private async getConnectionString(): Promise<string> {
		let connectionstring = await sqlops.connection.getConnectionString(this.model.serverConnection.connectionId, true);
		let splitted = connectionstring.split(';');

		// set datbase to appropriate value instead of master
		let temp = splitted.find(s => s.startsWith('Initial Catalog'));
		splitted[splitted.indexOf(temp)] = 'Initial Catalog=' + this.model.databaseName;

		return splitted.join(';');
	}
}





