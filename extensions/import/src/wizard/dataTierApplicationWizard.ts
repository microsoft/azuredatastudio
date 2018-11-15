/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { SelectOperationPage } from './pages/selectOperationpage';
import { DeployConfigPage } from './pages/deployConfigPage';
import { DeploySummaryPage } from './pages/deploySummaryPage';
import { ExportConfigPage } from './pages/exportConfigPage';
import { ExportSummaryPage } from './pages/exportSummaryPage';
import { ExtractConfigPage } from './pages/extractConfigPage';
import { ExtractSummaryPage } from './pages/extractSummaryPage';
import { ImportConfigPage } from './pages/importConfigPage';
import { ImportSummaryPage } from './pages/importSummaryPage';
import { DacFxDataModel } from './api/models';
import { DacFxPage } from './api/dacFxPage';

const localize = nls.loadMessageBundle();

class Page {
	wizardPage: sqlops.window.modelviewdialog.WizardPage;
	dacFxPage: DacFxPage;

	constructor(wizardPage: sqlops.window.modelviewdialog.WizardPage, dacFxPage: DacFxPage) {
		this.wizardPage = wizardPage;
		this.dacFxPage = dacFxPage;
	}
}

export enum Operation {
	deploy,
	extract,
	import,
	export
}

export class DataTierApplicationWizard {
	public wizard: sqlops.window.modelviewdialog.Wizard;
	private connection: sqlops.connection.Connection;
	private model: DacFxDataModel;
	public pages:  Map<number, Page> = new Map<number, Page>();
	private selectedOperation: Operation;

	constructor() {
	}

	public async start(p: any, ...args: any[]) {
		this.model = <DacFxDataModel>{};

		let profile = p ? <sqlops.IConnectionProfile>p.connectionProfile : null;
		if (profile) {
			this.model.serverId = profile.id;
			this.model.databaseName = profile.databaseName;
		}

		this.connection = await sqlops.connection.getCurrentConnection();
		if (!this.connection) {
			vscode.window.showErrorMessage(localize('dacFx.needConnection', 'Please connect to a server before using this wizard.'));
			return;
		}

		this.wizard = sqlops.window.modelviewdialog.createWizard('Data-tier Application Wizard');
		let selectOperationWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.selectOperationPageName', 'Select Operation'));
		let deployConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.deployConfigPageName', 'Deploy Settings'));
		let deploySummaryWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.deploySummaryPageName', 'Deploy Summary'));
		let extractConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.extractConfigPageName', 'Extract Settings'));
		let extractSummaryWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.extractSummaryPageName', 'Extract Summary'));
		let importConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.importConfigPageName', 'Import Settings'));
		let importSummaryWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.importSummaryPageName', 'Import Summary'));
		let exportConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.exportConfigPageName', 'Export Settings'));
		let exportSummaryWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.exportSummaryPageName', 'Export Summary'));

		console.error('starting wizard');

		selectOperationWizardPage.registerContent(async (view) => {
			let selectOperationDacFxPage = new SelectOperationPage(this, selectOperationWizardPage, this.model, view);
			console.error('registering select page');
			this.pages.set(0, new Page(selectOperationWizardPage, selectOperationDacFxPage));
			await selectOperationDacFxPage.start().then(() => {
				selectOperationDacFxPage.setupNavigationValidator();
				selectOperationDacFxPage.onPageEnter();
			});
		});

		deployConfigWizardPage.registerContent(async (view) => {
			let deployConfigDacFxPage = new DeployConfigPage(this, deployConfigWizardPage, this.model, view);
			console.error('registering deploy config page');
			this.pages.set(1, new Page(deployConfigWizardPage, deployConfigDacFxPage));
			await deployConfigDacFxPage.start().then(() => {
				deployConfigDacFxPage.setupNavigationValidator();
				deployConfigDacFxPage.onPageEnter();
			});
		});

		deploySummaryWizardPage.registerContent(async (view) => {
			let deploySummaryDacFxPage = new DeploySummaryPage(this, deploySummaryWizardPage, this.model, view);
			console.error('registering deploy config page');
			this.pages.set(2, new Page(deploySummaryWizardPage, deploySummaryDacFxPage));
			await deploySummaryDacFxPage.start();
		});

		extractConfigWizardPage.registerContent(async (view) => {
			let extractConfigDacFxPage = new ExtractConfigPage(this, extractConfigWizardPage, this.model, view);
			console.error('registering extract config page');
			this.pages.set(3, new Page(extractConfigWizardPage, extractConfigDacFxPage));
			await extractConfigDacFxPage.start().then(() => {
				extractConfigDacFxPage.setupNavigationValidator();
				extractConfigDacFxPage.onPageEnter();
			});
		});

		extractSummaryWizardPage.registerContent(async (view) => {
			let extractSummaryDacFxPage = new ExtractSummaryPage(this, extractSummaryWizardPage, this.model, view);
			console.error('registering extract config page');
			this.pages.set(4, new Page(extractSummaryWizardPage, extractSummaryDacFxPage));
			await extractSummaryDacFxPage.start();
		});

		importConfigWizardPage.registerContent(async (view) => {
			let importConfigDacFxPage = new ImportConfigPage(this, importConfigWizardPage, this.model, view);
			console.error('registering import config page');
			this.pages.set(5, new Page(importConfigWizardPage, importConfigDacFxPage));
			await importConfigDacFxPage.start().then(() => {
				importConfigDacFxPage.setupNavigationValidator();
				importConfigDacFxPage.onPageEnter();
			});
		});

		importSummaryWizardPage.registerContent(async (view) => {
			let importSummaryDacFxPage = new ImportSummaryPage(this, importSummaryWizardPage, this.model, view);
			console.error('registering import config page');
			this.pages.set(6, new Page(importSummaryWizardPage, importSummaryDacFxPage));
			await importSummaryDacFxPage.start();
		});

		exportConfigWizardPage.registerContent(async (view) => {
			let exportConfigDacFxPage = new ExportConfigPage(this, exportConfigWizardPage, this.model, view);
			console.error('registering export config page');
			this.pages.set(7, new Page(exportConfigWizardPage, exportConfigDacFxPage));
			await exportConfigDacFxPage.start().then(() => {
				exportConfigDacFxPage.setupNavigationValidator();
				exportConfigDacFxPage.onPageEnter();
			});
		});

		exportSummaryWizardPage.registerContent(async (view) => {
			let exportSummaryDacFxPage = new ExportSummaryPage(this, exportSummaryWizardPage, this.model, view);
			console.error('registering export config page');
			this.pages.set(8, new Page(exportSummaryWizardPage, exportSummaryDacFxPage));
			await exportSummaryDacFxPage.start();
		});

		this.wizard.onPageChanged(async (event) => {
			let idx = event.newPage;

			let page = this.pages.get(idx);

			// get appropriate summary page
			if(idx === 2)
			{
				console.error('getting appropriate summary page');
				switch(this.selectedOperation) {
					case Operation.deploy: {
						page = this.pages.get(2);
						break;
					}
					case Operation.extract: {
						page = this.pages.get(4);
						break;
					}
					case Operation.import: {
						page = this.pages.get(6);
						break;
					}
					case Operation.export: {
						page = this.pages.get(8);
						break;
					}
				}
			}

			if (page) {
				console.error('setting up page');
				page.dacFxPage.setupNavigationValidator();
				page.dacFxPage.onPageEnter();
			}
		});

		this.wizard.onPageChanged(async (event) => {
			let idx = event.lastPage;

			let page = this.pages.get(idx);
			if (page) {
				page.dacFxPage.onPageLeave();
			}
		});

		this.wizard.pages = [selectOperationWizardPage, deployConfigWizardPage, deploySummaryWizardPage, extractConfigWizardPage, extractSummaryWizardPage,
								importConfigWizardPage, importSummaryWizardPage, exportConfigWizardPage, exportSummaryWizardPage];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.doneButton.onClick(async () => await this.executeOperation());

		this.wizard.open();
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public setDoneButton(operation: Operation) : void {
		switch(operation) {
			case Operation.deploy: {
				this.wizard.doneButton.label = localize('dacFx.deployButton', 'Deploy');
				this.selectedOperation = Operation.deploy;
				break;
			}
			case Operation.extract: {
				this.wizard.doneButton.label = localize('dacFx.extractButton', 'Extract');
				this.selectedOperation = Operation.extract;
				break;
			}
			case Operation.import: {
				this.wizard.doneButton.label = localize('dacFx.importButton', 'Import');
				this.selectedOperation = Operation.import;
				break;
			}
			case Operation.export: {
				this.wizard.doneButton.label = localize('dacFx.exportButton', 'Export');
				this.selectedOperation = Operation.export;
				break;
			}
		}
	}

	private async executeOperation() {
		console.error('execution operation: ' + this.selectedOperation);
		switch(this.selectedOperation) {
			case Operation.deploy: {
				await this.deploy();
				break;
			}
			case Operation.extract: {
				await this.extract();
				break;
			}
			case Operation.import: {
				await this.import();
				break;
			}
			case Operation.export: {
				await this.export();
				break;
			}
		}
	}

	private async deploy() {
		let service = await DataTierApplicationWizard.getService();
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.serverConnection.connectionId);

		let result = await service.deployDacpac(this.model.filePath, this.model.databaseName, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.deployErrorMessage', "Deploy failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async extract() {
		let service = await DataTierApplicationWizard.getService();
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.serverConnection.connectionId);

		let result = await service.extractDacpac(this.model.databaseName, this.model.filePath, this.model.databaseName, this.model.version,ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.extractErrorMessage', "Extract failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async export() {
		let service = await DataTierApplicationWizard.getService();
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.serverConnection.connectionId);

		let result = await service.exportBacpac(this.model.databaseName, this.model.filePath, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.exportErrorMessage', "Export failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async import() {
		let service = await DataTierApplicationWizard.getService();
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.serverConnection.connectionId);

		let result = await service.importBacpac(this.model.filePath, this.model.databaseName, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.importErrorMessage', "Import failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	public static async getService(): Promise<sqlops.DacFxServicesProvider> {
		let currentConnection = await sqlops.connection.getCurrentConnection();
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}
}





