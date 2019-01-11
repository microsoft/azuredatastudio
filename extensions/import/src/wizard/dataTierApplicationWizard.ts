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
import { DacFxSummaryPage } from './pages/dacFxSummaryPage';
import { ExportConfigPage } from './pages/exportConfigPage';
import { ExtractConfigPage } from './pages/extractConfigPage';
import { ImportConfigPage } from './pages/importConfigPage';
import { DacFxDataModel } from './api/models';
import { BasePage } from './api/basePage';

const localize = nls.loadMessageBundle();

class Page {
	wizardPage: sqlops.window.modelviewdialog.WizardPage;
	dacFxPage: BasePage;

	constructor(wizardPage: sqlops.window.modelviewdialog.WizardPage) {
		this.wizardPage = wizardPage;
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
	public pages: Map<string, Page> = new Map<string, Page>();
	public selectedOperation: Operation;

	constructor() {
	}

	public async start(p: any, ...args: any[]) {
		this.model = <DacFxDataModel>{};

		let profile = p ? <sqlops.IConnectionProfile>p.connectionProfile : undefined;
		if (profile) {
			this.model.serverId = profile.id;
			this.model.database = profile.databaseName;
		}

		this.connection = await sqlops.connection.getCurrentConnection();
		if (!this.connection) {
			this.connection = await sqlops.connection.openConnectionDialog();
		}

		this.wizard = sqlops.window.modelviewdialog.createWizard('Data-tier Application Wizard');
		let selectOperationWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.selectOperationPageName', 'Select an Operation'));
		let deployConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.deployConfigPageName', 'Select Deploy Dacpac Settings'));
		let summaryWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.summaryPageName', 'Summary'));
		let extractConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.extractConfigPageName', 'Select Extract Dacpac Settings'));
		let importConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.importConfigPageName', 'Select Import Bacpac Settings'));
		let exportConfigWizardPage = sqlops.window.modelviewdialog.createWizardPage(localize('dacFx.exportConfigPageName', 'Select Export Bacpac Settings'));

		this.pages.set('selectOperation', new Page(selectOperationWizardPage));
		this.pages.set('deployConfig', new Page(deployConfigWizardPage));
		this.pages.set('extractConfig', new Page(extractConfigWizardPage));
		this.pages.set('importConfig', new Page(importConfigWizardPage));
		this.pages.set('exportConfig', new Page(exportConfigWizardPage));
		this.pages.set('summary', new Page(summaryWizardPage));

		selectOperationWizardPage.registerContent(async (view) => {
			let selectOperationDacFxPage = new SelectOperationPage(this, selectOperationWizardPage, this.model, view);
			this.pages.get('selectOperation').dacFxPage = selectOperationDacFxPage;
			await selectOperationDacFxPage.start().then(() => {
				selectOperationDacFxPage.setupNavigationValidator();
				selectOperationDacFxPage.onPageEnter();
			});
		});

		deployConfigWizardPage.registerContent(async (view) => {
			let deployConfigDacFxPage = new DeployConfigPage(this, deployConfigWizardPage, this.model, view);
			this.pages.get('deployConfig').dacFxPage = deployConfigDacFxPage;
			await deployConfigDacFxPage.start();
		});

		extractConfigWizardPage.registerContent(async (view) => {
			let extractConfigDacFxPage = new ExtractConfigPage(this, extractConfigWizardPage, this.model, view);
			this.pages.get('extractConfig').dacFxPage = extractConfigDacFxPage;
			await extractConfigDacFxPage.start();
		});

		importConfigWizardPage.registerContent(async (view) => {
			let importConfigDacFxPage = new ImportConfigPage(this, importConfigWizardPage, this.model, view);
			this.pages.get('importConfig').dacFxPage = importConfigDacFxPage;
			await importConfigDacFxPage.start();
		});

		exportConfigWizardPage.registerContent(async (view) => {
			let exportConfigDacFxPage = new ExportConfigPage(this, exportConfigWizardPage, this.model, view);
			this.pages.get('exportConfig').dacFxPage = exportConfigDacFxPage;
			await exportConfigDacFxPage.start();
		});

		summaryWizardPage.registerContent(async (view) => {
			let summaryDacFxPage = new DacFxSummaryPage(this, summaryWizardPage, this.model, view);
			this.pages.get('summary').dacFxPage = summaryDacFxPage;
			await summaryDacFxPage.start();
		});

		this.wizard.onPageChanged(async (event) => {
			let idx = event.newPage;
			let page: Page;

			if (idx === 1) {
				switch (this.selectedOperation) {
					case Operation.deploy: {
						page = this.pages.get('deployConfig');
						break;
					}
					case Operation.extract: {
						page = this.pages.get('extractConfig');
						break;
					}
					case Operation.import: {
						page = this.pages.get('importConfig');
						break;
					}
					case Operation.export: {
						page = this.pages.get('exportConfig');
						break;
					}
				}
			} else if (idx === 2) {
				page = this.pages.get('summary');
			}

			if (page !== undefined) {
				page.dacFxPage.setupNavigationValidator();
				page.dacFxPage.onPageEnter();
			}
		});

		this.wizard.pages = [selectOperationWizardPage, deployConfigWizardPage, summaryWizardPage];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.doneButton.onClick(async () => await this.executeOperation());

		this.wizard.open();
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public setDoneButton(operation: Operation): void {
		switch (operation) {
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
		switch (this.selectedOperation) {
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
		let service = await DataTierApplicationWizard.getService(this.model.server.providerName);
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);

		let result = await service.deployDacpac(this.model.filePath, this.model.database, this.model.upgradeExisting, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.deployErrorMessage', "Deploy failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async extract() {
		let service = await DataTierApplicationWizard.getService(this.model.server.providerName);
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);

		let result = await service.extractDacpac(this.model.database, this.model.filePath, this.model.database, this.model.version, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.extractErrorMessage', "Extract failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async export() {
		let service = await DataTierApplicationWizard.getService(this.model.server.providerName);
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);

		let result = await service.exportBacpac(this.model.database, this.model.filePath, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.exportErrorMessage', "Export failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async import() {
		let service = await DataTierApplicationWizard.getService(this.model.server.providerName);
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);

		let result = await service.importBacpac(this.model.filePath, this.model.database, ownerUri, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.importErrorMessage', "Import failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private static async getService(providerName: string): Promise<sqlops.DacFxServicesProvider> {
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}
}
