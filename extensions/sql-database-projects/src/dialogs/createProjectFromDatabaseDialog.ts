/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import * as newProjectTool from '../tools/newProjectTool';

import { IconPathHelper } from '../common/iconHelper';
import { cssStyles } from '../common/uiConstants';
import { ImportDataModel } from '../models/api/import';
import { Deferred } from '../common/promise';

export class CreateProjectFromDatabaseDialog {
	public dialog: azdata.window.Dialog;
	public importTab: azdata.window.DialogTab;
	private sourceConnectionTextBox: azdata.InputBoxComponent | undefined;
	private selectConnectionButton: azdata.ButtonComponent | undefined;
	private sourceDatabaseDropDown: azdata.DropDownComponent | undefined;
	private projectNameTextBox: azdata.InputBoxComponent | undefined;
	private projectLocationTextBox: azdata.InputBoxComponent | undefined;
	private folderStructureDropDown: azdata.DropDownComponent | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private connectionId: string | undefined;
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete!: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	public createNewProjectCallBack: ((model: ImportDataModel) => any) | undefined;
	public mapExtractTargetEnum: ((folderStructure: string) => any) | undefined;

	constructor(private profile: azdata.IConnectionProfile | undefined) {
		this.dialog = azdata.window.createModelViewDialog(constants.createProjectFromDatabaseDialogName);
		this.importTab = azdata.window.createTab(constants.createProjectFromDatabaseDialogName);
	}

	public async openDialog(): Promise<void> {
		this.initializeDialog();
		this.dialog.okButton.label = constants.importDialogOkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.importClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;

		if (this.profile) {
			this.updateConnectionComponents(this.getConnectionName(this.profile), this.profile.id, this.profile.databaseName!);
		}
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private initializeDialog(): void {
		this.initializeImportTab();
		this.dialog.content = [this.importTab];
	}

	private initializeImportTab(): void {
		this.importTab.registerContent(async view => {

			const connectionRow = this.createConnectionRow(view);
			const databaseRow = this.createDatabaseRow(view);
			const sourceDatabaseFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			sourceDatabaseFormSection.addItems([connectionRow, databaseRow]);

			const projectNameColumn = this.createProjectNameColumn(view);
			const projectLocationColumn = this.createProjectLocationColumn(view);
			const targetProjectFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			targetProjectFormSection.addItems([projectNameColumn, projectLocationColumn]);

			const folderStructureRow = this.createFolderStructureRow(view);
			const importSettingsFormSection = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			importSettingsFormSection.addItems([folderStructureRow]);

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							{
								component: sourceDatabaseFormSection,
								title: constants.sourceDatabase
							},
							{
								component: targetProjectFormSection,
								title: constants.targetProject
							},
							{
								component: importSettingsFormSection,
								title: constants.importSettings
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

			let formModel = this.formBuilder.component();
			await view.initializeModel(formModel);
			this.initDialogComplete?.resolve();
		});
	}

	private createConnectionRow(view: azdata.ModelView): azdata.FlexContainer {
		this.sourceConnectionTextBox = this.createSourceConnectionComponent(view);
		const selectConnectionButton: azdata.Component = this.createSelectConnectionButton(view);

		const serverLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.server,
			requiredIndicator: true,
			width: cssStyles.importDialogLabelWidth
		}).component();

		const connectionRow = view.modelBuilder.flexContainer().withItems([serverLabel, this.sourceConnectionTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		connectionRow.insertItem(selectConnectionButton, 2, { CSSStyles: { 'margin-right': '0px' } });

		return connectionRow;
	}

	private createDatabaseRow(view: azdata.ModelView): azdata.FlexContainer {
		this.sourceDatabaseDropDown = view.modelBuilder.dropDown().withProperties({
			ariaLabel: constants.databaseNameLabel,
			required: true,
			width: cssStyles.importDialogTextboxWidth,
			editable: true,
			fireOnTextChange: true
		}).component();

		this.sourceDatabaseDropDown.onValueChanged(() => {
			this.projectNameTextBox!.value = newProjectTool.defaultProjectNameFromDb(<string>this.sourceDatabaseDropDown!.value);
			this.tryEnableImportButton();
		});

		const databaseLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.databaseNameLabel,
			requiredIndicator: true,
			width: cssStyles.importDialogLabelWidth
		}).component();

		const databaseRow = view.modelBuilder.flexContainer().withItems([databaseLabel, <azdata.DropDownComponent>this.sourceDatabaseDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return databaseRow;
	}

	private createSourceConnectionComponent(view: azdata.ModelView): azdata.InputBoxComponent {
		this.sourceConnectionTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			placeHolder: constants.selectConnection,
			width: cssStyles.importDialogTextboxWidth,
			enabled: false
		}).component();

		this.sourceConnectionTextBox.onTextChanged(() => {
			this.tryEnableImportButton();
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
			connectionTextboxValue = this.getConnectionName(connection);

			this.updateConnectionComponents(connectionTextboxValue, this.connectionId, connection.options.database);
		});

		return this.selectConnectionButton;
	}

	private getConnectionName(connection: any): string {
		// get connection name if there is one, otherwise set connection name in format that shows in OE
		let connectionName: string;
		if (connection.options['connectionName']) {
			connectionName = connection.options['connectionName'];
		} else {
			let user = connection.options['user'];
			if (!user) {
				user = constants.defaultUser;
			}

			connectionName = `${connection.options['server']} (${user})`;
		}

		return connectionName;
	}

	private async updateConnectionComponents(connectionTextboxValue: string, connectionId: string, databaseName?: string) {
		this.sourceConnectionTextBox!.value = connectionTextboxValue;
		this.sourceConnectionTextBox!.placeHolder = connectionTextboxValue;

		// populate database dropdown with the databases for this connection
		if (connectionId) {
			const databaseValues = await azdata.connection.listDatabases(connectionId);

			this.sourceDatabaseDropDown!.values = databaseValues;
			this.connectionId = connectionId;
		}

		// change the database inputbox value to the connection's database if there is one
		if (databaseName && databaseName !== constants.master) {
			this.sourceDatabaseDropDown!.value = databaseName;
		}

		// change icon to the one without a plus sign
		this.selectConnectionButton!.iconPath = IconPathHelper.connect;
	}

	private createProjectNameColumn(view: azdata.ModelView): azdata.FlexContainer {
		this.projectNameTextBox = view.modelBuilder.inputBox().withProperties<azdata.InputBoxProperties>({
			ariaLabel: constants.projectNamePlaceholderText,
			required: true,
			width: cssStyles.importDialogProjectInfoTextboxWidth,
			validationErrorMessage: constants.projectNameRequired
		}).component();

		this.projectNameTextBox.onTextChanged(() => {
			this.projectNameTextBox!.value = this.projectNameTextBox!.value?.trim();
			this.tryEnableImportButton();
		});

		const projectNameLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.projectNameLabel,
			requiredIndicator: true,
			width: cssStyles.importDialogLabelWidth
		}).component();

		const projectNameColumn = view.modelBuilder.flexContainer().withItems([projectNameLabel, this.projectNameTextBox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'column' }).component();

		return projectNameColumn;
	}

	private createProjectLocationColumn(view: azdata.ModelView): azdata.FlexContainer {
		const projectLocationRow = this.createProjectLocationComponent(view);

		const projectLocationLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.projectLocationLabel,
			requiredIndicator: true,
			width: cssStyles.importDialogLabelWidth
		}).component();

		const projectLocationColumn = view.modelBuilder.flexContainer().withItems([projectLocationLabel, projectLocationRow], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'column' }).component();

		return projectLocationColumn;
	}

	private createProjectLocationComponent(view: azdata.ModelView): azdata.FlexContainer {
		const browseFolderButton: azdata.Component = this.createBrowseFolderButton(view);

		this.projectLocationTextBox = view.modelBuilder.inputBox().withProperties({
			value: '',
			ariaLabel: constants.projectLocationLabel,
			placeHolder: constants.projectLocationPlaceholderText,
			width: cssStyles.importDialogProjectInfoTextboxWidth,
			validationErrorMessage: constants.projectLocationRequired
		}).component();

		this.projectLocationTextBox.onTextChanged(() => {
			this.projectLocationTextBox!.placeHolder = this.projectLocationTextBox!.value;
			this.tryEnableImportButton();
		});

		const projectLocationRow = view.modelBuilder.flexContainer().withItems([this.projectLocationTextBox, browseFolderButton], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return projectLocationRow;
	}

	private createBrowseFolderButton(view: azdata.ModelView): azdata.ButtonComponent {
		const browseFolderButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			ariaLabel: constants.browseButtonText,
			iconPath: IconPathHelper.folder_blue,
			height: '16px',
			width: '16px'
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
			this.projectLocationTextBox!.placeHolder = folderUris[0].fsPath;

		});

		return browseFolderButton;
	}

	private createFolderStructureRow(view: azdata.ModelView): azdata.FlexContainer {
		this.folderStructureDropDown = view.modelBuilder.dropDown().withProperties({
			values: [constants.file, constants.flat, constants.objectType, constants.schema, constants.schemaObjectType],
			value: constants.schemaObjectType,
			ariaLabel: constants.folderStructureLabel,
			required: true,
			width: cssStyles.importDialogTextboxWidth
		}).component();

		this.folderStructureDropDown.onValueChanged(() => {
			this.tryEnableImportButton();
		});

		const folderStructureLabel = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: constants.folderStructureLabel,
			requiredIndicator: true,
			width: cssStyles.importDialogLabelWidth
		}).component();

		const folderStructureRow = view.modelBuilder.flexContainer().withItems([folderStructureLabel, <azdata.DropDownComponent>this.folderStructureDropDown], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		return folderStructureRow;
	}

	// only enable Import button if all fields are filled
	private tryEnableImportButton(): void {
		if (this.sourceConnectionTextBox!.value && this.sourceDatabaseDropDown!.value
			&& this.projectNameTextBox!.value && this.projectLocationTextBox!.value) {
			this.dialog.okButton.enabled = true;
		} else {
			this.dialog.okButton.enabled = false;
		}
	}

	public async importClick(): Promise<void> {
		const model: ImportDataModel = {
			serverId: this.connectionId!,
			database: <string>this.sourceDatabaseDropDown!.value,
			projName: this.projectNameTextBox!.value!,
			filePath: this.projectLocationTextBox!.value!,
			version: '1.0.0.0',
			extractTarget: this.mapExtractTargetEnum!(<string>this.folderStructureDropDown!.value)
		};

		azdata.window.closeDialog(this.dialog);
		await this.createNewProjectCallBack!(model);

		this.dispose();
	}
}
