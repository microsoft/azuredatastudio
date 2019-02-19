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
import { DeployPlanPage } from './pages/deployPlanPage';
import { DeployActionPage } from './pages/deployActionPage';
import { DacFxSummaryPage } from './pages/dacFxSummaryPage';
import { ExportConfigPage } from './pages/exportConfigPage';
import { ExtractConfigPage } from './pages/extractConfigPage';
import { ImportConfigPage } from './pages/importConfigPage';
import { DacFxDataModel } from './api/models';
import { BasePage } from './api/basePage';

const localize = nls.loadMessageBundle();

class Page {
	wizardPage: sqlops.window.WizardPage;
	dacFxPage: BasePage;

	constructor(wizardPage: sqlops.window.WizardPage) {
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
	deployAction,
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

export class DataTierApplicationWizard {
	public wizard: sqlops.window.Wizard;
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

		this.wizard = sqlops.window.createWizard('Data-tier Application Wizard');
		let selectOperationWizardPage = sqlops.window.createWizardPage(localize('dacFx.selectOperationPageName', 'Select an Operation'));
		let deployConfigWizardPage = sqlops.window.createWizardPage(localize('dacFx.deployConfigPageName', 'Select Deploy Dacpac Settings'));
		let deployPlanWizardPage = sqlops.window.createWizardPage(localize('dacFx.deployPlanPage', 'Review the deploy plan'));
		let deployActionWizardPage = sqlops.window.createWizardPage(localize('dacFx.deployActionPageName', 'Select Action'));
		let summaryWizardPage = sqlops.window.createWizardPage(localize('dacFx.summaryPageName', 'Summary'));
		let extractConfigWizardPage = sqlops.window.createWizardPage(localize('dacFx.extractConfigPageName', 'Select Extract Dacpac Settings'));
		let importConfigWizardPage = sqlops.window.createWizardPage(localize('dacFx.importConfigPageName', 'Select Import Bacpac Settings'));
		let exportConfigWizardPage = sqlops.window.createWizardPage(localize('dacFx.exportConfigPageName', 'Select Export Bacpac Settings'));

		this.pages.set('selectOperation', new Page(selectOperationWizardPage));
		this.pages.set('deployConfig', new Page(deployConfigWizardPage));
		this.pages.set('deployPlan', new Page(deployPlanWizardPage));
		this.pages.set('deployAction', new Page(deployActionWizardPage));
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

		deployPlanWizardPage.registerContent(async (view) => {
			let deployPlanDacFxPage = new DeployPlanPage(this, deployPlanWizardPage, this.model, view);
			this.pages.get('deployPlan').dacFxPage = deployPlanDacFxPage;
			await deployPlanDacFxPage.start();
		});

		deployActionWizardPage.registerContent(async (view) => {
			let deployActionDacFxPage = new DeployActionPage(this, deployActionWizardPage, this.model, view);
			this.pages.get('deployAction').dacFxPage = deployActionDacFxPage;
			await deployActionDacFxPage.start();
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
			let page = this.getPage(idx);

			if (page !== undefined) {
				page.dacFxPage.setupNavigationValidator();
				page.dacFxPage.onPageEnter();
			}

			//do onPageLeave for summary page so that GenerateScript button only shows up if upgrading database
			let idxLast = event.lastPage;

			if (this.isSummaryPage(idxLast)) {
				let lastPage = this.pages.get('summary');
				if (lastPage) {
					lastPage.dacFxPage.onPageLeave();
				}
			}
		});

		this.wizard.pages = [selectOperationWizardPage, deployConfigWizardPage, deployPlanWizardPage, deployActionWizardPage, summaryWizardPage];
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.generateScriptButton.onClick(async () => await this.generateDeployScript());
		this.wizard.doneButton.onClick(async () => await this.executeOperation());

		this.wizard.open();
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.WizardPageChangeInfo) => boolean) {
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

	private async generateDeployScript() {
		if (!this.model.scriptFilePath) {
			return;
		}

		let service = await DataTierApplicationWizard.getService(this.model.server.providerName);
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);
		this.wizard.message = {
			text: localize('dacfx.scriptGeneratingMessage', 'You can view the status of script generation in the Task History once the wizard is closed'),
			level: sqlops.window.MessageLevel.Information,
			description: ''
		};

		let result = await service.generateDeployScript(this.model.filePath, this.model.database, this.model.scriptFilePath, ownerUri, sqlops.TaskExecutionMode.execute);
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
		} else if (this.isSummaryPage(idx)) {
			page = this.pages.get('summary');
		} else if ((this.selectedOperation === Operation.deploy || this.selectedOperation === Operation.generateDeployScript) && idx === DeployOperationPath.deployPlan) {
			page = this.pages.get('deployPlan');
		} else if ((this.selectedOperation === Operation.deploy || this.selectedOperation === Operation.generateDeployScript) && idx === DeployOperationPath.deployAction) {
			page = this.pages.get('deployAction');
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
		let service = await DataTierApplicationWizard.getService(this.model.server.providerName);
		let ownerUri = await sqlops.connection.getUriForConnection(this.model.server.connectionId);

		let result = await service.generateDeployPlan(this.model.filePath, this.model.database, ownerUri, sqlops.TaskExecutionMode.execute);

		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('alertData.deployPlanErrorMessage', "Generating deploy plan failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}

		return result.report;
	}

	private static async getService(providerName: string): Promise<sqlops.DacFxServicesProvider> {
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}
}
