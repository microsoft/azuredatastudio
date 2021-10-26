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
import { IDeploySettings } from '../models/IDeploySettings';
import { DeploymentOptions } from '../../../mssql/src/mssql';
import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { getConnectionName, getDockerBaseImages } from './utils';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { IDeployProfile } from '../models/deploy/deployProfile';

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
	private existingServerRadioButton: azdataType.RadioButtonComponent | undefined;
	private dockerServerRadioButton: azdataType.RadioButtonComponent | undefined;
	private dataSourcesRadioButton: azdataType.RadioButtonComponent | undefined;
	private sqlCmdVariablesTable: azdataType.DeclarativeTableComponent | undefined;
	private sqlCmdVariablesFormComponentGroup: azdataType.FormComponentGroup | undefined;
	private loadSqlCmdVarsButton: azdataType.ButtonComponent | undefined;
	private loadProfileTextBox: azdataType.InputBoxComponent | undefined;
	private formBuilder: azdataType.FormBuilder | undefined;
	private connectionRow: azdataType.FlexContainer | undefined;
	private localDbSection: azdataType.FlexContainer | undefined;
	private baseDockerImageDropDown: azdataType.DropDownComponent | undefined;
	private serverAdminPasswordTextBox: azdataType.InputBoxComponent | undefined;
	private serverConfigAdminPasswordTextBox: azdataType.InputBoxComponent | undefined;
	private serverPortTextBox: azdataType.InputBoxComponent | undefined;

	private connectionId: string | undefined;
	private connectionIsDataSource: boolean | undefined;
	private sqlCmdVars: Record<string, string> | undefined;
	private deploymentOptions: DeploymentOptions | undefined;
	private profileUsed: boolean = false;
	private serverName: string | undefined;

	private toDispose: vscode.Disposable[] = [];

	public publish: ((proj: Project, profile: IDeploySettings) => any) | undefined;
	public publishToContainer: ((proj: Project, profile: IDeployProfile) => any) | undefined;
	public generateScript: ((proj: Project, profile: IDeploySettings) => any) | undefined;
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
			const flexRadioButtonsModel = this.createPublishTypeRadioButtons(view);
			this.createRadioButtons(view);
			this.createLocalDbInfoRow(view);

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
			this.connectionRow = this.createConnectionRow(view);
			const databaseRow = this.createDatabaseRow(view);

			const horizontalFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			horizontalFormSection.addItems([profileRow, databaseRow]);


			this.formBuilder = <azdataType.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							{
								component: flexRadioButtonsModel,
								title: ''
							},
							{
								component: this.connectionRow,
								title: ''
							},
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

			await this.loadProfileTextBox!.focus();
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
		if (this.existingServerRadioButton?.checked) {
			const settings: IDeploySettings = {
				databaseName: this.getTargetDatabaseName(),
				serverName: this.getServerName(),
				connectionUri: await this.getConnectionUri(),
				sqlCmdVariables: this.getSqlCmdVariablesForPublish(),
				deploymentOptions: await this.getDeploymentOptions(),
				profileUsed: this.profileUsed
			};

			utils.getAzdataApi()!.window.closeDialog(this.dialog);
			await this.publish!(this.project, settings);
		} else {
			const settings: IDeployProfile = {
				localDbSetting: {
					dbName: this.getTargetDatabaseName(),
					dockerBaseImage: this.getBaseDockerImageName(),
					password: this.serverAdminPasswordTextBox?.value || '',
					port: +(this.serverPortTextBox?.value || ''),
					serverName: constants.defaultLocalServerName,
					userName: constants.defaultLocalServerAdminName
				},
				deploySettings: {
					databaseName: this.getTargetDatabaseName(),
					serverName: this.getServerName(),
					connectionUri: '',
					sqlCmdVariables: this.getSqlCmdVariablesForPublish(),
					deploymentOptions: await this.getDeploymentOptions(),
					profileUsed: this.profileUsed
				}
			};

			utils.getAzdataApi()!.window.closeDialog(this.dialog);
			await this.publishToContainer!(this.project, settings);
		}

		this.dispose();
	}

	public async generateScriptClick(): Promise<void> {
		TelemetryReporter.sendActionEvent(TelemetryViews.SqlProjectPublishDialog, TelemetryActions.generateScriptClicked);

		const sqlCmdVars = this.getSqlCmdVariablesForPublish();
		const settings: IDeploySettings = {
			databaseName: this.getTargetDatabaseName(),
			serverName: this.getServerName(),
			connectionUri: await this.getConnectionUri(),
			sqlCmdVariables: sqlCmdVars,
			deploymentOptions: await this.getDeploymentOptions(),
			profileUsed: this.profileUsed
		};

		utils.getAzdataApi()!.window.closeDialog(this.dialog);

		await this.generateScript?.(this.project, settings);

		this.dispose();
	}

	public async getDeploymentOptions(): Promise<DeploymentOptions> {
		// eventually, database options will be configurable in this dialog
		// but for now, just send the default DacFx deployment options if no options were loaded from a publish profile
		if (!this.deploymentOptions) {
			// We only use the dialog in ADS context currently so safe to cast to the mssql DeploymentOptions here
			this.deploymentOptions = await utils.getDefaultPublishDeploymentOptions(this.project) as DeploymentOptions;
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

	public getBaseDockerImageName(): string {
		return <string>this.baseDockerImageDropDown?.value ?? '';
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

	private createPublishTypeRadioButtons(view: azdataType.ModelView): azdataType.Component {
		this.existingServerRadioButton = view.modelBuilder.radioButton()
			.withProps({
				name: 'publishType',
				label: constants.publishToExistingServer
			}).component();

		this.existingServerRadioButton.checked = true;
		this.existingServerRadioButton.onDidChangeCheckedState((checked) => {
			this.onPublishTypeChange(checked);
		});

		this.dockerServerRadioButton = view.modelBuilder.radioButton()
			.withProps({
				name: 'publishType',
				label: constants.publishToDockerContainer
			}).component();

		this.dockerServerRadioButton.onDidChangeCheckedState((checked) => {
			this.onPublishTypeChange(!checked);
		});

		let flexRadioButtonsModel: azdataType.FlexContainer = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.existingServerRadioButton, this.dockerServerRadioButton])
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return flexRadioButtonsModel;
	}

	private onPublishTypeChange(existingServer: boolean) {
		this.tryEnableGenerateScriptAndOkButtons();
		if (existingServer) {
			if (this.connectionRow) {
				this.formBuilder!.insertFormItem({
					title: '',
					component: this.connectionRow
				}, 2);
			}
			if (this.localDbSection) {
				this.formBuilder!.removeFormItem({
					title: '',
					component: this.localDbSection
				});
			}
		} else {
			if (this.connectionRow) {
				this.formBuilder!.removeFormItem({
					title: '',
					component: this.connectionRow
				});
			}
			if (this.localDbSection) {
				this.formBuilder!.insertFormItem({
					title: '',
					component: this.localDbSection
				}, 2);
			}
		}
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

	private createLocalDbInfoRow(view: azdataType.ModelView): azdataType.FlexContainer {
		this.serverPortTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			ariaLabel: constants.serverPortNumber,
			placeHolder: constants.serverPortNumber,
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			inputType: 'number',
			validationErrorMessage: constants.portMustBeNumber
		}).withValidation(component => utils.validateSqlServerPortNumber(component.value)).component();

		this.serverPortTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndOkButtons();
		});
		const serverPortRow = this.createFormRow(view, constants.serverPortNumber, this.serverPortTextBox);
		this.serverAdminPasswordTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			ariaLabel: constants.serverPasswordNumber,
			placeHolder: constants.serverPasswordNumber,
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			inputType: 'password',
			validationErrorMessage: constants.invalidSQLPasswordMessage
		}).withValidation(component => !utils.isEmptyString(component.value) && utils.isValidSQLPassword(component.value || '')).component();

		const serverPasswordRow = this.createFormRow(view, constants.serverPasswordNumber, this.serverAdminPasswordTextBox);
		this.serverConfigAdminPasswordTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			ariaLabel: constants.confirmServerPasswordNumber,
			placeHolder: constants.confirmServerPasswordNumber,
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			inputType: 'password',
			validationErrorMessage: constants.passwordNotMatch
		}).withValidation(component => component.value === this.serverAdminPasswordTextBox?.value).component();
		this.serverAdminPasswordTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndOkButtons();
			if (this.serverConfigAdminPasswordTextBox) {
				this.serverConfigAdminPasswordTextBox.value = '';
			}
		});
		this.serverConfigAdminPasswordTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndOkButtons();

		});
		const serverConfirmPasswordRow = this.createFormRow(view, constants.confirmServerPasswordNumber, this.serverConfigAdminPasswordTextBox);

		this.baseDockerImageDropDown = view.modelBuilder.dropDown().withProps({
			values: getDockerBaseImages(),
			ariaLabel: constants.baseDockerImage,
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true
		}).component();

		const dropDownRow = this.createFormRow(view, constants.confirmServerPasswordNumber, this.baseDockerImageDropDown);

		this.localDbSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		this.localDbSection.addItems([serverPortRow, serverPasswordRow, serverConfirmPasswordRow, dropDownRow]);
		return this.localDbSection;
	}

	private createFormRow(view: azdataType.ModelView, label: string, component: azdataType.Component): azdataType.FlexContainer {

		const labelComponent = view.modelBuilder.text().withProps({
			value: label,
			requiredIndicator: true,
			width: cssStyles.publishDialogLabelWidth
		}).component();

		return view.modelBuilder.flexContainer().withItems([labelComponent, component], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
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
			await (<azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable)!.updateProperties({
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

			await this.updateConnectionComponents(connectionTextboxValue, this.connectionId);

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
		await this.targetConnectionTextBox!.updateProperty('title', connectionTextboxValue);

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
				await this.loadProfileTextBox!.updateProperty('title', fileUris[0].fsPath);
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
		let publishEnabled: boolean = false;
		let generateScriptEnabled: boolean = false;

		if (this.existingServerRadioButton?.checked) {
			if ((this.targetConnectionTextBox!.value && this.targetDatabaseDropDown!.value
				|| this.connectionIsDataSource && this.targetDatabaseDropDown!.value)
				&& this.allSqlCmdVariablesFilled()) {
				publishEnabled = true;
				generateScriptEnabled = true;
			}
		} else if (utils.validateSqlServerPortNumber(this.serverPortTextBox?.value) &&
			!utils.isEmptyString(this.serverAdminPasswordTextBox?.value) &&
			utils.isValidSQLPassword(this.serverAdminPasswordTextBox?.value || '', constants.defaultLocalServerAdminName) &&
			this.serverAdminPasswordTextBox?.value === this.serverConfigAdminPasswordTextBox?.value) {
			publishEnabled = true; // only publish is supported for container
		}

		this.dialog.okButton.enabled = publishEnabled;
		this.dialog.customButtons[0].enabled = generateScriptEnabled;
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
