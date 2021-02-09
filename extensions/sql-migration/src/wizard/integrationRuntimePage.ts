/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { CreateMigrationControllerDialog } from './createMigrationControllerDialog';
import * as constants from '../models/strings';
import * as os from 'os';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private migrationControllerDropdown!: azdata.DropDownComponent;
	private defaultSetupRadioButton!: azdata.RadioButtonComponent;
	private customSetupRadioButton!: azdata.RadioButtonComponent;
	private startSetupButton!: azdata.ButtonComponent;
	private cancelSetupButton!: azdata.ButtonComponent;
	private _connectionStatus!: azdata.TextComponent;
	private createMigrationContainer!: azdata.FlexContainer;
	private _view!: azdata.ModelView;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const createNewController = view.modelBuilder.button().withProps({
			label: constants.NEW,
			width: '100px',
			secondary: true
		}).component();

		createNewController.onDidClick((e) => {
			this.createMigrationContainer.display = 'inline';
		});

		const setupButtonGroup = 'setupOptions';

		this.defaultSetupRadioButton = view.modelBuilder.radioButton().withProps({
			label: constants.DEFAULT_SETUP_BUTTON,
			name: setupButtonGroup
		}).component();
		this.defaultSetupRadioButton.checked = true;

		this.customSetupRadioButton = view.modelBuilder.radioButton().withProps({
			label: constants.CUSTOM_SETUP_BUTTON,
			name: setupButtonGroup
		}).component();

		this.startSetupButton = view.modelBuilder.button().withProps({
			label: constants.CREATE,
			width: '100px',
			secondary: true
		}).component();

		this.startSetupButton.onDidClick((e) => {
			if (this.defaultSetupRadioButton.checked) {
				vscode.window.showInformationMessage(constants.FEATURE_NOT_AVAILABLE);
			} else {
				this.createMigrationContainer.display = 'none';
				const dialog = new CreateMigrationControllerDialog(this.migrationStateModel, this);
				dialog.initialize();
			}
		});

		this.cancelSetupButton = view.modelBuilder.button().withProps({
			label: constants.CANCEL,
			width: '100px',
			secondary: true
		}).component();

		this.cancelSetupButton.onDidClick((e) => {
			this.createMigrationContainer.display = 'none';
		});

		const setupButtonsContainer = view.modelBuilder.flexContainer().withItems([
			this.startSetupButton,
			this.cancelSetupButton
		],
			{ CSSStyles: { 'margin': '10px', } }
		).withLayout({
			flexFlow: 'row'
		}).component();

		this.createMigrationContainer = view.modelBuilder.flexContainer().withItems(
			[
				this.defaultSetupRadioButton,
				this.customSetupRadioButton,
				setupButtonsContainer
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		this._connectionStatus = view.modelBuilder.text().component();

		this.createMigrationContainer.display = 'none';

		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.migrationControllerDropdownsContainer()
					},
					{
						component: createNewController
					},
					{
						component: this.createMigrationContainer
					},
					{
						component: this._connectionStatus
					}

				]
			);
		await view.initializeModel(form.component());
	}

	public async onPageEnter(): Promise<void> {
		this.populateMigrationController();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			const errors: string[] = [];
			if (((<azdata.CategoryValue>this.migrationControllerDropdown.value).displayName === constants.CONTROLLER_NOT_FOUND)) {
				errors.push(constants.CONTROLLER_NOT_SETUP_ERROR);
			}

			this.wizard.message = {
				text: errors.join(os.EOL),
				level: azdata.window.MessageLevel.Error
			};

			if (errors.length > 0) {
				return false;
			}

			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private migrationControllerDropdownsContainer(): azdata.FlexContainer {
		const descriptionText = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_DESCRIPTION,
			links: [
				{
					url: 'https://www.microsoft.com', // TODO: Add proper link
					text: constants.LEARN_MORE
				},
			]
		}).component();

		const migrationControllerDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_A_MIGRATION_CONTROLLER
		}).component();

		this.migrationControllerDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
		}).component();

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			descriptionText,
			migrationControllerDropdownLabel,
			this.migrationControllerDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	public async populateMigrationController(controllerStatus?: string): Promise<void> {
		let migrationContollerValues: azdata.CategoryValue[] = [];
		if (this.migrationStateModel.migrationController) {
			migrationContollerValues = [
				{
					displayName: this.migrationStateModel.migrationController.name,
					name: this.migrationStateModel.migrationController.name
				}
			];

			this._connectionStatus.value = constants.CONTRLLER_READY(this.migrationStateModel.migrationController!.name, os.hostname());
		}
		else {
			migrationContollerValues = [
				{
					displayName: constants.CONTROLLER_NOT_FOUND,
					name: ''
				}
			];
			this._connectionStatus.value = '';
		}
		this.migrationControllerDropdown.values = migrationContollerValues;
		this.migrationControllerDropdown.loading = false;
	}

}


