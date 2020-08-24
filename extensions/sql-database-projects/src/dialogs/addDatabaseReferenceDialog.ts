/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';

import { Project, SystemDatabase, DatabaseReferenceLocation } from '../models/project';
import { cssStyles } from '../common/uiConstants';
import { IconPathHelper } from '../common/iconHelper';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { isEmptyOrUndefined } from '../common/utils';

export enum ReferenceType {
	project,
	systemDb,
	dacpac
}

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class AddDatabaseReferenceDialog {
	public dialog: azdata.window.Dialog;
	public addDatabaseReferenceTab: azdata.window.DialogTab;
	private view: azdata.ModelView | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private systemDatabaseDropdown: azdata.DropDownComponent | undefined;
	private systemDatabaseFormComponent: azdata.FormComponent | undefined;
	public dacpacTextbox: azdata.InputBoxComponent | undefined;
	private dacpacFormComponent: azdata.FormComponent | undefined;
	public locationDropdown: azdata.DropDownComponent | undefined;
	public databaseNameTextbox: azdata.InputBoxComponent | undefined;
	public databaseVariableTextbox: azdata.InputBoxComponent | undefined;
	public serverNameTextbox: azdata.InputBoxComponent | undefined;
	public serverVariableTextbox: azdata.InputBoxComponent | undefined;

	public currentReferenceType: ReferenceType | undefined;
	private referenceLocationMap: Map<string, DatabaseReferenceLocation>;

	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete: Deferred<void> | undefined;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	public addReference: ((proj: Project, settings: ISystemDatabaseReferenceSettings | IDacpacReferenceSettings) => any) | undefined;

	constructor(private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.addDatabaseReferenceDialogName);
		this.addDatabaseReferenceTab = azdata.window.createTab(constants.addDatabaseReferenceDialogName);

		this.referenceLocationMap = new Map([
			[constants.sameDatabase, DatabaseReferenceLocation.sameDatabase],
			[constants.differentDbSameServer, DatabaseReferenceLocation.differentDatabaseSameServer],
			[constants.differentDbDifferentServer, DatabaseReferenceLocation.differentDatabaseDifferentServer]
		]);
	}

	public async openDialog(): Promise<void> {
		this.initializeDialog();
		this.dialog.okButton.label = constants.addDatabaseReferenceOkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.addReferenceClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private initializeDialog(): void {
		this.initializeTab();
		this.dialog.content = [this.addDatabaseReferenceTab];
	}

	private initializeTab(): void {
		this.addDatabaseReferenceTab.registerContent(async view => {
			this.view = view;
			const radioButtonGroup = this.createRadioButtons();
			this.systemDatabaseFormComponent = this.createSystemDatabaseDropdown();
			this.dacpacFormComponent = this.createDacpacTextbox();
			const locationDropdown = this.createLocationDropdown();
			const variableSection = this.createVariableSection();

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							radioButtonGroup,
							this.systemDatabaseFormComponent,
							locationDropdown,
							variableSection
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

			this.initDialogComplete?.resolve();
		});
	}

	public async addReferenceClick(): Promise<void> {
		let referenceSettings: ISystemDatabaseReferenceSettings | IDacpacReferenceSettings;

		if (this.currentReferenceType === ReferenceType.systemDb) {
			referenceSettings = {
				databaseName: <string>this.databaseNameTextbox?.value,
				systemDb: <string>this.systemDatabaseDropdown?.value === constants.master ? SystemDatabase.master : SystemDatabase.msdb
			};
		} else {// if (this.currentReferenceType === ReferenceType.dacpac) {
			referenceSettings = {
				databaseName: <string>this.databaseNameTextbox?.value,
				databaseLocation: <DatabaseReferenceLocation>this.referenceLocationMap.get(<string>this.locationDropdown?.value),
				dacpacFileLocation: vscode.Uri.file(<string>this.dacpacTextbox?.value),
				databaseVariable: <string>this.databaseVariableTextbox?.value
			};
		}

		await this.addReference!(this.project, referenceSettings);

		this.dispose();
	}

	private createRadioButtons(): azdata.FormComponent {
		// TODO: add project reference button

		const systemDatabaseRadioButton = this.view!.modelBuilder.radioButton()
			.withProperties({
				name: 'referenceType',
				label: constants.systemDatabaseRadioButtonTitle
			}).component();

		systemDatabaseRadioButton.checked = true;
		systemDatabaseRadioButton.onDidClick(() => {
			this.systemDbRadioButtonClick();
		});

		const dacpacRadioButton = this.view!.modelBuilder.radioButton()
			.withProperties({
				name: 'referenceType',
				label: constants.dacpacText
			}).component();

		dacpacRadioButton.onDidClick(() => {
			this.dacpacRadioButtonClick();
		});

		this.currentReferenceType = ReferenceType.systemDb;
		let flexRadioButtonsModel: azdata.FlexContainer = this.view!.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([systemDatabaseRadioButton, dacpacRadioButton])
			.withProperties({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: constants.referenceRadioButtonsGroupTitle
		};
	}

	public systemDbRadioButtonClick(): void {
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.dacpacFormComponent);
		this.formBuilder!.insertFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent, 2);

		this.locationDropdown!.values = constants.systemDbLocationDropdownValues;

		this.currentReferenceType = ReferenceType.systemDb;
		this.updateEnabledInputBoxes(true);
		this.tryEnableAddReferenceButton();
	}

	public dacpacRadioButtonClick(): void {
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent);
		this.formBuilder!.insertFormItem(<azdata.FormComponent>this.dacpacFormComponent, 2);

		this.locationDropdown!.values = constants.locationDropdownValues;
		this.locationDropdown!.value = constants.differentDbSameServer;

		this.currentReferenceType = ReferenceType.dacpac;
		this.updateEnabledInputBoxes();
		this.tryEnableAddReferenceButton();
	}

	private createSystemDatabaseDropdown(): azdata.FormComponent {
		this.systemDatabaseDropdown = this.view!.modelBuilder.dropDown().withProperties({
			values: [constants.master, constants.msdb],
			ariaLabel: constants.databaseNameLabel
		}).component();

		if (this.project.getProjectTargetPlatform().toLowerCase().includes('azure')) {
			this.systemDatabaseDropdown.values?.splice(1);
		}

		return {
			component: this.systemDatabaseDropdown,
			title: constants.databaseNameLabel
		};
	}

	private createDacpacTextbox(): azdata.FormComponent {
		this.dacpacTextbox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: constants.dacpacText,
			placeholder: constants.dacpacPlaceholder,
			width: '405px'
		}).component();

		this.dacpacTextbox.onTextChanged(() => {
			this.tryEnableAddReferenceButton();
		});

		const loadDacpacButton = this.createLoadDacpacButton();
		const databaseRow = this.view!.modelBuilder.flexContainer().withItems([this.dacpacTextbox], { flex: '0 0 auto', CSSStyles: { 'margin-right': '10px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
		databaseRow.insertItem(loadDacpacButton, 1);

		return {
			component: databaseRow,
			title: constants.dacpacText
		};
	}

	private createLoadDacpacButton(): azdata.ButtonComponent {
		const loadDacpacButton = this.view!.modelBuilder.button().withProperties({
			ariaLabel: constants.loadDacpacButton,
			iconPath: IconPathHelper.folder,
			height: '16px',
			width: '15px'
		}).component();

		loadDacpacButton.onDidClick(async () => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.workspace.workspaceFolders ? (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[])[0].uri : undefined,
					openLabel: constants.selectString,
					filters: {
						[constants.dacpacFiles]: ['dacpac'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}

			this.dacpacTextbox!.value = fileUris[0].fsPath;
		});

		return loadDacpacButton;
	}

	private createLocationDropdown(): azdata.FormComponent {
		this.locationDropdown = this.view!.modelBuilder.dropDown().withProperties({
			ariaLabel: constants.locationDropdown,
			values: constants.systemDbLocationDropdownValues//constants.locationDropdownValues
		}).component();

		this.locationDropdown.onValueChanged(() => {
			this.updateEnabledInputBoxes();
			this.tryEnableAddReferenceButton();
		});

		return {
			component: this.locationDropdown,
			title: constants.locationDropdown
		};
	}

	/**
	 * Update the enabled input boxes based on what the location of the database reference selected in the dropdown is
	 * @param isSystemDb
	 */
	public updateEnabledInputBoxes(isSystemDb: boolean = false): void {
		if (this.locationDropdown?.value === constants.sameDatabase) {
			this.databaseNameTextbox!.enabled = false;
			this.databaseVariableTextbox!.enabled = false;
			this.serverNameTextbox!.enabled = false;
			this.serverVariableTextbox!.enabled = false;

			// clear values in disabled fields
			this.databaseNameTextbox!.value = '';
			this.databaseVariableTextbox!.value = '';
			this.serverNameTextbox!.value = '';
			this.serverVariableTextbox!.value = '';
		} else if (this.locationDropdown?.value === constants.differentDbSameServer) {
			this.databaseNameTextbox!.enabled = true;
			this.databaseVariableTextbox!.enabled = !isSystemDb; // database variable is only enabled for non-system database references
			this.serverNameTextbox!.enabled = false;
			this.serverVariableTextbox!.enabled = false;

			// clear values in disabled fields
			this.databaseVariableTextbox!.value = isSystemDb ? '' : this.databaseVariableTextbox!.value;
			this.serverNameTextbox!.value = '';
			this.serverVariableTextbox!.value = '';
		} else if (this.locationDropdown?.value === constants.differentDbDifferentServer) {
			this.databaseNameTextbox!.enabled = true;
			this.databaseVariableTextbox!.enabled = true;
			this.serverNameTextbox!.enabled = true;
			this.serverVariableTextbox!.enabled = true;
		}
	}

	private createVariableSection(): azdata.FormComponent {
		// database name row
		this.databaseNameTextbox = this.createInputBox(constants.databaseName, true);
		const databaseNameRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.databaseName, true), this.databaseNameTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// database variable row
		this.databaseVariableTextbox = this.createInputBox(constants.databaseVariable, false);
		const databaseVariableRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.databaseVariable), this.databaseVariableTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// server name row
		this.serverNameTextbox = this.createInputBox(constants.serverName, false);
		const serverNameRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.serverName, true), this.serverNameTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// server variable row
		this.serverVariableTextbox = this.createInputBox(constants.serverVariable, false);
		const serverVariableRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.serverVariable, true), this.serverVariableTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		const variableSection = this.view!.modelBuilder.flexContainer().withItems([databaseNameRow, databaseVariableRow, serverNameRow, serverVariableRow]).withLayout({ flexFlow: 'column' }).component();

		return {
			component: variableSection,
			title: ''
		};
	}

	private createLabel(value: string, required: boolean = false): azdata.TextComponent {
		const label = this.view!.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: value,
			width: cssStyles.addDatabaseReferenceDialogLabelWidth,
			requiredIndicator: required
		}).component();

		return label;
	}

	private createInputBox(ariaLabel: string, enabled: boolean): azdata.InputBoxComponent {
		const inputBox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: ariaLabel,
			enabled: enabled,
			width: cssStyles.addDatabaseReferenceInputboxWidth
		}).component();

		inputBox.onTextChanged(() => {
			this.tryEnableAddReferenceButton();
		});

		return inputBox;
	}

	// only enable Add reference button if all enabled fields are filled
	public tryEnableAddReferenceButton(): void {
		switch (this.currentReferenceType) {
			case ReferenceType.systemDb: {
				this.dialog.okButton.enabled = !isEmptyOrUndefined(<string>this.databaseNameTextbox?.value);
				break;
			}
			case ReferenceType.dacpac: {
				this.dialog.okButton.enabled = this.dacpacFieldsRequiredFieldsFilled();
				break;
			}
			case ReferenceType.project: {
				// TODO
			}
		}
	}

	private dacpacFieldsRequiredFieldsFilled(): boolean {
		return !isEmptyOrUndefined(<string>this.dacpacTextbox?.value) &&
			((this.locationDropdown?.value === constants.sameDatabase)
				|| (this.locationDropdown?.value === constants.differentDbSameServer && this.differentDatabaseSameServerRequiredFieldsFilled())
				|| ((this.locationDropdown?.value === constants.differentDbDifferentServer && this.differentDatabaseDifferentServerRequiredFieldsFilled())));
	}

	private differentDatabaseSameServerRequiredFieldsFilled(): boolean {
		return !isEmptyOrUndefined(<string>this.databaseNameTextbox?.value);
	}

	private differentDatabaseDifferentServerRequiredFieldsFilled(): boolean {
		return !isEmptyOrUndefined(<string>this.databaseNameTextbox?.value) && !isEmptyOrUndefined(<string>this.serverNameTextbox?.value) && !isEmptyOrUndefined(<string>this.serverVariableTextbox?.value);
	}
}
