/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation, DeployOperationPath, ExtractOperationPath, ImportOperationPath, ExportOperationPath } from '../dataTierApplicationWizard';
import { BasePage } from '../api/basePage';

const localize = nls.loadMessageBundle();

export class SelectOperationPage extends BasePage {

	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private deployRadioButton: sqlops.RadioButtonComponent;
	private extractRadioButton: sqlops.RadioButtonComponent;
	private importRadioButton: sqlops.RadioButtonComponent;
	private exportRadioButton: sqlops.RadioButtonComponent;
	private form: sqlops.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super();
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	async start(): Promise<boolean> {
		let deployComponent = await this.createDeployRadioButton();
		let extractComponent = await this.createExtractRadioButton();
		let importComponent = await this.createImportRadioButton();
		let exportComponent = await this.createExportRadioButton();

		this.form = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					deployComponent,
					extractComponent,
					importComponent,
					exportComponent
				], {
					horizontal: true
				}).component();
		await this.view.initializeModel(this.form);

		// default have the first radio button checked
		this.deployRadioButton.checked = true;
		this.instance.setDoneButton(Operation.deploy);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		return true;
	}

	private async createDeployRadioButton(): Promise<sqlops.FormComponent> {
		this.deployRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: localize('dacFx.deployRadioButtonLabel', 'Deploy a data-tier application .dacpac file to an instance of SQL Server [Deploy Dacpac]'),
			}).component();

		this.deployRadioButton.onDidClick(() => {
			this.removePages();

			//add deploy pages
			let configPage = this.instance.pages.get('deployConfig');
			this.instance.wizard.addPage(configPage.wizardPage, DeployOperationPath.deployOptions);
			let deployPlanPage = this.instance.pages.get('deployPlan');
			this.instance.wizard.addPage(deployPlanPage.wizardPage, DeployOperationPath.deployPlan);
			let actionPage = this.instance.pages.get('deployAction');
			this.instance.wizard.addPage(actionPage.wizardPage, DeployOperationPath.deployAction);
			this.addSummaryPage(DeployOperationPath.summary);

			// change button text and operation
			this.instance.setDoneButton(Operation.deploy);
		});

		return {
			component: this.deployRadioButton,
			title: ''
		};
	}

	private async createExtractRadioButton(): Promise<sqlops.FormComponent> {
		this.extractRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: localize('dacFx.extractRadioButtonLabel', 'Extract a data-tier application from an instance of SQL Server to a .dacpac file [Extract Dacpac]'),
			}).component();

		this.extractRadioButton.onDidClick(() => {
			this.removePages();

			// add the extract page
			let page = this.instance.pages.get('extractConfig');
			this.instance.wizard.addPage(page.wizardPage, ExtractOperationPath.options);
			this.addSummaryPage(ExtractOperationPath.summary);

			// change button text and operation
			this.instance.setDoneButton(Operation.extract);
		});

		return {
			component: this.extractRadioButton,
			title: ''
		};
	}

	private async createImportRadioButton(): Promise<sqlops.FormComponent> {
		this.importRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: localize('dacFx.importRadioButtonLabel', 'Create a database from a .bacpac file [Import Bacpac]'),
			}).component();

		this.importRadioButton.onDidClick(() => {
			this.removePages();

			// add the import page
			let page = this.instance.pages.get('importConfig');
			this.instance.wizard.addPage(page.wizardPage, ImportOperationPath.options);
			this.addSummaryPage(ImportOperationPath.summary);

			// change button text and operation
			this.instance.setDoneButton(Operation.import);
		});

		return {
			component: this.importRadioButton,
			title: ''
		};
	}

	private async createExportRadioButton(): Promise<sqlops.FormComponent> {
		this.exportRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: localize('dacFx.exportRadioButtonLabel', 'Export the schema and data from a database to the logical .bacpac file format [Export Bacpac]'),
			}).component();

		this.exportRadioButton.onDidClick(() => {
			this.removePages();

			// add the export pages
			let page = this.instance.pages.get('exportConfig');
			this.instance.wizard.addPage(page.wizardPage, ExportOperationPath.options);
			this.addSummaryPage(ExportOperationPath.summary);

			// change button text and operation
			this.instance.setDoneButton(Operation.export);
		});

		return {
			component: this.exportRadioButton,
			title: ''
		};
	}

	private removePages() {
		let numPages = this.instance.wizard.pages.length;
		for (let i = numPages - 1; i > 0; --i) {
			this.instance.wizard.removePage(i);
		}
	}

	private addSummaryPage(index: number) {
		let summaryPage = this.instance.pages.get('summary');
		this.instance.wizard.addPage(summaryPage.wizardPage, index);
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
