/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { EOL } from 'os';
import * as constants from '../constants';
import { apiService } from '../../../services/apiService';
import { azureResource } from 'azureResource';
import * as vscode from 'vscode';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
import { DeployAzureSQLDBWizardModel } from '../deployAzureSQLDBWizardModel';
import * as localizedConstants from '../../../localizedConstants';
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

	//dropdown for SQL servers <- subscription dropdown
	private _serverGroupDropdown!: azdata.DropDownComponent;

	// //dropdown for azure regions <- subscription dropdown //@todo alma1 9/8/2020 Region dropdown used for upcoming server creation feature.
	// private _azureRegionsDropdown!: azdata.DropDownComponent;

	// //information text about hardware settings. //@todo alma1 9/8/2020 components below are used for upcoming database hardware creation feature.
	// private _dbHardwareInfoText!: azdata.TextComponent;

	// //dropdown for Managed Instance Versions <- server dropdown.
	// private _dbManagedInstanceDropdown!: azdata.DropDownComponent;

	// //dropdown for Supported Editions <- Managed Instance dropdown.
	// private _dbSupportedEditionsDropdown!: azdata.DropDownComponent;

	// //dropdown for Supported Family <- Supported Editions dropdown.
	// private _dbSupportedFamilyDropdown!: azdata.DropDownComponent;

	// //dropdown for VCore <= Supported Family dropdown.
	// private _dbVCoreDropdown!: azdata.DropDownComponent;


	// //input box for maximum memory size, supports between 1 and 1024 GB (1 TB)
	// private _dbMemoryTextBox!: azdata.InputBoxComponent;

	private _form!: azdata.FormContainer;

	private _accountsMap!: Map<string, azdata.Account>;
	private _subscriptionsMap!: Map<string, azureResource.AzureResourceSubscription>;
	constructor(private _model: DeployAzureSQLDBWizardModel) {
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
				//this.createResourceDropdown(view), //@todo alma1 9/8/2020 used for upcoming server creation feature.
				this.createServerDropdown(view),
				//this.createAzureRegionsDropdown(view) //@todo alma1 9/8/2020 used for upcoming server creation feature.
				// this.createDatabaseHardwareSettingsText(view), //@todo alma1 9/8/2020 used for upcoming database hardware creation feature.
				// this.createManagedInstanceDropdown(view),
				// this.createSupportedEditionsDropdown(view),
				// this.createSupportedFamilyDropdown(view),
				// this.createVCoreDropdown(view),
				// this.createMaxMemoryText(view),
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
						// { //@todo alma1 9/9/2020 Used for upcoming server creation feature.
						// 	component: this.wizard.createFormRowComponent(view, constants.AzureAccountResourceGroupDropdownLabel, '', this._resourceGroupDropdown, true)
						// },
						{
							component: this._model.createFormRowComponent(view, constants.AzureAccountDatabaseServersDropdownLabel, '', this._serverGroupDropdown, true)
						},
						// { //@todo alma1 9/8/2020 Used for upcoming server creation feature.
						// 	component: this.wizard.createFormRowComponent(view, constants.AzureAccountRegionDropdownLabel, '', this._azureRegionsDropdown, true)
						// }
						// { //@todo alma1 9/8/2020 Used for upcoming database hardware creation feature.
						// 	component: this._dbHardwareInfoText
						// },
						// {
						// 	component: this.wizard.createFormRowComponent(view, constants.DatabaseManagedInstanceDropdownLabel, '', this._dbManagedInstanceDropdown, true)
						// },
						// {
						// 	component: this.wizard.createFormRowComponent(view, constants.DatabaseSupportedEditionsDropdownLabel, '', this._dbSupportedEditionsDropdown, true)
						// },
						// {
						// 	component: this.wizard.createFormRowComponent(view, constants.DatabaseSupportedFamilyDropdownLabel, '', this._dbSupportedFamilyDropdown, true)
						// },
						// {
						// 	component: this.wizard.createFormRowComponent(view, constants.DatabaseVCoreNumberDropdownLabel, '', this._dbVCoreDropdown, true)
						// },
						// {
						// 	component: this.wizard.createFormRowComponent(view, constants.DatabaseMaxMemoryTextLabel, '', this._dbMemoryTextBox, true)
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

	public override async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator(async (pcInfo) => {
			if (pcInfo.newPage < pcInfo.lastPage) {
				return true;
			}
			let errorMessage = await this.validate();

			if (errorMessage !== '') {
				return false;
			}
			return true;
		});
	}

	public override async onLeave(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private async createAzureAccountsDropdown(view: azdata.ModelView) {

		this._azureAccountsDropdown = view.modelBuilder.dropDown().withProps({}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			this._model.azureAccount = this._accountsMap.get(value.selected)!;
			this.populateAzureSubscriptionsDropdown();
		});

		this.signInButton = view.modelBuilder.button().withProps({
			label: localizedConstants.signIn,
			width: '100px',
			secondary: true
		}).component();
		this.refreshButton = view.modelBuilder.button().withProps({
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
			this._model.wizard.showErrorMessage(localize('deployAzureSQLDB.azureSignInError', "Sign in to an Azure account first"));
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
		this._azureSubscriptionsDropdown = view.modelBuilder.dropDown().component();

		this._azureSubscriptionsDropdown.onValueChanged(async (value) => {

			let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
			this._model.azureSubscription = currentSubscriptionValue.name;
			this._model.azureSubscriptionDisplayName = currentSubscriptionValue.displayName;

			this._model.securityToken = await azdata.accounts.getAccountSecurityToken(
				this._model.azureAccount,
				this._subscriptionsMap.get(currentSubscriptionValue.name)?.tenant!,
				azdata.AzureResource.ResourceManagement
			);

			await this.populateServerGroupDropdown();
			//@todo alma1 9/8/2020 used for upcoming server creation feature.
			//this.populateResourceGroupDropdown();
			//this.populateAzureRegionsDropdown();
		});
	}

	private async populateAzureSubscriptionsDropdown() {
		this._azureSubscriptionsDropdown.loading = true;
		let subService = apiService.azurecoreApi;
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
		await this.populateServerGroupDropdown();
		//@todo alma1 9/8/2020 used for upcoming server creation feature.
		//await this.populateResourceGroupDropdown();
		//await this.populateAzureRegionsDropdown();
	}

	private async createServerDropdown(view: azdata.ModelView) {
		this._serverGroupDropdown = view.modelBuilder.dropDown().withProps({
			required: true,
		}).component();
		this._serverGroupDropdown.onValueChanged(async (value) => {
			if (value.selected === ((this._serverGroupDropdown.value as azdata.CategoryValue).displayName)) {
				this._model.azureServerName = value.selected;
				this._model.azureResouceGroup = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
				this._model.azureRegion = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/location/'), '');
				//this.populateManagedInstanceDropdown(); //@todo alma1 9/8/2020 functions below are used for upcoming database hardware creation feature.
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
			// await this.populateManagedInstanceDropdown(); //@todo alma1 9/8/2020 functions below are used for upcoming database hardware creation feature.
			return;
		}
		let url = `https://management.azure.com/subscriptions/${this._model.azureSubscription}/providers/Microsoft.Sql/servers?api-version=2019-06-01-preview`;
		let response = await this._model.getRequest(url);
		if (response.data.value.length === 0) {
			this._serverGroupDropdown.updateProperties({
				values: [
					{
						displayName: localize('deployAzureSQLDB.NoServerLabel', "No servers found"),
						name: ''
					}
				],
			});
			this._serverGroupDropdown.loading = false;
			// await this.populateManagedInstanceDropdown(); //@todo alma1 9/8/2020 functions below are used for upcoming database hardware creation feature.
			return;
		} else {
			response.data.value.sort((a: azdata.CategoryValue, b: azdata.CategoryValue) => (a!.name > b!.name) ? 1 : -1);
		}
		this._model.addDropdownValues(
			this._serverGroupDropdown,
			response.data.value.map((value: any) => {
				return {
					displayName: value.name,
					// remove location from this line and others when region population is enabled again.
					name: value.id + '/location/' + value.location,
				};
			})
		);
		if (this._serverGroupDropdown.value) {
			this._model.azureServerName = (this._serverGroupDropdown.value as azdata.CategoryValue).displayName;
			this._model.azureResouceGroup = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
			this._model.azureRegion = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/location/'), '');
		}
		this._serverGroupDropdown.loading = false;
		// await this.populateManagedInstanceDropdown(); //@todo alma1 9/8/2020 functions below are used for upcoming database hardware creation feature.
		return;
	}

	//@todo alma1 9/8/2020 functions below are used for upcoming server creation feature.

	// private async createResourceDropdown(view: azdata.ModelView) {
	// 	this._resourceGroupDropdown = view.modelBuilder.dropDown().withProps({
	// 		required: true
	// 	}).component();
	// 	this._resourceGroupDropdown.onValueChanged(async (value) => {
	// 		this.wizard.model.azureResouceGroup = value.selected;
	// 		this.populateServerGroupDropdown();
	// 	});
	// }

	// private async populateResourceGroupDropdown() {
	// 	this._resourceGroupDropdown.loading = true;
	// 	let subService = await apiService.azurecoreApi;
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

	// 	resourceGroups.sort((a: any, b: any) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
	// 	this._resourceGroupDropdown.updateProperties({
	// 		values: resourceGroups.map((resourceGroup: any) => {
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
	// 	this._azureRegionsDropdown = view.modelBuilder.dropDown().withProps({
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

	//@todo alma1 9/8/2020 functions below are used for upcoming database hardware creation feature.

	// private createDatabaseHardwareSettingsText(view: azdata.ModelView) {
	// 	this._dbHardwareInfoText = view.modelBuilder.text()
	// 		.withProps({
	// 			value: constants.DatabaseHardwareInfoLabel
	// 		}).component();
	// }

	// private async createManagedInstanceDropdown(view: azdata.ModelView) {
	// 	this._dbManagedInstanceDropdown = view.modelBuilder.dropDown().withProps({
	// 		required: true,
	// 	}).component();
	// 	this._dbManagedInstanceDropdown.onValueChanged(async (value) => {
	// 		this.populateSupportedEditionsDropdown();
	// 	});
	// }

	// private async populateManagedInstanceDropdown() {
	// 	this._dbManagedInstanceDropdown.loading = true;
	// 	let currentSubscriptionValue = this._azureSubscriptionsDropdown.value as azdata.CategoryValue;
	// 	if (!currentSubscriptionValue || currentSubscriptionValue.displayName === '') {
	// 		this._dbManagedInstanceDropdown.updateProperties({
	// 			values: []
	// 		});
	// 		this._dbManagedInstanceDropdown.loading = false;
	// 		await this.populateSupportedEditionsDropdown();
	// 		return;
	// 	}
	// 	let currentServerValue = this._serverGroupDropdown.value as azdata.CategoryValue;

	// 	if (currentServerValue.name === '') {
	// 		this._dbManagedInstanceDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoServerLabel', "No servers found"),
	// 					name: '',
	// 					supportedEditions: undefined
	// 				}
	// 			]
	// 		});
	// 		this._dbManagedInstanceDropdown.loading = false;
	// 		await this.populateSupportedEditionsDropdown();
	// 		return;
	// 	}

	// 	let url = `https://management.azure.com/subscriptions/${this.wizard.model.azureSubscription}/providers/Microsoft.Sql/locations/${this.wizard.model.azureRegion}/capabilities?api-version=2017-10-01-preview`;
	// 	let response = await this.wizard.getRequest(url);

	// 	if (response.data.supportedManagedInstanceVersions.length === 0) {
	// 		this._dbManagedInstanceDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoHardwareConfigLabel', "No database hardware configuration found"),
	// 					name: '',
	// 					supportedEditions: undefined
	// 				}
	// 			],
	// 		});
	// 		this._dbManagedInstanceDropdown.loading = false;
	// 		await this.populateSupportedEditionsDropdown();
	// 		return;
	// 	} else {
	// 		response.data.supportedManagedInstanceVersions.sort((a: any, b: any) => (a!.name > b!.name) ? 1 : -1);
	// 	}
	// 	this.wizard.addDropdownValues(
	// 		this._dbManagedInstanceDropdown,
	// 		response.data.supportedManagedInstanceVersions.map((value: any) => {
	// 			return {
	// 				displayName: value.name,
	// 				name: value.name,
	// 				supportedEditions: value.supportedEditions
	// 			};
	// 		})
	// 	);
	// 	// if (this._serverGroupDropdown.value) {
	// 	// 	this.wizard.model.azureServerName = (this._serverGroupDropdown.value as azdata.CategoryValue).displayName;
	// 	// 	this.wizard.model.azureResouceGroup = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/resourceGroups/'), '').replace(RegExp('/providers/.*'), '');
	// 	// 	this.wizard.model.azureRegion = (this._serverGroupDropdown.value as azdata.CategoryValue).name.replace(RegExp('^(.*?)/location/'), '');
	// 	// }
	// 	this._dbManagedInstanceDropdown.loading = false;
	// 	await this.populateSupportedEditionsDropdown();
	// 	return;
	// }

	// private async createSupportedEditionsDropdown(view: azdata.ModelView) {
	// 	this._dbSupportedEditionsDropdown = view.modelBuilder.dropDown().withProps({
	// 		required: true,
	// 	}).component();
	// 	this._dbSupportedEditionsDropdown.onValueChanged(async (value) => {
	// 		this.wizard.model.databaseEdition = value.selected;
	// 		this.populateSupportedFamilyDropdown();
	// 	});
	// }

	// private async populateSupportedEditionsDropdown() {
	// 	this._dbSupportedEditionsDropdown.loading = true;
	// 	if (!this._dbManagedInstanceDropdown.values || this._dbManagedInstanceDropdown.values!.length === 0) {
	// 		this._dbSupportedEditionsDropdown.updateProperties({
	// 			values: []
	// 		});
	// 		this._dbSupportedEditionsDropdown.loading = false;
	// 		await this.populateSupportedFamilyDropdown();
	// 		return;
	// 	}
	// 	let currentManagedInstanceValue = this._dbManagedInstanceDropdown.value as any;
	// 	if (!currentManagedInstanceValue.supportedEditions) {
	// 		this._dbSupportedEditionsDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoManagedInstanceLabel', "Managed instance not selected"),
	// 					name: ''
	// 				}
	// 			]
	// 		});
	// 		this._dbSupportedEditionsDropdown.loading = false;
	// 		await this.populateSupportedFamilyDropdown();
	// 		return;
	// 	}

	// 	if (currentManagedInstanceValue.supportedEditions.length === 0) {
	// 		this._dbSupportedEditionsDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoSupportedEditionsLabel', "No supported editions found"),
	// 					name: ''
	// 				}
	// 			],
	// 		});
	// 		this._dbSupportedEditionsDropdown.loading = false;
	// 		await this.populateSupportedFamilyDropdown();
	// 		return;
	// 	} else {
	// 		currentManagedInstanceValue.supportedEditions.sort((a: any, b: any) => (a!.name > b!.name) ? 1 : -1);
	// 	}
	// 	this.wizard.addDropdownValues(
	// 		this._dbSupportedEditionsDropdown,
	// 		currentManagedInstanceValue.supportedEditions.map((value: any) => {
	// 			return {
	// 				displayName: value.name,
	// 				name: value.supportedFamilies
	// 			};
	// 		})
	// 	);
	// 	if (this._dbSupportedEditionsDropdown.value) {
	// 		this.wizard.model.databaseEdition = (this._dbSupportedEditionsDropdown.value as azdata.CategoryValue).displayName;
	// 	}
	// 	this._dbSupportedEditionsDropdown.loading = false;
	// 	await this.populateSupportedFamilyDropdown();
	// 	return;
	// }

	// private async createSupportedFamilyDropdown(view: azdata.ModelView) {
	// 	this._dbSupportedFamilyDropdown = view.modelBuilder.dropDown().withProps({
	// 		required: true,
	// 	}).component();
	// 	this._dbSupportedFamilyDropdown.onValueChanged(async (value) => {
	// 		this.wizard.model.databaseFamily = value.selected;
	// 		this.populateVCoreDropdown();
	// 	});
	// }

	// private async populateSupportedFamilyDropdown() {
	// 	this._dbSupportedFamilyDropdown.loading = true;
	// 	if (!this._dbSupportedEditionsDropdown.values || this._dbSupportedEditionsDropdown.values!.length === 0) {
	// 		this._dbSupportedFamilyDropdown.updateProperties({
	// 			values: []
	// 		});
	// 		this._dbSupportedFamilyDropdown.loading = false;
	// 		await this.populateVCoreDropdown();
	// 		return;
	// 	}
	// 	let currentSupportedEditionValue = this._dbSupportedEditionsDropdown.value as any;
	// 	if (!currentSupportedEditionValue.name) {
	// 		this._dbSupportedFamilyDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoSupportedEditionLabel', "Supported Edition not selected"),
	// 					name: ''
	// 				}
	// 			]
	// 		});
	// 		this._dbSupportedFamilyDropdown.loading = false;
	// 		await this.populateVCoreDropdown();
	// 		return;
	// 	}

	// 	if (currentSupportedEditionValue.name.length === 0) {
	// 		this._dbSupportedFamilyDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoSupportedFamiliesLabel', "No database family types found."),
	// 					name: ''
	// 				}
	// 			],
	// 		});
	// 		this._dbSupportedFamilyDropdown.loading = false;
	// 		await this.populateVCoreDropdown();
	// 		return;
	// 	} else {
	// 		currentSupportedEditionValue.name.sort((a: any, b: any) => (a!.name > b!.name) ? 1 : -1);
	// 	}
	// 	this.wizard.addDropdownValues(
	// 		this._dbSupportedFamilyDropdown,
	// 		currentSupportedEditionValue.name.map((value: any) => {
	// 			return {
	// 				displayName: value.name,
	// 				name: value
	// 			};
	// 		})
	// 	);
	// 	if (this._dbSupportedFamilyDropdown.value) {
	// 		this.wizard.model.databaseFamily = (this._dbSupportedFamilyDropdown.value as any).displayName;
	// 	}
	// 	this._dbSupportedFamilyDropdown.loading = false;
	// 	await this.populateVCoreDropdown();
	// 	return;
	// }

	// private async createVCoreDropdown(view: azdata.ModelView) {
	// 	this._dbVCoreDropdown = view.modelBuilder.dropDown().withProps({
	// 		required: true,
	// 	}).component();
	// 	this._dbVCoreDropdown.onValueChanged(async (value) => {
	// 		this.wizard.model.vCoreNumber = value.selected;
	// 	});
	// }

	// private async populateVCoreDropdown() {
	// 	this._dbVCoreDropdown.loading = true;
	// 	if (!this._dbSupportedFamilyDropdown.values || this._dbSupportedFamilyDropdown.values!.length === 0) {
	// 		this._dbVCoreDropdown.updateProperties({
	// 			values: []
	// 		});
	// 		this._dbVCoreDropdown.loading = false;
	// 		return;
	// 	}
	// 	let currentSupportedFamilyValue = this._dbSupportedFamilyDropdown.value as any;
	// 	if (!currentSupportedFamilyValue.name && !currentSupportedFamilyValue.name.supportedVcoresValues) {
	// 		this._dbVCoreDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoSupportedFamilyLabel', "Supported Family not selected"),
	// 					name: ''
	// 				}
	// 			]
	// 		});
	// 		this._dbVCoreDropdown.loading = false;
	// 		return;
	// 	}

	// 	if (currentSupportedFamilyValue.name.supportedVcoresValues === 0) {
	// 		this._dbVCoreDropdown.updateProperties({
	// 			values: [
	// 				{
	// 					displayName: localize('deployAzureSQLDB.NoSupportedVCoreValuesLabel', "No VCore values found."),
	// 					name: ''
	// 				}
	// 			],
	// 		});
	// 		this._dbVCoreDropdown.loading = false;
	// 		return;
	// 	} else {
	// 		currentSupportedFamilyValue.name.supportedVcoresValues.sort((a: any, b: any) => (a!.value > b!.value) ? 1 : -1);
	// 	}

	// 	this.wizard.addDropdownValues(
	// 		this._dbVCoreDropdown,
	// 		currentSupportedFamilyValue.name.supportedVcoresValues.map((value: any) => {
	// 			return {
	// 				displayName: String(value.value),
	// 				name: value.status
	// 			};
	// 		})
	// 	);
	// 	for (let i = 0; i < this._dbVCoreDropdown.values!.length; i++) {
	// 		let value = this._dbVCoreDropdown.values![i] as azdata.CategoryValue;
	// 		if (value.name === 'Default') {
	// 			this._dbVCoreDropdown.value = this._dbVCoreDropdown.values![i];
	// 			break;
	// 		}
	// 	}

	// 	if (this._dbVCoreDropdown.value) {
	// 		this.wizard.model.vCoreNumber = Number((this._dbVCoreDropdown.value as any).displayName);
	// 	}
	// 	this._dbVCoreDropdown.loading = false;
	// 	return;
	// }

	// private createMaxMemoryText(view: azdata.ModelView) {
	// 	this._dbMemoryTextBox = view.modelBuilder.inputBox().withProps(<azdata.InputBoxProperties>{
	// 		inputType: 'number',
	// 		max: 1024,
	// 		min: 1,
	// 		value: '32',
	// 		required: true
	// 	}).component();

	// 	this._dbMemoryTextBox.onTextChanged((value) => {
	// 		this.wizard.model.storageInGB = value + 'GB';
	// 	});
	// }


	protected async validate(): Promise<string> {
		let errorMessages = [];
		let serverName = (this._serverGroupDropdown.value as azdata.CategoryValue).name;
		if (serverName === '') {
			errorMessages.push(localize('deployAzureSQLDB.NoServerError', "No servers found in current subscription.\nSelect a different subscription containing at least one server"));
		}
		// let supportedEditionName = (this._dbSupportedEditionsDropdown.value as azdata.CategoryValue).name;
		// if (supportedEditionName === '') {
		// 	errorMessages.push(localize('deployAzureSQLDB.SupportedEditionError', "No Supported DB Edition found in current server.\nSelect a different server"));
		// }
		// let familyName = (this._dbSupportedFamilyDropdown.value as azdata.CategoryValue).name;
		// if (familyName === '') {
		// 	errorMessages.push(localize('deployAzureSQLDB.SupportedFamiliesError', "No Supported Family found in current DB edition.\nSelect a different edition"));
		// }

		this._model.wizard.showErrorMessage(errorMessages.join(EOL));
		return errorMessages.join(EOL);
	}
}
