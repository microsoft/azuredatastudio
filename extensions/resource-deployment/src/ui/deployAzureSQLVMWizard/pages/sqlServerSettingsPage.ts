/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import { BasePage } from './basePage';

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

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			constants.SqlServerSettingsPageTitle,
			'',
			wizard
		);

	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			this.createSqlConnectivityDropdown(view);
			this.createPortText(view);
			this.createSqlAuthentication(view);

			// this._sqlStorageOptimiazationDropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
			// 	values: [{
			// 		displayName: 'General',
			// 		name: 'GENERAL',
			// 	},
			// 	{
			// 		displayName: 'Transactional Processing',
			// 		name: 'OLTP',
			// 	},
			// 	{
			// 		displayName: 'Data Warehousing',
			// 		name: 'DW',
			// 	}]
			// }).component();

			// this._sqlStorageOptimiazationDropdown.onValueChanged((value) => {
			// 	this.wizard.model.sqlOptimizationDropdown = (this._sqlStorageOptimiazationDropdown.value as azdata.CategoryValue).name;
			// });

			// this.wizard.model.sqlOptimizationDropdown = (this._sqlStorageOptimiazationDropdown.value as azdata.CategoryValue).name;


			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this.wizard.createFormRowComponent(view, constants.SqlConnectivityTypeDropdownLabel, '', this._sqlConnectivityDropdown, true)
						},
						{
							component: this._portTextRow
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.SqlEnableSQLAuthenticationLabel, '', this._sqlAuthenticationDropdown, true)
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
						// {
						// 	component: this.wizard.createFormRowComponent(view, 'SQL Storage Optimization Type', '', this._sqlStorageOptimiazationDropdown, true)

						// }
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

	public async onEnter(): Promise<void> {

		this.liveValidation = false;

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}

			this.liveValidation = true;

			let showErrorMessage = this.formValidation();

			if (showErrorMessage !== '') {
				return false;
			}
			return true;
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private createSqlConnectivityDropdown(view: azdata.ModelView) {
		this._sqlConnectivityDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownProperties>
			{
				values: [
					{
						name: 'local',
						displayName: 'Local (inside VM only)'
					},
					{
						name: 'private',
						displayName: 'Private (within Virtual Network)'
					},
					{
						name: 'public',
						displayName: 'Public (Internet)'
					}
				],
				value: {
					name: 'private',
					displayName: 'Private (within Virtual Network)'
				}
			}).component();

		this.wizard.model.sqlConnectivityType = (this._sqlConnectivityDropdown.value as azdata.CategoryValue).name;

		this._sqlConnectivityDropdown.onValueChanged((value) => {

			let connectivityValue = (this._sqlConnectivityDropdown.value as azdata.CategoryValue).name;
			this.wizard.model.sqlConnectivityType = connectivityValue;

			if (connectivityValue === 'local') {
				this.wizard.changeRowDisplay(this._portTextRow, 'none');
			} else {
				this.wizard.changeRowDisplay(this._portTextRow, 'block');
			}
		});

	}

	private createPortText(view: azdata.ModelView) {
		this._portTextBox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'number',
			max: 65535,
			min: 1024,
			value: '1433'
		}).component();

		this._portTextBox.onTextChanged((value) => {
			this.wizard.model.port = value;
			this.liveFormValidation();
		});

		this._portTextRow = this.wizard.createFormRowComponent(view, constants.SqlPortLabel, '', this._portTextBox, true);
	}

	private createSqlAuthentication(view: azdata.ModelView) {

		this._sqlAuthenticationDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownComponent>{
			values: [
				{
					displayName: 'Yes',
					name: 'True'
				},
				{
					displayName: 'No',
					name: 'False'
				}
			]
		}).component();

		this._sqlAuthenticationDropdown.onValueChanged((value) => {
			let dropdownValue = (this._sqlAuthenticationDropdown.value as azdata.CategoryValue).name;
			let displayValue: 'block' | 'none' = dropdownValue === 'True' ? 'block' : 'none';
			this.wizard.changeRowDisplay(this._sqlAuthenticationTextRow, displayValue);
			this.wizard.changeRowDisplay(this._sqlAuthenticationPasswordTextRow, displayValue);
			this.wizard.changeRowDisplay(this._sqlAuthenticationPasswordConfirmationTextRow, displayValue);
			this.wizard.model.enableSqlAuthentication = dropdownValue;
		});

		this.wizard.model.enableSqlAuthentication = (this._sqlAuthenticationDropdown.value as azdata.CategoryValue).name;


		this._sqlAuthenticationTextbox = view.modelBuilder.inputBox().component();

		this._sqlAuthenticationTextRow = this.wizard.createFormRowComponent(view, constants.SqlAuthenticationUsernameLabel, '', this._sqlAuthenticationTextbox, true);

		this._sqlAuthenticationPasswordTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'password'
		}).component();

		this._sqlAuthenticationPasswordTextRow = this.wizard.createFormRowComponent(view, constants.SqlAuthenticationPasswordLabel, '', this._sqlAuthenticationPasswordTextbox, true);

		this._sqlAuthenticationPasswordConfirmationTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'password'
		}).component();

		this._sqlAuthenticationPasswordConfirmationTextRow = this.wizard.createFormRowComponent(view, constants.SqlAuthenticationConfirmPasswordLabel, '', this._sqlAuthenticationPasswordConfirmationTextbox, true);


		this._sqlAuthenticationTextbox.onTextChanged((value) => {
			this.wizard.model.sqlAuthenticationUsername = value;
			this.liveFormValidation();
		});

		this._sqlAuthenticationPasswordTextbox.onTextChanged((value) => {
			this.wizard.model.sqlAuthenticationPassword = value;
			this.liveFormValidation();
		});

	}


	protected formValidation(): string {
		let username = this._sqlAuthenticationTextbox.value!;

		let showErrorMessage = '';

		if (username.length < 2 || username.length > 128) {
			showErrorMessage += 'Username must be between 2 and 128 characters long.\n';
		}

		if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(username)) {
			showErrorMessage += 'Username cannot contain special characters \/""[]:|<>+=;,?* .\n';
		}

		showErrorMessage += this.wizard.validatePassword(this._sqlAuthenticationPasswordTextbox.value!);

		if (this._sqlAuthenticationPasswordTextbox.value !== this._sqlAuthenticationPasswordConfirmationTextbox.value) {
			showErrorMessage += ('Password and confirm password must match.');
		}

		this.wizard.showErrorMessage(showErrorMessage);

		return showErrorMessage;
	}
}
