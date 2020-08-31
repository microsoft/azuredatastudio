/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';

export class SqlServerSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {

	private _sqlConnectivityTypeDropdown!: azdata.DropDownComponent;
	private _portTextBox!: azdata.InputBoxComponent;
	private _enableSqlAuthenticationCheckbox!: azdata.CheckBoxComponent;
	private _loginNameTextBox!: azdata.InputBoxComponent;
	private _passwordTextBox!: azdata.InputBoxComponent;

	private _form!: azdata.FormContainer;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			constants.AzureSettingsPageTitle,
			constants.AzureSettingsPageDescription,
			wizard
		);

	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			this.createSQLConnectivityDropdown(view);
			this.createSQLAuthenticationComponents(view);

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							title: 'SQL Connectivity Type',
							component: this._sqlConnectivityTypeDropdown
						},
						{
							title: 'Port',
							component: this._portTextBox
						},
						{
							component: this._enableSqlAuthenticationCheckbox
						},
						{
							title: 'SQL Username',
							component: this._loginNameTextBox
						},
						{
							title: 'SQL Password',
							component: this._passwordTextBox
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

	private createSQLConnectivityDropdown(view: azdata.ModelView) {
		this._sqlConnectivityTypeDropdown = view.modelBuilder.dropDown().withProperties(<azdata.DropDownProperties>{
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
			]
		}).component();

		this._sqlConnectivityTypeDropdown.onValueChanged((value) => {
			if (value.name === 'private' || value.name === 'public') {
				this._portTextBox.updateCssStyles({
					display: 'block'
				});
			} else {
				this._portTextBox.updateCssStyles({
					display: 'none'
				});
			}
			this.wizard.model.sqlConnectivityType = value.name;
		});

		this._portTextBox = view.modelBuilder.inputBox().withProperties(<azdata.InputBoxProperties>{
			inputType: 'number',
			min: 1024,
			max: 65535,
			value: '1433'
		}).component();

		this._portTextBox.onTextChanged((value: string) => {
			this.wizard.model.port = Number.parseInt(value);
		});


	}

	private createSQLAuthenticationComponents(view: azdata.ModelView) {
		this._enableSqlAuthenticationCheckbox = view.modelBuilder.checkBox().withProperties(
			<azdata.CheckBoxProperties>{
				checked: true,
				label: 'Enable SQL Authentication'
			}
		).component();

		this._enableSqlAuthenticationCheckbox.onChanged((value) => {
			let elementDisplay = value ? 'block' : 'none';
			this._loginNameTextBox.updateCssStyles(
				{
					display: elementDisplay
				}
			);

			this._passwordTextBox.updateCssStyles(
				{
					display: elementDisplay
				}
			);
		});
		this._loginNameTextBox = view.modelBuilder.inputBox().component();
		this._passwordTextBox = view.modelBuilder.inputBox().component();
	}
}
