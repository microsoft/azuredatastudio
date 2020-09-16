/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as constants from '../constants';
import { DeployAzureSQLDBWizard } from '../deployAzureSQLDBWizard';
import { apiService } from '../../../services/apiService';
import { azureResource } from 'azureResource';
import * as vscode from 'vscode';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class AzureSettingsPage extends BasePage {
	// <- means depends on
	//dropdown for azure accounts
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private signInButton!: azdata.ButtonComponent;
	private refreshButton!: azdata.ButtonComponent;

	private buttonFlexContainer!: azdata.FlexContainer;

	//dropdown for subscription accounts <- azure account dropdown
	private _azureSubscriptionsDropdown!: azdata.DropDownComponent;

	//dropdown for resource groups <- subscription dropdown //@todo alma1 9/9/2020 Used for upcoming server creation feature.
	// private _resourceGroupDropdown!: azdata.DropDownComponent;

	//dropdown for SQL servers <- resource dropdown
	private _serverGroupDropdown!: azdata.DropDownComponent;

	// //dropdown for azure regions <- subscription dropdown //@todo alma1 9/8/2020 Region dropdown used for upcoming server creation feature.
	// private _azureRegionsDropdown!: azdata.DropDownComponent;

	private _form!: azdata.FormContainer;

	private _accountsMap!: Map<string, azdata.Account>;
	private _subscriptionsMap!: Map<string, azureResource.AzureResourceSubscription>;
	constructor(wizard: DeployAzureSQLDBWizard) {
		super(
			constants.AzureSettingsPageTitle,
			'',
			wizard
		);
		this._accountsMap = new Map();
		this._subscriptionsMap = new Map();
	}

	public async initialize() {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {

			await Promise.all([
				this.createAzureAccountsDropdown(view),
				this.createAzureSubscriptionsDropdown(view),
				//this.createResourceDropdown(view), //@todo alma1 9/8/2020 used for upcoming server creation feature.
				this.createServerDropdown(view),
				//this.createAzureRegionsDropdown(view) //@todo alma1 9/8/2020 used for upcoming server creation feature.
			]);
			this.populateAzureAccountsDropdown();

			this._form = view.modelBuilder.formContainer()
				.withFormItems(
					[
						{
							component: this.wizard.createFormRowComponent(view, constants.AzureAccountDropdownLabel, '', this._azureAccountsDropdown, true)
						},
						{
							component: this.buttonFlexContainer
						},
						{
							component: this.wizard.createFormRowComponent(view, constants.AzureAccountSubscriptionDropdownLabel, '', this._azureSubscriptionsDropdown, true)
						},
						// { //@todo alma1 9/9/2020 Used for upcoming server creation feature.
						// 	component: this.wizard.createFormRowComponent(view, constants.AzureAccountResourceGroupDropdownLabel, '', this._resourceGroupDropdown, true)
						// },
						{
							component: this.wizard.createFormRowComponent(view, constants.AzureAccountDatabaseServersDropdownLabel, '', this._serverGroupDropdown, true)
						}
						// { //@todo alma1 9/8/2020 Used for upcoming server creation feature.
						// 	component: this.wizard.createFormRowComponent(view, constants.AzureAccountRegionDropdownLabel, '', this._azureRegionsDropdown, true)
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
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}
			this.liveValidation = true;
			let errorMessage = await this.validatePage();

			if (errorMessage !== '') {
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

	private async createAzureAccountsDropdown(view: azdata.ModelView) {

		this._azureAccountsDropdown = view.modelBuilder.dropDown().withProperties({}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			this.wizard.model.azureAccount = this._accountsMap.get(value.selected)!;
			this.populateAzureSubscriptionsDropdown();
		});

		this.signInButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Sign In',
			width: '100px'
		}).component();
		this.refreshButton = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			label: 'Refresh',
			width: '100px'
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
			this.wizard.showErrorMessage('Sign in to an Azure account first');
			return;
		} else {
			this.wizard.showErrorMessage('');
		}

		this.wizard.addDropdownValues(
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

		this.wizard.model.azureAccount = accounts[0];
		this._azureAccountsDropdown.loading = false;

		await this.populateAzureSubscriptionsDropdown();
	}

	private async createAzureSubscriptionsDropdown(view: azdata.ModelView) {
		this._azureSubscriptionsDropdown = view.modelBuilder.dropDown().withProperties({}).component();

		this._azureSubscriptionsDropdown.onValueChanged(async (value) => {

			let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
			this.wizard.model.azureSubscription = currentSubscriptionValue.name;
			this.wizard.model.azureSubscriptionDisplayName = currentSubscriptionValue.displayName;

			this.wizard.model.securityToken = await azdata.accounts.getAccountSecurityToken(
				this.wizard.model.azureAccount,
				this._subscriptionsMap.get(currentSubscriptionValue.name)?.tenant!,
				azdata.AzureResource.ResourceManagement
			);

			this.populateServerGroupDropdown();
			//@todo alma1 9/8/2020 used for upcoming server creation feature.
			//this.populateResourceGroupDropdown();
			//this.populateAzureRegionsDropdown();
		});
	}

	private async populateAzureSubscriptionsDropdown() {
		this._azureSubscriptionsDropdown.loading = true;
		let subService = await apiService.getAzurecoreApi();
		let currentAccountDropdownValue = (this._azureAccountsDropdown.value as azdata.CategoryValue);
		if (currentAccountDropdownValue === undefined) {
			this._azureSubscriptionsDropdown.loading = false;
			await this.populateServerGroupDropdown();
			//@todo alma1 9/8/2020 used for upcoming server creation feature.
			//await this.populateResourceGroupDropdown();
			//await this.populateAzureRegionsDropdown();
			return;
		}
		let currentAccount = this._accountsMap.get(currentAccountDropdownValue.name);
		let subscriptions = (await subService.getSubscriptions(currentAccount, true)).subscriptions;
		if (subscriptions === undefined || subscriptions.length === 0) {
			this._azureSubscriptionsDropdown.updateProperties({
				values: []
			});
			this._azureSubscriptionsDropdown.loading = false;
			await this.populateServerGroupDropdown();
			//@todo alma1 9/8/2020 used for upcoming server creation feature.
			//await this.populateResourceGroupDropdown();
			//await this.populateAzureRegionsDropdown();
			return;
		}
		subscriptions.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));

		this.wizard.addDropdownValues(
			this._azureSubscriptionsDropdown,
			subscriptions.map((subscription): azdata.CategoryValue => {
				let subscriptionCategoryValue = {
					displayName: subscription.name + ' - ' + subscription.id,
					name: subscription.id
				};
				this._subscriptionsMap.set(subscriptionCategoryValue.name, subscription);
				return subscriptionCategoryValue;
			})
		);

		this.wizard.model.azureSubscription = (this._azureSubscriptionsDropdown.value as azdata.CategoryValue).name;
		this.wizard.model.azureSubscriptionDisplayName = (this._azureSubscriptionsDropdown.value as azdata.CategoryValue).displayName;

		this.wizard.model.securityToken = await azdata.accounts.getAccountSecurityToken(
			this.wizard.model.azureAccount,
			this._subscriptionsMap.get((this._azureSubscriptionsDropdown.value as azdata.CategoryValue).name)?.tenant!,
			azdata.AzureResource.ResourceManagement
		);
		this._azureSubscriptionsDropdown.loading = false;
		await this.populateServerGroupDropdown();
		//@todo alma1 9/8/2020 used for upcoming server creation feature.
		//await this.populateResourceGroupDropdown();
		//await this.populateAzureRegionsDropdown();
	}

	private async createServerDropdown(view: azdata.ModelView) {
		this._serverGroupDropdown = view.modelBuilder.dropDown().withProperties({
			required: true,
		}).component();
		this._serverGroupDropdown.onValueChanged(async (value) => {
			if (value.selected === ((this._serverGroupDropdown.value as azdata.CategoryValue).displayName)) {
				this.wizard.model.azureServerName = (this._serverGroupDropdown.value as azdata.CategoryValue).displayName;
				this.wizard.model.azureResouceGroup = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
			}
		});
	}

	private async populateServerGroupDropdown() {
		this._serverGroupDropdown.loading = true;
		let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
		if (currentSubscriptionValue === undefined || currentSubscriptionValue.displayName === '') {
			this._serverGroupDropdown.updateProperties({
				values: []
			});
			this._serverGroupDropdown.loading = false;
			return;
		}
		let url = `https://management.azure.com/subscriptions/${this.wizard.model.azureSubscription}/providers/Microsoft.Sql/servers?api-version=2019-06-01-preview`;
		let response = await this.wizard.getRequest(url);
		if (response.data.value.length === 0) {
			this._serverGroupDropdown.updateProperties({
				values: [
					{
						displayName: 'No servers found',
						name: ''
					}
				],
			});
			this._serverGroupDropdown.loading = false;
			return;
		} else {
			response.data.value.sort((a: azdata.CategoryValue, b: azdata.CategoryValue) => (a!.name > b!.name) ? 1 : -1);
		}
		this.wizard.addDropdownValues(
			this._serverGroupDropdown,
			response.data.value.map((value: any) => {
				return {
					displayName: value.name,
					name: value.id,
				};
			})
		);
		if (this._serverGroupDropdown.value) {
			this.wizard.model.azureServerName = (this._serverGroupDropdown.value as azdata.CategoryValue).displayName;
			this.wizard.model.azureResouceGroup = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
		}
		this._serverGroupDropdown.loading = false;
		return;
	}

	//@todo alma1 9/8/2020 functions below are used for upcoming server creation feature.

	// private async createResourceDropdown(view: azdata.ModelView) {
	// 	this._resourceGroupDropdown = view.modelBuilder.dropDown().withProperties({
	// 		required: true
	// 	}).component();
	// 	this._resourceGroupDropdown.onValueChanged(async (value) => {
	// 		this.wizard.model.azureResouceGroup = value.selected;
	// 		this.populateServerGroupDropdown();
	// 	});
	// }

	// private async populateResourceGroupDropdown() {
	// 	this._resourceGroupDropdown.loading = true;
	// 	let subService = await apiService.getAzurecoreApi();
	// 	let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
	// 	if (currentSubscriptionValue === undefined || currentSubscriptionValue.displayName === '') {

	// 		this._resourceGroupDropdown.updateProperties({
	// 			values: []
	// 		});
	// 		this._resourceGroupDropdown.loading = false;
	// 		await this.populateServerGroupDropdown();
	// 		return;
	// 	}
	// 	let currentSubscription = this._subscriptionsMap.get(currentSubscriptionValue.name);
	// 	let resourceGroups = (await subService.getResourceGroups(this.wizard.model.azureAccount, currentSubscription, true)).resourceGroups;
	// 	if (resourceGroups === undefined || resourceGroups.length === 0) {
	// 		this._resourceGroupDropdown.loading = false;
	// 		this._resourceGroupDropdown.updateProperties({
	// 			values: []
	// 		});
	// 		await this.populateServerGroupDropdown();
	// 		return;
	// 	}

	// 	resourceGroups.sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
	// 	this._resourceGroupDropdown.updateProperties({
	// 		values: resourceGroups.map((resourceGroup) => {
	// 			return {
	// 				displayName: resourceGroup.name,
	// 				name: resourceGroup.name
	// 			};
	// 		})
	// 	});
	// 	this.wizard.model.azureResouceGroup = (this._resourceGroupDropdown.value as azdata.CategoryValue).name;
	// 	this._resourceGroupDropdown.loading = false;
	// 	await this.populateServerGroupDropdown();
	// }

	// private async createAzureRegionsDropdown(view: azdata.ModelView) {
	// 	this._azureRegionsDropdown = view.modelBuilder.dropDown().withProperties({
	// 		required: true
	// 	}).component();


	// 	this._azureRegionsDropdown.onValueChanged((value) => {
	// 		this.wizard.model.azureRegion = (this._azureRegionsDropdown.value as azdata.CategoryValue).name;
	// 	});
	// }

	// private async populateAzureRegionsDropdown() {
	// 	this._azureRegionsDropdown.loading = true;

	// let supportedRegions = 'eastus, eastus2, westus, centralus, northcentralus, southcentralus, northeurope, westeurope, eastasia, southeastasia, japaneast, japanwest, australiaeast, australiasoutheast, australiacentral, brazilsouth, southindia, centralindia, westindia, canadacentral, canadaeast, westus2, westcentralus, uksouth, ukwest, koreacentral, koreasouth, francecentral, southafricanorth, uaenorth, switzerlandnorth, germanywestcentral, norwayeast';
	// 	let supportedRegionsArray = supportedRegions.split(', ');
	// 	let url = `https://management.azure.com/subscriptions/${this.wizard.model.azureSubscription}/locations?api-version=2020-01-01`;
	// 	const response = await this.wizard.getRequest(url, true);
	// 	response.data.value = response.data.value.sort((a: any, b: any) => (a.displayName > b.displayName) ? 1 : -1);

	// 	this.wizard.addDropdownValues(
	// 		this._azureRegionsDropdown,
	// 		response.data.value.filter((value: any) => {
	// 	return supportedRegionsArray.includes(value.name);
	// }).map((value: any) => {
	// 			return {
	// 				displayName: value.displayName,
	// 				name: value.name
	// 			};
	// 		})
	// 	);
	// 	this.wizard.model.azureRegion = (this._azureRegionsDropdown.value as azdata.CategoryValue).name;
	// 	this._azureRegionsDropdown.loading = false;
	// }

	protected async validatePage(): Promise<string> {
		let errorMessages = [];
		let serverName = (this._serverGroupDropdown.value as azdata.CategoryValue).displayName;
		if (serverName === 'No servers found') {
			errorMessages.push(localize('deployAzureSQLDB.NoServerError', "No servers found in current subscription.\nSelect a different subscription containing at least one server"));
		}

		this.wizard.showErrorMessage(errorMessages.join(EOL));
		return errorMessages.join(EOL);
	}
}
