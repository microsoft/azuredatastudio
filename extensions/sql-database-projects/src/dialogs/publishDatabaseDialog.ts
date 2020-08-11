/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

import { Project } from '../models/project';
import { SqlConnectionDataSource } from '../models/dataSources/sqlConnectionStringSource';
import { IPublishSettings, IGenerateScriptSettings } from '../models/IPublishSettings';
import { DeploymentOptions } from '../../../mssql/src/mssql';

const titleFontSize = 12;

interface DataSourceDropdownValue extends azdata.CategoryValue {
	dataSource: SqlConnectionDataSource;
	database: string;
}

export class PublishDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public publishTab: azdata.window.DialogTab;
	private targetConnectionTextBox: azdata.InputBoxComponent | undefined;
	private targetConnectionFormComponent: azdata.FormComponent | undefined;
	private dataSourcesFormComponent: azdata.FormComponent | undefined;
	private dataSourcesDropDown: azdata.DropDownComponent | undefined;
	private targetDatabaseTextBox: azdata.InputBoxComponent | undefined;
	private connectionsRadioButton: azdata.RadioButtonComponent | undefined;
	private dataSourcesRadioButton: azdata.RadioButtonComponent | undefined;
	private loadProfileButton: azdata.ButtonComponent | undefined;
	private sqlCmdVariablesTable: azdata.TableComponent | undefined;
	private sqlCmdVariablesFormComponent: azdata.FormComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;

	private connectionId: string | undefined;
	private connectionIsDataSource: boolean | undefined;
	private profileSqlCmdVars: Record<string, string> | undefined;
	private deploymentOptions: DeploymentOptions | undefined;

	private toDispose: vscode.Disposable[] = [];

	public publish: ((proj: Project, profile: IPublishSettings) => any) | undefined;
	public generateScript: ((proj: Project, profile: IGenerateScriptSettings) => any) | undefined;
	public readPublishProfile: ((profileUri: vscode.Uri) => any) | undefined;

	constructor(private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.publishDialogName);
		this.publishTab = azdata.window.createTab(constants.publishDialogName);
	}

	public openDialog(): void {
		this.initializeDialog();
		this.dialog.okButton.label = constants.publishDialogOkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.publishClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		let generateScriptButton: azdata.window.Button = azdata.window.createButton(constants.generateScriptButtonText);
		this.toDispose.push(generateScriptButton.onClick(async () => await this.generateScriptClick()));
		generateScriptButton.enabled = false;

		this.dialog.customButtons = [];
		this.dialog.customButtons.push(generateScriptButton);

		azdata.window.openDialog(this.dialog);
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private initializeDialog(): void {
		this.initializePublishTab();
		this.dialog.content = [this.publishTab];
	}

	private initializePublishTab(): void {
		this.publishTab.registerContent(async view => {

			// TODO : enable using this when data source creation is enabled
			this.createRadioButtons(view);
			this.targetConnectionFormComponent = this.createTargetConnectionComponent(view);

			this.targetDatabaseTextBox = view.modelBuilder.inputBox().withProperties({
				value: this.getDefaultDatabaseName(),
				ariaLabel: constants.databaseNameLabel
			}).component();

			this.dataSourcesFormComponent = this.createDataSourcesFormComponent(view);

			this.targetDatabaseTextBox.onTextChanged(() => {
				this.tryEnableGenerateScriptAndOkButtons();
			});

			this.loadProfileButton = this.createLoadProfileButton(view);
			this.sqlCmdVariablesTable = view.modelBuilder.table().withProperties({
				title: constants.sqlCmdTableLabel,
				data: this.convertSqlCmdVarsToTableFormat(this.project.sqlCmdVariables),
				columns: [
					{
						value: constants.sqlCmdVariableColumn
					},
					{
						value: constants.sqlCmdValueColumn,
					}],
				width: 400,
				height: 400
			}).component();

			this.sqlCmdVariablesFormComponent = {
				title: constants.sqlCmdTableLabel,
				component: <azdata.TableComponent>this.sqlCmdVariablesTable
			};

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: constants.targetDatabaseSettings,
						components: [
							{
								title: constants.profileWarningText,
								component: <azdata.ButtonComponent>this.loadProfileButton
							},
							/* TODO : enable using this when data source creation is enabled
							{
								title: constants.selectConnectionRadioButtonsTitle,
								component: selectConnectionRadioButtons
							},*/
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

			// add SQLCMD variables table if the project has any
			if (Object.keys(this.project.sqlCmdVariables).length > 0) {
				this.formBuilder.addFormItem(this.sqlCmdVariablesFormComponent, { titleFontSize: titleFontSize });
			}

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
		});
	}

	public async getConnectionUri(): Promise<string> {
		try {
			// if target connection is a data source, have to check if already connected or if connection dialog needs to be opened
			let connId: string;

			if (this.connectionIsDataSource) {
				const dataSource = (this.dataSourcesDropDown!.value! as DataSourceDropdownValue).dataSource;
				const connProfile: azdata.IConnectionProfile = dataSource.getConnectionProfile();

				if (dataSource.integratedSecurity) {
					connId = (await azdata.connection.connect(connProfile, false, false)).connectionId;
				}
				else {
					connId = (await azdata.connection.openConnectionDialog(undefined, connProfile)).connectionId;
				}
			}
			else {
				if (!this.connectionId) {
					throw new Error('Connection not defined.');
				}

				connId = this.connectionId;
			}

			return await azdata.connection.getUriForConnection(connId);
		}
		catch (err) {
			throw new Error(constants.unableToCreatePublishConnection + ': ' + utils.getErrorMessage(err));
		}
	}

	public async publishClick(): Promise<void> {
		const sqlCmdVars = this.getSqlCmdVariablesForPublish();
		const settings: IPublishSettings = {
			databaseName: this.getTargetDatabaseName(),
			upgradeExisting: true,
			connectionUri: await this.getConnectionUri(),
			sqlCmdVariables: sqlCmdVars,
			deploymentOptions: this.deploymentOptions
		};

		azdata.window.closeDialog(this.dialog);
		await this.publish!(this.project, settings);

		this.dispose();
	}

	public async generateScriptClick(): Promise<void> {
		const sqlCmdVars = this.getSqlCmdVariablesForPublish();
		const settings: IGenerateScriptSettings = {
			databaseName: this.getTargetDatabaseName(),
			connectionUri: await this.getConnectionUri(),
			sqlCmdVariables: sqlCmdVars,
			deploymentOptions: this.deploymentOptions
		};

		azdata.window.closeDialog(this.dialog);

		if (this.generateScript) {
			await this.generateScript!(this.project, settings);
		}

		this.dispose();
	}

	private getSqlCmdVariablesForPublish(): Record<string, string> {
		// get SQLCMD variables from project
		let sqlCmdVariables = { ...this.project.sqlCmdVariables };

		// update with SQLCMD variables loaded from profile if there are any
		for (const key in this.profileSqlCmdVars) {
			sqlCmdVariables[key] = this.profileSqlCmdVars[key];
		}

		return sqlCmdVariables;
	}

	public getTargetDatabaseName(): string {
		return this.targetDatabaseTextBox?.value ?? '';
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
		this.connectionsRadioButton.onDidClick(() => {
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

		this.dataSourcesRadioButton.onDidClick(() => {
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
		this.targetConnectionTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			ariaLabel: constants.targetConnectionLabel,
			enabled: false
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

		this.project.dataSources.filter(d => d instanceof SqlConnectionDataSource).forEach(dataSource => {
			const dbName: string = (dataSource as SqlConnectionDataSource).database;
			const displayName: string = `${dataSource.name}`;
			dataSourcesValues.push({
				displayName: displayName,
				name: dataSource.name,
				dataSource: dataSource as SqlConnectionDataSource,
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
		if ((<DataSourceDropdownValue>this.dataSourcesDropDown!.value)?.database) {
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
			let connection = await azdata.connection.openConnectionDialog();
			this.connectionId = connection.connectionId;

			// show connection name if there is one, otherwise show connection string
			if (connection.options['connectionName']) {
				this.targetConnectionTextBox!.value = connection.options['connectionName'];
			} else {
				this.targetConnectionTextBox!.value = await azdata.connection.getConnectionString(connection.connectionId, false);
			}

			// change the database inputbox value to the connection's database if there is one
			if (connection.options.database && connection.options.database !== constants.master) {
				this.targetDatabaseTextBox!.value = connection.options.database;
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

	private createLoadProfileButton(view: azdata.ModelView): azdata.ButtonComponent {
		let loadProfileButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			label: constants.loadProfileButtonText,
			title: constants.loadProfileButtonText,
			ariaLabel: constants.loadProfileButtonText,
			width: '120px'
		}).component();

		loadProfileButton.onDidClick(async () => {
			const fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.workspace.workspaceFolders ? (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri : undefined,
					filters: {
						[constants.publishSettingsFiles]: ['publish.xml']
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			if (this.readPublishProfile) {
				const result = await this.readPublishProfile(fileUris[0]);
				(<azdata.InputBoxComponent>this.targetDatabaseTextBox).value = result.databaseName;

				this.connectionId = result.connectionId;
				(<azdata.InputBoxComponent>this.targetConnectionTextBox).value = result.connectionString;

				this.deploymentOptions = result.options;
				this.profileSqlCmdVars = result.sqlCmdVariables;
				const data = this.convertSqlCmdVarsToTableFormat(this.getSqlCmdVariablesForPublish());

				await (<azdata.TableComponent>this.sqlCmdVariablesTable).updateProperties({
					data: data
				});

				if (Object.keys(result.sqlCmdVariables).length) {
					// add SQLCMD Variables table if it wasn't there before
					if (Object.keys(this.project.sqlCmdVariables).length === 0) {
						this.formBuilder?.addFormItem(<azdata.FormComponent>this.sqlCmdVariablesFormComponent, { titleFontSize: titleFontSize });
					}
				} else if (Object.keys(this.project.sqlCmdVariables).length === 0) {
					// remove the table if there are no SQLCMD variables in the project and loaded profile
					this.formBuilder?.removeFormItem(<azdata.FormComponent>this.sqlCmdVariablesFormComponent);
				}
			}
		});

		return loadProfileButton;
	}

	private convertSqlCmdVarsToTableFormat(sqlCmdVars: Record<string, string>): string[][] {
		let data = [];
		for (let key in sqlCmdVars) {
			data.push([key, sqlCmdVars[key]]);
		}

		return data;
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
