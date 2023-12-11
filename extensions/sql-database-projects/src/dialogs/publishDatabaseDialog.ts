/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as uiUtils from './utils';
import * as path from 'path';

import { Project } from '../models/project';
import { SqlConnectionDataSource } from '../models/dataSources/sqlConnectionStringSource';
import { DeploymentOptions } from 'mssql';
import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { getAgreementDisplayText, getConnectionName, getDockerBaseImage, getPublishServerName } from './utils';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';
import { Deferred } from '../common/promise';
import { PublishOptionsDialog } from './publishOptionsDialog';
import { IPublishToDockerSettings, ISqlProjectPublishSettings } from '../models/deploy/publishSettings';
import { PublishProfile, promptToSaveProfile } from '../models/publishProfile/publishProfile';

interface DataSourceDropdownValue extends azdataType.CategoryValue {
	dataSource: SqlConnectionDataSource;
	database: string;
}

export class PublishDatabaseDialog {
	public dialog: azdataType.window.Dialog;
	public publishTab: azdataType.window.DialogTab;
	private targetConnectionTextBox: azdataType.InputBoxComponent | undefined;
	private dataSourcesDropDown: azdataType.DropDownComponent | undefined;
	private targetDatabaseDropDown: azdataType.DropDownComponent | undefined;
	private targetDatabaseTextBox: azdataType.TextComponent | undefined;
	private selectConnectionButton: azdataType.ButtonComponent | undefined;
	private existingServerRadioButton: azdataType.RadioButtonComponent | undefined;
	private dockerServerRadioButton: azdataType.RadioButtonComponent | undefined;
	private eulaCheckBox: azdataType.CheckBoxComponent | undefined;
	private sqlCmdVariablesTable: azdataType.DeclarativeTableComponent | undefined;
	private sqlCmdVariablesFormComponentGroup: azdataType.FormComponentGroup | undefined;
	private revertSqlCmdVarsButton: azdataType.ButtonComponent | undefined;
	private loadProfileTextBox: azdataType.InputBoxComponent | undefined;
	private formBuilder: azdataType.FormBuilder | undefined;
	private connectionRow: azdataType.FlexContainer | undefined;
	private databaseRow: azdataType.FlexContainer | undefined;
	private localDbSection: azdataType.FlexContainer | undefined;
	private imageTagDropDown: azdataType.DropDownComponent | undefined;
	private serverAdminPasswordTextBox: azdataType.InputBoxComponent | undefined;
	private serverConfigAdminPasswordTextBox: azdataType.InputBoxComponent | undefined;
	private serverPortTextBox: azdataType.InputBoxComponent | undefined;
	private existingServerSelected: boolean = true;
	private connectionId: string | undefined;
	private connectionIsDataSource: boolean | undefined;
	private sqlCmdVars: Map<string, string> | undefined;
	private deploymentOptions: DeploymentOptions | undefined;
	private serverName: string | undefined;
	protected optionsButton: azdataType.ButtonComponent | undefined;
	private publishOptionsDialog: PublishOptionsDialog | undefined;
	public publishOptionsModified: boolean = false;
	private publishProfileUri: vscode.Uri | undefined;

	private completionPromise: Deferred = new Deferred();

	private toDispose: vscode.Disposable[] = [];

	public publish: ((proj: Project, profile: ISqlProjectPublishSettings) => any) | undefined;
	public publishToContainer: ((proj: Project, profile: IPublishToDockerSettings) => any) | undefined;
	public generateScript: ((proj: Project, profile: ISqlProjectPublishSettings) => any) | undefined;
	public readPublishProfile: ((profileUri: vscode.Uri) => Promise<PublishProfile>) | undefined;
	public savePublishProfile: ((profilePath: string, databaseName: string, connectionString: string, sqlCommandVariableValues?: Map<string, string>, deploymentOptions?: DeploymentOptions) => any) | undefined;

	constructor(private project: Project) {
		this.dialog = utils.getAzdataApi()!.window.createModelViewDialog(constants.publishDialogName, 'sqlProjectPublishDialog');
		this.toDispose.push(this.dialog.onClosed(_ => this.completionPromise.resolve()));
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

	public set publishToExistingServer(v: boolean) {
		this.existingServerSelected = v;
	}


	public waitForClose(): Promise<void> {
		return this.completionPromise.promise;
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
			const flexRadioButtonsModel = this.createPublishTypeRadioButtons(view);
			await this.createLocalDbInfoRow(view);

			this.sqlCmdVariablesTable = this.createSqlCmdTable(view);
			this.revertSqlCmdVarsButton = this.createRevertSqlCmdVarsButton(view);

			this.sqlCmdVariablesFormComponentGroup = {
				components: [
					{
						title: '',
						component: this.revertSqlCmdVarsButton
					},
					{
						title: '',
						component: <azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable
					}
				],
				title: constants.sqlCmdVariables
			};

			// Get the default deployment option and set
			const options = await this.getDefaultDeploymentOptions();
			this.setDeploymentOptions(options);

			const profileRow = this.createProfileSection(view);

			this.connectionRow = this.createConnectionRow(view);
			this.databaseRow = this.createDatabaseRow(view);
			const displayOptionsButton = this.createOptionsButton(view);

			const horizontalFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			horizontalFormSection.addItems([this.databaseRow]);

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
								component: profileRow,
								title: constants.profile
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
							{
								component: displayOptionsButton,
								title: ''
							}
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
			if (this.project.sqlCmdVariables.size > 0) {
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
				const connProfile: azdataType.IConnectionProfile = dataSource.getConnectionProfile();

				if (dataSource.integratedSecurity) {
					const connResult = await utils.getAzdataApi()!.connection.connect(connProfile, false, false);
					utils.throwIfNotConnected(connResult);
					connId = connResult.connectionId!;
				}
				else {
					connId = (await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connProfile, {
						saveConnection: false,
						showDashboard: false,
						showConnectionDialogOnError: true,
						showFirewallRuleOnError: true
					})).connectionId;
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
		if (this.existingServerSelected) {
			const settings: ISqlProjectPublishSettings = {
				databaseName: this.targetDatabaseName,
				serverName: this.getServerName(),
				connectionUri: await this.getConnectionUri(),
				sqlCmdVariables: this.getSqlCmdVariablesForPublish(),
				deploymentOptions: await this.getDeploymentOptions(),
				publishProfileUri: this.publishProfileUri
			};

			utils.getAzdataApi()!.window.closeDialog(this.dialog);
			await this.publish!(this.project, settings);
		} else {
			const imageInfo = getDockerBaseImage(this.project.getProjectTargetVersion());
			const imageName = imageInfo?.name;
			const imageTag = this.imageTagDropDown?.value;
			let dockerBaseImage = imageName;

			// Add the image tag if it's not the latest
			if (imageTag && imageTag !== constants.dockerImageDefaultTag) {
				dockerBaseImage = `${imageName}:${imageTag}`;
			}

			const settings: IPublishToDockerSettings = {
				dockerSettings: {
					dbName: this.targetDatabaseName,
					dockerBaseImage: dockerBaseImage,
					dockerBaseImageEula: imageInfo?.agreementInfo?.link?.url || '',
					password: this.serverAdminPasswordTextBox?.value || '',
					port: +(this.serverPortTextBox?.value || constants.defaultPortNumber),
					serverName: constants.defaultLocalServerName,
					userName: constants.defaultLocalServerAdminName
				},
				sqlProjectPublishSettings: {
					databaseName: this.targetDatabaseName,
					serverName: constants.defaultLocalServerName,
					connectionUri: '',
					sqlCmdVariables: this.getSqlCmdVariablesForPublish(),
					deploymentOptions: await this.getDeploymentOptions(),
					publishProfileUri: this.publishProfileUri
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
		const settings: ISqlProjectPublishSettings = {
			databaseName: this.targetDatabaseName,
			serverName: this.getServerName(),
			connectionUri: await this.getConnectionUri(),
			sqlCmdVariables: sqlCmdVars,
			deploymentOptions: await this.getDeploymentOptions(),
			publishProfileUri: this.publishProfileUri
		};

		utils.getAzdataApi()!.window.closeDialog(this.dialog);

		await this.generateScript?.(this.project, settings);

		this.dispose();
	}

	public async getDeploymentOptions(): Promise<DeploymentOptions> {
		if (!this.deploymentOptions) {
			// We only use the dialog in ADS context currently so safe to cast to the mssql DeploymentOptions here
			this.deploymentOptions = await utils.getDefaultPublishDeploymentOptions(this.project) as DeploymentOptions;
		}
		return this.deploymentOptions;
	}

	public getSqlCmdVariablesForPublish(): Map<string, string> {
		// get SQLCMD variables from table
		let sqlCmdVariables = this.sqlCmdVars ?? new Map();
		return sqlCmdVariables;
	}

	public get targetDatabaseName(): string {
		if (this.existingServerSelected) {
			return <string>this.targetDatabaseDropDown?.value ?? '';
		} else {
			return <string>this.targetDatabaseTextBox?.value || '';
		}
	}

	public set targetDatabaseName(value: string) {
		(<azdataType.DropDownComponent>this.targetDatabaseDropDown).values = [];
		this.targetDatabaseDropDown!.values?.push(<any>value);
		this.targetDatabaseDropDown!.value = value;

		if (this.targetDatabaseTextBox) {
			this.targetDatabaseTextBox!.value = value;
		}
	}

	public getDefaultDatabaseName(): string {
		return this.project.projectFileName;
	}

	public getServerName(): string {
		return this.serverName!;
	}

	private createPublishTypeRadioButtons(view: azdataType.ModelView): azdataType.Component {
		const name = getPublishServerName(this.project.getProjectTargetVersion());
		const publishToLabel = view.modelBuilder.text().withProps({
			value: constants.publishTo,
			width: cssStyles.publishDialogLabelWidth
		}).component();
		this.existingServerRadioButton = view.modelBuilder.radioButton()
			.withProps({
				name: 'publishType',
				label: constants.publishToExistingServer(name)
			}).component();

		this.existingServerRadioButton.checked = true;
		this.existingServerRadioButton.onDidChangeCheckedState((checked) => {
			this.onPublishTypeChange(checked, view);
		});

		this.dockerServerRadioButton = view.modelBuilder.radioButton()
			.withProps({
				name: 'publishType',
				label: name === constants.AzureSqlServerName ? constants.publishToDockerContainerPreview(name) : constants.publishToDockerContainer(name)
			}).component();

		this.dockerServerRadioButton.onDidChangeCheckedState((checked) => {
			this.onPublishTypeChange(!checked, view);
		});

		const radioButtonContainer = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.existingServerRadioButton, this.dockerServerRadioButton])
			.withProps({ ariaRole: 'radiogroup', ariaLabel: constants.publishTo })
			.component();

		let flexRadioButtonsModel: azdataType.FlexContainer = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
			.withItems([publishToLabel, radioButtonContainer], { CSSStyles: { flex: '0 0 auto', 'margin-right': '10px' } })
			.component();

		return flexRadioButtonsModel;
	}

	private onPublishTypeChange(existingServer: boolean, view: azdataType.ModelView) {
		this.existingServerSelected = existingServer;
		this.createDatabaseRow(view);
		this.tryEnableGenerateScriptAndPublishButtons();
		if (existingServer) {
			if (this.localDbSection) {
				this.formBuilder!.removeFormItem({
					title: '',
					component: this.localDbSection
				});
			}

			if (this.connectionRow) {
				this.formBuilder!.insertFormItem({
					title: '',
					component: this.connectionRow
				}, 3);
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
			this.tryEnableGenerateScriptAndPublishButtons();
		});

		return this.targetConnectionTextBox;
	}

	private createProfileSection(view: azdataType.ModelView): azdataType.FlexContainer {
		const selectProfileButton = this.createSelectProfileButton(view);
		const saveProfileAsButton = this.createSaveProfileAsButton(view);

		this.loadProfileTextBox = view.modelBuilder.inputBox().withProps({
			placeHolder: constants.loadProfilePlaceholderText,
			ariaLabel: constants.profile,
			width: '200px',
			enabled: false
		}).component();

		const buttonsList = view.modelBuilder.flexContainer().withItems([selectProfileButton, saveProfileAsButton], { flex: '0 0 auto', CSSStyles: { 'margin-right': '5px', 'text-align': 'justify' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		const profileRow = view.modelBuilder.flexContainer().withItems([this.loadProfileTextBox, buttonsList], { flex: '0 0 auto', CSSStyles: { 'margin-right': '15px', 'text-align': 'justify' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

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

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, this.targetConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin': '-8px 10px -15px 0' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.insertItem(selectConnectionButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return connectionRow;
	}

	private async createLocalDbInfoRow(view: azdataType.ModelView): Promise<azdataType.FlexContainer> {
		const name = getPublishServerName(this.project.getProjectTargetVersion());
		this.serverPortTextBox = view.modelBuilder.inputBox().withProps({
			value: constants.defaultPortNumber,
			ariaLabel: constants.serverPortNumber(name),
			placeHolder: constants.serverPortNumber(name),
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			inputType: 'number',
			validationErrorMessage: constants.portMustBeNumber,
			required: true
		}).withValidation(component => utils.validateSqlServerPortNumber(component.value)).component();

		this.serverPortTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndPublishButtons();
		});
		const serverPortRow = this.createFormRow(view, constants.serverPortNumber(name), this.serverPortTextBox);
		this.serverAdminPasswordTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			ariaLabel: constants.serverPassword(name),
			placeHolder: constants.serverPassword(name),
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			inputType: 'password',
			validationErrorMessage: constants.invalidSQLPasswordMessage(name),
			required: true
		}).withValidation(component => !utils.isEmptyString(component.value) && utils.isValidSQLPassword(component.value || '')).component();

		const serverPasswordRow = this.createFormRow(view, constants.serverPassword(name), this.serverAdminPasswordTextBox);
		this.serverConfigAdminPasswordTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			ariaLabel: constants.confirmServerPassword(name),
			placeHolder: constants.confirmServerPassword(name),
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			inputType: 'password',
			validationErrorMessage: constants.passwordNotMatch(name),
			required: true
		}).withValidation(component => component.value === this.serverAdminPasswordTextBox?.value).component();
		this.serverAdminPasswordTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndPublishButtons();
			if (this.serverConfigAdminPasswordTextBox) {
				this.serverConfigAdminPasswordTextBox.value = '';
			}
		});
		this.serverConfigAdminPasswordTextBox.onTextChanged(() => {
			this.tryEnableGenerateScriptAndPublishButtons();
		});
		const serverConfirmPasswordRow = this.createFormRow(view, constants.confirmServerPassword(name), this.serverConfigAdminPasswordTextBox);

		const imageInfo = getDockerBaseImage(this.project.getProjectTargetVersion());
		const imageTags = await uiUtils.getImageTags(imageInfo!, this.project.getProjectTargetVersion(), true);

		this.imageTagDropDown = view.modelBuilder.dropDown().withProps({
			values: imageTags,
			value: imageTags[0],
			ariaLabel: constants.imageTag,
			width: cssStyles.publishDialogTextboxWidth,
			enabled: true,
			editable: true,
			required: true,
			fireOnTextChange: true
		}).component();

		this.imageTagDropDown.onValueChanged(() => {
			this.tryEnableGenerateScriptAndPublishButtons();
		});

		const agreementInfo = imageInfo.agreementInfo;
		const imageTagDropDownRow = this.createFormRow(view, constants.imageTag, this.imageTagDropDown);

		this.eulaCheckBox = view.modelBuilder.checkBox().withProps({
			ariaLabel: getAgreementDisplayText(agreementInfo),
			required: true
		}).component();
		this.eulaCheckBox.onChanged(() => {
			this.tryEnableGenerateScriptAndPublishButtons();
		});

		const eulaRow = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		this.localDbSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		this.localDbSection.addItems([serverPortRow, serverPasswordRow, serverConfirmPasswordRow, imageTagDropDownRow, eulaRow]);

		this.eulaCheckBox.checked = false;
		if (imageInfo?.agreementInfo.link) {
			const text = view.modelBuilder.text().withProps({
				value: constants.eulaAgreementTemplate,
				links: [imageInfo.agreementInfo.link],
				requiredIndicator: true
			}).component();

			if (eulaRow && this.eulaCheckBox) {
				eulaRow?.clearItems();
				eulaRow?.addItems([this.eulaCheckBox, text], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } });
			}
		}
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
		let databaseComponent: azdataType.Component | undefined;

		if (!this.existingServerSelected) {
			if (this.targetDatabaseTextBox === undefined) {
				this.targetDatabaseTextBox = view.modelBuilder.inputBox().withProps({
					ariaLabel: constants.databaseNameLabel,
					required: true,
					width: cssStyles.publishDialogDropdownWidth,
					value: this.getDefaultDatabaseName()
				}).component();
			}
			databaseComponent = this.targetDatabaseTextBox;
		} else {
			if (this.targetDatabaseDropDown === undefined) {
				this.targetDatabaseDropDown = view.modelBuilder.dropDown().withProps({
					values: [this.getDefaultDatabaseName()],
					value: this.getDefaultDatabaseName(),
					ariaLabel: constants.databaseNameLabel,
					required: true,
					width: cssStyles.publishDialogDropdownWidth,
					editable: true,
					fireOnTextChange: true
				}).component();

				this.targetDatabaseDropDown.onValueChanged(() => {
					this.tryEnableGenerateScriptAndPublishButtons();
				});
			}

			databaseComponent = this.targetDatabaseDropDown;
		}

		const databaseLabel = view.modelBuilder.text().withProps({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.publishDialogLabelWidth
		}).component();
		const itemLayout = { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } };
		if (this.databaseRow === undefined) {
			this.databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdataType.Component>databaseComponent], itemLayout).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		} else {
			this.databaseRow.clearItems();
			this.databaseRow.addItems([databaseLabel, <azdataType.Component>databaseComponent], itemLayout);
		}
		return this.databaseRow;
	}

	private createSqlCmdTable(view: azdataType.ModelView): azdataType.DeclarativeTableComponent {
		this.sqlCmdVars = this.project.sqlCmdVariables;

		const table = view.modelBuilder.declarativeTable().withProps({
			ariaLabel: constants.sqlCmdVariables,
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
			this.sqlCmdVars = new Map();
			table.dataValues?.forEach((row) => {
				this.sqlCmdVars?.set(<string>row[0].value, <string>row[1].value);
			});

			this.updateRevertSqlCmdVarsButtonState();
			this.tryEnableGenerateScriptAndPublishButtons();
		});

		return table;
	}

	private createRevertSqlCmdVarsButton(view: azdataType.ModelView): azdataType.ButtonComponent {
		let loadSqlCmdVarsButton: azdataType.ButtonComponent = view.modelBuilder.button().withProps({
			label: constants.revertSqlCmdVarsButtonTitle,
			title: constants.revertSqlCmdVarsButtonTitle,
			ariaLabel: constants.revertSqlCmdVarsButtonTitle,
			width: '210px',
			iconPath: IconPathHelper.refresh,
			height: '18px',
			CSSStyles: { 'font-size': '13px' },
			enabled: false // start disabled because no SQLCMD variable values have been edited yet
		}).component();

		loadSqlCmdVarsButton.onDidClick(async () => {
			for (const key of this.sqlCmdVars!.keys()) {

				this.sqlCmdVars!.set(key, this.getDefaultSqlCmdValue(key));
			}

			const data = this.convertSqlCmdVarsToTableFormat(this.sqlCmdVars!);
			await (<azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable)!.updateProperties({
				dataValues: data
			});

			this.updateRevertSqlCmdVarsButtonState();
			this.tryEnableGenerateScriptAndPublishButtons();
		});

		return loadSqlCmdVarsButton;
	}

	/**
	 * Gets the default value of a SQLCMD variable for a project
	 * @param varName
	 * @returns value defined in the sqlproj file, or blank string if not defined
	 */
	private getDefaultSqlCmdValue(varName: string): string {
		return this.project.sqlCmdVariables.get(varName) ?? '';
	}

	private createSelectConnectionButton(view: azdataType.ModelView): azdataType.Component {
		this.selectConnectionButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.selectConnection,
			title: constants.selectConnection,
			iconPath: IconPathHelper.selectConnection,
			height: '16px',
			width: '16px'
		}).component();

		this.selectConnectionButton.onDidClick(async () => {
			let connection = await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, undefined, {
				saveConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			});
			this.connectionId = connection.connectionId;
			this.serverName = connection.options['server'];

			let connectionTextboxValue: string = getConnectionName(connection);

			await this.updateConnectionComponents(connectionTextboxValue, this.connectionId, connection.options.database);
		});

		return this.selectConnectionButton;
	}

	private async updateConnectionComponents(connectionTextboxValue: string, connectionId: string, database: string) {
		this.targetConnectionTextBox!.value = connectionTextboxValue;
		await this.targetConnectionTextBox!.updateProperty('title', connectionTextboxValue);

		if (database && database !== constants.master) {
			this.targetDatabaseName = database;
		}

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			const databaseValues = (await utils.getAzdataApi()!.connection.listDatabases(connectionId))
				// filter out system dbs
				.filter(db => !constants.systemDbs.includes(db));

			this.targetDatabaseDropDown!.values = databaseValues;

			// change icon to the one without a plus sign
			this.selectConnectionButton!.iconPath = IconPathHelper.connect;
		}
	}

	private createSelectProfileButton(view: azdataType.ModelView): azdataType.ButtonComponent {
		let loadProfileButton: azdataType.ButtonComponent = view.modelBuilder.button().withProps({
			label: constants.selectProfile,
			title: constants.selectProfile,
			ariaLabel: constants.selectProfile,
			width: '90px',
			height: '25px',
			secondary: true,
		}).component();

		loadProfileButton.onDidClick(async () => {
			const fileUris = await promptForPublishProfile(this.project.projectFolderPath);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			if (this.readPublishProfile) {
				const result = await this.readPublishProfile(fileUris[0]);
				// clear out old database dropdown values. They'll get populated later if there was a connection specified in the profile
				this.targetDatabaseName = '';

				this.connectionId = result.connectionId;
				this.serverName = result.serverName;
				await this.updateConnectionComponents(result.connection, <string>this.connectionId, result.databaseName);

				// set options coming from the publish profiles to deployment options
				this.setDeploymentOptions(result.options);

				if ((<Map<string, string>>result.sqlCmdVariables).size) {
					// add SQLCMD Variables table if it wasn't there before and the profile had sqlcmd variables
					if (this.project.sqlCmdVariables.size === 0 && this.sqlCmdVars?.size === 0) {
						this.formBuilder?.addFormItem(<azdataType.FormComponentGroup>this.sqlCmdVariablesFormComponentGroup);
					}
				} else if (this.project.sqlCmdVariables.size === 0) {
					// remove the table if there are no SQLCMD variables in the project and loaded profile
					this.formBuilder?.removeFormItem(<azdataType.FormComponentGroup>this.sqlCmdVariablesFormComponentGroup);
				}

				for (let key of result.sqlCmdVariables.keys()) {
					this.sqlCmdVars?.set(key, result.sqlCmdVariables.get(key)!);
				}

				this.updateRevertSqlCmdVarsButtonState();
				this.deploymentOptions = result.options;

				const data = this.convertSqlCmdVarsToTableFormat(this.getSqlCmdVariablesForPublish());
				await (<azdataType.DeclarativeTableComponent>this.sqlCmdVariablesTable).updateProperties({
					dataValues: data
				});

				// show file path in text box and hover text
				this.loadProfileTextBox!.value = fileUris[0].fsPath;
				await this.loadProfileTextBox!.updateProperty('title', fileUris[0].fsPath);

				this.publishProfileUri = fileUris[0];
			}
		});

		return loadProfileButton;
	}

	private createSaveProfileAsButton(view: azdataType.ModelView): azdataType.ButtonComponent {
		let saveProfileAsButton: azdataType.ButtonComponent = view.modelBuilder.button().withProps({
			label: constants.saveProfileAsButtonText,
			title: constants.saveProfileAsButtonText,
			ariaLabel: constants.saveProfileAsButtonText,
			width: cssStyles.PublishingOptionsButtonWidth,
			height: '25px',
			secondary: true
		}).component();

		saveProfileAsButton.onDidClick(async () => {
			const filePath = await promptToSaveProfile(this.project, this.publishProfileUri);

			if (!filePath) {
				return;
			}

			if (this.savePublishProfile) {
				const targetConnectionString = this.connectionId ? await utils.getAzdataApi()!.connection.getConnectionString(this.connectionId, false) : '';
				const targetDatabaseName = this.targetDatabaseName ?? '';
				const deploymentOptions = await this.getDeploymentOptions();
				await this.savePublishProfile(filePath.fsPath, targetDatabaseName, targetConnectionString, this.getSqlCmdVariablesForPublish(), deploymentOptions);

				TelemetryReporter.sendActionEvent(TelemetryViews.SqlProjectPublishDialog, TelemetryActions.profileSaved);
			}

			this.publishProfileUri = filePath;

			await this.project.addNoneItem(path.relative(this.project.projectFolderPath, filePath.fsPath));
			void vscode.commands.executeCommand(constants.refreshDataWorkspaceCommand);		//refresh data workspace to load the newly added profile to the tree
		});

		return saveProfileAsButton;
	}

	private convertSqlCmdVarsToTableFormat(sqlCmdVars: Map<string, string>): azdataType.DeclarativeTableCellValue[][] {
		let data = [];
		for (const [key, value] of sqlCmdVars) {
			data.push([{ value: key }, { value: value! }]);
		}

		return data;
	}

	/**
	 * Enables or disables "Revert SQLCMD variable values" button depending on whether there are changes
	 *  */
	private updateRevertSqlCmdVarsButtonState(): void {
		// no SQLCMD vars -> no button to update state for
		if (!this.revertSqlCmdVarsButton) {
			return;
		}

		let revertButtonEnabled = false;

		for (const key of this.sqlCmdVars!.keys()) {
			if (this.sqlCmdVars!.get(key) !== this.getDefaultSqlCmdValue(key)) {
				revertButtonEnabled = true;
				break;
			}
		}

		this.revertSqlCmdVarsButton.enabled = revertButtonEnabled;
	}

	// only enable "Generate Script" and "Publish" buttons if all fields are filled
	private tryEnableGenerateScriptAndPublishButtons(): void {
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
			this.serverAdminPasswordTextBox?.value === this.serverConfigAdminPasswordTextBox?.value
			&& this.imageTagDropDown!.value && this.eulaCheckBox?.checked) {
			publishEnabled = true; // only publish is supported for container
		}

		this.dialog.okButton.enabled = publishEnabled;
		this.dialog.customButtons[0].enabled = generateScriptEnabled;
	}

	private allSqlCmdVariablesFilled(): boolean {
		for (let key in this.sqlCmdVars) {
			if (this.sqlCmdVars.get(key) === '' || this.sqlCmdVars.get(key) === undefined) {
				return false;
			}
		}

		return true;
	}

	/*
	 * Creates Display options container with a 'configure options' button
	 */
	private createOptionsButton(view: azdataType.ModelView): azdataType.FlexContainer {
		this.optionsButton = view.modelBuilder.button().withProps({
			label: constants.AdvancedOptionsButton,
			secondary: true,
			width: cssStyles.PublishingOptionsButtonWidth
		}).component();

		const optionsRow = view.modelBuilder.flexContainer().withItems([this.optionsButton], { CSSStyles: { flex: '0 0 auto', 'margin': '-8px 0 0 307px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		this.toDispose.push(this.optionsButton.onDidClick(async () => {
			TelemetryReporter.sendActionEvent(TelemetryViews.SqlProjectPublishDialog, TelemetryActions.publishOptionsOpened);
			// Create fresh options dialog with default selections each time when creating the 'configure options' button
			this.publishOptionsDialog = new PublishOptionsDialog(this.deploymentOptions!, this);
			this.publishOptionsDialog.openDialog();
		}));

		return optionsRow;
	}

	/*
	* Gets the default deployment options from the dacfx service
	*/
	public async getDefaultDeploymentOptions(): Promise<DeploymentOptions> {
		const defaultDeploymentOptions = await utils.getDefaultPublishDeploymentOptions(this.project) as DeploymentOptions;
		if (defaultDeploymentOptions && defaultDeploymentOptions.excludeObjectTypes !== undefined) {
			// For publish dialog no default exclude options should exists
			defaultDeploymentOptions.excludeObjectTypes.value = [];
		}
		return defaultDeploymentOptions;
	}

	/*
	* Sets the default deployment options to deployment options model object
	*/
	public setDeploymentOptions(deploymentOptions: DeploymentOptions | undefined): void {
		this.deploymentOptions = deploymentOptions;
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
