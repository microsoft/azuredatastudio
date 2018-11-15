/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation } from '../DataTierApplicationWizard';
import { DacFxPage } from '../api/dacFxPage';

export class SelectOperationPage extends DacFxPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;

	private deployRadioButton: sqlops.RadioButtonComponent;
	private extractRadioButton: sqlops.RadioButtonComponent;
	private importRadioButton: sqlops.RadioButtonComponent;
	private exportRadioButton: sqlops.RadioButtonComponent;
	private form: sqlops.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
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

		// default have the first radio button checked
		this.deployRadioButton.checked = true;
		this.instance.setDoneButton(Operation.deploy);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let numPages = this.instance.wizard.pages.length;
		console.error('in onPageEnter');
		for(let i= numPages -1; i > 2; --i) {
			await this.instance.wizard.removePage(i);
			console.error('removing page: ' + i + ' length is now ' + this.instance.wizard.pages.length);
		}

		console.error('numpages after removing: ' + this.instance.wizard.pages.length);
		return true;
	}

	async onPageLeave(): Promise<boolean> {
		return true;
	}

	public async cleanup(): Promise<boolean> {
		return true;
	}

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}

	private async createDeployRadioButton(): Promise<sqlops.FormComponent> {
		this.deployRadioButton = this.view.modelBuilder.radioButton()
		.withProperties({
			name: 'selectedOperation',
			label: 'Deploy Dacpac',
		}).component();

		this.deployRadioButton.onDidClick(() => {
			// remove the 2 previous pages
			this.instance.wizard.removePage(2);
			this.instance.wizard.removePage(1);

			// add deploy config page
			console.error('adding deploy pages');
			let page = this.instance.pages.get(1);
			this.instance.wizard.addPage(page.wizardPage, 1);
			let page2 = this.instance.pages.get(2);
			this.instance.wizard.addPage(page2.wizardPage, 2);

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
			label: 'Extract Dacpac',
		}).component();

		this.extractRadioButton.onDidClick(() => {
			// remove the 2 previous pages
			this.instance.wizard.removePage(2);
			this.instance.wizard.removePage(1);

			// add the extract config page
			let page = this.instance.pages.get(3);
			console.error('adding extract page');
			this.instance.wizard.addPage(page.wizardPage, 1);
			let page2 = this.instance.pages.get(4);
			this.instance.wizard.addPage(page2.wizardPage, 2);

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
			label: 'Import Bacpac',
		}).component();

		this.importRadioButton.onDidClick(() => {
			// remove the 2 previous pages and action
			this.instance.wizard.removePage(2);
			this.instance.wizard.removePage(1);

			// add the import config page
			let page = this.instance.pages.get(5);
			console.error('adding import page');
			this.instance.wizard.addPage(page.wizardPage, 1);
			let page2 = this.instance.pages.get(6);
			this.instance.wizard.addPage(page2.wizardPage, 2);

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
			label: 'Export Bacpac',
		}).component();

		this.exportRadioButton.onDidClick(() => {
			// remove the 2 previous pages
			this.instance.wizard.removePage(2);
			this.instance.wizard.removePage(1);

			// add the export config page
			let page = this.instance.pages.get(7);
			console.error('adding export page');
			this.instance.wizard.addPage(page.wizardPage, 1);
			let page2 = this.instance.pages.get(8);
			this.instance.wizard.addPage(page2.wizardPage, 2);

			// change button text and operation
			this.instance.setDoneButton(Operation.export);
		});

		return {
			component: this.exportRadioButton,
			title: ''
		};
	}
}
