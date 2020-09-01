/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';

export class SqlServerSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	private sqlConnectivityDropdown!: azdata.DropDownComponent;
	private portTextBox!: azdata.InputBoxComponent;
	private sqlAuthenticationCheckbox!: azdata.CheckBoxComponent;
	private sqlAuthenticationTextbox!: azdata.InputBoxComponent;
	private sqlAuthenticationPasswordTextbox!: azdata.InputBoxComponent;
	private sqlStorageOptimiazationDropdown!: azdata.DropDownComponent;
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

			this.sqlConnectivityDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownProperties>
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


			this.sqlConnectivityDropdown.onValueChanged((value) => {
				let connectivityValue = (this.sqlConnectivityDropdown.value as azdata.CategoryValue).name;
				if (connectivityValue === 'local') {
					this.portTextBox.updateCssStyles({
						display: 'none'
					});
				} else {
					this.portTextBox.updateCssStyles({
						display: 'block'
					});
				}
			});

			this.portTextBox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxComponent>{
				inputType: 'number',
				max: 65535,
				min: 1024
			}).component();

			this.portTextBox.onTextChanged((value) => {
				this.wizard.model.port = value;
			});

			this.sqlAuthenticationCheckbox = view.modelBuilder.checkBox().withProperties(<azdata.CheckBoxComponent>{
				label: 'Enable SQL authentication',
				checked: true
			}).component();

			this.sqlAuthenticationCheckbox.onChanged((value) => {
				this.sqlAuthenticationTextbox.updateCssStyles({
					display: value ? 'block' : 'none'
				});
				this.sqlAuthenticationPasswordTextbox.updateCssStyles({
					display: value ? 'block' : 'none'
				});
				this.wizard.model.enableSqlAuthentication = value;
			});


			this.sqlAuthenticationTextbox = view.modelBuilder.inputBox().component();

			this.sqlAuthenticationPasswordTextbox = view.modelBuilder.inputBox().component();

			this.sqlAuthenticationTextbox.onTextChanged((value) => {
				this.wizard.model.sqlAuthenticationUsername = value;
			});

			this.sqlAuthenticationTextbox.onTextChanged((value) => {
				this.wizard.model.sqlAuthenticationPassword = value;
			});

			this.sqlStorageOptimiazationDropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
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

			this.sqlStorageOptimiazationDropdown.onValueChanged((value) => {
				this.wizard.model.sqlOptimizationDropdown = (this.sqlStorageOptimiazationDropdown.value as azdata.CategoryValue).name;
			});

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							title: 'SQL connectivity',
							component: this.sqlConnectivityDropdown
						},
						{
							title: 'Port',
							component: this.portTextBox
						},
						{
							title: 'Sql Authentication',
							component: this.sqlAuthenticationCheckbox
						},
						{
							title: ' Username',
							component: this.sqlAuthenticationTextbox
						},
						{
							title: ' Password',
							component: this.sqlAuthenticationPasswordTextbox
						},
						{
							title: 'SQL Storage Optimization Type',
							component: this.sqlStorageOptimiazationDropdown
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


}
