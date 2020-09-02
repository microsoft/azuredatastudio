/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';

export class SqlServerSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	private _sqlConnectivityDropdown!: azdata.DropDownComponent;
	private _portTextRow!: azdata.FlexContainer;
	private _portTextBox!: azdata.InputBoxComponent;
	private _sqlAuthenticationCheckbox!: azdata.CheckBoxComponent;
	private _sqlAuthenticationTextbox!: azdata.InputBoxComponent;
	private _sqlAuthenticationTextRow!: azdata.FlexContainer;
	private _sqlAuthenticationPasswordTextbox!: azdata.InputBoxComponent;
	private _sqlAuthenticationPasswordTextRow!: azdata.FlexContainer;
	private _sqlAuthenticationPasswordConfirmationTextbox!: azdata.InputBoxComponent;
	private _sqlAuthenticationPasswordConfirmationTextRow!: azdata.FlexContainer;
	private _sqlStorageOptimiazationDropdown!: azdata.DropDownComponent;
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

			this._sqlStorageOptimiazationDropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				values: [{
					displayName: 'General',
					name: 'GENERAL',
				},
				{
					displayName: 'Transactional Processing',
					name: 'OLTP',
				},
				{
					displayName: 'Data Warehousing',
					name: 'DW',
				}]
			}).component();

			this._sqlStorageOptimiazationDropdown.onValueChanged((value) => {
				this.wizard.model.sqlOptimizationDropdown = (this._sqlStorageOptimiazationDropdown.value as azdata.CategoryValue).name;
			});

			this.wizard.model.sqlOptimizationDropdown = (this._sqlStorageOptimiazationDropdown.value as azdata.CategoryValue).name;


			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this.wizard.createFormRowComponent(view, 'SQL connectivity', '', this._sqlConnectivityDropdown, true)
						},
						{
							component: this._portTextRow
						},
						{
							component: this._sqlAuthenticationCheckbox
						},
						{
							component: this._sqlAuthenticationTextRow
						},
						{
							component: this._sqlAuthenticationPasswordTextRow
						},
						{
							component: this._sqlAuthenticationPasswordConfirmationTextRow
						},
						{
							component: this.wizard.createFormRowComponent(view, 'SQL Storage Optimization Type', '', this._sqlStorageOptimiazationDropdown, true)

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

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
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
		});

		this._portTextRow = this.wizard.createFormRowComponent(view, 'Port', '', this._portTextBox, true);
	}

	private createSqlAuthentication(view: azdata.ModelView) {

		this._sqlAuthenticationCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxComponent>{
			label: 'Enable SQL authentication',
			checked: true
		}).component();

		this._sqlAuthenticationCheckbox.onChanged((value) => {
			this.wizard.changeRowDisplay(this._sqlAuthenticationTextRow, value ? 'block' : 'none');
			this.wizard.changeRowDisplay(this._sqlAuthenticationPasswordTextRow, value ? 'block' : 'none');
			this.wizard.changeRowDisplay(this._sqlAuthenticationPasswordConfirmationTextRow, value ? 'block' : 'none');
			this.wizard.model.enableSqlAuthentication = value ? 'True' : 'False';
		});

		this.wizard.model.enableSqlAuthentication = this._sqlAuthenticationCheckbox.checked ? 'True' : 'False';


		this._sqlAuthenticationTextbox = view.modelBuilder.inputBox().component();

		this._sqlAuthenticationTextRow = this.wizard.createFormRowComponent(view, 'Username', '', this._sqlAuthenticationTextbox, true);

		this._sqlAuthenticationPasswordTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'password'
		}).component();

		this._sqlAuthenticationPasswordTextRow = this.wizard.createFormRowComponent(view, 'Password', '', this._sqlAuthenticationPasswordTextbox, true);

		this._sqlAuthenticationPasswordConfirmationTextbox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'password'
		}).component();

		this._sqlAuthenticationPasswordConfirmationTextRow = this.wizard.createFormRowComponent(view, 'Confirm password', '', this._sqlAuthenticationPasswordConfirmationTextbox, true);


		this._sqlAuthenticationTextbox.onTextChanged((value) => {
			this.wizard.model.sqlAuthenticationUsername = value;
		});

		this._sqlAuthenticationPasswordTextbox.onTextChanged((value) => {
			this.wizard.model.sqlAuthenticationPassword = value;
		});

	}


}
