/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../localizedConstants';
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
	export
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
	private dacfxService: mssql.IDacFxService;
	public model: DacFxDataModel;
	public pages: Map<string, Page> = new Map<string, Page>();
	public selectedOperation: Operation;

	constructor(dacfxInputService?: mssql.IDacFxService) {
		this.wizard = azdata.window.createWizard(loc.wizardTitle);
		this.dacfxService = dacfxInputService;
	}

	public async start(p: any, ...args: any[]): Promise<boolean> {
		this.model = <DacFxDataModel>{};

		let profile = p ? <azdata.IConnectionProfile>p.connectionProfile : undefined;
		if (profile) {
			this.model.serverId = profile.id;
			this.model.database = profile.databaseName;
		}

		this.connection = await azdata.connection.getCurrentConnection();
		if (!this.connection || (profile && this.connection.connectionId !== profile.id)) {
			// check if there are any active connections
			const connections = await azdata.connection.getConnections(true);
			if (connections.length > 0) {
				// set connection to the first one in the list
				this.connection = connections[0];
			} else {
				// @TODO: remove cast once azdata update complete - karlb 3/1/2019
				this.connection = <azdata.connection.ConnectionProfile><any>await azdata.connection.openConnectionDialog(undefined, profile);
			}
			// don't open the wizard if connection dialog is cancelled
			if (!this.connection) {
				return false;
			}
		}

		this.model.serverId = this.connection.connectionId;
		this.setPages();
		this.configureButtons();

		this.wizard.open();
		return true;
	}

	public setPages(): void {
		let selectOperationWizardPage = azdata.window.createWizardPage(loc.selectOperationPageName);
		let deployConfigWizardPage = azdata.window.createWizardPage(loc.deployConfigPageName);
		let deployPlanWizardPage = azdata.window.createWizardPage(loc.deployPlanPageName);
		let summaryWizardPage = azdata.window.createWizardPage(loc.summaryPageName);
		let extractConfigWizardPage = azdata.window.createWizardPage(loc.extractConfigPageName);
		let importConfigWizardPage = azdata.window.createWizardPage(loc.importConfigPageName);
		let exportConfigWizardPage = azdata.window.createWizardPage(loc.exportConfigPageName);

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
	}

	public configureButtons(): void {
		this.wizard.generateScriptButton.hidden = true;
		this.wizard.generateScriptButton.onClick(async () => await this.generateDeployScript());
		this.wizard.doneButton.onClick(async () => await this.executeOperation());
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public setDoneButton(operation: Operation): void {
		switch (operation) {
			case Operation.deploy: {
				this.wizard.doneButton.label = loc.deploy;
				this.selectedOperation = Operation.deploy;
				break;
			}
			case Operation.extract: {
				this.wizard.doneButton.label = loc.extract;
				this.selectedOperation = Operation.extract;
				break;
			}
			case Operation.import: {
				this.wizard.doneButton.label = loc.importText;
				this.selectedOperation = Operation.import;
				break;
			}
			case Operation.export: {
				this.wizard.doneButton.label = loc.exportText;
				this.selectedOperation = Operation.export;
				break;
			}
		}

		if (operation !== Operation.deploy) {
			this.model.upgradeExisting = false;
		}
	}

	public async executeOperation(): Promise<mssql.DacFxResult> {
		switch (this.selectedOperation) {
			case Operation.deploy: {
				return await this.deploy();
			}
			case Operation.extract: {
				return await this.extract();
			}
			case Operation.import: {
				return await this.import();
			}
			case Operation.export: {
				return await this.export();
			}
		}
	}

	public async deploy(): Promise<mssql.DacFxResult> {
		const service = await this.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		return await service.deployDacpac(this.model.filePath, this.model.database, this.model.upgradeExisting, ownerUri, azdata.TaskExecutionMode.execute);
	}

	private async extract(): Promise<mssql.DacFxResult> {
		const service = await this.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		return await service.extractDacpac(this.model.database, this.model.filePath, this.model.database, this.model.version, ownerUri, azdata.TaskExecutionMode.execute);
	}

	private async export(): Promise<mssql.DacFxResult> {
		const service = await this.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		return await service.exportBacpac(this.model.database, this.model.filePath, ownerUri, azdata.TaskExecutionMode.execute);
	}

	private async import(): Promise<mssql.DacFxResult> {
		const service = await this.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		return await service.importBacpac(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.execute);
	}

	private async generateDeployScript(): Promise<mssql.DacFxResult> {
		const service = await this.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
		this.wizard.message = {
			text: loc.generatingScriptMessage,
			level: azdata.window.MessageLevel.Information,
			description: ''
		};

		return await service.generateDeployScript(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.script);
	}

	public getPage(idx: number): Page {
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
		} else if ((this.selectedOperation === Operation.deploy) && idx === DeployOperationPath.deployPlan) {
			page = this.pages.get(PageName.deployPlan);
		}

		return page;
	}

	public isSummaryPage(idx: number): boolean {
		return this.selectedOperation === Operation.import && idx === ImportOperationPath.summary
			|| this.selectedOperation === Operation.export && idx === ExportOperationPath.summary
			|| this.selectedOperation === Operation.extract && idx === ExtractOperationPath.summary
			|| this.selectedOperation === Operation.deploy && !this.model.upgradeExisting && idx === DeployNewOperationPath.summary
			|| (this.selectedOperation === Operation.deploy) && idx === DeployOperationPath.summary;
	}

	public async generateDeployPlan(): Promise<string> {
		const service = await this.getService(msSqlProvider);
		const ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);

		const result = await service.generateDeployPlan(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.execute);

		if (!result || !result.success) {
			vscode.window.showErrorMessage(loc.deployPlanErrorMessage(result.errorMessage));
		}

		return result.report;
	}

	private async getService(providerName: string): Promise<mssql.IDacFxService> {
		if (!this.dacfxService) {
			this.dacfxService = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).dacFx;
		}
		return this.dacfxService;
	}
}
