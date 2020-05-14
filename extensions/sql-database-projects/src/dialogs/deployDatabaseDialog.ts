/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import { Project } from '../models/project';
import { DataSource } from '../models/dataSources/dataSources';
import { SqlConnectionDataSource } from '../models/dataSources/sqlConnectionStringSource';
import { ApiWrapper } from '../common/apiWrapper';

interface DataSourceDropdownValue extends azdata.CategoryValue {
	dataSource: DataSource;
	database: string;
}

export class DeployDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public deployTab: azdata.window.DialogTab;
	private targetConnectionTextBox: azdata.InputBoxComponent | undefined;
	private targetConnectionFormComponent: azdata.FormComponent | undefined;
	private dataSourcesFormComponent: azdata.FormComponent | undefined;
	private dataSourcesDropDown: azdata.DropDownComponent | undefined;
	private targetDatabaseTextBox: azdata.InputBoxComponent | undefined;
	private connectionsRadioButton: azdata.RadioButtonComponent | undefined;
	private dataSourcesRadioButton: azdata.RadioButtonComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;

	private connection: azdata.connection.Connection | undefined;
	private connectionIsDataSource: boolean | undefined;

	constructor(private apiWrapper: ApiWrapper, private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.deployDialogName);
		this.deployTab = azdata.window.createTab(constants.deployDialogName);
	}

	public openDialog(): void {
		this.initializeDialog();
		this.dialog.okButton.label = constants.deployDialogOkButtonText;
		this.dialog.okButton.enabled = false;
		this.dialog.okButton.onClick(async () => await this.deploy());

		this.dialog.cancelButton.label = constants.cancelButtonText;

		let generateScriptButton: azdata.window.Button = azdata.window.createButton(constants.generateScriptButtonText);
		generateScriptButton.onClick(async () => await this.generateScript());
		generateScriptButton.enabled = false;

		this.dialog.customButtons = [];
		this.dialog.customButtons.push(generateScriptButton);

		azdata.window.openDialog(this.dialog);
	}


	private initializeDialog(): void {
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

			this.dataSourcesFormComponent = this.createDataSourcesFormComponent(view);

			this.targetDatabaseTextBox.onTextChanged(() => {
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
		// if target connection is a data source, have to check if already connected or if connection dialog needs to be opened
	}

	private async generateScript(): Promise<void> {
		// TODO: hook up with build and generate script
		// if target connection is a data source, have to check if already connected or if connection dialog needs to be opened
		azdata.window.closeDialog(this.dialog);
	}

	public getDefaultDatabaseName(): string {
		return this.project.projectFileName;
	}

	private createRadioButtons(view: azdata.ModelView): azdata.Component {
		this.connectionsRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'connection',
				label: constants.connectionRadioButtonLabel
			}).component();

		this.connectionsRadioButton.checked = true;
		this.connectionsRadioButton.onDidClick(async () => {
			this.formBuilder!.removeFormItem(<azdata.FormComponent>this.dataSourcesFormComponent);
			this.formBuilder!.insertFormItem(<azdata.FormComponent>this.targetConnectionFormComponent, 2);
			this.connectionIsDataSource = false;
			this.targetDatabaseTextBox!.value = this.getDefaultDatabaseName();
		});

		this.dataSourcesRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'connection',
				label: constants.dataSourceRadioButtonLabel
			}).component();

		this.dataSourcesRadioButton.onDidClick(async () => {
			this.formBuilder!.removeFormItem(<azdata.FormComponent>this.targetConnectionFormComponent);
			this.formBuilder!.insertFormItem(<azdata.FormComponent>this.dataSourcesFormComponent, 2);
			this.connectionIsDataSource = true;

			this.setDatabaseToSelectedDataSourceDatabase();
		});

		let flexRadioButtonsModel: azdata.FlexContainer = view.modelBuilder.flexContainer()
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

		let editConnectionButton: azdata.Component = this.createEditConnectionButton(view);
		let clearButton: azdata.Component = this.createClearButton(view);

		return {
			title: constants.targetConnectionLabel,
			component: this.targetConnectionTextBox,
			actions: [editConnectionButton, clearButton]
		};
	}

	private createDataSourcesFormComponent(view: azdata.ModelView): azdata.FormComponent {
		if (this.project.dataSources.length > 0) {
			return this.createDataSourcesDropdown(view);
		} else {
			const noDataSourcesText = view.modelBuilder.text().withProperties({ value: constants.noDataSourcesText }).component();
			return {
				title: constants.dataSourceDropdownTitle,
				component: noDataSourcesText
			};
		}
	}

	private createDataSourcesDropdown(view: azdata.ModelView): azdata.FormComponent {
		let dataSourcesValues: DataSourceDropdownValue[] = [];

		this.project.dataSources.forEach(dataSource => {
			const dbName: string = (dataSource as SqlConnectionDataSource).getSetting(constants.initialCatalogSetting);
			const displayName: string = `${dataSource.name}`;
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

	private setDatabaseToSelectedDataSourceDatabase(): void {
		if ((<DataSourceDropdownValue>this.dataSourcesDropDown!.value).database) {
			this.targetDatabaseTextBox!.value = (<DataSourceDropdownValue>this.dataSourcesDropDown!.value).database;
		}
	}

	private createEditConnectionButton(view: azdata.ModelView): azdata.Component {
		let editConnectionButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			label: constants.editConnectionButtonText,
			title: constants.editConnectionButtonText,
			ariaLabel: constants.editConnectionButtonText
		}).component();

		editConnectionButton.onDidClick(async () => {
			this.connection = await this.apiWrapper.openConnectionDialog();

			// show connection name if there is one, otherwise show connection string
			if (this.connection.options['connectionName']) {
				this.targetConnectionTextBox!.value = this.connection.options['connectionName'];
			} else {
				this.targetConnectionTextBox!.value = await azdata.connection.getConnectionString(this.connection.connectionId, false);
			}

			// change the database inputbox value to the connection's database if there is one
			if (this.connection.options.database) {
				this.targetDatabaseTextBox!.value = this.connection.options.database;
			}
		});

		return editConnectionButton;
	}

	private createClearButton(view: azdata.ModelView): azdata.Component {
		let clearButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			label: constants.clearButtonText,
			title: constants.clearButtonText,
			ariaLabel: constants.clearButtonText
		}).component();

		clearButton.onDidClick(() => {
			this.targetConnectionTextBox!.value = '';
		});

		return clearButton;
	}

	// only enable Generate Script and Ok buttons if all fields are filled
	private tryEnableGenerateScriptAndOkButtons(): void {
		if (this.targetConnectionTextBox!.value && this.targetDatabaseTextBox!.value
			|| this.connectionIsDataSource && this.targetDatabaseTextBox!.value) {
			this.dialog.okButton.enabled = true;
			this.dialog.customButtons[0].enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
			this.dialog.customButtons[0].enabled = false;
		}
	}
}
