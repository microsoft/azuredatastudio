/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, DeployOperationPath, Operation, DeployNewOperationPath, PageName } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';
import { generateDatabaseName } from '../api/utils';

export class DeployConfigPage extends DacFxConfigPage {
	private databaseDropdownComponent: azdata.FormComponent;
	private databaseComponent: azdata.FormComponent;
	private formBuilder: azdata.FormBuilder;
	private form: azdata.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
		this.fileExtension = '.dacpac';
	}

	async start(): Promise<boolean> {
		let serverComponent = await this.createServerDropdown(true);
		let fileBrowserComponent = await this.createFileBrowser();
		this.databaseComponent = await this.createDatabaseTextBox(loc.databaseName);
		this.databaseDropdownComponent = await this.createDeployDatabaseDropdown();
		this.databaseDropdownComponent.title = loc.databaseName;
		let radioButtons = await this.createRadiobuttons();

		this.formBuilder = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					fileBrowserComponent,
					serverComponent,
					radioButtons,
					this.databaseDropdownComponent
				], {
				horizontal: true,
				componentWidth: 400
			});

		this.form = this.formBuilder.component();
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		let r1 = await this.populateServerDropdown();
		let r2 = await this.populateDeployDatabaseDropdown();
		// get existing database values to verify if new database name is valid
		await this.getDatabaseValues();
		return r1 && r2;
	}

	private async createFileBrowser(): Promise<azdata.FormComponent> {
		this.createFileBrowserParts();

		this.fileButton.onDidClick(async (click) => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(this.getRootPath()),
					openLabel: loc.open,
					filters: {
						'dacpac Files': ['dacpac'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			let fileUri = fileUris[0];
			this.fileTextBox.value = fileUri.fsPath;
			this.model.filePath = fileUri.fsPath;
		});

		this.fileTextBox.onTextChanged(async () => {
			this.model.filePath = this.fileTextBox.value;
			this.databaseTextBox.value = generateDatabaseName(this.model.filePath);
			if (!this.model.upgradeExisting) {
				this.model.database = this.databaseTextBox.value;
			}
		});

		return {
			component: this.fileTextBox,
			title: loc.fileLocation,
			actions: [this.fileButton]
		};
	}

	private async createRadiobuttons(): Promise<azdata.FormComponent> {
		let upgradeRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'updateExistingOrCreateNew',
				label: loc.upgradeExistingDatabase,
			}).component();

		let newRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'updateExistingOrCreateNew',
				label: loc.newDatabase,
			}).component();

		upgradeRadioButton.onDidClick(() => {
			this.model.upgradeExisting = true;
			this.formBuilder.removeFormItem(this.databaseComponent);
			this.formBuilder.addFormItem(this.databaseDropdownComponent, { horizontal: true, componentWidth: 400 });
			this.model.database = (<azdata.CategoryValue>this.databaseDropdown.value).name;

			// add deploy plan page and remove and re-add summary page so that it has the correct page number
			this.instance.wizard.removePage(DeployNewOperationPath.summary);
			let deployPlanPage = this.instance.pages.get(PageName.deployPlan);
			let summaryPage = this.instance.pages.get(PageName.summary);
			this.instance.wizard.addPage(deployPlanPage.wizardPage, DeployOperationPath.deployPlan);
			this.instance.wizard.addPage(summaryPage.wizardPage, DeployOperationPath.summary);
		});

		newRadioButton.onDidClick(() => {
			this.model.upgradeExisting = false;
			this.formBuilder.removeFormItem(this.databaseDropdownComponent);
			this.formBuilder.addFormItem(this.databaseComponent, { horizontal: true, componentWidth: 400 });
			this.model.database = this.databaseTextBox.value;
			this.instance.setDoneButton(Operation.deploy);

			// remove deploy plan page and readd summary page so that it has the correct page number
			this.instance.wizard.removePage(DeployOperationPath.summary);
			this.instance.wizard.removePage(DeployOperationPath.deployPlan);
			let summaryPage = this.instance.pages.get(PageName.summary);
			this.instance.wizard.addPage(summaryPage.wizardPage, DeployNewOperationPath.summary);
		});

		//Initialize with upgrade existing true
		upgradeRadioButton.checked = true;
		this.model.upgradeExisting = true;

		let flexRadioButtonsModel = this.view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row',
			}).withItems([
				upgradeRadioButton, newRadioButton]
			).component();

		return {
			component: flexRadioButtonsModel,
			title: loc.targetDatabase
		};
	}

	protected async createDeployDatabaseDropdown(): Promise<azdata.FormComponent> {
		const targetDatabaseTitle = loc.databaseName;
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			ariaLabel: targetDatabaseTitle
		}).component();

		//Handle database changes
		this.databaseDropdown.onValueChanged(async () => {
			this.model.database = (<azdata.CategoryValue>this.databaseDropdown.value).name;
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).withProperties({
			required: true
		}).component();

		return {
			component: this.databaseLoader,
			title: targetDatabaseTitle
		};
	}

	protected async populateDeployDatabaseDropdown(): Promise<boolean> {
		this.databaseLoader.loading = true;
		this.databaseDropdown.updateProperties({ values: [] });
		if (!this.model.server) {
			this.databaseLoader.loading = false;
			return false;
		}
		let values = await this.getDatabaseValues();

		//set the database to the first dropdown value if upgrading, otherwise it should get set to the textbox value
		if (this.model.upgradeExisting) {
			this.model.database = values[0];
		}

		this.databaseDropdown.updateProperties({
			values: values
		});
		this.databaseLoader.loading = false;
		return true;
	}
}
