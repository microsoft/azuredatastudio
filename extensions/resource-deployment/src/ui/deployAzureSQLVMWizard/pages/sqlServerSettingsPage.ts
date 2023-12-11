/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as constants from '../constants';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
import { DeployAzureSQLVMWizardModel } from '../deployAzureSQLVMWizardModel';
import * as localizedConstants from '../../../localizedConstants';
const localize = nls.loadMessageBundle();

export class SqlServerSettingsPage extends BasePage {

	private _sqlConnectivityDropdown!: azdata.DropDownComponent;
	private _portTextRow!: azdata.FlexContainer;
	private _portTextBox!: azdata.InputBoxComponent;
	private _sqlAuthenticationDropdown!: azdata.DropDownComponent;
	private _sqlAuthenticationTextbox!: azdata.InputBoxComponent;
	private _sqlAuthenticationTextRow!: azdata.FlexContainer;
	private _sqlAuthenticationPasswordTextbox!: azdata.InputBoxComponent;
	private _sqlAuthenticationPasswordTextRow!: azdata.FlexContainer;
	private _sqlAuthenticationPasswordConfirmationTextbox!: azdata.InputBoxComponent;
	private _sqlAuthenticationPasswordConfirmationTextRow!: azdata.FlexContainer;
	//private _sqlStorageOptimiazationDropdown!: azdata.DropDownComponent;
	//private sqlStorageContainer!: azdata.FlexContainer;

	private _form!: azdata.FormContainer;

	constructor(private _model: DeployAzureSQLVMWizardModel) {
		super(
			constants.SqlServerSettingsPageTitle,
			'',
			_model.wizard
		);

	}

	public override async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			await Promise.all([
				this.createSqlConnectivityDropdown(view),
				this.createPortText(view),
				this.createSqlAuthentication(view),
			]);

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this._model.createFormRowComponent(view, constants.SqlConnectivityTypeDropdownLabel, '', this._sqlConnectivityDropdown, true)
						},
						{
							component: this._portTextRow
						},
						{
							component: this._model.createFormRowComponent(view, constants.SqlEnableSQLAuthenticationLabel, '', this._sqlAuthenticationDropdown, true)
						},
						{
							component: this._sqlAuthenticationTextRow
						},
						{
							component: this._sqlAuthenticationPasswordTextRow
						},
						{
							component: this._sqlAuthenticationPasswordConfirmationTextRow
						}
					],
					{
						horizontal: false,
						componentWidth: '100%'
					})
				.withLayout({ width: '100%' })
				.component();

			return view.initializeModel(this._form);
		});
	}

	public override async onEnter(): Promise<void> {

		this.liveValidation = false;

		this._model.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}

			this.liveValidation = true;

			let showErrorMessage = await this.validatePage();

			if (showErrorMessage !== '') {
				return false;
			}
			return true;
		});
	}

	public override async onLeave(): Promise<void> {
		this._model.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private createSqlConnectivityDropdown(view: azdata.ModelView) {

		const privateOptionDisplayName = localize('deployAzureSQLVM.PrivateConnectivityDropdownOptionDefault', "Private (within Virtual Network)");
		this._sqlConnectivityDropdown = view.modelBuilder.dropDown().withProps(<azdata.DropDownProperties>
			{
				values: [
					{
						name: 'local',
						displayName: localize('deployAzureSQLVM.LocalConnectivityDropdownOption', "Local (inside VM only)")
					},
					{
						name: 'private',
						displayName: privateOptionDisplayName
					},
					{
						name: 'public',
						displayName: localize('deployAzureSQLVM.PublicConnectivityDropdownOption', "Public (Internet)")
					}
				],
				value: {
					name: 'private',
					displayName: privateOptionDisplayName
				}
			}).component();

		this._model.sqlConnectivityType = (this._sqlConnectivityDropdown.value as azdata.CategoryValue).name;

		this._sqlConnectivityDropdown.onValueChanged((value) => {

			let connectivityValue = (this._sqlConnectivityDropdown.value as azdata.CategoryValue).name;
			this._model.sqlConnectivityType = connectivityValue;

			if (connectivityValue === 'local') {
				this._model.changeRowDisplay(this._portTextRow, 'none');
			} else {
				this._model.changeRowDisplay(this._portTextRow, 'block');
			}
		});

	}

	private createPortText(view: azdata.ModelView) {
		this._portTextBox = view.modelBuilder.inputBox().withProps(<azdata.InputBoxProperties>{
			inputType: 'number',
			max: 65535,
			min: 1024,
			value: '1433'
		}).component();

		this._portTextBox.onTextChanged((value) => {
			this._model.port = value;
			this.activateRealTimeFormValidation();
		});

		this._portTextRow = this._model.createFormRowComponent(view, constants.SqlPortLabel, '', this._portTextBox, true);
	}

	private createSqlAuthentication(view: azdata.ModelView) {

		this._sqlAuthenticationDropdown = view.modelBuilder.dropDown().withProps(<azdata.DropDownComponent>{
			values: [
				{
					displayName: localizedConstants.yes,
					name: 'True'
				},
				{
					displayName: localizedConstants.no,
					name: 'False'
				}
			]
		}).component();

		this._sqlAuthenticationDropdown.onValueChanged((value) => {
			let dropdownValue = (this._sqlAuthenticationDropdown.value as azdata.CategoryValue).name;
			let displayValue: 'block' | 'none' = dropdownValue === 'True' ? 'block' : 'none';
			this._model.changeRowDisplay(this._sqlAuthenticationTextRow, displayValue);
			this._model.changeRowDisplay(this._sqlAuthenticationPasswordTextRow, displayValue);
			this._model.changeRowDisplay(this._sqlAuthenticationPasswordConfirmationTextRow, displayValue);
			this._model.enableSqlAuthentication = dropdownValue;
		});

		this._model.enableSqlAuthentication = (this._sqlAuthenticationDropdown.value as azdata.CategoryValue).name;


		this._sqlAuthenticationTextbox = view.modelBuilder.inputBox().component();

		this._sqlAuthenticationTextRow = this._model.createFormRowComponent(view, constants.SqlAuthenticationUsernameLabel, '', this._sqlAuthenticationTextbox, true);

		this._sqlAuthenticationPasswordTextbox = view.modelBuilder.inputBox().withProps(<azdata.InputBoxProperties>{
			inputType: 'password'
		}).component();

		this._sqlAuthenticationPasswordTextRow = this._model.createFormRowComponent(view, constants.SqlAuthenticationPasswordLabel, '', this._sqlAuthenticationPasswordTextbox, true);

		this._sqlAuthenticationPasswordConfirmationTextbox = view.modelBuilder.inputBox().withProps(<azdata.InputBoxProperties>{
			inputType: 'password'
		}).component();

		this._sqlAuthenticationPasswordConfirmationTextRow = this._model.createFormRowComponent(view, constants.SqlAuthenticationConfirmPasswordLabel, '', this._sqlAuthenticationPasswordConfirmationTextbox, true);


		this._sqlAuthenticationTextbox.onTextChanged((value) => {
			this._model.sqlAuthenticationUsername = value;
			this.activateRealTimeFormValidation();
		});

		this._sqlAuthenticationPasswordTextbox.onTextChanged((value) => {
			this._model.sqlAuthenticationPassword = value;
			this.activateRealTimeFormValidation();
		});

	}


	protected override async validatePage(): Promise<string> {

		const errorMessages = [];

		if ((this._sqlAuthenticationDropdown.value as azdata.CategoryValue).name === 'True') {
			let username = this._sqlAuthenticationTextbox.value!;

			if (username.length < 2 || username.length > 128) {
				errorMessages.push(localize('deployAzureSQLVM.SqlUsernameLengthError', "Username must be between 2 and 128 characters long."));
			}

			if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(username)) {
				errorMessages.push(localize('deployAzureSQLVM.SqlUsernameSpecialCharError', "Username cannot contain special characters \/\"\"[]:|<>+=;,?* ."));
			}

			errorMessages.push(this._model.validatePassword(this._sqlAuthenticationPasswordTextbox.value!));

			if (this._sqlAuthenticationPasswordTextbox.value !== this._sqlAuthenticationPasswordConfirmationTextbox.value) {
				errorMessages.push(localize('deployAzureSQLVM.SqlConfirmPasswordError', "Password and confirm password must match."));
			}
		}


		this._model.wizard.showErrorMessage(errorMessages.join(EOL));

		return errorMessages.join(EOL);
	}
}
