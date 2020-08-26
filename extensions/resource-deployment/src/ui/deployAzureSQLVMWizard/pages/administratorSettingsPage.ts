/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as azdata from 'azdata';
// import * as constants from '../constants';
// import { WizardPageBase } from '../../wizardPageBase';
// import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
// import { apiService } from '../../../services/apiService';

// export class AdministratorSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {


// 	private _vmNameTextBox!: azdata.InputBoxComponent;
// 	private _vmImageDropdown!: azdata.DropDownComponent;
// 	private _vmImageSkuDropdown!: azdata.DropDownComponent;
// 	private _vmImageSizeDropdown!: azdata.DropDownComponent;

// 	private _form!: azdata.FormContainer;



// 	constructor(wizard: DeployAzureSQLVMWizard) {
// 		super(
// 			constants.AzureSettingsPageTitle,
// 			constants.AzureSettingsPageDescription,
// 			wizard
// 		);
// 	}

// 	public async initialize() {
// 		this.pageObject.registerContent(async (view: azdata.ModelView) => {

// 			this.createAzureAccountsDropdown(view);
// 			this.createAzureSubscriptionsDropdown(view);
// 			this.createAzureRegionsDropdown(view);

// 			this._form = view.modelBuilder.formContainer()
// 				.withFormItems(
// 					[
// 						{
// 							title: constants.AzureAccountDropdownLabel,
// 							component: this._azureAccountsLoader,
// 						},
// 						{
// 							title: constants.AzureAccountSubscriptionDropdownLabel,
// 							component: this._azureSubscriptionLoader
// 						},
// 						{
// 							title: constants.AzureAccountRegionDropdownLabel,
// 							component: this._azureRegionsLoader
// 						}
// 					],
// 					{
// 						horizontal: false,
// 						componentWidth: '100%'
// 					})
// 				.withLayout({ width: '100%' })
// 				.component();

// 			return view.initializeModel(this._form);
// 		});
// 	}

// 	public async onEnter(): Promise<void> {
// 		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
// 			return true;
// 		});
// 	}

// 	public onLeave(): void {
// 		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
// 			return true;
// 		});
// 	}

// 	private async createAzureAccountsDropdown(view: azdata.ModelView) {
// 		this._azureAccountsDropdown = view.modelBuilder.dropDown().withProperties({
// 			required: true,
// 		}).component();

// 		this._azureAccountsDropdown.onValueChanged((value) => {
// 			this.wizard.model.azureAccount = value;
// 			this.populateAzureSubscriptionsDropdown();
// 		});

// 		this._azureAccountsLoader = view.modelBuilder.loadingComponent().withItem(this._azureAccountsDropdown).component();

// 		await this.populateAzureAccountsDropdown();
// 	}

// 	private async populateAzureAccountsDropdown() {
// 		this._azureAccountsLoader.loading = true;
// 		let accounts = await azdata.accounts.getAllAccounts();
// 		this._azureAccountsDropdown.updateProperties({
// 			values: accounts.map((account): azdata.CategoryValue => {
// 				let accountCategoryValue = {
// 					displayName: account.displayInfo.displayName,
// 					name: account.displayInfo.name!
// 				};
// 				this._accountsMap.set(accountCategoryValue, account);
// 				return accountCategoryValue;
// 			})
// 		});

// 		this.wizard.model.azureAccount = accounts[0];
// 		this._azureAccountsLoader.loading = false;
// 		await this.populateAzureSubscriptionsDropdown();

// 	}

// 	private async createAzureSubscriptionsDropdown(view: azdata.ModelView) {
// 		this._azureSubscriptionsDropdown = view.modelBuilder.dropDown().withProperties({
// 			required: true
// 		}).component();

// 		this._azureSubscriptionLoader = view.modelBuilder.loadingComponent().withItem(this._azureSubscriptionsDropdown).component();

// 		this._azureSubscriptionsDropdown.onValueChanged(function (value) {

// 		});
// 	}

// 	private async populateAzureSubscriptionsDropdown() {
// 		this._azureSubscriptionLoader.loading = true;
// 		let subService = await apiService.getAzurecoreApi();
// 		let currentAccount = this._accountsMap.get(this._azureAccountsDropdown.value as azdata.CategoryValue);
// 		let subscriptions = (await subService.getSubscriptions(currentAccount, true)).subscriptions;
// 		console.log(subscriptions);
// 		this._azureSubscriptionsDropdown.updateProperties({
// 			values: subscriptions.map(function (subscription): azdata.CategoryValue {
// 				return {
// 					displayName: subscription.name,
// 					name: subscription.name
// 				};
// 			})
// 		});
// 		this._azureSubscriptionLoader.loading = false;
// 	}

// 	private async createAzureRegionsDropdown(view: azdata.ModelView) {
// 		this._azureRegionsDropdown = view.modelBuilder.dropDown().withProperties({
// 			required: true
// 		}).component();

// 		this._azureRegionsLoader = view.modelBuilder.loadingComponent().withItem(this._azureRegionsDropdown).component();
// 		await this.populateAzureRegionsDropdown();
// 	}

// 	private async populateAzureRegionsDropdown() {
// 		this._azureRegionsLoader.loading = true;
// 		let accounts = await azdata.accounts.getAllAccounts();
// 		this._azureRegionsDropdown.updateProperties({
// 			values: accounts.map((value) => { return value.displayInfo; })
// 		});
// 		this._azureRegionsLoader.loading = false;
// 	}
// }
