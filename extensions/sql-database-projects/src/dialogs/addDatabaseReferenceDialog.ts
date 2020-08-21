/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';

import { Project } from '../models/project';
import { cssStyles } from '../common/uiConstants';
import { IconPathHelper } from '../common/iconHelper';

export class AddDatabaseReferenceDialog {
	public dialog: azdata.window.Dialog;
	public addDatabaseReferenceTab: azdata.window.DialogTab;
	private view: azdata.ModelView | undefined;
	private formBuilder: azdata.FormBuilder | undefined;
	private systemDatabaseDropdown: azdata.DropDownComponent | undefined;
	private systemDatabaseFormComponent: azdata.FormComponent | undefined;
	private dacpacTextbox: azdata.InputBoxComponent | undefined;
	private dacpacFormComponent: azdata.FormComponent | undefined;
	private locationDropdown: azdata.DropDownComponent | undefined;
	private databaseNameTextbox: azdata.InputBoxComponent | undefined;
	private databaseVariableTextbox: azdata.InputBoxComponent | undefined;
	private serverNameTextbox: azdata.InputBoxComponent | undefined;
	private serverVariableTextbox: azdata.InputBoxComponent | undefined;

	private toDispose: vscode.Disposable[] = [];

	public addReference: ((proj: Project) => any) | undefined;

	constructor(private project: Project) {
		this.dialog = azdata.window.createModelViewDialog(constants.addDatabaseReferenceDialogName);
		this.addDatabaseReferenceTab = azdata.window.createTab(constants.addDatabaseReferenceDialogName);
	}

	public openDialog(): void {
		this.initializeDialog();
		this.dialog.okButton.label = constants.addDatabaseReferenceOkButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.addReferenceClick()));

		this.dialog.cancelButton.label = constants.cancelButtonText;

		azdata.window.openDialog(this.dialog);
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
		});
	}

	public async addReferenceClick(): Promise<void> {
		await this.addReference!(this.project);

		this.dispose();
	}

	private createRadioButtons(): azdata.FormComponent {
		const systemDatabaseRadioButton = this.view!.modelBuilder.radioButton()
			.withProperties({
				name: 'referenceType',
				label: constants.systemDatabaseRadioButtonTitle
			}).component();

		systemDatabaseRadioButton.checked = true;
		systemDatabaseRadioButton.onDidClick(() => {
			this.formBuilder!.removeFormItem(<azdata.FormComponent>this.dacpacFormComponent);
			this.formBuilder!.insertFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent, 2);

			this.locationDropdown!.values = constants.systemDbLocationDropdownValues;
			this.updateEnabledInputBoxes(constants.differentDbSameServer, true);
			// this.connectionIsDataSource = false;
			// this.targetDatabaseTextBox!.value = this.getDefaultDatabaseName();
		});

		const dacpacRadioButton = this.view!.modelBuilder.radioButton()
			.withProperties({
				name: 'referenceType',
				label: constants.dacpacText
			}).component();

		dacpacRadioButton.onDidClick(() => {
			this.formBuilder!.removeFormItem(<azdata.FormComponent>this.systemDatabaseFormComponent);
			this.formBuilder!.insertFormItem(<azdata.FormComponent>this.dacpacFormComponent, 2);

			this.locationDropdown!.values = constants.locationDropdownValues;
			this.locationDropdown!.value = constants.differentDbSameServer;
			this.updateEnabledInputBoxes(constants.differentDbSameServer);
			// this.connectionIsDataSource = true;

			// this.setDatabaseToSelectedDataSourceDatabase();
		});

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
			enabled: false,
			width: '405px'
		}).component();

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

		return loadDacpacButton;
	}

	private createLocationDropdown(): azdata.FormComponent {
		this.locationDropdown = this.view!.modelBuilder.dropDown().withProperties({
			ariaLabel: constants.locationDropdown,
			values: constants.systemDbLocationDropdownValues//constants.locationDropdownValues
		}).component();

		this.locationDropdown.onValueChanged((v) => {
			this.updateEnabledInputBoxes(v.selected);
		});

		return {
			component: this.locationDropdown,
			title: constants.locationDropdown
		};
	}

	private updateEnabledInputBoxes(dropdownValue: string, isSystemDb: boolean = false): void {
		if (dropdownValue === constants.sameDatabase) {
			this.databaseNameTextbox!.enabled = false;
			this.databaseVariableTextbox!.enabled = false;
			this.serverNameTextbox!.enabled = false;
			this.serverVariableTextbox!.enabled = false;
		} else if (dropdownValue === constants.differentDbSameServer) {
			this.databaseNameTextbox!.enabled = true;
			this.databaseVariableTextbox!.enabled = !isSystemDb; // database variable is only enabled for non-system database references
			this.serverNameTextbox!.enabled = false;
			this.serverVariableTextbox!.enabled = false;
		} else if (dropdownValue === constants.differentDbDifferentServer) {
			this.databaseNameTextbox!.enabled = true;
			this.databaseVariableTextbox!.enabled = true;
			this.serverNameTextbox!.enabled = true;
			this.serverVariableTextbox!.enabled = true;
		}
	}

	private createLabel(value: string): azdata.TextComponent {
		const label = this.view!.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
			value: value,
			width: cssStyles.addDatabaseReferenceDialogLabelWidth
		}).component();

		return label;
	}

	private createVariableSection(): azdata.FormComponent {
		// database name row
		this.databaseNameTextbox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: constants.databaseName,
			enabled: true,
			width: cssStyles.addDatabaseReferenceInputboxWidth
		}).component();

		const databaseNameRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.databaseName), this.databaseNameTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// database variable row
		this.databaseVariableTextbox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: constants.databaseVariable,
			enabled: false,
			width: cssStyles.addDatabaseReferenceInputboxWidth
		}).component();

		const databaseVariableRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.databaseVariable), this.databaseVariableTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// server name row
		this.serverNameTextbox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: constants.serverName,
			enabled: false,
			width: cssStyles.addDatabaseReferenceInputboxWidth
		}).component();

		const serverNameRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.serverName), this.serverNameTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		// server variable row
		this.serverVariableTextbox = this.view!.modelBuilder.inputBox().withProperties({
			ariaLabel: constants.serverVariable,
			enabled: false,
			width: cssStyles.addDatabaseReferenceInputboxWidth
		}).component();

		const serverVariableRow = this.view!.modelBuilder.flexContainer().withItems([this.createLabel(constants.serverVariable), this.serverVariableTextbox], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();

		const variableSection = this.view!.modelBuilder.flexContainer().withItems([databaseNameRow, databaseVariableRow, serverNameRow, serverVariableRow]).withLayout({ flexFlow: 'column' }).component();

		return {
			component: variableSection,
			title: ''
		};
	}
}
