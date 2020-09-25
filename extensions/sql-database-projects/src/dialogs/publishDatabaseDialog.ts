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
import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';

interface DataSourceDropdownValue extends azdata.CategoryValue {
	dataSource: SqlConnectionDataSource;
	database: string;
}

export class PublishDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public publishTab: azdata.window.DialogTab;
	private targetConnectionTextBox: azdata.InputBoxComponent | undefined;
	private dataSourcesFormComponent: azdata.FormComponent | undefined;
	private dataSourcesDropDown: azdata.DropDownComponent | undefined;
	private targetDatabaseDropDown: azdata.DropDownComponent | undefined;
	private connectionsRadioButton: azdata.RadioButtonComponent | undefined;
	private dataSourcesRadioButton: azdata.RadioButtonComponent | undefined;
	private sqlCmdVariablesTable: azdata.DeclarativeTableComponent | undefined;
	private sqlCmdVariablesFormComponentGroup: azdata.FormComponentGroup | undefined;
	private loadSqlCmdVarsButton: azdata.ButtonComponent | undefined;
	private loadProfileTextBox: azdata.InputBoxComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;

	private connectionId: string | undefined;
	private connectionIsDataSource: boolean | undefined;
	private sqlCmdVars: Record<string, string> | undefined;
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

			this.dataSourcesFormComponent = this.createDataSourcesFormComponent(view);

			this.sqlCmdVariablesTable = this.createSqlCmdTable(view);
			this.loadSqlCmdVarsButton = this.createLoadSqlCmdVarsButton(view);

			this.sqlCmdVariablesFormComponentGroup = {
				components: [
					{
						title: '',
						component: this.loadSqlCmdVarsButton
					},
					{
						title: '',
						component: <azdata.DeclarativeTableComponent>this.sqlCmdVariablesTable
					}
				],
				title: constants.sqlCmdTableLabel
			};

			const profileRow = this.createProfileRow(view);
			const connectionRow = this.createConnectionRow(view);
			const databaseRow = this.createDatabaseRow(view);

			const horizontalFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			horizontalFormSection.addItems([profileRow, connectionRow, databaseRow]);


			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							{
								component: horizontalFormSection,
								title: ''
							},
							/* TODO : enable using this when data source creation is enabled
							{
								title: constants.selectConnectionRadioButtonsTitle,
								component: selectConnectionRadioButtons
							},*/
						]
					}
				], {
					horizontal: false,
					titleFontSize: cssStyles.titleFontSize
				})
				.withLayout({
					width: '100%'
				});

			// add SQLCMD variables table if the project has any
			if (Object.keys(this.project.sqlCmdVariables).length > 0) {
				this.formBuilder.addFormItem(this.sqlCmdVariablesFormComponentGroup);
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
			deploymentOptions: await this.getDeploymentOptions()
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
			deploymentOptions: await this.getDeploymentOptions()
		};

		azdata.window.closeDialog(this.dialog);

		if (this.generateScript) {
			await this.generateScript!(this.project, settings);
		}

		this.dispose();
	}

	private async getDeploymentOptions(): Promise<DeploymentOptions> {
		// eventually, database options will be configurable in this dialog
		// but for now,  just send the default DacFx deployment options if no options were loaded from a publish profile
		if (!this.deploymentOptions) {
			this.deploymentOptions = await utils.GetDefaultDeploymentOptions();

			// this option needs to be true for same database references validation to work
			if (this.project.databaseReferences.length > 0) {
				this.deploymentOptions.includeCompositeObjects = true;
			}
		}

		return this.deploymentOptions;
	}

	private getSqlCmdVariablesForPublish(): Record<string, string> {
		// get SQLCMD variables from table
		let sqlCmdVariables = { ...this.sqlCmdVars };
		return sqlCmdVariables;
	}

	public getTargetDatabaseName(): string {
		return <string>this.targetDatabaseDropDown?.value ?? '';
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
			// TODO: fix this when data sources are enabled again
			// this.formBuilder!.insertFormItem(<azdata.FormComponent>this.targetConnectionTextBox, 2);
			this.connectionIsDataSource = false;
			this.targetDatabaseDropDown!.value = this.getDefaultDatabaseName();
		});

		this.dataSourcesRadioButton = view.modelBuilder.radioButton()
			.withProperties({
				name: 'connection',
				label: constants.dataSourceRadioButtonLabel
			}).component();

		this.dataSourcesRadioButton.onDidClick(() => {
			// TODO: fix this when data sources are enabled again
			// this.formBuilder!.removeFormItem(<azdata.FormComponent>this.targetConnectionTextBox);
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

	private createTargetConnectionComponent(view: azdata.ModelView): azdata.InputBoxComponent {
		this.targetConnectionTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			ariaLabel: constants.targetConnectionLabel,
			placeHolder: constants.selectConnection,
			width: cssStyles.publishDialogTextboxWidth,
			enabled: false
		}).component();

		this.targetConnectionTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndOkButtons();
		});

		return this.targetConnectionTextBox;
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
			this.targetDatabaseDropDown!.value = (<DataSourceDropdownValue>this.dataSourcesDropDown!.value).database;
		}
	}

	private createProfileRow(view: azdata.ModelView): azdata.FlexContainer {
		const loadProfileButton = this.createLoadProfileButton(view);
		this.loadProfileTextBox = view.modelBuilder.inputBox().withProperties({
			placeHolder: constants.loadProfilePlaceholderText,
			ariaLabel: constants.profile,
			width: cssStyles.publishDialogTextboxWidth
		}).component();

		const profileLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.profile,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		const profileRow = view.modelBuilder.flexContainer().withItems([profileLabel, this.loadProfileTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		profileRow.insertItem(loadProfileButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return profileRow;
	}

	private createConnectionRow(view: azdata.ModelView): azdata.FlexContainer {
		this.targetConnectionTextBox = this.createTargetConnectionComponent(view);
		const selectConnectionButton: azdata.Component = this.createSelectConnectionButton(view);

		const serverLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, this.targetConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.insertItem(selectConnectionButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdata.ModelView): azdata.FlexContainer {
		this.targetDatabaseDropDown = view.modelBuilder.dropDown().withProperties({
			value: this.getDefaultDatabaseName(),
			ariaLabel: constants.databaseNameLabel,
			required: true,
			width: cssStyles.publishDialogTextboxWidth,
			editable: true,
			fireOnTextChange: true
		}).component();

		this.targetDatabaseDropDown.onValueChanged(() => {
			this.tryEnableGenerateScriptAndOkButtons();
		});

		const databaseLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdata.DropDownComponent>this.targetDatabaseDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	private createSqlCmdTable(view: azdata.ModelView): azdata.DeclarativeTableComponent {
		this.sqlCmdVars = { ...this.project.sqlCmdVariables };

		const table = view.modelBuilder.declarativeTable().withProperties<azdata.DeclarativeTableProperties>({
			ariaLabel: constants.sqlCmdTableLabel,
			data: this.convertSqlCmdVarsToTableFormat(this.sqlCmdVars),
			columns: [
				{
					displayName: constants.sqlCmdVariableColumn,
					valueType: azdata.DeclarativeDataType.string,
					width: '50%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: constants.sqlCmdValueColumn,
					valueType: azdata.DeclarativeDataType.string,
					width: '50%',
					isReadOnly: false,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}],
			width: '420px'
		}).component();

		table.onDataChanged(() => {
			this.sqlCmdVars = {};
			table.data?.forEach((row) => {
				(<Record<string, string>>this.sqlCmdVars)[row[0]] = row[1];
			});

			this.tryEnableGenerateScriptAndOkButtons();
		});

		return table;
	}

	private createLoadSqlCmdVarsButton(view: azdata.ModelView): azdata.ButtonComponent {
		let loadSqlCmdVarsButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			label: constants.loadSqlCmdVarsButtonTitle,
			title: constants.loadSqlCmdVarsButtonTitle,
			ariaLabel: constants.loadSqlCmdVarsButtonTitle,
			width: '210px',
			iconPath: IconPathHelper.refresh,
			height: '18px',
			CSSStyles: { 'font-size': '13px' }
		}).component();

		loadSqlCmdVarsButton.onDidClick(async () => {
			this.sqlCmdVars = { ...this.project.sqlCmdVariables };

			const data = this.convertSqlCmdVarsToTableFormat(this.getSqlCmdVariablesForPublish());
			await (<azdata.DeclarativeTableComponent>this.sqlCmdVariablesTable).updateProperties({
				data: data
			});

			this.tryEnableGenerateScriptAndOkButtons();
		});

		return loadSqlCmdVarsButton;
	}

	private createSelectConnectionButton(view: azdata.ModelView): azdata.Component {
		let selectConnectionButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			ariaLabel: constants.selectConnection,
			iconPath: IconPathHelper.selectConnection,
			height: '16px',
			width: '16px'
		}).component();

		selectConnectionButton.onDidClick(async () => {
			let connection = await azdata.connection.openConnectionDialog();
			this.connectionId = connection.connectionId;

			// show connection name if there is one, otherwise show connection in format that shows in OE
			let connectionTextboxValue: string;
			if (connection.options['connectionName']) {
				connectionTextboxValue = connection.options['connectionName'];
			} else {
				let user = connection.options['user'];
				if (!user) {
					user = constants.defaultUser;
				}

				connectionTextboxValue = `${connection.options['server']} (${user})`;
			}

			this.updateConnectionComponents(connectionTextboxValue, this.connectionId);

			// change the database inputbox value to the connection's database if there is one
			if (connection.options.database && connection.options.database !== constants.master) {
				this.targetDatabaseDropDown!.value = connection.options.database;
			}

			// change icon to the one without a plus sign
			selectConnectionButton.iconPath = IconPathHelper.connect;
		});

		return selectConnectionButton;
	}

	private async updateConnectionComponents(connectionTextboxValue: string, connectionId: string) {
		this.targetConnectionTextBox!.value = connectionTextboxValue;
		this.targetConnectionTextBox!.placeHolder = connectionTextboxValue;

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			const databaseValues = (await azdata.connection.listDatabases(connectionId))
				// filter out system dbs
				.filter(db => constants.systemDbs.find(systemdb => db === systemdb) === undefined);

			this.targetDatabaseDropDown!.values = databaseValues;
		}
	}

	private createLoadProfileButton(view: azdata.ModelView): azdata.ButtonComponent {
		let loadProfileButton: azdata.ButtonComponent = view.modelBuilder.button().withProperties({
			ariaLabel: constants.loadProfilePlaceholderText,
			iconPath: IconPathHelper.folder_blue,
			height: '16px',
			width: '16px'
		}).component();

		loadProfileButton.onDidClick(async () => {
			const fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(this.project.projectFolderPath),
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
				// clear out old database dropdown values. They'll get populated later if there was a connection specified in the profile
				(<azdata.DropDownComponent>this.targetDatabaseDropDown).values = [];

				this.connectionId = result.connectionId;
				await this.updateConnectionComponents(result.connection, <string>this.connectionId);

				if (result.databaseName) {
					(<azdata.DropDownComponent>this.targetDatabaseDropDown).value = result.databaseName;
				}

				for (let key in result.sqlCmdVariables) {
					(<Record<string, string>>this.sqlCmdVars)[key] = result.sqlCmdVariables[key];
				}

				this.deploymentOptions = result.options;

				const data = this.convertSqlCmdVarsToTableFormat(this.getSqlCmdVariablesForPublish());
				await (<azdata.DeclarativeTableComponent>this.sqlCmdVariablesTable).updateProperties({
					data: data
				});

				if (Object.keys(result.sqlCmdVariables).length) {
					// add SQLCMD Variables table if it wasn't there before
					if (Object.keys(this.project.sqlCmdVariables).length === 0) {
						this.formBuilder?.addFormItem(<azdata.FormComponentGroup>this.sqlCmdVariablesFormComponentGroup);
					}
				} else if (Object.keys(this.project.sqlCmdVariables).length === 0) {
					// remove the table if there are no SQLCMD variables in the project and loaded profile
					this.formBuilder?.removeFormItem(<azdata.FormComponentGroup>this.sqlCmdVariablesFormComponentGroup);
				}

				// show file path in text box and hover text
				this.loadProfileTextBox!.value = fileUris[0].fsPath;
				this.loadProfileTextBox!.placeHolder = fileUris[0].fsPath;
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
		if ((this.targetConnectionTextBox!.value && this.targetDatabaseDropDown!.value
			|| this.connectionIsDataSource && this.targetDatabaseDropDown!.value)
			&& this.allSqlCmdVariablesFilled()) {
			this.dialog.okButton.enabled = true;
			this.dialog.customButtons[0].enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
			this.dialog.customButtons[0].enabled = false;
		}
	}

	private allSqlCmdVariablesFilled(): boolean {
		for (let key in this.sqlCmdVars) {
			if (this.sqlCmdVars[key] === '' || this.sqlCmdVars[key] === undefined) {
				return false;
			}
		}

		return true;
	}
}
