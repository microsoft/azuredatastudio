/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { CreateMigrationControllerDialog } from '../dialog/createMigrationDialog/createMigrationControllerDialog';
import * as constants from '../models/strings';
import * as os from 'os';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private migrationControllerDropdown!: azdata.DropDownComponent;
	private _connectionStatus!: azdata.InfoBoxComponent;
	private _view!: azdata.ModelView;
	private _form!: azdata.FormBuilder;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const createNewController = view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			url: ''
		}).component();

		createNewController.onDidClick((e) => {
			const dialog = new CreateMigrationControllerDialog(this.migrationStateModel, this);
			dialog.initialize();
		});

		this._connectionStatus = view.modelBuilder.infoBox().component();

		this._form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.migrationControllerDropdownsContainer()
					},
					{
						component: createNewController
					},
					{
						component: this._connectionStatus
					}

				]
			);
		await view.initializeModel(this._form.component());
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
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
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

		const noteText = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_NOTE
		}).component();

		const migrationControllerDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_A_MIGRATION_CONTROLLER
		}).component();

		this.migrationControllerDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			descriptionText,
			noteText,
			migrationControllerDropdownLabel,
			this.migrationControllerDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	public async populateMigrationController(controllerStatus?: string): Promise<void> {
		this.migrationControllerDropdown.loading = true;
		let migrationContollerValues: azdata.CategoryValue[] = [];

		// TODO: Replace with this code when APIs are deployed.
		// try{
		// 	this.migrationControllerDropdown.values = await this.migrationStateModel.getMigrationControllerValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._targetManagedInstance);
		// 	this.migrationStateModel.migrationController = this.migrationStateModel.getMigrationController(0);
		// } catch (e) {

		// } finally {
		// 	this.migrationControllerDropdown.loading = false;
		// }

		if (this.migrationStateModel.migrationController) {

			this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
				text: constants.CONTROLLER_READY(this.migrationStateModel.migrationController!.name, this.migrationStateModel._nodeNames.join(', ')),
				style: 'success'
			});
			this._form.addFormItem({
				component: this._connectionStatus
			});
			migrationContollerValues = [
				{
					displayName: this.migrationStateModel.migrationController.name,
					name: ''
				}
			];
		}
		else {
			migrationContollerValues = [
				{
					displayName: constants.CONTROLLER_NOT_FOUND,
					name: ''
				}
			];
			this._form.removeFormItem({
				component: this._connectionStatus
			});
		}
		this.migrationControllerDropdown.values = migrationContollerValues;
		this.migrationControllerDropdown.loading = false;
	}

}


