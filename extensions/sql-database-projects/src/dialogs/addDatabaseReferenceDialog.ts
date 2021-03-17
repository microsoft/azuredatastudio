/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

import { Project, SystemDatabase } from '../models/project';
import { cssStyles } from '../common/uiConstants';
import { IconPathHelper } from '../common/iconHelper';
import { ISystemDatabaseReferenceSettings, IDacpacReferenceSettings, IProjectReferenceSettings } from '../models/IDatabaseReferenceSettings';
import { Deferred } from '../common/promise';
import { TelemetryActions, TelemetryReporter, TelemetryViews } from '../common/telemetry';

export enum ReferenceType {
	project,
	systemDb,
	dacpac
}

export class AddDatabaseReferenceDialog {
	public dialog: azdata.window.Dialog;
	public addDatabaseReferenceTab: azdata.window.DialogTab;
	private view: azdata.ModelView | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private projectDropdown: azdata.DropDownComponent | undefined;
	private projectFormComponent: azdata.FormComponent | undefined;
	private systemDatabaseDropdown: azdata.DropDownComponent | undefined;
	private systemDatabaseFormComponent: azdata.FormComponent | undefined;
	public dacpacTextbox: azdata.InputBoxComponent | undefined;
	private dacpacFormComponent: azdata.FormComponent | undefined;
	public locationDropdown: azdata.DropDownComponent | undefined;
	public databaseNameTextbox: azdata.InputBoxComponent | undefined;
	public databaseVariableTextbox: azdata.InputBoxComponent | undefined;
	public serverNameTextbox: azdata.InputBoxComponent | undefined;
	public serverVariableTextbox: azdata.InputBoxComponent | undefined;
	public suppressMissingDependenciesErrorsCheckbox: azdata.CheckBoxComponent | undefined;
	public exampleUsage: azdata.TextComponent | undefined;
	private projectRadioButton: azdata.RadioButtonComponent | undefined;
	private systemDatabaseRadioButton: azdata.RadioButtonComponent | undefined;

	public currentReferenceType: ReferenceType | undefined;

	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete: Deferred<void> | undefined;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	public addReference: ((proj: Project, settings: ISystemDatabaseReferenceSettings | IDacpacReferenceSettings | IProjectReferenceSettings) => any) | undefined;

	constructor(private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.addDatabaseReferenceDialogName, 'addDatabaseReferencesDialog');
		this.addDatabaseReferenceTab = azdata.window.createTab(constants.addDatabaseReferenceDialogName);
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
			this.projectFormComponent = await this.createProjectDropdown();
			const radioButtonGroup = this.createRadioButtons();
			this.systemDatabaseFormComponent = this.createSystemDatabaseDropdown();
			this.dacpacFormComponent = this.createDacpacTextbox();
			const locationDropdown = this.createLocationDropdown();
			const variableSection = this.createVariableSection();
			this.suppressMissingDependenciesErrorsCheckbox = view.modelBuilder.checkBox().withProperties({
				label: constants.suppressMissingDependenciesErrors
			}).component();
			const exampleUsage = this.createExampleUsage();

			this.formBuilder = <azdata.FormBuilder>view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: '',
						components: [
							radioButtonGroup,
							this.currentReferenceType === ReferenceType.project ? this.projectFormComponent : this.systemDatabaseFormComponent,
							locationDropdown,
							variableSection,
							exampleUsage,
							{
								component: this.suppressMissingDependenciesErrorsCheckbox
							}
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
			this.updateEnabledInputBoxes();

			if (this.currentReferenceType === ReferenceType.project) {
				this.projectRadioButton?.focus();
			} else {
				this.systemDatabaseRadioButton?.focus();
			}

			this.initDialogComplete?.resolve();
		});
	}

	public async addReferenceClick(): Promise<void> {
		let referenceSettings: ISystemDatabaseReferenceSettings | IDacpacReferenceSettings | IProjectReferenceSettings;

		if (this.currentReferenceType === ReferenceType.project) {
			referenceSettings = {
				projectName: <string>this.projectDropdown?.value,
				projectGuid: '',
				projectRelativePath: undefined,
				databaseName: <string>this.databaseNameTextbox?.value,
				databaseVariable: <string>this.databaseVariableTextbox?.value,
				serverName: <string>this.serverNameTextbox?.value,
				serverVariable: <string>this.serverVariableTextbox?.value,
				suppressMissingDependenciesErrors: <boolean>this.suppressMissingDependenciesErrorsCheckbox?.checked
			};
		} else if (this.currentReferenceType === ReferenceType.systemDb) {
			referenceSettings = {
				databaseName: <string>this.databaseNameTextbox?.value,
				systemDb: <string>this.systemDatabaseDropdown?.value === constants.master ? SystemDatabase.master : SystemDatabase.msdb,
				suppressMissingDependenciesErrors: <boolean>this.suppressMissingDependenciesErrorsCheckbox?.checked
			};
		} else { // this.currentReferenceType === ReferenceType.dacpac
			referenceSettings = {
				databaseName: <string>this.databaseNameTextbox?.value,
				dacpacFileLocation: vscode.Uri.file(<string>this.dacpacTextbox?.value),
				databaseVariable: utils.removeSqlCmdVariableFormatting(<string>this.databaseVariableTextbox?.value),
				serverName: <string>this.serverNameTextbox?.value,
				serverVariable: utils.removeSqlCmdVariableFormatting(<string>this.serverVariableTextbox?.value),
				suppressMissingDependenciesErrors: <boolean>this.suppressMissingDependenciesErrorsCheckbox?.checked
			};
		}

		TelemetryReporter.createActionEvent(TelemetryViews.ProjectTree, TelemetryActions.addDatabaseReference)
			.withAdditionalProperties({ referenceType: this.currentReferenceType!.toString() })
			.send();

		await this.addReference!(this.project, referenceSettings);

		this.dispose();
	}

	private createRadioButtons(): azdata.FormComponent {
		this.projectRadioButton = this.view!.modelBuilder.radioButton()
			.withProperties({
				name: 'referenceType',
				label: constants.projectRadioButtonTitle
			}).component();

		this.projectRadioButton.onDidClick(() => {
			this.projectRadioButtonClick();
		});

		this.systemDatabaseRadioButton = this.view!.modelBuilder.radioButton()
			.withProperties({
				name: 'referenceType',
				label: constants.systemDatabaseRadioButtonTitle
			}).component();

		this.systemDatabaseRadioButton.onDidClick(() => {
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

		if (this.projectDropdown?.values?.length) {
			this.projectRadioButton.checked = true;
			this.currentReferenceType = ReferenceType.project;
		} else {
			this.systemDatabaseRadioButton.checked = true;
			this.currentReferenceType = ReferenceType.systemDb;

			// disable projects radio button if there aren't any projects that can be added as a reference
			this.projectRadioButton.enabled = false;
		}

		let flexRadioButtonsModel: azdata.FlexContainer = this.view!.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.projectRadioButton, this.systemDatabaseRadioButton, dacpacRadioButton])
			.withProperties({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: constants.referenceRadioButtonsGroupTitle
		};
	}

	public projectRadioButtonClick(): void {
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.dacpacFormComponent);
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent);
		this.formBuilder!.insertFormItem(<azdata.FormComponent>this.projectFormComponent, 2);

		this.currentReferenceType = ReferenceType.project;
		this.updateEnabledInputBoxes();
		this.tryEnableAddReferenceButton();
		this.updateExampleUsage();
	}

	public systemDbRadioButtonClick(): void {
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.dacpacFormComponent);
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.projectFormComponent);
		this.formBuilder!.insertFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent, 2);

		// update dropdown values because only different database, same server is a valid location for system db references
		this.locationDropdown!.values = constants.systemDbLocationDropdownValues;
		this.locationDropdown!.value = constants.differentDbSameServer;

		this.currentReferenceType = ReferenceType.systemDb;
		this.updateEnabledInputBoxes();
		this.tryEnableAddReferenceButton();
		this.updateExampleUsage();
	}

	public dacpacRadioButtonClick(): void {
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent);
		this.formBuilder!.removeFormItem(<azdata.FormComponent>this.projectFormComponent);
		this.formBuilder!.insertFormItem(<azdata.FormComponent>this.dacpacFormComponent, 2);

		this.locationDropdown!.values = constants.locationDropdownValues;
		this.locationDropdown!.value = constants.differentDbSameServer;

		this.currentReferenceType = ReferenceType.dacpac;
		this.updateEnabledInputBoxes();
		this.tryEnableAddReferenceButton();
		this.updateExampleUsage();
	}

	private async createProjectDropdown(): Promise<azdata.FormComponent> {
		this.projectDropdown = this.view!.modelBuilder.dropDown().withProperties({
			ariaLabel: constants.databaseProject
		}).component();

		this.projectDropdown.onValueChanged(() => {
			this.setDefaultDatabaseValues();
		});

		// get projects in workspace and filter to only sql projects
		let projectFiles: vscode.Uri[] = utils.getSqlProjectsInWorkspace();

		// filter out current project
		projectFiles = projectFiles.filter(p => p.fsPath !== this.project.projectFilePath);
		this.projectDropdown.values = projectFiles.map(p => path.parse(p.fsPath).name);

		return {
			component: this.projectDropdown,
			title: constants.databaseProject
		};
	}


	private createSystemDatabaseDropdown(): azdata.FormComponent {
		this.systemDatabaseDropdown = this.view!.modelBuilder.dropDown().withProperties({
			values: [constants.master, constants.msdb],
			ariaLabel: constants.databaseNameLabel
		}).component();

		this.systemDatabaseDropdown.onValueChanged(() => {
			this.setDefaultDatabaseValues();
		});

		// only master is a valid system db reference for projects targetting Azure
		if (this.project.getProjectTargetVersion().toLowerCase().includes('azure')) {
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
			placeHolder: constants.dacpacPlaceholder,
			width: '400px'
		}).component();

		this.dacpacTextbox.onTextChanged(() => {
			this.setDefaultDatabaseValues();
			this.tryEnableAddReferenceButton();
			this.updateExampleUsage();
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
			iconPath: IconPathHelper.folder_blue,
			height: '18px',
			width: '18px'
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
			values: this.currentReferenceType === ReferenceType.systemDb ? constants.systemDbLocationDropdownValues : constants.locationDropdownValues
		}).component();

		this.locationDropdown.value = constants.differentDbSameServer;

		this.locationDropdown.onValueChanged(() => {
			this.updateEnabledInputBoxes();
			this.tryEnableAddReferenceButton();
			this.updateExampleUsage();
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
	public updateEnabledInputBoxes(): void {
		const isSystemDb = this.currentReferenceType === ReferenceType.systemDb;

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

			// add default values in enabled fields
			this.setDefaultDatabaseValues();
		} else if (this.locationDropdown?.value === constants.differentDbDifferentServer) {
			this.databaseNameTextbox!.enabled = true;
			this.databaseVariableTextbox!.enabled = true;
			this.serverNameTextbox!.enabled = true;
			this.serverVariableTextbox!.enabled = true;

			// add default values in enabled fields
			this.setDefaultDatabaseValues();
			this.serverNameTextbox!.value = constants.otherServer;
			this.serverVariableTextbox!.value = constants.otherSeverVariable;
		}
	}

	private setDefaultDatabaseValues(): void {
		switch (this.currentReferenceType) {
			case ReferenceType.project: {
				this.databaseNameTextbox!.value = <string>this.projectDropdown?.value;
				this.databaseVariableTextbox!.value = `${this.projectDropdown?.value}`;
				break;
			}
			case ReferenceType.systemDb: {
				this.databaseNameTextbox!.value = <string>this.systemDatabaseDropdown?.value;
				break;
			}
			case ReferenceType.dacpac: {
				const dacpacName = this.dacpacTextbox!.value ? path.parse(this.dacpacTextbox!.value!).name : '';
				this.databaseNameTextbox!.value = dacpacName;
				this.databaseVariableTextbox!.value = dacpacName ? `${dacpacName}` : '';
				break;
			}
		}
	}

	private createVariableSection(): azdata.FormComponent {
		// database name row
		this.databaseNameTextbox = this.createInputBox(constants.databaseName, true, true);
		const databaseNameRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.databaseName, true), this.databaseNameTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// database variable row
		this.databaseVariableTextbox = this.createInputBox(constants.databaseVariable, false, false);
		const databaseVariableRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.databaseVariable), this.databaseVariableTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// server name row
		this.serverNameTextbox = this.createInputBox(constants.serverName, false, true);
		const serverNameRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.serverName, true), this.serverNameTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// server variable row
		this.serverVariableTextbox = this.createInputBox(constants.serverVariable, false, true);
		const serverVariableRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.serverVariable, true), this.serverVariableTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		const variableSection = this.view!.modelBuilder.flexContainer().withItems([databaseNameRow, databaseVariableRow, serverNameRow, serverVariableRow]).withLayout({ flexFlow: 'column' }).withProperties({ CSSStyles: { 'margin-bottom': '25px' } }).component();
		this.setDefaultDatabaseValues();

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

	private createInputBox(ariaLabel: string, enabled: boolean, required: boolean): azdata.InputBoxComponent {
		const inputBox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: ariaLabel,
			enabled: enabled,
			width: cssStyles.addDatabaseReferenceInputboxWidth,
			required: required
		}).component();

		inputBox.onTextChanged(() => {
			this.tryEnableAddReferenceButton();
			this.updateExampleUsage();
		});

		return inputBox;
	}

	private createExampleUsage(): azdata.FormComponent {
		this.exampleUsage = this.view!.modelBuilder.text().withProperties({
			value: this.currentReferenceType === ReferenceType.project ? constants.databaseNameRequiredVariableOptional : constants.systemDatabaseReferenceRequired,
			CSSStyles: { 'user-select': 'text' }
		}).component();

		const exampleUsageWrapper = this.view!.modelBuilder.flexContainer().withItems([this.exampleUsage], { CSSStyles: { 'width': '415px', 'height': '80px', 'padding': '0 10px', 'border': '1px solid #8a8886', 'font-style': 'italic' } }).component();

		return {
			component: exampleUsageWrapper,
			title: constants.exampleUsage
		};
	}

	private updateExampleUsage(): void {
		let newText = '';
		let fontStyle = cssStyles.fontStyle.normal; // font-style should be normal for example usage and italics if showing message that a required field needs to be filled

		switch (this.locationDropdown!.value) {
			case constants.sameDatabase: {
				newText = constants.sameDatabaseExampleUsage;
				break;
			}
			case constants.differentDbSameServer: {
				if (!this.databaseNameTextbox?.value) {
					newText = this.currentReferenceType === ReferenceType.systemDb ? constants.enterSystemDbName : constants.databaseNameRequiredVariableOptional;
					fontStyle = cssStyles.fontStyle.italics;
				} else {
					const db = this.databaseVariableTextbox?.value ? utils.formatSqlCmdVariable(this.databaseVariableTextbox?.value) : this.databaseNameTextbox.value;
					newText = constants.differentDbSameServerExampleUsage(db);
				}
				break;
			}
			case constants.differentDbDifferentServer: {
				if (!this.databaseNameTextbox?.value || !this.serverNameTextbox?.value || !this.serverVariableTextbox?.value) {
					newText = constants.databaseNameServerNameVariableRequired;
					fontStyle = cssStyles.fontStyle.italics;
				} else {
					const server = utils.formatSqlCmdVariable(this.serverVariableTextbox.value);
					const db = this.databaseVariableTextbox?.value ? utils.formatSqlCmdVariable(this.databaseVariableTextbox?.value) : this.databaseNameTextbox.value;
					newText = constants.differentDbDifferentServerExampleUsage(server, db);
				}
				break;
			}
		}

		// check for invalid variables
		if (!this.validSqlCmdVariables()) {
			let invalidName = !utils.isValidSqlCmdVariableName(this.databaseVariableTextbox?.value) ? this.databaseVariableTextbox!.value! : this.serverVariableTextbox!.value!;
			invalidName = utils.removeSqlCmdVariableFormatting(invalidName);
			newText = constants.notValidVariableName(invalidName);
		}

		this.exampleUsage!.value = newText;
		this.exampleUsage?.updateCssStyles({ 'font-style': fontStyle });
	}

	private validSqlCmdVariables(): boolean {
		if (this.databaseVariableTextbox?.enabled && this.databaseVariableTextbox?.value && !utils.isValidSqlCmdVariableName(this.databaseVariableTextbox?.value)
			|| this.serverVariableTextbox?.enabled && this.serverVariableTextbox?.value && !utils.isValidSqlCmdVariableName(this.serverVariableTextbox?.value)) {
			return false;
		}

		return true;
	}

	/**
	 * Only enable Add reference button if all enabled fields are filled
	 */
	public tryEnableAddReferenceButton(): void {
		switch (this.currentReferenceType) {
			case ReferenceType.project: {
				this.dialog.okButton.enabled = this.projectRequiredFieldsFilled();
				break;
			}
			case ReferenceType.systemDb: {
				this.dialog.okButton.enabled = !!this.databaseNameTextbox?.value;
				break;
			}
			case ReferenceType.dacpac: {
				this.dialog.okButton.enabled = this.dacpacRequiredFieldsFilled();
				break;
			}
		}
	}

	private dacpacRequiredFieldsFilled(): boolean {
		return !!this.dacpacTextbox?.value
			&& this.validSqlCmdVariables()
			&& ((this.locationDropdown?.value === constants.sameDatabase)
				|| (this.locationDropdown?.value === constants.differentDbSameServer && this.differentDatabaseSameServerRequiredFieldsFilled())
				|| ((this.locationDropdown?.value === constants.differentDbDifferentServer && this.differentDatabaseDifferentServerRequiredFieldsFilled())));
	}

	private projectRequiredFieldsFilled(): boolean {
		return !!this.projectDropdown?.value &&
			((this.locationDropdown?.value === constants.sameDatabase)
				|| (this.locationDropdown?.value === constants.differentDbSameServer && this.differentDatabaseSameServerRequiredFieldsFilled())
				|| ((this.locationDropdown?.value === constants.differentDbDifferentServer && this.differentDatabaseDifferentServerRequiredFieldsFilled())));
	}

	private differentDatabaseSameServerRequiredFieldsFilled(): boolean {
		return !!this.databaseNameTextbox?.value;
	}

	private differentDatabaseDifferentServerRequiredFieldsFilled(): boolean {
		return !!this.databaseNameTextbox?.value && !!this.serverNameTextbox?.value && !!this.serverVariableTextbox?.value;
	}
}
