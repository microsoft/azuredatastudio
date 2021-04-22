/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import { apiService } from '../../../services/apiService';
import { azureResource } from 'azureResource';
import * as vscode from 'vscode';
import * as localizedConstants from '../../../localizedConstants';
import { BasePage } from './basePage';
import { DeployAzureSQLVMWizardModel } from '../deployAzureSQLVMWizardModel';

const supportedRegions = ['eastus', 'eastus2', 'westus', 'centralus', 'northcentralus', 'southcentralus', 'northeurope', 'westeurope', 'eastasia', 'southeastasia', 'japaneast', 'japanwest', 'australiaeast', 'australiasoutheast', 'australiacentral', 'brazilsouth', 'southindia', 'centralindia', 'westindia', 'canadacentral', 'canadaeast', 'westus2', 'westcentralus', 'uksouth', 'ukwest', 'koreacentral', 'koreasouth', 'francecentral', 'southafricanorth', 'uaenorth', 'switzerlandnorth', 'germanywestcentral', 'norwayeast'];

export class AzureSettingsPage extends BasePage {
	// <- means depends on
	//dropdown for azure accounts
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private signInButton!: azdata.ButtonComponent;
	private refreshButton!: azdata.ButtonComponent;

	private buttonFlexContainer!: azdata.FlexContainer;

	//dropdown for subscription accounts <- azure account dropdown
	private _azureSubscriptionsDropdown!: azdata.DropDownComponent;

	//dropdown for resource groups <- subscription dropdown
	private _resourceGroupDropdown!: azdata.DropDownComponent;

	//dropdown for azure regions <- subscription dropdown
	private _azureRegionsDropdown!: azdata.DropDownComponent;

	private _form!: azdata.FormContainer;

	private _accountsMap!: Map<string, azdata.Account>;
	private _subscriptionsMap!: Map<string, azureResource.AzureResourceSubscription>;
	constructor(private _model: DeployAzureSQLVMWizardModel) {
		super(
			constants.AzureSettingsPageTitle,
			'',
			_model.wizard
		);
		this._accountsMap = new Map();
		this._subscriptionsMap = new Map();
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			await Promise.all([
				this.createAzureAccountsDropdown(view),
				this.createAzureSubscriptionsDropdown(view),
				this.createResourceDropdown(view),
				this.createAzureRegionsDropdown(view)
			]);
			this.populateAzureAccountsDropdown();

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this._model.createFormRowComponent(view, constants.AzureAccountDropdownLabel, '', this._azureAccountsDropdown, true)
						},
						{
							component: this.buttonFlexContainer
						},
						{
							component: this._model.createFormRowComponent(view, constants.AzureAccountSubscriptionDropdownLabel, '', this._azureSubscriptionsDropdown, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.AzureAccountResourceGroupDropdownLabel, '', this._resourceGroupDropdown, true)
						},
						{
							component: this._model.createFormRowComponent(view, constants.AzureAccountRegionDropdownLabel, '', this._azureRegionsDropdown, true)
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
		this._model.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	public async onLeave(): Promise<void> {
		this._model.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private async createAzureAccountsDropdown(view: azdata.ModelView) {

		this._azureAccountsDropdown = view.modelBuilder.dropDown().withProperties({}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			if (!this._azureAccountsDropdown.value) {
				return;
			}
			this._model.azureAccount = this._accountsMap.get(value.selected)!;
			this.populateAzureSubscriptionsDropdown();
		});

		this.signInButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: localizedConstants.signIn,
			width: '100px',
			secondary: true
		}).component();
		this.refreshButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: localizedConstants.refresh,
			width: '100px',
			secondary: true
		}).component();

		this.signInButton.onDidClick(async (event) => {
			await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
			await this.populateAzureAccountsDropdown();
		});
		this.refreshButton.onDidClick(async (event) => {
			await this.populateAzureAccountsDropdown();
		});
		this.buttonFlexContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row'
		}).withItems([this.signInButton, this.refreshButton], { CSSStyles: { 'margin-right': '5px', } }).component();

	}

	private async populateAzureAccountsDropdown() {
		this._azureAccountsDropdown.loading = true;
		let accounts = await azdata.accounts.getAllAccounts();

		if (accounts.length === 0) {
			this._model.wizard.showErrorMessage('Sign in to an Azure account first');
			return;
		} else {
			this._model.wizard.showErrorMessage('');
		}

		this._model.addDropdownValues(
			this._azureAccountsDropdown,
			accounts.map((account): azdata.CategoryValue => {
				let accountCategoryValue = {
					displayName: account.displayInfo.displayName,
					name: account.displayInfo.displayName
				};
				this._accountsMap.set(accountCategoryValue.displayName, account);
				return accountCategoryValue;
			}),
		);

		this._model.azureAccount = accounts[0];
		this._azureAccountsDropdown.loading = false;

		await this.populateAzureSubscriptionsDropdown();
	}

	private async createAzureSubscriptionsDropdown(view: azdata.ModelView) {
		this._azureSubscriptionsDropdown = view.modelBuilder.dropDown().withProperties({}).component();

		this._azureSubscriptionsDropdown.onValueChanged(async value => {
			if (!this._azureSubscriptionsDropdown.value) {
				return;
			}
			let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
			this._model.azureSubscription = currentSubscriptionValue.name;
			this._model.azureSubscriptionDisplayName = currentSubscriptionValue.displayName;

			this._model.securityToken = await azdata.accounts.getAccountSecurityToken(
				this._model.azureAccount,
				this._subscriptionsMap.get(currentSubscriptionValue.name)?.tenant!,
				azdata.AzureResource.ResourceManagement
			);

			this.populateResourceGroupDropdown();
			this.populateAzureRegionsDropdown();
		});
	}

	private async populateAzureSubscriptionsDropdown() {
		this._azureSubscriptionsDropdown.loading = true;
		let subService = apiService.azurecoreApi;
		let currentAccountDropdownValue = (this._azureAccountsDropdown.value as azdata.CategoryValue);
		if (currentAccountDropdownValue === undefined) {
			this._azureSubscriptionsDropdown.loading = false;
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
			this._azureSubscriptionsDropdown.loading = false;
			await this.populateResourceGroupDropdown();
			await this.populateAzureRegionsDropdown();
			return;
		}
		subscriptions.sort((a: any, b: any) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));

		this._model.addDropdownValues(
			this._azureSubscriptionsDropdown,
			subscriptions.map((subscription: any): azdata.CategoryValue => {
				let subscriptionCategoryValue = {
					displayName: subscription.name + ' - ' + subscription.id,
					name: subscription.id
				};
				this._subscriptionsMap.set(subscriptionCategoryValue.name, subscription);
				return subscriptionCategoryValue;
			})
		);

		this._model.azureSubscription = (this._azureSubscriptionsDropdown.value as azdata.CategoryValue).name;
		this._model.azureSubscriptionDisplayName = (this._azureSubscriptionsDropdown.value as azdata.CategoryValue).displayName;

		this._model.securityToken = await azdata.accounts.getAccountSecurityToken(
			this._model.azureAccount,
			this._subscriptionsMap.get((this._azureSubscriptionsDropdown.value as azdata.CategoryValue).name)?.tenant!,
			azdata.AzureResource.ResourceManagement
		);
		this._azureSubscriptionsDropdown.loading = false;
		await this.populateResourceGroupDropdown();
		await this.populateAzureRegionsDropdown();
	}

	private async createResourceDropdown(view: azdata.ModelView) {
		this._resourceGroupDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();
		this._resourceGroupDropdown.onValueChanged(async (value) => {
			this._model.azureResouceGroup = value.selected;
		});
	}

	private async populateResourceGroupDropdown() {
		this._resourceGroupDropdown.loading = true;
		let subService = apiService.azurecoreApi;
		let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
		if (currentSubscriptionValue === undefined || currentSubscriptionValue.displayName === '') {

			this._resourceGroupDropdown.updateProperties({
				values: []
			});
			this._resourceGroupDropdown.loading = false;
			return;
		}
		let currentSubscription = this._subscriptionsMap.get(currentSubscriptionValue.name);
		let resourceGroups = (await subService.getResourceGroups(this._model.azureAccount, currentSubscription, true)).resourceGroups;
		if (resourceGroups === undefined || resourceGroups.length === 0) {
			this._resourceGroupDropdown.loading = false;
			this._resourceGroupDropdown.updateProperties({
				values: []
			});
			return;
		}

		resourceGroups.sort((a: any, b: any) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
		this._resourceGroupDropdown.updateProperties({
			values: resourceGroups.map((resourceGroup: any) => {
				return {
					displayName: resourceGroup.name,
					name: resourceGroup.name
				};
			})
		});
		this._model.azureResouceGroup = (this._resourceGroupDropdown.value as azdata.CategoryValue).name;
		this._resourceGroupDropdown.loading = false;
	}

	private async createAzureRegionsDropdown(view: azdata.ModelView) {
		this._azureRegionsDropdown = view.modelBuilder.dropDown().withProperties({
			required: true
		}).component();

		this._azureRegionsDropdown.onValueChanged(value => {
			if (!this._azureRegionsDropdown.value) {
				return;
			}
			this._model.azureRegion = (this._azureRegionsDropdown.value as azdata.CategoryValue).name;
		});
	}

	private async populateAzureRegionsDropdown() {
		this._azureRegionsDropdown.loading = true;

		let url = `https://management.azure.com/subscriptions/${this._model.azureSubscription}/locations?api-version=2020-01-01`;
		const response = await this._model.getRequest(url, false);
		response.data.value = response.data.value.sort((a: any, b: any) => (a.displayName > b.displayName) ? 1 : -1);
		this._model.addDropdownValues(
			this._azureRegionsDropdown,
			response.data.value.filter((value: any) => {
				return supportedRegions.includes(value.name);
			}).map((value: any) => {
				return {
					displayName: value.displayName,
					name: value.name
				};
			})
		);
		this._model.azureRegion = (this._azureRegionsDropdown.value as azdata.CategoryValue).name;
		this._azureRegionsDropdown.loading = false;
	}
}
