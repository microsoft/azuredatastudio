/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../localizedConstants';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation, DeployOperationPath, ExtractOperationPath, ImportOperationPath, ExportOperationPath, PageName } from '../dataTierApplicationWizard';
import { BasePage } from '../api/basePage';

export class SelectOperationPage extends BasePage {
	private deployRadioButton: azdata.RadioButtonComponent;
	private extractRadioButton: azdata.RadioButtonComponent;
	private importRadioButton: azdata.RadioButtonComponent;
	private exportRadioButton: azdata.RadioButtonComponent;
	private form: azdata.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
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

		this.deployRadioButton.focus();
		this.instance.setDoneButton(Operation.deploy);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		return true;
	}

	private async createDeployRadioButton(): Promise<azdata.FormComponent> {
		this.deployRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: loc.deployDescription,
				checked: true // Default to first radio button being selected
			}).component();

		this.deployRadioButton.onDidClick(() => {
			this.removePages();

			//add deploy pages
			let configPage = this.instance.pages.get(PageName.deployConfig);
			this.instance.wizard.addPage(configPage.wizardPage, DeployOperationPath.deployOptions);
			let deployPlanPage = this.instance.pages.get(PageName.deployPlan);
			this.instance.wizard.addPage(deployPlanPage.wizardPage, DeployOperationPath.deployPlan);
			this.addSummaryPage(DeployOperationPath.summary);

			// change button text and operation
			this.instance.setDoneButton(Operation.deploy);
		});

		return {
			component: this.deployRadioButton,
			title: ''
		};
	}

	private async createExtractRadioButton(): Promise<azdata.FormComponent> {
		this.extractRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: loc.extractDescription,
			}).component();

		this.extractRadioButton.onDidClick(() => {
			this.removePages();

			// add the extract page
			let page = this.instance.pages.get(PageName.extractConfig);
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

	private async createImportRadioButton(): Promise<azdata.FormComponent> {
		this.importRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: loc.importDescription,
			}).component();

		this.importRadioButton.onDidClick(() => {
			this.removePages();

			// add the import page
			let page = this.instance.pages.get(PageName.importConfig);
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

	private async createExportRadioButton(): Promise<azdata.FormComponent> {
		this.exportRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'selectedOperation',
				label: loc.exportDescription,
			}).component();

		this.exportRadioButton.onDidClick(() => {
			this.removePages();

			// add the export pages
			let page = this.instance.pages.get(PageName.exportConfig);
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
		let summaryPage = this.instance.pages.get(PageName.summary);
		this.instance.wizard.addPage(summaryPage.wizardPage, index);
	}

	public setupNavigationValidator(): void {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
