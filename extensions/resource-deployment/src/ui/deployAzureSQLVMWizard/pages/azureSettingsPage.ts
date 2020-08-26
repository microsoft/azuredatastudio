/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import { apiService } from '../../../services/apiService';

export class AzureSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {


	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _azureSubscriptionsDropdown!: azdata.DropDownComponent;
	private _azureRegionsDropdown!: azdata.DropDownComponent;
	private _form!: azdata.FormContainer;

	private _accountsMap!: Map<azdata.CategoryValue, azdata.Account>;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			constants.AzureSettingsPageTitle,
			constants.AzureSettingsPageDescription,
			wizard
		);
		this._accountsMap = new Map();
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			this.createAzureAccountsDropdown(view);
			this.createAzureSubscriptionsDropdown(view);
			this.createAzureRegionsDropdown(view);

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							title: constants.AzureAccountDropdownLabel,
							component: this._azureAccountsDropdown,
						},
						{
							title: constants.AzureAccountSubscriptionDropdownLabel,
							component: this._azureSubscriptionsDropdown
						},
						{
							title: constants.AzureAccountRegionDropdownLabel,
							component: this._azureRegionsDropdown
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

	private async createAzureAccountsDropdown(view: azdata.ModelView) {
		this._azureAccountsDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		await this.populateAzureAccountsDropdown();

		this._azureAccountsDropdown.onValueChanged(function (value) {

		});
	}

	private async populateAzureAccountsDropdown() {
		let accounts = await azdata.accounts.getAllAccounts();
		this._azureAccountsDropdown.updateProperties({
			values: accounts.map((account): azdata.CategoryValue => {
				let accountCategoryValue = {
					displayName: account.displayInfo.displayName,
					name: account.displayInfo.name!
				};
				this._accountsMap.set(accountCategoryValue, account);
				return accountCategoryValue;
			})
		});

		if (!(this.wizard.model.azureAccount === accounts[0])) {
			this.wizard.model.azureAccount = accounts[0];
			await this.populateAzureSubscriptionsDropdown();
		}
	}

	private async createAzureSubscriptionsDropdown(view: azdata.ModelView) {
		this._azureSubscriptionsDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		await this.populateAzureSubscriptionsDropdown();

		this._azureSubscriptionsDropdown.onValueChanged(function (value) {

		});
	}

	private async populateAzureSubscriptionsDropdown() {
		let subService = await apiService.getAzurecoreApi();
		let currentAccount = this._accountsMap.get(this._azureAccountsDropdown.value as azdata.CategoryValue);
		let subscriptions = (await subService.getSubscriptions(currentAccount, true)).subscriptions;
		console.log(subscriptions);
		this._azureSubscriptionsDropdown.updateProperties({
			values: subscriptions.map(function (subscription): azdata.CategoryValue {
				return {
					displayName: subscription.name,
					name: subscription.name
				};
			})
		});
	}

	private async createAzureRegionsDropdown(view: azdata.ModelView) {
		this._azureRegionsDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		await this.populateAzureRegionsDropdown();

		this._azureRegionsDropdown.onValueChanged(function (value) {

		});
	}

	private async populateAzureRegionsDropdown() {
		let accounts = await azdata.accounts.getAllAccounts();
		this._azureRegionsDropdown.updateProperties({
			values: accounts.map((value) => { return value.displayInfo; })
		});
	}
}
