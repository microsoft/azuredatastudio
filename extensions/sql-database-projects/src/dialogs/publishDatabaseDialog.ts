/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

import { Project } from '../models/project';
import { SqlConnectionDataSource } from '../models/dataSources/sqlConnectionStringSource';
import { IPublishSettings, IGenerateScriptSettings } from '../models/IPublishSettings';
import { DeploymentOptions, SchemaObjectType } from '../../../mssql/src/mssql';
import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { getConnectionName } from './utils';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

interface DataSourceDropdownValue extends azdataType.CategoryValue {
	dataSource: SqlConnectionDataSource;
	database: string;
}

export class PublishDatabaseDialog {
	public dialog: azdataType.window.Dialog;
	public publishTab: azdataType.window.DialogTab;
	private targetConnectionTextBox: azdataType.InputBoxComponent | undefined;
	private dataSourcesFormComponent: azdataType.FormComponent | undefined;
	private dataSourcesDropDown: azdataType.DropDownComponent | undefined;
	private targetDatabaseDropDown: azdataType.DropDownComponent | undefined;
	private connectionsRadioButton: azdataType.RadioButtonComponent | undefined;
	private dataSourcesRadioButton: azdataType.RadioButtonComponent | undefined;
	private sqlCmdVariablesTable: azdataType.DeclarativeTableComponent | undefined;
	private sqlCmdVariablesFormComponentGroup: azdataType.FormComponentGroup | undefined;
	private loadSqlCmdVarsButton: azdataType.ButtonComponent | undefined;
	private loadProfileTextBox: azdataType.InputBoxComponent | undefined;
	private formBuilder: azdataType.FormBuilder | undefined;

	private connectionId: string | undefined;
	private connectionIsDataSource: boolean | undefined;
	private sqlCmdVars: Record<string, string> | undefined;
	private deploymentOptions: DeploymentOptions | undefined;
	private profileUsed: boolean = false;
	private serverName: string | undefined;

	private toDispose: vscode.Disposable[] = [];

	public publish: ((proj: Project, profile: IPublishSettings) => any) | undefined;
	public generateScript: ((proj: Project, profile: IGenerateScriptSettings) => any) | undefined;
	public readPublishProfile: ((profileUri: vscode.Uri) => any) | undefined;

	constructor(private project: Project) {
		this.dialog = utils.getAzdataApi()!.window.createModelViewDialog(constants.publishDialogName, 'sqlProjectPublishDialog');
		this.publishTab = utils.getAzdataApi()!.window.createTab(constants.publishDialogName);
	}

	public openDialog(): void {
		this.initializeDialog();
		this.dialog.okButton.label = constants.publish;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.publishClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		let generateScriptButton: azdataType.window.Button = utils.getAzdataApi()!.window.createButton(constants.generateScriptButtonText);
		this.toDispose.push(generateScriptButton.onClick(async () => await this.generateScriptClick()));
		generateScriptButton.enabled = false;

		this.dialog.customButtons = [];
		this.dialog.customButtons.push(generateScriptButton);

		utils.getAzdataApi()!.window.openDialog(this.dialog);
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
						component: <azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable
					}
				],
				title: constants.sqlCmdTableLabel
			};

			const profileRow = this.createProfileRow(view);
			const connectionRow = this.createConnectionRow(view);
			const databaseRow = this.createDatabaseRow(view);

			const horizontalFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			horizontalFormSection.addItems([profileRow, connectionRow, databaseRow]);


			this.formBuilder = <azdataType.FormBuilder>view.modelBuilder.formContainer()
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

			this.loadProfileTextBox!.focus();
		});
	}

	public async getConnectionUri(): Promise<string> {
		try {
			// if target connection is a data source, have to check if already connected or if connection dialog needs to be opened
			let connId: string;

			if (this.connectionIsDataSource) {
				const dataSource = (this.dataSourcesDropDown!.value! as DataSourceDropdownValue).dataSource;
				const connProfile: azdataType.IConnectionProfile = dataSource.getConnectionProfile();

				if (dataSource.integratedSecurity) {
					connId = (await utils.getAzdataApi()!.connection.connect(connProfile, false, false)).connectionId;
				}
				else {
					connId = (await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connProfile)).connectionId;
				}
			}
			else {
				if (!this.connectionId) {
					throw new Error('Connection not defined.');
				}

				connId = this.connectionId;
			}

			return await utils.getAzdataApi()!.connection.getUriForConnection(connId);
		}
		catch (err) {
			throw new Error(constants.unableToCreatePublishConnection + ': ' + utils.getErrorMessage(err));
		}
	}

	public async publishClick(): Promise<void> {
		const settings: IPublishSettings = {
			databaseName: this.getTargetDatabaseName(),
			serverName: this.getServerName(),
			upgradeExisting: true,
			connectionUri: await this.getConnectionUri(),
			sqlCmdVariables: this.getSqlCmdVariablesForPublish(),
			deploymentOptions: await this.getDeploymentOptions(),
			profileUsed: this.profileUsed
		};

		utils.getAzdataApi()!.window.closeDialog(this.dialog);
		await this.publish!(this.project, settings);

		this.dispose();
	}

	public async generateScriptClick(): Promise<void> {
		TelemetryReporter.sendActionEvent(TelemetryViews.SqlProjectPublishDialog, TelemetryActions.generateScriptClicked);

		const sqlCmdVars = this.getSqlCmdVariablesForPublish();
		const settings: IGenerateScriptSettings = {
			databaseName: this.getTargetDatabaseName(),
			serverName: this.getServerName(),
			connectionUri: await this.getConnectionUri(),
			sqlCmdVariables: sqlCmdVars,
			deploymentOptions: await this.getDeploymentOptions(),
			profileUsed: this.profileUsed
		};

		utils.getAzdataApi()!.window.closeDialog(this.dialog);

		if (this.generateScript) {
			await this.generateScript!(this.project, settings);
		}

		this.dispose();
	}

	public async getDeploymentOptions(): Promise<DeploymentOptions> {
		// eventually, database options will be configurable in this dialog
		// but for now, just send the default DacFx deployment options if no options were loaded from a publish profile
		if (!this.deploymentOptions) {
			this.deploymentOptions = await utils.GetDefaultDeploymentOptions();

			// re-include database-scoped credentials
			this.deploymentOptions.excludeObjectTypes = this.deploymentOptions.excludeObjectTypes.filter(x => x !== SchemaObjectType.DatabaseScopedCredentials);

			// this option needs to be true for same database references validation to work
			if (this.project.databaseReferences.length > 0) {
				this.deploymentOptions.includeCompositeObjects = true;
			}
		}

		return this.deploymentOptions;
	}

	public getSqlCmdVariablesForPublish(): Record<string, string> {
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

	public getServerName(): string {
		return this.serverName!;
	}

	private createRadioButtons(view: azdataType.ModelView): azdataType.Component {
		this.connectionsRadioButton = view.modelBuilder.radioButton()
			.withProps({
				name: 'connection',
				label: constants.connectionRadioButtonLabel
			}).component();

		this.connectionsRadioButton.checked = true;
		this.connectionsRadioButton.onDidClick(() => {
			this.formBuilder!.removeFormItem(<azdataType.FormComponent>this.dataSourcesFormComponent);
			// TODO: fix this when data sources are enabled again
			// this.formBuilder!.insertFormItem(<azdata.FormComponent>this.targetConnectionTextBox, 2);
			this.connectionIsDataSource = false;
			this.targetDatabaseDropDown!.value = this.getDefaultDatabaseName();
		});

		this.dataSourcesRadioButton = view.modelBuilder.radioButton()
			.withProps({
				name: 'connection',
				label: constants.dataSourceRadioButtonLabel
			}).component();

		this.dataSourcesRadioButton.onDidClick(() => {
			// TODO: fix this when data sources are enabled again
			// this.formBuilder!.removeFormItem(<azdata.FormComponent>this.targetConnectionTextBox);
			this.formBuilder!.insertFormItem(<azdataType.FormComponent>this.dataSourcesFormComponent, 2);
			this.connectionIsDataSource = true;

			this.setDatabaseToSelectedDataSourceDatabase();
		});

		let flexRadioButtonsModel: azdataType.FlexContainer = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.connectionsRadioButton, this.dataSourcesRadioButton])
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return flexRadioButtonsModel;
	}

	private createTargetConnectionComponent(view: azdataType.ModelView): azdataType.InputBoxComponent {
		this.targetConnectionTextBox = view.modelBuilder.inputBox().withProps({
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

	private createDataSourcesFormComponent(view: azdataType.ModelView): azdataType.FormComponent {
		if (this.project.dataSources.length > 0) {
			return this.createDataSourcesDropdown(view);
		} else {
			const noDataSourcesText = view.modelBuilder.text().withProps({ value: constants.noDataSourcesText }).component();
			return {
				title: constants.dataSourceDropdownTitle,
				component: noDataSourcesText
			};
		}
	}

	private createDataSourcesDropdown(view: azdataType.ModelView): azdataType.FormComponent {
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

		this.dataSourcesDropDown = view.modelBuilder.dropDown().withProps({
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

	private createProfileRow(view: azdataType.ModelView): azdataType.FlexContainer {
		const loadProfileButton = this.createLoadProfileButton(view);
		this.loadProfileTextBox = view.modelBuilder.inputBox().withProps({
			placeHolder: constants.loadProfilePlaceholderText,
			ariaLabel: constants.profile,
			width: cssStyles.publishDialogTextboxWidth
		}).component();

		const profileLabel = view.modelBuilder.text().withProps({
			value: constants.profile,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		const profileRow = view.modelBuilder.flexContainer().withItems([profileLabel, this.loadProfileTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		profileRow.insertItem(loadProfileButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return profileRow;
	}

	private createConnectionRow(view: azdataType.ModelView): azdataType.FlexContainer {
		this.targetConnectionTextBox = this.createTargetConnectionComponent(view);
		const selectConnectionButton: azdataType.Component = this.createSelectConnectionButton(view);

		const serverLabel = view.modelBuilder.text().withProps({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, this.targetConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.insertItem(selectConnectionButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdataType.ModelView): azdataType.FlexContainer {
		this.targetDatabaseDropDown = view.modelBuilder.dropDown().withProps({
			values: [this.getDefaultDatabaseName()],
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

		const databaseLabel = view.modelBuilder.text().withProps({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdataType.DropDownComponent>this.targetDatabaseDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	private createSqlCmdTable(view: azdataType.ModelView): azdataType.DeclarativeTableComponent {
		this.sqlCmdVars = { ...this.project.sqlCmdVariables };

		const table = view.modelBuilder.declarativeTable().withProps({
			ariaLabel: constants.sqlCmdTableLabel,
			dataValues: this.convertSqlCmdVarsToTableFormat(this.sqlCmdVars),
			columns: [
				{
					displayName: constants.sqlCmdVariableColumn,
					valueType: utils.getAzdataApi()!.DeclarativeDataType.string,
					width: '50%',
					isReadOnly: true,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: constants.sqlCmdValueColumn,
					valueType: utils.getAzdataApi()!.DeclarativeDataType.string,
					width: '50%',
					isReadOnly: false,
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}],
			width: '420px'
		}).component();

		table.onDataChanged(() => {
			this.sqlCmdVars = {};
			table.dataValues?.forEach((row) => {
				(<Record<string, string>>this.sqlCmdVars)[<string>row[0].value] = <string>row[1].value;
			});

			this.tryEnableGenerateScriptAndOkButtons();
		});

		return table;
	}

	private createLoadSqlCmdVarsButton(view: azdataType.ModelView): azdataType.ButtonComponent {
		let loadSqlCmdVarsButton: azdataType.ButtonComponent = view.modelBuilder.button().withProps({
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

			const data = this.convertSqlCmdVarsToTableFormat(this.sqlCmdVars!);
			(<azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable)!.updateProperties({
				dataValues: data
			});

			this.tryEnableGenerateScriptAndOkButtons();
		});

		return loadSqlCmdVarsButton;
	}

	private createSelectConnectionButton(view: azdataType.ModelView): azdataType.Component {
		let selectConnectionButton: azdataType.ButtonComponent = view.modelBuilder.button().withProps({
			ariaLabel: constants.selectConnection,
			iconPath: IconPathHelper.selectConnection,
			height: '16px',
			width: '16px'
		}).component();

		selectConnectionButton.onDidClick(async () => {
			let connection = await utils.getAzdataApi()!.connection.openConnectionDialog();
			this.connectionId = connection.connectionId;
			this.serverName = connection.options['server'];

			let connectionTextboxValue: string = getConnectionName(connection);

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
		this.targetConnectionTextBox!.updateProperty('title', connectionTextboxValue);

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			const databaseValues = (await utils.getAzdataApi()!.connection.listDatabases(connectionId))
				// filter out system dbs
				.filter(db => !constants.systemDbs.includes(db));

			this.targetDatabaseDropDown!.values = databaseValues;
		}
	}

	private createLoadProfileButton(view: azdataType.ModelView): azdataType.ButtonComponent {
		let loadProfileButton: azdataType.ButtonComponent = view.modelBuilder.button().withProps({
			ariaLabel: constants.loadProfilePlaceholderText,
			iconPath: IconPathHelper.folder_blue,
			height: '18px',
			width: '18px'
		}).component();

		loadProfileButton.onDidClick(async () => {
			const fileUris = await promptForPublishProfile(this.project.projectFolderPath);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			if (this.readPublishProfile) {
				const result = await this.readPublishProfile(fileUris[0]);
				// clear out old database dropdown values. They'll get populated later if there was a connection specified in the profile
				(<azdataType.DropDownComponent>this.targetDatabaseDropDown).values = [];

				this.connectionId = result.connectionId;
				this.serverName = result.serverName;
				await this.updateConnectionComponents(result.connection, <string>this.connectionId);

				if (result.databaseName) {
					this.targetDatabaseDropDown!.values?.push(result.databaseName);
					this.targetDatabaseDropDown!.value = result.databaseName;
				}

				if (Object.keys(result.sqlCmdVariables).length) {
					// add SQLCMD Variables table if it wasn't there before and the profile had sqlcmd variables
					if (Object.keys(this.project.sqlCmdVariables).length === 0 && Object.keys(<Record<string, string>>this.sqlCmdVars).length === 0) {
						this.formBuilder?.addFormItem(<azdataType.FormComponentGroup>this.sqlCmdVariablesFormComponentGroup);
					}
				} else if (Object.keys(this.project.sqlCmdVariables).length === 0) {
					// remove the table if there are no SQLCMD variables in the project and loaded profile
					this.formBuilder?.removeFormItem(<azdataType.FormComponentGroup>this.sqlCmdVariablesFormComponentGroup);
				}

				for (let key in result.sqlCmdVariables) {
					(<Record<string, string>>this.sqlCmdVars)[key] = result.sqlCmdVariables[key];
				}

				this.deploymentOptions = result.options;

				const data = this.convertSqlCmdVarsToTableFormat(this.getSqlCmdVariablesForPublish());
				await (<azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable).updateProperties({
					dataValues: data
				});

				// show file path in text box and hover text
				this.loadProfileTextBox!.value = fileUris[0].fsPath;
				this.loadProfileTextBox!.updateProperty('title', fileUris[0].fsPath);
			}
		});

		return loadProfileButton;
	}

	private convertSqlCmdVarsToTableFormat(sqlCmdVars: Record<string, string>): azdataType.DeclarativeTableCellValue[][] {
		let data = [];
		for (let key in sqlCmdVars) {
			data.push([{ value: key }, { value: sqlCmdVars[key] }]);
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

export function promptForPublishProfile(defaultPath: string): Thenable<vscode.Uri[] | undefined> {
	return vscode.window.showOpenDialog(
		{
			title: constants.selectProfile,
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri: vscode.Uri.file(defaultPath),
			filters: {
				[constants.publishSettingsFiles]: ['publish.xml']
			}
		}
	);
}
