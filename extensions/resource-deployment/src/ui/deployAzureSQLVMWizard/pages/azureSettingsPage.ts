/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
import { apiService } from '../../../services/apiService';
import { azureResource } from 'azureResource';

export class AzureSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {


	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _azureAccountsLoader!: azdata.LoadingComponent;

	private _azureSubscriptionsDropdown!: azdata.DropDownComponent;
	private _azureSubscriptionLoader!: azdata.LoadingComponent;

	private _resourceGroupDropdown!: azdata.DropDownComponent;
	private _resourceGroupLoader!: azdata.LoadingComponent;

	private _azureRegionsDropdown!: azdata.DropDownComponent;
	private _azureRegionsLoader!: azdata.LoadingComponent;

	private _form!: azdata.FormContainer;

	private _accountsMap!: Map<string, azdata.Account>;
	private _subscriptionsMap!: Map<string, azureResource.AzureResourceSubscription>;

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(
			constants.AzureSettingsPageTitle,
			constants.AzureSettingsPageDescription,
			wizard
		);
		this._accountsMap = new Map();
		this._subscriptionsMap = new Map();
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			this.createAzureAccountsDropdown(view);
			this.createAzureSubscriptionsDropdown(view);
			this.createResourceDropdown(view);
			this.createAzureRegionsDropdown(view);

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							title: constants.AzureAccountDropdownLabel,
							component: this._azureAccountsLoader,
						},
						{
							title: constants.AzureAccountSubscriptionDropdownLabel,
							component: this._azureSubscriptionLoader
						},
						{
							title: constants.AzureAccountResourceGroupDropdownLabel,
							component: this._resourceGroupLoader
						},
						{
							title: constants.AzureAccountRegionDropdownLabel,
							component: this._azureRegionsLoader
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
			required: true,
		}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			this.wizard.model.azureAccount = this._accountsMap.get(value.selected)!;
			this.wizard.model.securityToken = await azdata.accounts.getSecurityToken(this.wizard.model.azureAccount);
			this.populateAzureSubscriptionsDropdown();
		});

		this._azureAccountsLoader = view.modelBuilder.loadingComponent().withItem(this._azureAccountsDropdown).component();

		await this.populateAzureAccountsDropdown();
	}

	private async populateAzureAccountsDropdown() {
		this._azureAccountsLoader.loading = true;
		let accounts = await azdata.accounts.getAllAccounts();
		this._azureAccountsDropdown.updateProperties({
			values: accounts.map((account): azdata.CategoryValue => {
				let accountCategoryValue = {
					displayName: account.displayInfo.displayName,
					name: account.displayInfo.displayName
				};
				this._accountsMap.set(accountCategoryValue.displayName, account);
				return accountCategoryValue;
			})
		});
		this.wizard.model.azureAccount = accounts[0];
		this.wizard.model.securityToken = await azdata.accounts.getSecurityToken(this.wizard.model.azureAccount);
		this._azureAccountsLoader.loading = false;
		await this.populateAzureSubscriptionsDropdown();

	}

	private async createAzureSubscriptionsDropdown(view: azdata.ModelView) {
		this._azureSubscriptionsDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		this._azureSubscriptionLoader = view.modelBuilder.loadingComponent().withItem(this._azureSubscriptionsDropdown).component();

		this._azureSubscriptionsDropdown.onValueChanged(async (value) => {
			let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
			this.wizard.model.azureSubscription = currentSubscriptionValue.name;
			this.populateResourceGroupDropdown();
			this.populateAzureRegionsDropdown();
		});
	}

	private async populateAzureSubscriptionsDropdown() {
		this._azureSubscriptionLoader.loading = true;
		let subService = await apiService.getAzurecoreApi();
		let currentAccountDropdownValue = (this._azureAccountsDropdown.value as azdata.CategoryValue);
		if (currentAccountDropdownValue === undefined) {
			this._azureSubscriptionLoader.loading = false;
			await this.populateResourceGroupDropdown();
			await this.populateAzureRegionsDropdown();
			return;
		}
		let currentAccount = this._accountsMap.get(currentAccountDropdownValue.name);
		let subscriptions = (await subService.getSubscriptions(currentAccount, true)).subscriptions;
		if (subscriptions === undefined || subscriptions.length === 0) {
			this._azureSubscriptionsDropdown.updateProperties({
				values: []
			});
			this._azureSubscriptionLoader.loading = false;
			await this.populateResourceGroupDropdown();
			await this.populateAzureRegionsDropdown();
			return;
		}
		subscriptions.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
		this._azureSubscriptionsDropdown.updateProperties({
			values: subscriptions.map((subscription): azdata.CategoryValue => {
				let subscriptionCategoryValue = {
					displayName: subscription.name + ' - ' + subscription.id,
					name: subscription.id
				};
				this._subscriptionsMap.set(subscriptionCategoryValue.name, subscription);
				return subscriptionCategoryValue;
			})
		});
		this.wizard.model.azureSubscription = (this._azureSubscriptionsDropdown.value as azdata.CategoryValue).name;
		this._azureSubscriptionLoader.loading = false;
		await this.populateResourceGroupDropdown();
		await this.populateAzureRegionsDropdown();
	}

	private async createResourceDropdown(view: azdata.ModelView) {
		this._resourceGroupDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();
		this._resourceGroupLoader = view.modelBuilder.loadingComponent().withItem(this._resourceGroupDropdown).component();
		this._resourceGroupDropdown.onValueChanged((value) => {
			this.wizard.model.azureResouceGroup = value.selected;
		});
	}

	private async populateResourceGroupDropdown() {
		this._resourceGroupLoader.loading = true;
		let subService = await apiService.getAzurecoreApi();
		let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
		if (currentSubscriptionValue === undefined || currentSubscriptionValue.displayName === '') {

			this._resourceGroupDropdown.updateProperties({
				values: []
			});
			this._resourceGroupLoader.loading = false;
			return;
		}
		let currentSubscription = this._subscriptionsMap.get(currentSubscriptionValue.name);
		let resourceGroups = (await subService.getResourceGroups(this.wizard.model.azureAccount, currentSubscription, true)).resourceGroups;
		if (resourceGroups === undefined || resourceGroups.length === 0) {
			this._resourceGroupLoader.loading = false;
			this._resourceGroupDropdown.updateProperties({
				values: []
			});
			return;
		}
		resourceGroups.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
		this._resourceGroupDropdown.updateProperties({
			values: resourceGroups.map(function (resourceGroup): azdata.CategoryValue {
				return {
					displayName: resourceGroup.name,
					name: resourceGroup.name
				};
			})
		});
		this.wizard.model.azureResouceGroup = (this._resourceGroupDropdown.value as azdata.CategoryValue).name;
		this._resourceGroupLoader.loading = false;
	}

	private async createAzureRegionsDropdown(view: azdata.ModelView) {
		this._azureRegionsDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		this._azureRegionsLoader = view.modelBuilder.loadingComponent().withItem(this._azureRegionsDropdown).component();

		this._azureRegionsDropdown.onValueChanged((value) => {
			this.wizard.model.azureRegion = (this._azureRegionsDropdown.value as azdata.CategoryValue).name;
		});
	}

	private async populateAzureRegionsDropdown() {

		this._azureRegionsLoader.loading = true;
		let url = 'https://management.azure.com/subscriptions/' + this.wizard.model.azureSubscription + '/locations?api-version=2020-01-01';
		const response = await this.wizard.getRequest(url);
		this._azureRegionsDropdown.updateProperties({
			values: response.data.value.map((value: any) => {
				return {
					displayName: value.displayName,
					name: value.name
				};
			})
		});
		this.wizard.model.azureRegion = (this._azureRegionsDropdown.value as azdata.CategoryValue).name;
		this._azureRegionsLoader.loading = false;
	}



}
