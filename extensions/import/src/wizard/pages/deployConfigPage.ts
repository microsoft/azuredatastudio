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
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

const localize = nls.loadMessageBundle();

export class DeployConfigPage extends DacFxConfigPage {

	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	private upgradeCheckbox: sqlops.CheckBoxComponent;
	private databaseDropdownComponent: sqlops.FormComponent;
	private databaseComponent: sqlops.FormComponent;
	private formBuilder: sqlops.FormBuilder;
	private form: sqlops.FormContainer;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
		this.fileExtension = '.bacpac';
	}

	async start(): Promise<boolean> {
		this.databaseComponent = await this.createDatabaseTextBox();
		let serverComponent = await this.createServerDropdown(true);
		let fileBrowserComponent = await this.createFileBrowser();
		let upgradeComponent = await this.createUpgradeCheckbox();
		this.databaseDropdownComponent = await this.createDeployDatabaseDropdown();
		this.upgradeCheckbox.checked = true;

		this.formBuilder = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					fileBrowserComponent,
					serverComponent,
					upgradeComponent,
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
						'All Files': ['*']
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
			if (!this.upgradeCheckbox.checked) {
				this.model.database = this.generateDatabaseName(this.model.filePath);
			}
			this.databaseTextBox.value = this.generateDatabaseName(this.model.filePath);
		});

		return {
			component: this.fileTextBox,
			title: localize('dacFxDeploy.fileTextboxTitle', 'Dacpac location'),
			actions: [this.fileButton]
		};
	}

	private async createUpgradeCheckbox(): Promise<sqlops.FormComponent> {
		this.upgradeCheckbox = this.view.modelBuilder.checkBox()
			.withProperties({
				label: localize('dacFx.upgradeCheckboxLabel', 'Upgrade Existing Database'),
			}).component();
		this.upgradeCheckbox.onChanged(() => {
			this.model.upgradeExisting = this.upgradeCheckbox.checked ? true : false;
			if (this.model.upgradeExisting) {
				this.formBuilder.removeFormItem(this.databaseComponent);
				this.formBuilder.addFormItem(this.databaseDropdownComponent, { horizontal: true, componentWidth: 400 });
				this.model.database =  (<sqlops.CategoryValue>this.databaseDropdown.value).name;
			} else {
				this.formBuilder.removeFormItem(this.databaseDropdownComponent);
				this.formBuilder.addFormItem(this.databaseComponent, { horizontal: true, componentWidth: 400 });
				this.model.database = this.databaseTextBox.value;
			}
		});
		return {
			component: this.upgradeCheckbox,
			title: ''
		};
	}

	protected async createDeployDatabaseDropdown(): Promise<sqlops.FormComponent> {
		this.databaseDropdown = this.view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();
		// Handle database changes
		this.databaseDropdown.onValueChanged(async () => {
			this.model.database = (<sqlops.CategoryValue>this.databaseDropdown.value).name;
		});
		this.databaseLoader = this.view.modelBuilder.loadingComponent().withItem(this.databaseDropdown).component();
		return {
			component: this.databaseLoader,
			title: localize('dacFx.targetDatabaseDropdownTitle', 'Target Database')
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

		if(this.model.database === undefined) {
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
