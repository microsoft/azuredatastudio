/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { SelectOperationPage } from './pages/selectOperationpage';
import { DeployConfigPage } from './pages/deployConfigPage';
import { DeployPlanPage } from './pages/deployPlanPage';
import { DacFxSummaryPage } from './pages/dacFxSummaryPage';
import { ExportConfigPage } from './pages/exportConfigPage';
import { ExtractConfigPage } from './pages/extractConfigPage';
import { ImportConfigPage } from './pages/importConfigPage';
import { DacFxDataModel } from './api/models';
import { BasePage } from './api/basePage';
import * as mssql from '../../../mssql';

const localize = nls.loadMessageBundle();
const msSqlProvider = 'MSSQL';
class Page {
	wizardPage: azdata.window.WizardPage;
	dacFxPage: BasePage;

	constructor(wizardPage: azdata.window.WizardPage) {
		this.wizardPage = wizardPage;
	}
}

export enum Operation {
	deploy,
	extract,
	import,
	export,
	generateDeployScript
}

export enum DeployOperationPath {
	selectOperation,
	deployOptions,
	deployPlan,
	summary
}

export enum DeployNewOperationPath {
	selectOperation,
	deployOptions,
	summary
}

export enum ExtractOperationPath {
	selectOperation,
	options,
	summary
}

export enum ImportOperationPath {
	selectOperation,
	options,
	summary
}

export enum ExportOperationPath {
	selectOperation,
	options,
	summary
}

export enum PageName {
	selectOperation = 'selectOperation',
	deployConfig = 'deployConfig',
	deployPlan = 'deployPlan',
	extractConfig = 'extractConfig',
	importConfig = 'importConfig',
	exportConfig = 'exportConfig',
	summary = 'summary'
}

export class DataTierApplicationWizard {
	public wizard: azdata.window.Wizard;
	private connection: azdata.connection.ConnectionProfile;
	private model: DacFxDataModel;
	public pages: Map<string, Page> = new Map<string, Page>();
	public selectedOperation: Operation;

	constructor() {
	}

	public async start(p: any, ...args: any[]) {
		this.model = <DacFxDataModel>{};

		let profile = p ? <azdata.IConnectionProfile>p.connectionProfile : undefined;
		if (profile) {
			this.model.serverId = profile.id;
			this.model.database = profile.databaseName;
		}

		this.connection = await azdata.connection.getCurrentConnection();
		if (!this.connection || (profile && this.connection.connectionId !== profile.id)) {
			// @TODO: remove cast once azdata update complete - karlb 3/1/2019
			this.connection = <azdata.connection.ConnectionProfile><any>await azdata.connection.openConnectionDialog(undefined, profile);

			// don't open the wizard if connection dialog is cancelled
			if (!this.connection) {
				return;
			}
		}

		this.model.serverId = this.connection.connectionId;

		this.wizard = azdata.window.createWizard('Data-tier Application Wizard');
		let selectOperationWizardPage = azdata.window.createWizardPage(localize('dacFx.selectOperationPageName', 'Select an Operation'));
		let deployConfigWizardPage = azdata.window.createWizardPage(localize('dacFx.deployConfigPageName', 'Select Deploy Dacpac Settings'));
		let deployPlanWizardPage = azdata.window.createWizardPage(localize('dacFx.deployPlanPage', 'Review the deploy plan'));
		let summaryWizardPage = azdata.window.createWizardPage(localize('dacFx.summaryPageName', 'Summary'));
		let extractConfigWizardPage = azdata.window.createWizardPage(localize('dacFx.extractConfigPageName', 'Select Extract Dacpac Settings'));
		let importConfigWizardPage = azdata.window.createWizardPage(localize('dacFx.importConfigPageName', 'Select Import Bacpac Settings'));
		let exportConfigWizardPage = azdata.window.createWizardPage(localize('dacFx.exportConfigPageName', 'Select Export Bacpac Settings'));

		this.pages.set(PageName.selectOperation, new Page(selectOperationWizardPage));
		this.pages.set(PageName.deployConfig, new Page(deployConfigWizardPage));
		this.pages.set(PageName.deployPlan, new Page(deployPlanWizardPage));
		this.pages.set(PageName.extractConfig, new Page(extractConfigWizardPage));
		this.pages.set(PageName.importConfig, new Page(importConfigWizardPage));
		this.pages.set(PageName.exportConfig, new Page(exportConfigWizardPage));
		this.pages.set(PageName.summary, new Page(summaryWizardPage));

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
			this.pages.get(PageName.deployConfig).dacFxPage = deployConfigDacFxPage;
			await deployConfigDacFxPage.start();
		});

		deployPlanWizardPage.registerContent(async (view) => {
			let deployPlanDacFxPage = new DeployPlanPage(this, deployPlanWizardPage, this.model, view);
			this.pages.get(PageName.deployPlan).dacFxPage = deployPlanDacFxPage;
			await deployPlanDacFxPage.start();
		});

		extractConfigWizardPage.registerContent(async (view) => {
			let extractConfigDacFxPage = new ExtractConfigPage(this, extractConfigWizardPage, this.model, view);
			this.pages.get(PageName.extractConfig).dacFxPage = extractConfigDacFxPage;
			await extractConfigDacFxPage.start();
		});

		importConfigWizardPage.registerContent(async (view) => {
			let importConfigDacFxPage = new ImportConfigPage(this, importConfigWizardPage, this.model, view);
			this.pages.get(PageName.importConfig).dacFxPage = importConfigDacFxPage;
			await importConfigDacFxPage.start();
		});

		exportConfigWizardPage.registerContent(async (view) => {
			let exportConfigDacFxPage = new ExportConfigPage(this, exportConfigWizardPage, this.model, view);
			this.pages.get(PageName.exportConfig).dacFxPage = exportConfigDacFxPage;
			await exportConfigDacFxPage.start();
		});

		summaryWizardPage.registerContent(async (view) => {
			let summaryDacFxPage = new DacFxSummaryPage(this, summaryWizardPage, this.model, view);
			this.pages.get(PageName.summary).dacFxPage = summaryDacFxPage;
			await summaryDacFxPage.start();
		});

		this.wizard.onPageChanged(async (event) => {
			let idxLast = event.lastPage;
			let lastPage = this.getPage(idxLast);
			if (lastPage) {
				lastPage.dacFxPage.onPageLeave();
			}

			let idx = event.newPage;
			let page = this.getPage(idx);
			if (page) {
				page.dacFxPage.setupNavigationValidator();
				page.dacFxPage.onPageEnter();
			}
		});

		this.wizard.pages = [selectOperationWizardPage, deployConfigWizardPage, deployPlanWizardPage, summaryWizardPage];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.generateScriptButton.onClick(async () => await this.generateDeployScript());
		this.wizard.doneButton.onClick(async () => await this.executeOperation());

		this.wizard.open();
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean) {
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
			case Operation.generateDeployScript: {
				this.wizard.doneButton.label = localize('dacFx.generateScriptButton', 'Generate Script');
				this.selectedOperation = Operation.generateDeployScript;
				break;
			}
		}

		if (operation !== Operation.deploy && operation !== Operation.generateDeployScript) {
			this.model.upgradeExisting = false;
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
			case Operation.generateDeployScript: {
				await this.generateDeployScript();
				break;
			}
		}
	}

	private async deploy() {
		const service = await DataTierApplicationWizard.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		const result = await service.deployDacpac(this.model.filePath, this.model.database, this.model.upgradeExisting, ownerUri, azdata.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.deployErrorMessage', "Deploy failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async extract() {
		const service = await DataTierApplicationWizard.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		const result = await service.extractDacpac(this.model.database, this.model.filePath, this.model.database, this.model.version, ownerUri, azdata.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.extractErrorMessage', "Extract failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async export() {
		const service = await DataTierApplicationWizard.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		const result = await service.exportBacpac(this.model.database, this.model.filePath, ownerUri, azdata.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.exportErrorMessage', "Export failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async import() {
		const service = await DataTierApplicationWizard.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		const result = await service.importBacpac(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.importErrorMessage', "Import failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private async generateDeployScript() {
		const service = await DataTierApplicationWizard.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
		this.wizard.message = {
			text: localize('dacfx.scriptGeneratingMessage', 'You can view the status of script generation in the Tasks View once the wizard is closed. The generated script will open when complete.'),
			level: azdata.window.MessageLevel.Information,
			description: ''
		};

		const result = await service.generateDeployScript(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.script);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.deployErrorMessage', "Deploy failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	private getPage(idx: number): Page {
		let page: Page;

		if (idx === 1) {
			switch (this.selectedOperation) {
				case Operation.deploy: {
					page = this.pages.get(PageName.deployConfig);
					break;
				}
				case Operation.extract: {
					page = this.pages.get(PageName.extractConfig);
					break;
				}
				case Operation.import: {
					page = this.pages.get(PageName.importConfig);
					break;
				}
				case Operation.export: {
					page = this.pages.get(PageName.exportConfig);
					break;
				}
			}
		} else if (this.isSummaryPage(idx)) {
			page = this.pages.get(PageName.summary);
		} else if ((this.selectedOperation === Operation.deploy || this.selectedOperation === Operation.generateDeployScript) && idx === DeployOperationPath.deployPlan) {
			page = this.pages.get(PageName.deployPlan);
		}

		return page;
	}

	private isSummaryPage(idx: number): boolean {
		return this.selectedOperation === Operation.import && idx === ImportOperationPath.summary
			|| this.selectedOperation === Operation.export && idx === ExportOperationPath.summary
			|| this.selectedOperation === Operation.extract && idx === ExtractOperationPath.summary
			|| this.selectedOperation === Operation.deploy && !this.model.upgradeExisting && idx === DeployNewOperationPath.summary
			|| (this.selectedOperation === Operation.deploy || this.selectedOperation === Operation.generateDeployScript) && idx === DeployOperationPath.summary;
	}

	public async generateDeployPlan(): Promise<string> {
		const service = await DataTierApplicationWizard.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		const result = await service.generateDeployPlan(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.execute);

		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.deployPlanErrorMessage', "Generating deploy plan failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}

		return result.report;
	}

	private static async getService(providerName: string): Promise<mssql.IDacFxService> {
		const service = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).dacFx;
		return service;
	}
}
