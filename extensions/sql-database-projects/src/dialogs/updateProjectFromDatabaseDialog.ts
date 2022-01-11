/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as azdata from 'azdata';
import * as constants from '../common/constants';
import * as newProjectTool from '../tools/newProjectTool';
import type * as mssqlVscode from 'vscode-mssql';

import { Deferred } from '../common/promise';
import { Project } from '../models/project';
import { cssStyles } from '../common/uiConstants';
import { IconPathHelper } from '../common/iconHelper';
import { UpdateProjectDataModel, UpdateProjectAction } from '../models/api/updateProject';
import { exists, getAzdataApi, getDataWorkspaceExtensionApi } from '../common/utils';
import * as path from 'path';

export class UpdateProjectFromDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public serverDropdown: azdata.DropDownComponent | undefined;
	public databaseDropdown: azdata.DropDownComponent | undefined;
	public projectFileTextBox: azdata.InputBoxComponent | undefined;
	public compareActionRadioButton: azdata.RadioButtonComponent | undefined;
	private updateProjectFromDatabaseTab: azdata.window.DialogTab;
	private connectionButton: azdata.ButtonComponent | undefined;
	private folderStructureDropDown: azdata.DropDownComponent | undefined;
	private updateActionRadioButton: azdata.RadioButtonComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private connectionId: string | undefined;
	private profile: azdata.IConnectionProfile | undefined;
	public action: UpdateProjectAction | undefined;
	private toDispose: vscode.Disposable[] = [];
	private initDialogPromise: Deferred = new Deferred();
	public populatedInputsPromise: Deferred = new Deferred();

	public updateProjectFromDatabaseCallback: ((model: UpdateProjectDataModel) => any) | undefined;

	constructor(connection: azdata.IConnectionProfile | mssqlVscode.IConnectionInfo | undefined, private project: Project | undefined) {
		if (connection && 'connectionName' in connection) {
			this.profile = connection;
		}

		// need to set profile when database is updated as well as here
		// see what schemaCompare is doing!

		this.dialog = getAzdataApi()!.window.createModelViewDialog(constants.updateProjectFromDatabaseDialogName, 'updateProjectFromDatabaseDialog');
		this.updateProjectFromDatabaseTab = getAzdataApi()!.window.createTab(constants.updateProjectFromDatabaseDialogName);
		this.dialog.registerCloseValidator(async () => {
			return this.validate();
		});

		this.toDispose.push(this.dialog.onClosed(_ => this.initDialogPromise.resolve()));
	}

	public async openDialog(): Promise<void> {
		let connection = await azdata.connection.getCurrentConnection();
		if (connection) {
			this.connectionId = connection.connectionId;
		}

		this.initializeDialog();

		this.dialog.okButton.label = constants.updateText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.handleUpdateButtonClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		getAzdataApi()!.window.openDialog(this.dialog);
		await this.initDialogPromise;

		this.tryEnableUpdateButton();
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private initializeDialog(): void {
		this.initializeUpdateProjectFromDatabaseTab();
		this.dialog.content = [this.updateProjectFromDatabaseTab];
	}

	private initializeUpdateProjectFromDatabaseTab(): void {
		this.updateProjectFromDatabaseTab.registerContent(async view => {

			const connectionRow = this.createServerRow(view);
			const databaseRow = this.createDatabaseRow(view);
			await this.populateServerDropdown();

			const sourceDatabaseFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			sourceDatabaseFormSection.addItems([connectionRow, databaseRow]);

			const projectLocationRow = this.createProjectLocationRow(view);
			const folderStructureRow = this.createFolderStructureRow(view);
			const targetProjectFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			targetProjectFormSection.addItems([projectLocationRow, folderStructureRow]);

			const actionRow = await this.createActionRow(view);
			const actionFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			actionFormSection.addItems([actionRow]);

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: constants.sourceDatabase,
						components: [
							{
								component: sourceDatabaseFormSection,
							}
						]
					},
					{
						title: constants.targetProject,
						components: [
							{
								component: targetProjectFormSection,
							}
						]
					},
					{
						title: constants.updateAction,
						components: [
							{
								component: actionFormSection,
							}
						]
					}
				], {
					horizontal: false,
					titleFontSize: cssStyles.titleFontSize
				})
				.withLayout({
					width: '100%',
					padding: '10px 10px 0 20px'
				});

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
			await this.connectionButton?.focus();
			this.initDialogPromise.resolve();
		});
	}

	private createServerRow(view: azdata.ModelView): azdata.FlexContainer {
		this.createServerComponent(view);

		const serverLabel = view.modelBuilder.text().withProps({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.updateProjectFromDatabaseLabelWidth
		}).component();

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, this.serverDropdown!], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-5px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.addItem(this.connectionButton!, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '-5px', 'margin-top': '-10px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdata.ModelView): azdata.FlexContainer {
		this.createDatabaseComponent(view);

		const databaseLabel = view.modelBuilder.text().withProps({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.updateProjectFromDatabaseLabelWidth
		}).component();

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdata.DropDownComponent>this.databaseDropdown!], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	private createServerComponent(view: azdata.ModelView) {
		this.serverDropdown = view.modelBuilder.dropDown().withProps({
			editable: true,
			fireOnTextChange: true,
			width: cssStyles.updateProjectFromDatabaseTextboxWidth
		}).component();

		this.createConnectionButton(view);

		this.serverDropdown.onValueChanged(() => {
			this.tryEnableUpdateButton();
		});
	}

	private createDatabaseComponent(view: azdata.ModelView) {
		this.databaseDropdown = view.modelBuilder.dropDown().withProps({
			editable: true,
			fireOnTextChange: true,
			width: cssStyles.updateProjectFromDatabaseTextboxWidth
		}).component();

		this.databaseDropdown.onValueChanged(() => {
			this.tryEnableUpdateButton();
		});
	}

	private async populateServerDropdown() {
		this.serverDropdown!.loading = true;
		const values = await this.getServerValues();

		if (values && values.length > 0) {
			await this.serverDropdown!.updateProperties({
				values: values,
				value: values[0]
			});
		}

		this.serverDropdown!.loading = false;

		if (this.serverDropdown!.value) {
			await this.populateDatabaseDropdown();
		}

		this.tryEnableUpdateButton();
		this.populatedInputsPromise.resolve();
	}

	protected async populateDatabaseDropdown() {
		const connectionProfile = (this.serverDropdown!.value as ConnectionDropdownValue).connection;

		this.databaseDropdown!.loading = true;

		await this.databaseDropdown!.updateProperties({
			values: [],
			value: undefined
		});

		let values = [];
		try {
			values = await this.getDatabaseValues(connectionProfile.connectionId);
		} catch (e) {
			// if the user doesn't have access to master, just set the database of the connection profile
			values = [connectionProfile.databaseName];
			console.warn(e);
		}

		if (values && values.length > 0) {
			await this.databaseDropdown!.updateProperties({
				values: values,
				value: values[0],
			});
		}

		this.databaseDropdown!.loading = false;
	}

	private async getServerValues() {
		let cons = await azdata.connection.getConnections(/* activeConnectionsOnly */ true);

		// This user has no active connections
		if (!cons || cons.length === 0) {
			return undefined;
		}

		// Update connection icon to "connected" state
		this.connectionButton!.iconPath = IconPathHelper.connect;

		// reverse list so that most recent connections are first
		cons.reverse();

		let count = -1;
		let idx = -1;
		let values = cons.map(c => {
			count++;

			let usr = c.options.user;

			if (!usr) {
				usr = constants.defaultUser;
			}

			let srv = c.options.server;

			let finalName = `${srv} (${usr})`;

			if (c.options.connectionName) {
				finalName = c.options.connectionName;
			}

			if (c.connectionId === this.connectionId) {
				idx = count;
			}

			return {
				connection: c,
				displayName: finalName,
				name: srv,
			};
		});

		// move server of current connection to the top of the list so it is the default
		if (idx >= 1) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}

		values = values.reduce((uniqueValues: { connection: azdata.connection.ConnectionProfile, displayName: string, name: string }[], conn) => {
			let exists = uniqueValues.find(x => x.displayName === conn.displayName);
			if (!exists) {
				uniqueValues.push(conn);
			}
			return uniqueValues;
		}, []);

		return values;
	}

	protected async getDatabaseValues(connectionId: string) {
		let idx = -1;
		let count = -1;

		let values = (await azdata.connection.listDatabases(connectionId)).sort((a, b) => a.localeCompare(b)).map(db => {
			count++;

			// put currently selected db at the top of the dropdown if there is one
			if (this.profile && this.profile.databaseName && this.profile.databaseName === db) {
				idx = count;
			}

			return db;
		});

		if (idx >= 0) {
			let tmp = values[0];
			values[0] = values[idx];
			values[idx] = tmp;
		}
		return values;
	}

	private createConnectionButton(view: azdata.ModelView) {
		this.connectionButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.selectConnection,
			iconPath: IconPathHelper.selectConnection,
			height: '20px',
			width: '20px'
		}).component();

		this.connectionButton.onDidClick(async () => {
			await this.connectionButtonClick();
			this.connectionButton!.iconPath = IconPathHelper.connect;
		});
	}

	private async connectionButtonClick() {
		let connection = await azdata.connection.openConnectionDialog();
		if (connection) {
			this.connectionId = connection.connectionId;
			await this.populateServerDropdown();
		}
	}

	private createProjectLocationRow(view: azdata.ModelView): azdata.FlexContainer {
		const browseFolderButton: azdata.Component = this.createBrowseFileButton(view);

		const value = this.project ? this.project.projectFilePath : '';

		this.projectFileTextBox = view.modelBuilder.inputBox().withProps({
			value: value,
			ariaLabel: constants.projectLocationLabel,
			placeHolder: constants.projectToUpdatePlaceholderText,
			width: cssStyles.updateProjectFromDatabaseTextboxWidth
		}).component();

		this.projectFileTextBox.onTextChanged(async () => {
			await this.projectFileTextBox!.updateProperty('title', this.projectFileTextBox!.value);
			this.tryEnableUpdateButton();
		});

		const projectLocationLabel = view.modelBuilder.text().withProps({
			value: constants.projectLocationLabel,
			requiredIndicator: true,
			width: cssStyles.updateProjectFromDatabaseLabelWidth
		}).component();

		const projectLocationRow = view.modelBuilder.flexContainer().withItems([projectLocationLabel, this.projectFileTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-5px', 'margin-top': '-10px' } }).component();
		projectLocationRow.addItem(browseFolderButton, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '-5px', 'margin-top': '-10px' } });

		return projectLocationRow;
	}

	private createBrowseFileButton(view: azdata.ModelView): azdata.ButtonComponent {
		const browseFolderButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.browseButtonText,
			iconPath: IconPathHelper.folder_blue,
			height: '18px',
			width: '18px'
		}).component();

		browseFolderButton.onDidClick(async () => {
			let fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				openLabel: constants.selectString,
				defaultUri: newProjectTool.defaultProjectSaveLocation(),
				filters: {
					'Files': ['sqlproj']
				}
			});

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			this.projectFileTextBox!.value = fileUris[0].fsPath;
			await this.projectFileTextBox!.updateProperty('title', fileUris[0].fsPath);
		});

		return browseFolderButton;
	}

	private createFolderStructureRow(view: azdata.ModelView): azdata.FlexContainer {
		this.folderStructureDropDown = view.modelBuilder.dropDown().withProps({
			values: [constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType],
			value: constants.schemaObjectType,
			ariaLabel: constants.folderStructureLabel,
			required: true,
			width: cssStyles.updateProjectFromDatabaseTextboxWidth
		}).component();

		this.folderStructureDropDown.onValueChanged(() => {
			this.tryEnableUpdateButton();
		});

		const folderStructureLabel = view.modelBuilder.text().withProps({
			value: constants.folderStructureLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const folderStructureRow = view.modelBuilder.flexContainer().withItems([folderStructureLabel, <azdata.DropDownComponent>this.folderStructureDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return folderStructureRow;
	}

	private async createActionRow(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		this.compareActionRadioButton = view.modelBuilder.radioButton().withProps({
			name: 'action',
			label: constants.compareActionRadioButtonLabel,
			checked: true
		}).component();

		this.updateActionRadioButton = view.modelBuilder.radioButton().withProps({
			name: 'action',
			label: constants.updateActionRadioButtonLabel
		}).component();

		await this.compareActionRadioButton.updateProperties({ checked: true });
		this.action = UpdateProjectAction.Compare;

		this.compareActionRadioButton.onDidClick(async () => {
			this.action = UpdateProjectAction.Compare;
			this.tryEnableUpdateButton();
		});

		this.updateActionRadioButton.onDidClick(async () => {
			this.action = UpdateProjectAction.Update;
			this.tryEnableUpdateButton();
		});

		let radioButtons = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.compareActionRadioButton, this.updateActionRadioButton])
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		const actionLabel = view.modelBuilder.text().withProps({
			value: constants.actionLabel,
			requiredIndicator: true,
			width: cssStyles.updateProjectFromDatabaseLabelWidth
		}).component();

		const actionRow = view.modelBuilder.flexContainer().withItems([actionLabel, <azdata.FlexContainer>radioButtons], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return actionRow;
	}

	// only enable Update button if all fields are filled
	public tryEnableUpdateButton(): void {
		if (this.serverDropdown?.value
			&& this.databaseDropdown?.value
			&& this.projectFileTextBox?.value
			&& this.folderStructureDropDown?.value
			&& this.action !== undefined) {
			this.dialog.okButton.enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
		}
	}

	public async handleUpdateButtonClick(): Promise<void> {
		const serverDropdownValue = this.serverDropdown!.value! as azdata.CategoryValue as ConnectionDropdownValue;
		const ownerUri = await azdata.connection.getUriForConnection(serverDropdownValue.connection.connectionId);

		let connection = (await azdata.connection.getConnections(true)).filter(con => con.connectionId === serverDropdownValue.connection.connectionId)[0];
		connection.databaseName = this.databaseDropdown!.value! as string;

		const credentials = await azdata.connection.getCredentials(connection.connectionId);
		if (credentials.hasOwnProperty('password')) {
			connection.password = connection.options.password = credentials.password;
		}

		const connectionDetails: azdata.IConnectionProfile = {
			id: connection.connectionId,
			userName: connection.userName,
			password: connection.password,
			serverName: connection.serverName,
			databaseName: connection.databaseName,
			connectionName: connection.connectionName,
			providerName: connection.providerId,
			groupId: connection.groupId,
			groupFullName: connection.groupFullName,
			authenticationType: connection.authenticationType,
			savePassword: connection.savePassword,
			saveProfile: connection.saveProfile,
			options: connection.options,
		};

		const sourceEndpointInfo: mssql.SchemaCompareEndpointInfo = {
			endpointType: mssql.SchemaCompareEndpointType.Database,
			databaseName: this.databaseDropdown!.value! as string,
			serverDisplayName: serverDropdownValue.displayName,
			serverName: serverDropdownValue.name!,
			connectionDetails: connectionDetails,
			ownerUri: ownerUri,
			projectFilePath: '',
			folderStructure: '',
			targetScripts: [],
			dataSchemaProvider: '',
			packageFilePath: '',
			connectionName: serverDropdownValue.connection.options.connectionName
		};

		const targetEndpointInfo: mssql.SchemaCompareEndpointInfo = {
			endpointType: mssql.SchemaCompareEndpointType.Project,
			projectFilePath: this.projectFileTextBox!.value!,
			folderStructure: this.folderStructureDropDown!.value as string,
			targetScripts: [],
			dataSchemaProvider: '',
			connectionDetails: connectionDetails,
			databaseName: '',
			serverDisplayName: '',
			serverName: '',
			ownerUri: '',
			packageFilePath: '',
		};

		const model: UpdateProjectDataModel = {
			sourceEndpointInfo: sourceEndpointInfo,
			targetEndpointInfo: targetEndpointInfo,
			action: this.action!
		};

		getAzdataApi()!.window.closeDialog(this.dialog);
		await this.updateProjectFromDatabaseCallback!(model);

		this.dispose();
	}

	async validate(): Promise<boolean> {
		try {
			if (await getDataWorkspaceExtensionApi().validateWorkspace() === false) {
				return false;
			}
			// the selected location should be an existing directory
			const parentDirectoryExists = await exists(path.dirname(this.projectFileTextBox!.value!));
			if (!parentDirectoryExists) {
				this.showErrorMessage(constants.ProjectParentDirectoryNotExistError(this.projectFileTextBox!.value!));
				return false;
			}

			// the selected location must contain a .sqlproj file
			const fileExists = await exists(this.projectFileTextBox!.value!);
			if (!fileExists) {
				this.showErrorMessage(constants.noSqlProjFile);
				return false;
			}

			// schema compare extension must be downloaded
			if (!vscode.extensions.getExtension(constants.schemaCompareExtensionId)) {
				this.showErrorMessage(constants.noSchemaCompareExtension);
				return false;
			}

			return true;
		} catch (err) {
			this.showErrorMessage(err?.message ? err.message : err);
			return false;
		}
	}

	protected showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: getAzdataApi()!.window.MessageLevel.Error
		};
	}
}

export interface ConnectionDropdownValue extends azdata.CategoryValue {
	connection: azdata.connection.ConnectionProfile;
}
