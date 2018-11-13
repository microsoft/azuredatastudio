/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { ExtractConfigPage } from './pages/extractConfigPage';
import { DacFxDataModel } from './api/models';
import { ExtractSummaryPage } from './pages/extractSummaryPage';
import { DacFxPage } from './api/dacFxPage';
import { DacFxWizard } from './dacfxWizard';

const localize = nls.loadMessageBundle();

export class ExtractWizard extends DacFxWizard {
	private wizard: sqlops.window.modelviewdialog.Wizard;
	private connection: sqlops.connection.Connection;
	private extractConfigPage: ExtractConfigPage;
	private summaryPage: ExtractSummaryPage;
	private model: DacFxDataModel;

	constructor() {
		super();
	}

	public async start(p: any, ...args: any[]) {
		this.model = <DacFxDataModel>{};
		let pages: Map<number, DacFxPage> = new Map<number, DacFxPage>();

		let profile = p ? <sqlops.IConnectionProfile>p.connectionProfile : null;
		if (profile) {
			this.model.serverId = profile.id;
			this.model.databaseName = profile.databaseName;
		}

		this.connection = await sqlops.connection.getCurrentConnection();
		if (!this.connection) {
			vscode.window.showErrorMessage(localize('dacFxExtract.needConnection', 'Please connect to a server before using this wizard.'));
			return;
		}

		this.wizard = sqlops.window.modelviewdialog.createWizard('Extract Data-tier Application Wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxExtract.page1Name', 'Extract Settings'));
		let page2 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxExtract.page2Name', 'Summary'));

		page1.registerContent(async (view) => {
			this.extractConfigPage = new ExtractConfigPage(this, page1, this.model, view);
			pages.set(0, this.extractConfigPage);
			await this.extractConfigPage.start().then(() => {
				this.extractConfigPage.setupNavigationValidator();
				this.extractConfigPage.onPageEnter();
			});
		});

		page2.registerContent(async (view) => {
			this.summaryPage = new ExtractSummaryPage(this, page2, this.model, view);
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
		this.wizard.doneButton.label = localize('dacFxExtract.exptractButton', 'Extract');
		this.wizard.doneButton.onClick(async () => await this.extract());
		this.wizard.open();
	}

	private async extract() {
		let service = await ExtractWizard.getService();
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.serverConnection.connectionId);

		let result = await service.extractDacpac(this.model.databaseName, this.model.filePath, this.model.databaseName, this.model.version,ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.saveErrorMessage', "Extract failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
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





