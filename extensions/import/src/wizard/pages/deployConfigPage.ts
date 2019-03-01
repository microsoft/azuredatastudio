/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, DeployOperationPath, Operation } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

const localize = nls.loadMessageBundle();

export class DeployConfigPage extends DacFxConfigPage {

	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	private databaseDropdownComponent: sqlops.FormComponent;
	private databaseComponent: sqlops.FormComponent;
	private formBuilder: sqlops.FormBuilder;
	private form: sqlops.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
		this.fileExtension = '.bacpac';
	}

	async start(): Promise<boolean> {
		let serverComponent = await this.createServerDropdown(true);
		let fileBrowserComponent = await this.createFileBrowser();
		this.databaseComponent = await this.createDatabaseTextBox();
		this.databaseComponent.title = localize('dacFx.databaseNameTextBox', 'Database Name');
		this.databaseDropdownComponent = await this.createDeployDatabaseDropdown();
		this.databaseDropdownComponent.title = localize('dacFx.databaseNameDropdown', 'Database Name');
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
		return r1 && r2;
	}

	private async createFileBrowser(): Promise<sqlops.FormComponent> {
		this.createFileBrowserParts();

		this.fileButton.onDidClick(async (click) => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(os.homedir()),
					openLabel: localize('dacFxDeploy.openFile', 'Open'),
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
			this.databaseTextBox.value = this.generateDatabaseName(this.model.filePath);
			if (!this.model.upgradeExisting) {
				this.model.database = this.databaseTextBox.value;
			}
		});

		return {
			component: this.fileTextBox,
			title: localize('dacFxDeploy.fileTextboxTitle', 'File Location'),
			actions: [this.fileButton]
		};
	}

	private async createRadiobuttons(): Promise<sqlops.FormComponent> {
		let upgradeRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'updateExisting',
				label: localize('dacFx.upgradeRadioButtonLabel', 'Upgrade Existing Database'),
			}).component();

		let newRadioButton = this.view.modelBuilder.radioButton()
			.withProperties({
				name: 'updateExisting',
				label: localize('dacFx.newRadioButtonLabel', 'New Database'),
			}).component();

		upgradeRadioButton.onDidClick(() => {
			this.model.upgradeExisting = true;
			this.formBuilder.removeFormItem(this.databaseComponent);
			this.formBuilder.addFormItem(this.databaseDropdownComponent, { horizontal: true, componentWidth: 400 });
			this.model.database = (<sqlops.CategoryValue>this.databaseDropdown.value).name;

			// add deploy plan and generate script pages
			let deployPlanPage = this.instance.pages.get('deployPlan');
			this.instance.wizard.addPage(deployPlanPage.wizardPage, DeployOperationPath.deployPlan);
			let deployActionPage = this.instance.pages.get('deployAction');
			this.instance.wizard.addPage(deployActionPage.wizardPage, DeployOperationPath.deployAction);
		});

		newRadioButton.onDidClick(() => {
			this.model.upgradeExisting = false;
			this.formBuilder.removeFormItem(this.databaseDropdownComponent);
			this.formBuilder.addFormItem(this.databaseComponent, { horizontal: true, componentWidth: 400 });
			this.model.database = this.databaseTextBox.value;
			this.instance.setDoneButton(Operation.deploy);

			// remove deploy plan and generate script pages
			this.instance.wizard.removePage(DeployOperationPath.deployAction);
			this.instance.wizard.removePage(DeployOperationPath.deployPlan);
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
			title: localize('dacFx.targetDatabaseRadioButtonsTitle', 'Target Database')
		};
	}

	protected async createDeployDatabaseDropdown(): Promise<sqlops.FormComponent> {
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();
		//Handle database changes
		this.databaseDropdown.onValueChanged(async () => {
			this.model.database = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
		});
		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();
		return {
			component: this.databaseLoader,
			title: localize('dacFx.targetDatabaseDropdownTitle', 'Database Name')
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
			this.model.database = values[0].name;
		}

		this.databaseDropdown.updateProperties({
			values: values
		});
		this.databaseLoader.loading = false;
		return true;
	}

	private generateDatabaseName(filePath: string): string {
		let result = path.parse(filePath);
		return result.name;
	}
}
