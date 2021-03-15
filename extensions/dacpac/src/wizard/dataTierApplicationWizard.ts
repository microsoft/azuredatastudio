/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as loc from '../localizedConstants';
import * as mssql from '../../../mssql';
import * as utils from '../utils';
import { SelectOperationPage } from './pages/selectOperationpage';
import { DeployConfigPage } from './pages/deployConfigPage';
import { DeployPlanPage } from './pages/deployPlanPage';
import { DacFxSummaryPage } from './pages/dacFxSummaryPage';
import { ExportConfigPage } from './pages/exportConfigPage';
import { ExtractConfigPage } from './pages/extractConfigPage';
import { ImportConfigPage } from './pages/importConfigPage';
import { DacFxDataModel } from './api/models';
import { BasePage } from './api/basePage';
import { TelemetryReporter, TelemetryViews } from '../telemetry';
import { TelemetryEventMeasures, TelemetryEventProperties } from '@microsoft/ads-extension-telemetry';

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
	public extensionContextExtensionPath: string;

	constructor(dacfxInputService?: mssql.IDacFxService, extensionContext?: vscode.ExtensionContext) {
		this.wizard = azdata.window.createWizard(loc.wizardTitle, 'Data Tier Application Wizard');
		this.dacfxService = dacfxInputService;
		this.extensionContextExtensionPath = extensionContext?.extensionPath ?? '';
	}

	public async start(p: any): Promise<boolean> {
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
				//Reporting Dacpac wizard cancelled event to Telemetry
				TelemetryReporter.sendActionEvent(TelemetryViews.DataTierApplicationWizard, 'ConnectionDialogCancelled');
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
		let selectOperationWizardPage = azdata.window.createWizardPage(loc.selectOperationPageName, 'Select an Operation Page');
		let deployConfigWizardPage = azdata.window.createWizardPage(loc.deployConfigPageName, 'Deploy Config Page');
		let deployPlanWizardPage = azdata.window.createWizardPage(loc.deployPlanPageName, 'Deploy Plan Page');
		let summaryWizardPage = azdata.window.createWizardPage(loc.summaryPageName, 'Summary Page');
		let extractConfigWizardPage = azdata.window.createWizardPage(loc.extractConfigPageName, 'Extract Config Page');
		let importConfigWizardPage = azdata.window.createWizardPage(loc.importConfigPageName, 'Import Config Page');
		let exportConfigWizardPage = azdata.window.createWizardPage(loc.exportConfigPageName, 'Export Config Page');

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
		this.wizard.cancelButton.onClick(() => this.cancelDataTierApplicationWizard());
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
		let result: mssql.DacFxResult;

		switch (this.selectedOperation) {
			case Operation.deploy: {
				result = await this.deploy();
				break;
			}
			case Operation.extract: {
				result = await this.extract();
				break;
			}
			case Operation.import: {
				result = await this.import();
				break;
			}
			case Operation.export: {
				result = await this.export();
				break;
			}
		}

		if (!result || !result.success) {
			vscode.window.showErrorMessage(this.getOperationErrorMessage(this.selectedOperation, result?.errorMessage));
		}

		return result;
	}

	private getOperationErrorMessage(operation: Operation, error: any): string {
		switch (this.selectedOperation) {
			case Operation.deploy: {
				return loc.operationErrorMessage(loc.deploy, error);
			}
			case Operation.extract: {
				return loc.operationErrorMessage(loc.extract, error);
			}
			case Operation.import: {
				return loc.operationErrorMessage(loc.importText, error);
			}
			case Operation.export: {
				return loc.operationErrorMessage(loc.exportText, error);
			}
		}
	}

	// Cancel button on click event is using to send the data loss information to telemetry
	private cancelDataTierApplicationWizard(): void {
		TelemetryReporter.createActionEvent(TelemetryViews.DataTierApplicationWizard, 'WizardCanceled')
			.withAdditionalProperties({
				isPotentialDataLoss: this.model.potentialDataLoss?.toString()
			}).send();
	}

	public async deploy(): Promise<mssql.DacFxResult> {
		const deployStartTime = new Date().getTime();
		let service: mssql.IDacFxService;
		let ownerUri: string;
		let result: mssql.DacFxResult;
		let additionalProps: TelemetryEventProperties = {};
		let additionalMeasurements: TelemetryEventMeasures = {};
		try {
			service = await this.getService(msSqlProvider);
			ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
			result = await service.deployDacpac(this.model.filePath, this.model.database, this.model.upgradeExisting, ownerUri, azdata.TaskExecutionMode.execute);
		} catch (e) {
			additionalProps.exceptionOccurred = 'true';
		}

		// If result is null which means exception occured, will be adding additional props to the Telemetry
		if (!result) {
			additionalProps = { ...additionalProps, ...this.getDacServiceArgsAsProps(service, this.model.database, this.model.filePath, ownerUri) };
		}
		additionalProps.deploymentStatus = result?.success.toString();
		additionalProps.upgradeExistingDatabase = this.model.upgradeExisting.toString();
		additionalProps.potentialDataLoss = this.model.potentialDataLoss.toString();

		additionalMeasurements.deployDacpacFileSizeBytes = await utils.tryGetFileSize(this.model.filePath);
		additionalMeasurements.totalDurationMs = (new Date().getTime() - deployStartTime);

		// Deploy Dacpac: 'Deploy button' clicked in deploy summary page, Reporting the event selection to the telemetry
		this.sendDacServiceTelemetryEvent(TelemetryViews.DeployDacpac, 'DeployDacpacOperation', additionalProps, additionalMeasurements);
		return result;
	}

	private async extract(): Promise<mssql.DacFxResult> {
		const extractStartTime = new Date().getTime();
		let service: mssql.IDacFxService;
		let ownerUri: string;
		let result: mssql.DacFxResult;
		let additionalProps: TelemetryEventProperties = {};
		let additionalMeasurements: TelemetryEventMeasures = {};
		try {
			service = await this.getService(msSqlProvider);
			ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
			result = await service.extractDacpac(this.model.database, this.model.filePath, this.model.database, this.model.version, ownerUri, azdata.TaskExecutionMode.execute);
		} catch (e) {
			additionalProps.exceptionOccurred = 'true';
		}

		// If result is null which means exception occured, will be adding additional props to the Telemetry
		if (!result) {
			additionalProps = { ...additionalProps, ...this.getDacServiceArgsAsProps(service, this.model.database, this.model.filePath, ownerUri) };
		}
		additionalProps.extractStatus = result?.success.toString();
		additionalMeasurements.extractedDacpacFileSizeBytes = await utils.tryGetFileSize(this.model.filePath);
		additionalMeasurements.totalDurationMs = (new Date().getTime() - extractStartTime);
		// Extract Dacpac: 'Extract button' clicked in extract summary page, Reporting the event selection to the telemetry
		this.sendDacServiceTelemetryEvent(TelemetryViews.ExtractDacpac, 'ExtractDacpacOperation', additionalProps, additionalMeasurements);
		return result;
	}

	private async export(): Promise<mssql.DacFxResult> {
		const exportStartTime = new Date().getTime();
		let service: mssql.IDacFxService;
		let ownerUri: string;
		let result: mssql.DacFxResult;
		let additionalProps: TelemetryEventProperties = {};
		let additionalMeasurements: TelemetryEventMeasures = {};
		try {
			service = await this.getService(msSqlProvider);
			ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
			result = await service.exportBacpac(this.model.database, this.model.filePath, ownerUri, azdata.TaskExecutionMode.execute);
		} catch (e) {
			additionalProps.exceptionOccurred = 'true';
		}

		// If result is null which means exception occured, will be adding additional props to the Telemetry
		if (!result) {
			additionalProps = { ...additionalProps, ...this.getDacServiceArgsAsProps(service, this.model.database, this.model.filePath, ownerUri) };
		}
		additionalProps.exportStatus = result?.success.toString();
		additionalMeasurements.exportedBacpacFileSizeBytes = await utils.tryGetFileSize(this.model.filePath);
		additionalMeasurements.totalDurationMs = (new Date().getTime() - exportStartTime);
		// Export Bacpac: 'Export button' clicked in Export summary page, Reporting the event selection to the telemetry
		this.sendDacServiceTelemetryEvent(TelemetryViews.ExportBacpac, 'ExportBacpacOperation', additionalProps, additionalMeasurements);
		return result;
	}

	private async import(): Promise<mssql.DacFxResult> {
		const importStartTime = new Date().getTime();
		let service: mssql.IDacFxService;
		let ownerUri: string;
		let result: mssql.DacFxResult;
		let additionalProps: TelemetryEventProperties = {};
		let additionalMeasurements: TelemetryEventMeasures = {};
		try {
			service = await this.getService(msSqlProvider);
			ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
			result = await service.importBacpac(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.execute);
		} catch (e) {
			additionalProps.exceptionOccurred = 'true';
		}

		// If result is null which means exception occured, will be adding additional props to the Telemetry
		if (!result) {
			additionalProps = { ...additionalProps, ...this.getDacServiceArgsAsProps(service, this.model.database, this.model.filePath, ownerUri) };
		}
		additionalProps.importStatus = result?.success.toString();
		additionalMeasurements.importedBacpacFileSizeBytes = await utils.tryGetFileSize(this.model.filePath);
		additionalMeasurements.totalDurationMs = (new Date().getTime() - importStartTime);
		// Import Bacpac: 'Import button' clicked in Import summary page, Reporting the event selection to the telemetry
		this.sendDacServiceTelemetryEvent(TelemetryViews.ImportBacpac, 'ImportBacpacOperation', additionalProps, additionalMeasurements);
		return result;
	}

	public async generateDeployScript(): Promise<mssql.DacFxResult> {
		const genScriptStartTime = new Date().getTime();
		let service: mssql.IDacFxService;
		let ownerUri: string;
		let result: mssql.DacFxResult;
		let additionalProps: TelemetryEventProperties = {};
		let additionalMeasurements: TelemetryEventMeasures = {};
		try {
			this.wizard.message = {
				text: loc.generatingScriptMessage,
				level: azdata.window.MessageLevel.Information,
				description: ''
			};

			service = await this.getService(msSqlProvider);
			ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
			result = await service.generateDeployScript(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.script);
		} catch (e) {
			additionalProps.exceptionOccurred = 'true';
		}

		if (!result || !result.success) {
			vscode.window.showErrorMessage(loc.generateDeployErrorMessage(result?.errorMessage));
		}

		// If result is null which means exception occured, will be adding additional props to the Telemetry
		if (!result) {
			additionalProps = { ...additionalProps, ...this.getDacServiceArgsAsProps(service, this.model.database, this.model.filePath, ownerUri) };
		}
		additionalProps.isScriptGenerated = result?.success.toString();
		additionalProps.potentialDataLoss = this.model.potentialDataLoss.toString();
		additionalMeasurements.deployDacpacFileSizeBytes = await utils.tryGetFileSize(this.model.filePath);
		additionalMeasurements.totalDurationMs = (new Date().getTime() - genScriptStartTime);
		// Deploy Dacpac 'generate script' button clicked in DeployPlanPage, Reporting the event selection to the telemetry with fail/sucess status
		this.sendDacServiceTelemetryEvent(TelemetryViews.DeployDacpac, 'GenerateDeployScriptOperation', additionalProps, additionalMeasurements);
		return result;
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
		const deployPlanStartTime = new Date().getTime();
		let service: mssql.IDacFxService;
		let ownerUri: string;
		let result: mssql.GenerateDeployPlanResult;
		let additionalProps: TelemetryEventProperties = {};
		let additionalMeasurements: TelemetryEventMeasures = {};
		try {
			service = await this.getService(msSqlProvider);
			ownerUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
			result = await service.generateDeployPlan(this.model.filePath, this.model.database, ownerUri, azdata.TaskExecutionMode.execute);
		} catch (e) {
			additionalProps.exceptionOccurred = 'true';
		}

		if (!result || !result.success) {
			vscode.window.showErrorMessage(loc.deployPlanErrorMessage(result?.errorMessage));
		}

		// If result is null which means exception occured, will be adding additional props to the Telemetry
		if (!result) {
			additionalProps = { ...additionalProps, ...this.getDacServiceArgsAsProps(service, this.model.database, this.model.filePath, ownerUri) };
		}
		additionalProps.isPlanGenerated = result?.success.toString();
		additionalMeasurements.totalDurationMs = (new Date().getTime() - deployPlanStartTime);
		// send Generate deploy plan error/succes telemetry event
		this.sendDacServiceTelemetryEvent(TelemetryViews.DeployPlanPage, 'GenerateDeployPlanOperation', additionalProps, additionalMeasurements);
		return result.report;
	}

	private async getService(providerName: string): Promise<mssql.IDacFxService> {
		if (!this.dacfxService) {
			this.dacfxService = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).dacFx;
		}
		return this.dacfxService;
	}

	public getDacServiceArgsAsProps(service: mssql.IDacFxService, database: string, filePath: string, ownerUri: string): { [k: string]: string } {
		return {
			isServiceExist: (!!service).toString(),
			isDatabaseExists: (!!database).toString(),
			isFilePathExist: (!!filePath).toString(),
			isOwnerUriExist: (!!ownerUri).toString()
		};
	}

	private sendDacServiceTelemetryEvent(telemetryView: string, telemetryAction: string, additionalProps: TelemetryEventProperties, additionalMeasurements: TelemetryEventMeasures): void {
		TelemetryReporter.createActionEvent(telemetryView, telemetryAction)
			.withAdditionalProperties(additionalProps)
			.withAdditionalMeasurements(additionalMeasurements)
			.send();
	}
}
