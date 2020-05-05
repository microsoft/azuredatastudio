/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import * as path from 'path';
import { Project } from '../models/project';
import { DataSource } from '../models/dataSources/dataSources';
import { SqlConnectionDataSource } from '../models/dataSources/sqlConnectionStringSource';

interface DataSourceDropdownValue extends azdata.CategoryValue {
	dataSource: DataSource;
	database: string;
}

export class DeployDatabaseDialog {
	public dialog: azdata.window.Dialog;
	private deployTab: azdata.window.DialogTab;
	private targetConnectionTextBox: azdata.InputBoxComponent;
	private targetConnectionFormComponent: azdata.FormComponent;
	private dataSourcesFormComponent: azdata.FormComponent;
	private dataSourcesDropDown: azdata.DropDownComponent;
	private targetDatabaseTextBox: azdata.InputBoxComponent;
	private deployScriptNameTextBox: azdata.InputBoxComponent;
	private connectionsRadioButton: azdata.RadioButtonComponent;
	private dataSourcesRadioButton: azdata.RadioButtonComponent;
	private formBuilder: azdata.FormBuilder;

	private connection: azdata.connection.ConnectionProfile;
	private connectionIsDataSource: boolean;

	constructor(private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.deployDialogName);
		this.deployTab = azdata.window.createTab(constants.deployDialogName);
	}

	public async openDialog(): Promise<void> {
		this.initializeDialog();
		this.dialog.okButton.label = constants.deployDialogOkButtonText;
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.onClick(async () => await this.deploy());

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		let generateScriptButton = azdata.window.createButton(constants.generateScriptButtonText);
		generateScriptButton.onClick(async () => await this.generateScript());
		generateScriptButton.enabled = false;

		this.dialog.customButtons = [];
		this.dialog.customButtons.push(generateScriptButton);

		azdata.window.openDialog(this.dialog);
	}


	private initializeDialog() {
		this.initializeDeployTab();
		this.dialog.content = [this.deployTab];
	}

	private initializeDeployTab(): void {
		this.deployTab.registerContent(async view => {

			let selectConnectionRadioButtons = this.createRadioButtons(view);
			this.targetConnectionFormComponent = this.createTargetConnectionComponent(view);

			this.targetDatabaseTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.getDefaultDatabaseName(),
				ariaLabel: constants.databaseNameLabel
			}).component();

			this.dataSourcesFormComponent = this.createDataSourcesDropdown(view);

			this.targetDatabaseTextBox.onTextChanged(() => {
				this.tryEnableGenerateScriptAndOkButtons();
			});

			this.deployScriptNameTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.getDefaultScriptName(),
				ariaLabel: constants.deployScriptNameLabel
			}).component();

			this.deployScriptNameTextBox.onTextChanged(() => {
				this.tryEnableGenerateScriptAndOkButtons();
			});

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: constants.targetDatabaseSettings,
						components: [
							{
								title: constants.selectConnectionRadioButtonsTitle,
								component: selectConnectionRadioButtons
							},
							this.targetConnectionFormComponent,
							{
								title: constants.databaseNameLabel,
								component: this.targetDatabaseTextBox
							},
							{
								title: constants.deployScriptNameLabel,
								component: this.deployScriptNameTextBox
							}
						]
					}
				], {
					horizontal: false
				})
				.withLayout({
					width: '100%'
				});

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	private async deploy(): Promise<void> {
		// TODO: hook up with build and deploy
	}

	private async generateScript(): Promise<void> {
		// TODO: hook up with build and generate script
		azdata.window.closeDialog(this.dialog);
	}

	private async cancel(): Promise<void> {
	}

	private getDefaultDatabaseName(): string {
		return path.basename(this.project.projectFolderPath);
	}

	private getDefaultScriptName(): string {
		return this.getDefaultDatabaseName() + '.sql';
	}

	private createRadioButtons(view: azdata.ModelView): azdata.Component {
		this.connectionsRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'connection',
				label: constants.connectionRadioButtonLabel
			}).component();

		this.connectionsRadioButton.checked = true;
		this.connectionsRadioButton.onDidClick(async () => {
			this.formBuilder.removeFormItem(this.dataSourcesFormComponent);
			this.formBuilder.insertFormItem(this.targetConnectionFormComponent, 2);
			this.connectionIsDataSource = false;
			this.targetDatabaseTextBox.value = this.getDefaultDatabaseName();
		});

		this.dataSourcesRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'connection',
				label: constants.dataSourceRadioButtonLabel
			}).component();

		this.dataSourcesRadioButton.onDidClick(async () => {
			this.formBuilder.removeFormItem(this.targetConnectionFormComponent);
			this.formBuilder.insertFormItem(this.dataSourcesFormComponent, 2);
			this.connectionIsDataSource = true;

			this.setDatabaseToSelectedDataSourceDatabase();
		});

		let flexRadioButtonsModel = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.connectionsRadioButton, this.dataSourcesRadioButton])
			.withProperties({ ariaRole: 'radiogroup' })
			.component();

		return flexRadioButtonsModel;
	}

	private createTargetConnectionComponent(view: azdata.ModelView): azdata.FormComponent {
		// TODO: make this not editable
		this.targetConnectionTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			ariaLabel: constants.targetConnectionLabel
		}).component();

		this.targetConnectionTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndOkButtons();
		});

		let editConnectionButton = this.createEditConnectionButton(view);
		let clearButton = this.createClearButton(view);

		return {
			title: constants.targetConnectionLabel,
			component: this.targetConnectionTextBox,
			actions: [editConnectionButton, clearButton]
		};
	}

	private createDataSourcesDropdown(view: azdata.ModelView): azdata.FormComponent {
		let dataSourcesValues: DataSourceDropdownValue[] = [];

		this.project.dataSources.forEach(dataSource => {
			const dbName = (dataSource as SqlConnectionDataSource).getSetting('Initial Catalog');
			const connectionString = (dataSource as SqlConnectionDataSource).connectionString;
			const displayName = `${dataSource.name}  (${connectionString})`;
			dataSourcesValues.push({
				displayName: displayName,
				name: dataSource.name,
				dataSource: dataSource,
				database: dbName
			});
		});

		this.dataSourcesDropDown = view.modelBuilder.dropDown().withProperties({
			values: dataSourcesValues,
		}).component();


		this.dataSourcesDropDown.onValueChanged(() => {
			this.setDatabaseToSelectedDataSourceDatabase();
			this.tryEnableGenerateScriptAndOkButtons();
		});

		return {
			title: constants.dataSourceDropdownTitle,
			component: this.dataSourcesDropDown
		};
	}

	private setDatabaseToSelectedDataSourceDatabase() {
		if ((<DataSourceDropdownValue>this.dataSourcesDropDown.value).database) {
			this.targetDatabaseTextBox.value = (<DataSourceDropdownValue>this.dataSourcesDropDown.value).database;
		}
	}

	private createEditConnectionButton(view: azdata.ModelView): azdata.Component {
		let editConnectionButton = view.modelBuilder.button().withProperties({
			label: constants.editConnectionButtonText,
			title: constants.editConnectionButtonText,
			ariaLabel: constants.editConnectionButtonText
		}).component();

		editConnectionButton.onDidClick(async () => {
			this.connection = <azdata.connection.ConnectionProfile><any>await azdata.connection.openConnectionDialog();
			this.targetConnectionTextBox.value = await azdata.connection.getConnectionString(this.connection.connectionId, false);

			// change the database inputbox value to the connection's database if there is one
			if (this.connection.options.database) {
				this.targetDatabaseTextBox.value = this.connection.options.database;
			}
		});

		return editConnectionButton;
	}

	private createClearButton(view: azdata.ModelView): azdata.Component {
		let clearButton = view.modelBuilder.button().withProperties({
			label: constants.clearButtonText,
			title: constants.clearButtonText,
			ariaLabel: constants.clearButtonText
		}).component();

		clearButton.onDidClick(() => {
			this.targetConnectionTextBox.value = '';
		});

		return clearButton;
	}

	// only enable Generate Script button if all fields are filled
	private tryEnableGenerateScriptAndOkButtons(): void {
		if (this.targetConnectionTextBox.value && this.targetDatabaseTextBox.value && this.deployScriptNameTextBox.value
			|| this.connectionIsDataSource && this.targetDatabaseTextBox.value && this.deployScriptNameTextBox.value) {
			this.dialog.okButton.enabled = true;
			this.dialog.customButtons[0].enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
			this.dialog.customButtons[0].enabled = false;
		}
	}
}
