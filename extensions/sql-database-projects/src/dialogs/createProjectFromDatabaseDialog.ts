/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as newProjectTool from '../tools/newProjectTool';
import * as path from 'path';

import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { ImportDataModel } from '../models/api/import';
import { Deferred } from '../common/promise';
import { getConnectionName, mapExtractTargetEnum } from './utils';
import { exists, getAzdataApi, getDataWorkspaceExtensionApi, isValidBasename, isValidBasenameErrorMessage, sanitizeStringForFilename } from '../common/utils';

export class CreateProjectFromDatabaseDialog {
	public dialog: azdataType.window.Dialog;
	public createProjectFromDatabaseTab: azdataType.window.DialogTab;
	public sourceConnectionTextBox: azdataType.InputBoxComponent | undefined;
	private selectConnectionButton: azdataType.ButtonComponent | undefined;
	public sourceDatabaseDropDown: azdataType.DropDownComponent | undefined;
	public projectNameTextBox: azdataType.InputBoxComponent | undefined;
	public projectLocationTextBox: azdataType.InputBoxComponent | undefined;
	public folderStructureDropDown: azdataType.DropDownComponent | undefined;
	public includePermissionsCheckbox: azdataType.CheckBoxComponent | undefined;
	public sdkStyleCheckbox: azdataType.CheckBoxComponent | undefined;
	private formBuilder: azdataType.FormBuilder | undefined;
	private connectionId: string | undefined;
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete: Deferred = new Deferred();

	public createProjectFromDatabaseCallback: ((model: ImportDataModel, connectionId?: string) => any) | undefined;

	constructor(private profile: azdataType.IConnectionProfile | undefined) {
		this.dialog = getAzdataApi()!.window.createModelViewDialog(constants.createProjectFromDatabaseDialogName, 'createProjectFromDatabaseDialog');
		this.createProjectFromDatabaseTab = getAzdataApi()!.window.createTab(constants.createProjectFromDatabaseDialogName);
		this.dialog.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	public async openDialog(): Promise<void> {
		this.initializeDialog();
		this.dialog.okButton.label = constants.createProjectDialogOkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.handleCreateButtonClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		let connected = false;

		// make sure the connection profile passed in has sufficient information to attempt to connect
		if (this.profile && this.profile?.serverName) {
			const connections = await getAzdataApi()!.connection.getConnections(true);
			connected = !!connections.find(c => c.connectionId === this.profile!.id);

			if (!connected) {
				// if the connection clicked on isn't currently connected, try to connect
				const result = await getAzdataApi()!.connection.connect(this.profile, true, false);
				connected = result.connected;

				if (!result.connected) {
					// if can't connect automatically, open connection dialog with the info from the profile
					const connection = await getAzdataApi()!.connection.openConnectionDialog(undefined, this.profile, {
						saveConnection: false,
						showDashboard: false,
						showConnectionDialogOnError: true,
						showFirewallRuleOnError: true
					});
					connected = !!connection;

					// update these fields if connection was successful, to ensure they match the connection made
					if (connected) {
						this.profile.id = connection.connectionId;
						this.profile.databaseName = connection.options['databaseName'];
						this.profile.serverName = connection.options['server'];
						this.profile.userName = connection.options['user'];
					}
				} else {
					// Successfully connectted, update connection Id as received.
					this.profile.id = result.connectionId!;
				}
			}
		}

		getAzdataApi()!.window.openDialog(this.dialog);
		await this.initDialogComplete.promise;

		if (connected) {
			await this.updateConnectionComponents(getConnectionName(this.profile), this.profile!.id, this.profile!.databaseName);
		}

		this.tryEnableCreateButton();
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private initializeDialog(): void {
		this.initializeCreateProjectFromDatabaseTab();
		this.dialog.content = [this.createProjectFromDatabaseTab];
	}

	private initializeCreateProjectFromDatabaseTab(): void {
		this.createProjectFromDatabaseTab.registerContent(async view => {

			const connectionRow = this.createConnectionRow(view);
			const databaseRow = this.createDatabaseRow(view);
			const sourceDatabaseFormSection = view.modelBuilder.groupContainer().withLayout({
				header: constants.sourceDatabase,
				collapsible: false,
				collapsed: false
			}).withItems([connectionRow, databaseRow]).component();

			const projectNameRow = this.createProjectNameRow(view);
			const projectLocationRow = this.createProjectLocationRow(view);
			const targetProjectFormSection = view.modelBuilder.groupContainer().withLayout({
				header: constants.targetProject,
				collapsible: false,
				collapsed: false
			}).withItems([projectNameRow, projectLocationRow]).component();

			const folderStructureRow = this.createFolderStructureRow(view);

			this.includePermissionsCheckbox = view.modelBuilder.checkBox().withProps({
				label: constants.includePermissionsLabel,
			}).component();

			// could also potentially be radio buttons once there's a term to refer to "legacy" style sqlprojs
			this.sdkStyleCheckbox = view.modelBuilder.checkBox().withProps({
				checked: true,
				label: constants.sdkStyleProject
			}).component();

			const sdkLearnMore = view.modelBuilder.hyperlink().withProps({
				label: constants.learnMore,
				url: constants.sdkLearnMoreUrl
			}).component();

			const sdkFormComponentGroup = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
				.withItems([this.sdkStyleCheckbox, sdkLearnMore], { CSSStyles: { flex: '0 0 auto', 'margin-right': '10px' } })
				.component();

			const settingsFormSection = view.modelBuilder.groupContainer().withLayout({
				header: constants.createProjectSettings,
				collapsible: false,
				collapsed: false
			}).withItems([folderStructureRow, this.includePermissionsCheckbox, sdkFormComponentGroup]).component();

			this.formBuilder = <azdataType.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							{
								component: sourceDatabaseFormSection,
							}
						]
					},
					{
						title: '',
						components: [
							{
								component: targetProjectFormSection,
							}
						]
					},
					{
						title: '',
						components: [
							{
								component: settingsFormSection
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
			await this.selectConnectionButton?.focus();
			this.initDialogComplete?.resolve();
		});
	}

	private createConnectionRow(view: azdataType.ModelView): azdataType.FlexContainer {
		const sourceConnectionTextBox = this.createSourceConnectionComponent(view);
		const selectConnectionButton: azdataType.Component = this.createSelectConnectionButton(view);

		const serverLabel = view.modelBuilder.text().withProps({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, sourceConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-5px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.addItem(selectConnectionButton, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '-5px', 'margin-top': '-10px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdataType.ModelView): azdataType.FlexContainer {
		this.sourceDatabaseDropDown = view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.databaseNameLabel,
			required: true,
			width: cssStyles.createProjectFromDatabaseTextboxWidth
		}).component();

		this.sourceDatabaseDropDown.onValueChanged(() => {
			this.setProjectName();
			this.tryEnableCreateButton();
		});

		const databaseLabel = view.modelBuilder.text().withProps({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdataType.DropDownComponent>this.sourceDatabaseDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	public setProjectName() {
		this.projectNameTextBox!.value = newProjectTool.defaultProjectNameFromDb(sanitizeStringForFilename(<string>this.sourceDatabaseDropDown!.value));
	}

	private createSourceConnectionComponent(view: azdataType.ModelView): azdataType.InputBoxComponent {
		this.sourceConnectionTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			placeHolder: constants.selectConnection,
			width: cssStyles.createProjectFromDatabaseTextboxWidth,
			enabled: false
		}).component();

		this.sourceConnectionTextBox.onTextChanged(() => {
			this.tryEnableCreateButton();
		});

		return this.sourceConnectionTextBox;
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
			let connection = await getAzdataApi()!.connection.openConnectionDialog(undefined, undefined, {
				saveConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			});
			this.connectionId = connection.connectionId;

			let connectionTextboxValue: string;
			connectionTextboxValue = getConnectionName(connection);

			await this.updateConnectionComponents(connectionTextboxValue, this.connectionId, connection.options.database);
		});

		return this.selectConnectionButton;
	}

	private async updateConnectionComponents(connectionTextboxValue: string, connectionId: string, databaseName?: string) {
		this.sourceConnectionTextBox!.value = connectionTextboxValue;
		void this.sourceConnectionTextBox!.updateProperty('title', connectionTextboxValue);

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			this.sourceDatabaseDropDown!.loading = true;
			let databaseValues;
			try {
				databaseValues = (await getAzdataApi()!.connection.listDatabases(connectionId))
					// filter out system dbs
					.filter(db => !constants.systemDbs.includes(db));
			} catch (e) {
				// if the user doesn't have access to master, just set the database of the connection profile
				databaseValues = [databaseName!];
				console.warn(e);
			}

			this.sourceDatabaseDropDown!.values = databaseValues;
			this.sourceDatabaseDropDown!.loading = false;
			this.connectionId = connectionId;
		}

		// change the database inputbox value to the connection's database if there is one
		if (databaseName && databaseName !== constants.master) {
			this.sourceDatabaseDropDown!.value = databaseName;
		}

		// change icon to the one without a plus sign
		this.selectConnectionButton!.iconPath = IconPathHelper.connect;
	}

	private createProjectNameRow(view: azdataType.ModelView): azdataType.FlexContainer {
		this.projectNameTextBox = view.modelBuilder.inputBox().withValidation(
			component => isValidBasename(component.value)
		)
			.withProps({
				ariaLabel: constants.projectNameLabel,
				placeHolder: constants.projectNamePlaceholderText,
				required: true,
				width: cssStyles.createProjectFromDatabaseTextboxWidth
			}).component();

		this.projectNameTextBox.onTextChanged(text => {
			const errorMessage = isValidBasenameErrorMessage(text);
			if (errorMessage !== undefined) {
				// Set validation error message if project name is invalid
				void this.projectNameTextBox!.updateProperty('validationErrorMessage', errorMessage);
			} else {
				this.projectNameTextBox!.value = this.projectNameTextBox!.value?.trim();
				void this.projectNameTextBox!.updateProperty('title', this.projectNameTextBox!.value);
				this.tryEnableCreateButton();
			}
		});

		const projectNameLabel = view.modelBuilder.text().withProps({
			value: constants.projectNameLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const projectNameRow = view.modelBuilder.flexContainer().withItems([projectNameLabel, this.projectNameTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-5px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return projectNameRow;
	}

	private createProjectLocationRow(view: azdataType.ModelView): azdataType.FlexContainer {
		const browseFolderButton: azdataType.Component = this.createBrowseFolderButton(view);

		this.projectLocationTextBox = view.modelBuilder.inputBox().withProps({
			value: '',
			ariaLabel: constants.location,
			placeHolder: constants.projectLocationPlaceholderText,
			width: cssStyles.createProjectFromDatabaseTextboxWidth,
			required: true
		}).component();

		this.projectLocationTextBox.onTextChanged(() => {
			void this.projectLocationTextBox!.updateProperty('title', this.projectLocationTextBox!.value);
			this.tryEnableCreateButton();
		});

		const projectLocationLabel = view.modelBuilder.text().withProps({
			value: constants.location,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const projectLocationRow = view.modelBuilder.flexContainer().withItems([projectLocationLabel, this.projectLocationTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		projectLocationRow.addItem(browseFolderButton, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '-10px' } });

		return projectLocationRow;
	}

	private createBrowseFolderButton(view: azdataType.ModelView): azdataType.ButtonComponent {
		const browseFolderButton = view.modelBuilder.button().withProps({
			ariaLabel: constants.browseButtonText,
			title: constants.browseButtonText,
			iconPath: IconPathHelper.folder_blue,
			height: '18px',
			width: '18px'
		}).component();

		browseFolderButton.onDidClick(async () => {
			let folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				openLabel: constants.selectString,
				defaultUri: newProjectTool.defaultProjectSaveLocation()
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}

			this.projectLocationTextBox!.value = folderUris[0].fsPath;
			void this.projectLocationTextBox!.updateProperty('title', folderUris[0].fsPath);
		});

		return browseFolderButton;
	}

	private createFolderStructureRow(view: azdataType.ModelView): azdataType.FlexContainer {
		this.folderStructureDropDown = view.modelBuilder.dropDown().withProps({
			values: [constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType],
			value: constants.schemaObjectType,
			ariaLabel: constants.folderStructureLabel,
			required: true,
			width: cssStyles.createProjectFromDatabaseTextboxWidth
		}).component();

		this.folderStructureDropDown.onValueChanged(() => {
			this.tryEnableCreateButton();
		});

		const folderStructureLabel = view.modelBuilder.text().withProps({
			value: constants.folderStructureLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const folderStructureRow = view.modelBuilder.flexContainer().withItems([folderStructureLabel, <azdataType.DropDownComponent>this.folderStructureDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return folderStructureRow;
	}

	// only enable Create button if all fields are filled
	public tryEnableCreateButton(): void {
		if (this.sourceConnectionTextBox!.value && this.sourceDatabaseDropDown!.value
			&& this.projectNameTextBox!.value && this.projectLocationTextBox!.value) {
			this.dialog.okButton.enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
		}
	}

	public async handleCreateButtonClick(): Promise<void> {
		const azdataApi = getAzdataApi()!;
		const connectionUri = await azdataApi!.connection.getUriForConnection(this.connectionId!);
		const model: ImportDataModel = {
			connectionUri: connectionUri,
			database: <string>this.sourceDatabaseDropDown!.value,
			projName: this.projectNameTextBox!.value!,
			filePath: this.projectLocationTextBox!.value!,
			version: '1.0.0.0',
			extractTarget: mapExtractTargetEnum(<string>this.folderStructureDropDown!.value),
			sdkStyle: this.sdkStyleCheckbox?.checked!,
			includePermissions: this.includePermissionsCheckbox?.checked
		};

		azdataApi!.window.closeDialog(this.dialog);
		await this.createProjectFromDatabaseCallback!(model, this.connectionId!);

		this.dispose();
	}

	async validate(): Promise<boolean> {
		try {
			// the selected location should be an existing directory
			const parentDirectoryExists = await exists(this.projectLocationTextBox!.value!);
			if (!parentDirectoryExists) {
				this.showErrorMessage(constants.ProjectParentDirectoryNotExistError(this.projectLocationTextBox!.value!));
				return false;
			}

			// there shouldn't be an existing sub directory with the same name as the project in the selected location
			const projectDirectoryExists = await exists(path.join(this.projectLocationTextBox!.value!, this.projectNameTextBox!.value!));
			if (projectDirectoryExists) {
				this.showErrorMessage(constants.ProjectDirectoryAlreadyExistError(this.projectNameTextBox!.value!, this.projectLocationTextBox!.value!));
				return false;
			}

			if (await getDataWorkspaceExtensionApi().validateWorkspace() === false) {
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
