/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as newProjectTool from '../tools/newProjectTool';
import * as mssql from '../../../mssql';
import * as path from 'path';

import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { ImportDataModel } from '../models/api/import';
import { Deferred } from '../common/promise';
import { getConnectionName } from './utils';
import { exists, isCurrentWorkspaceUntitled } from '../common/utils';

export class CreateProjectFromDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public createProjectFromDatabaseTab: azdata.window.DialogTab;
	public sourceConnectionTextBox: azdata.InputBoxComponent | undefined;
	private selectConnectionButton: azdata.ButtonComponent | undefined;
	public sourceDatabaseDropDown: azdata.DropDownComponent | undefined;
	public projectNameTextBox: azdata.InputBoxComponent | undefined;
	public projectLocationTextBox: azdata.InputBoxComponent | undefined;
	public folderStructureDropDown: azdata.DropDownComponent | undefined;
	public workspaceInputBox: azdata.InputBoxComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private connectionId: string | undefined;
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete!: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	public createProjectFromDatabaseCallback: ((model: ImportDataModel) => any) | undefined;

	constructor(private profile: azdata.IConnectionProfile | undefined) {
		this.dialog = azdata.window.createModelViewDialog(constants.createProjectFromDatabaseDialogName, 'createProjectFromDatabaseDialog');
		this.createProjectFromDatabaseTab = azdata.window.createTab(constants.createProjectFromDatabaseDialogName);
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

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;

		if (this.profile) {
			await this.updateConnectionComponents(getConnectionName(this.profile), this.profile.id, this.profile.databaseName!);
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
			const sourceDatabaseFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			sourceDatabaseFormSection.addItems([connectionRow, databaseRow]);

			const projectNameRow = this.createProjectNameRow(view);
			const projectLocationRow = this.createProjectLocationRow(view);
			const targetProjectFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			targetProjectFormSection.addItems([projectNameRow, projectLocationRow]);

			const folderStructureRow = this.createFolderStructureRow(view);
			const createProjectSettingsFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			createProjectSettingsFormSection.addItems([folderStructureRow]);

			const workspaceContainerRow = this.createWorkspaceContainerRow(view);
			const createworkspaceContainerFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			createworkspaceContainerFormSection.addItems([workspaceContainerRow]);

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
						title: constants.createProjectSettings,
						components: [
							{
								component: createProjectSettingsFormSection,
							}
						]
					},
					{
						title: constants.workspace,
						components: [
							{
								component: createworkspaceContainerFormSection,
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
			this.selectConnectionButton?.focus();
			this.initDialogComplete?.resolve();
		});
	}

	private createConnectionRow(view: azdata.ModelView): azdata.FlexContainer {
		const sourceConnectionTextBox = this.createSourceConnectionComponent(view);
		const selectConnectionButton: azdata.Component = this.createSelectConnectionButton(view);

		const serverLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, sourceConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-5px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.addItem(selectConnectionButton, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '-5px', 'margin-top': '-10px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdata.ModelView): azdata.FlexContainer {
		this.sourceDatabaseDropDown = view.modelBuilder.dropDown().withProperties({
			ariaLabel: constants.databaseNameLabel,
			required: true,
			width: cssStyles.createProjectFromDatabaseTextboxWidth
		}).component();

		this.sourceDatabaseDropDown.onValueChanged(() => {
			this.setProjectName();
			this.updateWorkspaceInputbox(path.join(this.projectLocationTextBox!.value!, this.projectNameTextBox!.value!), this.projectNameTextBox!.value!);
			this.tryEnableCreateButton();
		});

		const databaseLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdata.DropDownComponent>this.sourceDatabaseDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	public setProjectName() {
		this.projectNameTextBox!.value = newProjectTool.defaultProjectNameFromDb(<string>this.sourceDatabaseDropDown!.value);
	}

	private createSourceConnectionComponent(view: azdata.ModelView): azdata.InputBoxComponent {
		this.sourceConnectionTextBox = view.modelBuilder.inputBox().withProperties({
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

	private createSelectConnectionButton(view: azdata.ModelView): azdata.Component {
		this.selectConnectionButton = view.modelBuilder.button().withProperties({
			ariaLabel: constants.selectConnection,
			iconPath: IconPathHelper.selectConnection,
			height: '16px',
			width: '16px'
		}).component();

		this.selectConnectionButton.onDidClick(async () => {
			let connection = await azdata.connection.openConnectionDialog();
			this.connectionId = connection.connectionId;

			let connectionTextboxValue: string;
			connectionTextboxValue = getConnectionName(connection);

			await this.updateConnectionComponents(connectionTextboxValue, this.connectionId, connection.options.database);
		});

		return this.selectConnectionButton;
	}

	private async updateConnectionComponents(connectionTextboxValue: string, connectionId: string, databaseName?: string) {
		this.sourceConnectionTextBox!.value = connectionTextboxValue;
		this.sourceConnectionTextBox!.updateProperty('title', connectionTextboxValue);

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			this.sourceDatabaseDropDown!.loading = true;
			const databaseValues = await azdata.connection.listDatabases(connectionId);

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

	private createProjectNameRow(view: azdata.ModelView): azdata.FlexContainer {
		this.projectNameTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.projectNamePlaceholderText,
			placeHolder: constants.projectNamePlaceholderText,
			required: true,
			width: cssStyles.createProjectFromDatabaseTextboxWidth
		}).component();

		this.projectNameTextBox.onTextChanged(() => {
			this.projectNameTextBox!.value = this.projectNameTextBox!.value?.trim();
			this.projectNameTextBox!.updateProperty('title', this.projectNameTextBox!.value);
			this.updateWorkspaceInputbox(path.join(this.projectLocationTextBox!.value!, this.projectNameTextBox!.value!), this.projectNameTextBox!.value!);
			this.tryEnableCreateButton();
		});

		const projectNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.projectNameLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const projectNameRow = view.modelBuilder.flexContainer().withItems([projectNameLabel, this.projectNameTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-5px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return projectNameRow;
	}

	private createProjectLocationRow(view: azdata.ModelView): azdata.FlexContainer {
		const browseFolderButton: azdata.Component = this.createBrowseFolderButton(view);

		this.projectLocationTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			ariaLabel: constants.projectLocationLabel,
			placeHolder: constants.projectLocationPlaceholderText,
			width: cssStyles.createProjectFromDatabaseTextboxWidth
		}).component();

		this.projectLocationTextBox.onTextChanged(() => {
			this.projectLocationTextBox!.updateProperty('title', this.projectLocationTextBox!.value);
			this.updateWorkspaceInputbox(path.join(this.projectLocationTextBox!.value!, this.projectNameTextBox!.value!), this.projectNameTextBox!.value!);
			this.tryEnableCreateButton();
		});

		const projectLocationLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.projectLocationLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const projectLocationRow = view.modelBuilder.flexContainer().withItems([projectLocationLabel, this.projectLocationTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-bottom': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		projectLocationRow.addItem(browseFolderButton, { CSSStyles: { 'margin-right': '0px', 'margin-bottom': '-10px' } });

		return projectLocationRow;
	}

	private createBrowseFolderButton(view: azdata.ModelView): azdata.ButtonComponent {
		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.browseButtonText,
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
			this.projectLocationTextBox!.updateProperty('title', folderUris[0].fsPath);
			this.updateWorkspaceInputbox(path.join(this.projectLocationTextBox!.value!, this.projectNameTextBox!.value!), this.projectNameTextBox!.value!);
		});

		return browseFolderButton;
	}

	private createFolderStructureRow(view: azdata.ModelView): azdata.FlexContainer {
		this.folderStructureDropDown = view.modelBuilder.dropDown().withProperties({
			values: [constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType],
			value: constants.schemaObjectType,
			ariaLabel: constants.folderStructureLabel,
			required: true,
			width: cssStyles.createProjectFromDatabaseTextboxWidth
		}).component();

		this.folderStructureDropDown.onValueChanged(() => {
			this.tryEnableCreateButton();
		});

		const folderStructureLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.folderStructureLabel,
			requiredIndicator: true,
			width: cssStyles.createProjectFromDatabaseLabelWidth
		}).component();

		const folderStructureRow = view.modelBuilder.flexContainer().withItems([folderStructureLabel, <azdata.DropDownComponent>this.folderStructureDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-top': '-10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return folderStructureRow;
	}

	/**
	 * Creates container with information on which workspace the project will be added to and where the workspace will be
	 * created if no workspace is currently open
	 * @param view
	 */
	private createWorkspaceContainerRow(view: azdata.ModelView): azdata.FlexContainer {
		const initialWorkspaceInputBoxValue = !!vscode.workspace.workspaceFile && !isCurrentWorkspaceUntitled() ? vscode.workspace.workspaceFile.fsPath : '';

		this.workspaceInputBox = view.modelBuilder.inputBox().withProperties({
			ariaLabel: constants.workspaceLocationTitle,
			enabled: !vscode.workspace.workspaceFile || isCurrentWorkspaceUntitled(), // want it editable if no saved workspace is open
			value: initialWorkspaceInputBoxValue,
			title: initialWorkspaceInputBoxValue, // hovertext for if file path is too long to be seen in textbox
			width: '100%'
		}).component();

		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.browseButtonText,
			iconPath: IconPathHelper.folder_blue,
			height: '16px',
			width: '18px'
		}).component();

		this.toDispose.push(browseFolderButton.onDidClick(async () => {
			const currentFileName = path.parse(this.workspaceInputBox!.value!).base;

			// let user select folder for workspace file to be created in
			const folderUris = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: vscode.Uri.file(path.parse(this.workspaceInputBox!.value!).dir)
			});
			if (!folderUris || folderUris.length === 0) {
				return;
			}
			const selectedFolder = folderUris[0].fsPath;

			const selectedFile = path.join(selectedFolder, currentFileName);
			this.workspaceInputBox!.value = selectedFile;
			this.workspaceInputBox!.title = selectedFile;
		}));

		const workspaceLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: vscode.workspace.workspaceFile ? constants.addProjectToCurrentWorkspace : constants.newWorkspaceWillBeCreated,
			CSSStyles: { 'margin-top': '-10px', 'margin-bottom': '5px' }
		}).component();

		let workspaceContainerRow;
		if (vscode.workspace.workspaceFile && !isCurrentWorkspaceUntitled()) {
			workspaceContainerRow = view.modelBuilder.flexContainer().withItems([workspaceLabel, this.workspaceInputBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px', 'margin-top': '0px' } }).withLayout({ flexFlow: 'column' }).component();
		} else {
			// have browse button to help select where the workspace file should be created
			const workspaceInput = view.modelBuilder.flexContainer().withItems([this.workspaceInputBox], { CSSStyles: { 'margin-right': '10px', 'margin-bottom': '10px', 'width': '100%' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
			workspaceInput.addItem(browseFolderButton, { CSSStyles: { 'margin-top': '-10px' } });
			workspaceContainerRow = view.modelBuilder.flexContainer().withItems([workspaceLabel, workspaceInput], { flex: '0 0 auto', CSSStyles: { 'margin-top': '0px' } }).withLayout({ flexFlow: 'column' }).component();
		}

		return workspaceContainerRow;
	}

	/**
	 * Update the workspace inputbox based on the passed in location and name if there isn't a workspace currently open
	 * @param location
	 * @param name
	 */
	public updateWorkspaceInputbox(location: string, name: string): void {
		if (!vscode.workspace.workspaceFile || isCurrentWorkspaceUntitled()) {
			const fileLocation = location && name ? path.join(location, `${name}.code-workspace`) : '';
			this.workspaceInputBox!.value = fileLocation;
			this.workspaceInputBox!.title = fileLocation;
		}
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
		const model: ImportDataModel = {
			serverId: this.connectionId!,
			database: <string>this.sourceDatabaseDropDown!.value,
			projName: this.projectNameTextBox!.value!,
			filePath: this.projectLocationTextBox!.value!,
			version: '1.0.0.0',
			extractTarget: this.mapExtractTargetEnum(<string>this.folderStructureDropDown!.value),
			newWorkspaceFilePath: this.workspaceInputBox!.enabled ? vscode.Uri.file(this.workspaceInputBox!.value!) : undefined
		};

		azdata.window.closeDialog(this.dialog);
		await this.createProjectFromDatabaseCallback!(model);

		this.dispose();
	}

	private mapExtractTargetEnum(inputTarget: any): mssql.ExtractTarget {
		if (inputTarget) {
			switch (inputTarget) {
				case constants.file: return mssql.ExtractTarget['file'];
				case constants.flat: return mssql.ExtractTarget['flat'];
				case constants.objectType: return mssql.ExtractTarget['objectType'];
				case constants.schema: return mssql.ExtractTarget['schema'];
				case constants.schemaObjectType: return mssql.ExtractTarget['schemaObjectType'];
				default: throw new Error(constants.invalidInput(inputTarget));
			}
		} else {
			throw new Error(constants.extractTargetRequired);
		}
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

			if (this.workspaceInputBox!.enabled) {
				await this.validateNewWorkspace();
			}

			return true;
		} catch (err) {
			this.showErrorMessage(err?.message ? err.message : err);
			return false;
		}
	}

	protected async validateNewWorkspace(): Promise<void> {
		const sameFolderAsNewProject = path.join(this.projectLocationTextBox!.value!, this.projectNameTextBox!.value!) === path.dirname(this.workspaceInputBox!.value!);

		// workspace file should end in .code-workspace
		const workspaceValid = this.workspaceInputBox!.value!.endsWith(constants.WorkspaceFileExtension);
		if (!workspaceValid) {
			throw new Error(constants.WorkspaceFileInvalidError(this.workspaceInputBox!.value!));
		}

		// if the workspace file is not going to be in the same folder as the newly created project, then check that it's a valid folder
		if (!sameFolderAsNewProject) {
			const workspaceParentDirectoryExists = await exists(path.dirname(this.workspaceInputBox!.value!));
			if (!workspaceParentDirectoryExists) {
				throw new Error(constants.WorkspaceParentDirectoryNotExistError(path.dirname(this.workspaceInputBox!.value!)));
			}
		}

		// workspace file should not be an existing workspace file
		const workspaceFileExists = await exists(this.workspaceInputBox!.value!);
		if (workspaceFileExists) {
			throw new Error(constants.WorkspaceFileAlreadyExistsError(this.workspaceInputBox!.value!));
		}
	}

	protected showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}
}
