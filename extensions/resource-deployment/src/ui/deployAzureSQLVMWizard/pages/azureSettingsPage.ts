/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { getDropdownComponent, InputComponents, setModelValues } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { DeployAzureSQLVMWizard } from '../deployAzureSQLVMWizard';
const localize = nls.loadMessageBundle();
const MissingRequiredInformationErrorMessage = localize('deployCluster.MissingRequiredInfoError', "Please fill out the required fields marked with red asterisks.");

export class AzureSettingsPage extends WizardPageBase<DeployAzureSQLVMWizard> {
	private inputComponents: InputComponents = {};

	constructor(wizard: DeployAzureSQLVMWizard) {
		super(localize('deployAzureSQLVM.AzureSettingsPageTitle', "Azure settings"),
			localize('deployAzureSQLVM.AzureSettingsPageDescription', "Configure the settings to create an Azure SQL Virtual Machine"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			let accounts = await azdata.accounts.getAllAccounts();
			let azureAccountsSubscriptionMap: Map<string | CategoryValue, azdata.Account> = new Map();
			accounts.map((account) => {
				azureAccountsSubscriptionMap.set(account.displayInfo.displayName, account);
			});
			const azureAccountsDropdown = view.modelBuilder.dropDown()
				.withProperties({
					value: accounts[0].displayInfo,
					values: accounts.map((account) => {
						return account.displayInfo;
					})
				}).component();

			const azureSubscriptionDropdown = view.modelBuilder.dropDown()
				.withProperties({
					values: []
				}).component();

			let defaultAccount;
			if (azureAccountsDropdown.values) {
				defaultAccount = azureAccountsDropdown.values[0];
			}
			if (defaultAccount) {
				this.setSubscriptionFromAzureAccount(azureAccountsSubscriptionMap.get(defaultAccount));
			}


			azureAccountsDropdown.onValueChanged((account) => {
				azureSubscriptionDropdown.values = await this.setSubscriptionFromAzureAccount(account);
			});
			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						title: 'Azure Account',
						component: azureAccountsDropdown
					},
					{
						title: 'Account Subscription',
						component: azureSubscriptionDropdown
					}
				],
				{
					horizontal: false,
					componentWidth: '100%'
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	public async setSubscriptionFromAzureAccount(account: any): string[] {
		if (account) {
			return await azdata.accounts.getSecurityToken(account);
		}
	}

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const location = getDropdownComponent('Temp2', this.inputComponents).value;
				if (!location) {
					this.wizard.wizardObject.message = {
						text: MissingRequiredInformationErrorMessage,
						level: azdata.window.MessageLevel.Error
					};
				}
				return !!location;
			} else {
				return true;
			}
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
		setModelValues(this.inputComponents, this.wizard.model);
		Object.assign(this.wizard.inputComponents, this.inputComponents);
	}
}
