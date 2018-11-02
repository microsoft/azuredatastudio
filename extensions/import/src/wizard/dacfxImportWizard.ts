/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { ImportConfigPage } from './pages/importConfigPage';
import { ImportSummaryPage } from './pages/importSummaryPage';
import { DacFxDataModel } from './api/models';
import { DacFxPage } from './api/dacFxPage';
import { DacFxWizard } from './dacfxWizard';

const localize = nls.loadMessageBundle();

export class DacFxImportWizard extends DacFxWizard {
	private wizard: sqlops.window.modelviewdialog.Wizard;
	private connection: sqlops.connection.Connection;
	private importConfigPage: ImportConfigPage;
	private summaryPage: ImportSummaryPage;
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
			vscode.window.showErrorMessage(localize('dacFxExport.needConnection', 'Please connect to a server before using this wizard.'));
			return;
		}

		this.wizard = sqlops.window.modelviewdialog.createWizard('Import Data-tier Application Wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxImport.page1Name', 'Import Settings'));
		let page2 = sqlops.window.modelviewdialog.createWizardPage(localize('dacFxImport.page2Name', 'Summary'));

		page1.registerContent(async (view) => {
			this.importConfigPage = new ImportConfigPage(this, page1, this.model, view);
			pages.set(0, this.importConfigPage);
			await this.importConfigPage.start().then(() => {
				this.importConfigPage.setupNavigationValidator();
				this.importConfigPage.onPageEnter();
			});
		});

		page2.registerContent(async (view) => {
			this.summaryPage = new ImportSummaryPage(this, page2, this.model, view);
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
		this.wizard.doneButton.label = localize('dacFxImport.importButton', 'Import');
		this.wizard.doneButton.onClick(async () => await this.import());
		this.wizard.open();
	}

	private async import() {
		let connectionstring = await await sqlops.connection.getConnectionString(this.model.serverConnection.connectionId, true);
		let packageFilePath = this.model.filePath;
		let targetDatabaseName = this.model.databaseName;
		let service = await DacFxImportWizard.getService();
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.serverConnection.connectionId);
		let result = await service.importBacpac(connectionstring, packageFilePath, targetDatabaseName, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.saveErrorMessage', "Import failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}
}





