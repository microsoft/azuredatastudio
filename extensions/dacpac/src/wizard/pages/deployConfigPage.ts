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
	// variables for radio buttons to update them if no databases exist.
	private upgradeRadioButton: azdata.RadioButtonComponent;
	private newRadioButton: azdata.RadioButtonComponent;

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
		let r2 = await this.populateDatabaseDropdown();
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

	private createRadiobuttons(): azdata.FormComponent {
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

			this.updateUpgradeRadioButton();
		});

		newRadioButton.onDidClick(() => {

			this.updateNewRadioButton();
		});

		// Saving instances of the radio buttons to update if databases don't exist
		this.upgradeRadioButton = upgradeRadioButton;
		this.newRadioButton = newRadioButton;

		//Initialize with upgrade existing true
		upgradeRadioButton.checked = true;
		this.model.upgradeExisting = true;

		// Display the radio buttons on the window
		return this.createRadioButtonFlexContainer(upgradeRadioButton, newRadioButton);
	}

	protected async createDeployDatabaseDropdown(): Promise<azdata.FormComponent> {
		const targetDatabaseTitle = loc.databaseName;
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			ariaLabel: targetDatabaseTitle
		}).component();

		//Handle database changes
		this.databaseDropdown.onValueChanged(() => {
			const databaseDropdownValue = this.databaseDropdown.value as azdata.CategoryValue;
			if (!databaseDropdownValue) {
				return;
			}

			this.model.database = databaseDropdownValue.name;
		});

		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).withProperties({
			required: true
		}).component();

		return {
			component: this.databaseLoader,
			title: targetDatabaseTitle
		};
	}

	protected async populateDatabaseDropdown(): Promise<boolean> {
		this.databaseLoader.loading = true;
		this.databaseDropdown.updateProperties({ values: [] });
		if (!this.model.server) {
			this.databaseLoader.loading = false;
			return false;
		}
		let values = await this.getDatabaseValues();

		this.databaseDropdown.updateProperties({
			values: values
		});

		this.databaseLoader.loading = false;

		/*
		Check to avoid having the new radio button checked by default.
		*/
		if (this.newRadioButton.checked) {
			this.newRadioButton.checked = values.length === 0 ? true : false;
			this.upgradeRadioButton.enabled = values.length === 0 ? false : true;
		}

		/*
		Check if databases exist for the selected server.
		*/
		if (values.length === 0) {
			/*
			Set the upgrade radio button to be disabled and call the updateNewRadioButton function
			to update the new radio button accordingly.
			*/
			this.upgradeRadioButton.enabled = false;
			this.newRadioButton.checked = true;
			this.updateNewRadioButton();
		}
		else {
			/*
			Set the upgrade radio button to be enabled and call the updateUpgradeRadioButton function
			to update the upgrade radio button accordingly.
			*/
			this.upgradeRadioButton.enabled = true;
			this.updateUpgradeRadioButton();
		}

		//set the database to the first dropdown value if upgrading, otherwise it should get set to the textbox value
		if (this.model.upgradeExisting) {
			this.model.database = values[0];
		}

		return true;
	}

	/*
	Function that is used to update the window if upgrade radio button is selected.
	*/
	private updateUpgradeRadioButton(): void {
		this.model.upgradeExisting = true;
		this.formBuilder.removeFormItem(this.databaseComponent);
		this.formBuilder.addFormItem(this.databaseDropdownComponent, { horizontal: true, componentWidth: 400 });

		// add deploy plan page and remove and re-add summary page so that it has the correct page number
		if (this.instance.wizard.pages.length < 4) {
			this.instance.wizard.removePage(DeployNewOperationPath.summary);
			let deployPlanPage = this.instance.pages.get(PageName.deployPlan);
			let summaryPage = this.instance.pages.get(PageName.summary);
			this.instance.wizard.addPage(deployPlanPage.wizardPage, DeployOperationPath.deployPlan);
			this.instance.wizard.addPage(summaryPage.wizardPage, DeployOperationPath.summary);
		}
	}

	/*
	Function that is used to update the window if new radio button is selected.
	*/
	private updateNewRadioButton(): void {
		this.model.upgradeExisting = false;
		this.formBuilder.removeFormItem(this.databaseDropdownComponent);
		this.formBuilder.addFormItem(this.databaseComponent, { horizontal: true, componentWidth: 400 });
		this.instance.setDoneButton(Operation.deploy);

		// remove deploy plan page and read summary page so that it has the correct page number
		if (this.instance.wizard.pages.length >= 4) {
			this.instance.wizard.removePage(DeployOperationPath.summary);
			this.instance.wizard.removePage(DeployOperationPath.deployPlan);
			let summaryPage = this.instance.pages.get(PageName.summary);
			this.instance.wizard.addPage(summaryPage.wizardPage, DeployNewOperationPath.summary);
		}
	}

	/*
	Function to create the radio button flex container on the window.
	*/
	private createRadioButtonFlexContainer(upgradeRadioButton: azdata.RadioButtonComponent, newRadioButton: azdata.RadioButtonComponent): azdata.FormComponent {
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

}
