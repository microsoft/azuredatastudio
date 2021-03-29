/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { deepClone } from '../api/utils';

export class AccountsSelectionPage extends MigrationWizardPage {
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ACCOUNTS_SELECTION_PAGE_TITLE), migrationStateModel);
		this.wizardPage.description = constants.ACCOUNTS_SELECTION_PAGE_DESCRIPTION;
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					await this.createAzureAccountsDropdown(view),
					await this.createAzureTenantContainer(view),
				]
			);
		await view.initializeModel(form.component());
		await this.populateAzureAccountsDropdown();
	}

	private createAzureAccountsDropdown(view: azdata.ModelView): azdata.FormComponent {

		this._azureAccountsDropdown = view.modelBuilder.dropDown()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH
			})
			.withValidation((c) => {
				if ((<azdata.CategoryValue>c.value).displayName === constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR) {
					this.wizard.message = {
						text: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
						level: azdata.window.MessageLevel.Error
					};
					return false;
				}
				if (this.migrationStateModel._azureAccount?.isStale) {
					this.wizard.message = {
						text: constants.ACCOUNT_STALE_ERROR(this.migrationStateModel._azureAccount)
					};
					return false;
				}
				this.wizard.message = {
					text: ''
				};
				return true;
			}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				const selectedAzureAccount = this.migrationStateModel.getAccount(value.index);
				// Making a clone of the account object to preserve the original tenants
				this.migrationStateModel._azureAccount = deepClone(selectedAzureAccount);
				if (this.migrationStateModel._azureAccount.properties.tenants.length > 1) {
					this.migrationStateModel._accountTenants = selectedAzureAccount.properties.tenants;
					this._accountTenantDropdown.values = await this.migrationStateModel.getTenantValues();
					this._accountTenantFlexContainer.updateCssStyles({
						'display': 'inline'
					});
				} else {
					this._accountTenantFlexContainer.updateCssStyles({
						'display': 'none'
					});
				}
				this.migrationStateModel._subscriptions = undefined!;
				this.migrationStateModel._targetSubscription = undefined!;
				this.migrationStateModel._databaseBackup.subscription = undefined!;
				this._azureAccountsDropdown.validate();
			}
		});

		const linkAccountButton = view.modelBuilder.hyperlink()
			.withProps({
				label: constants.ACCOUNT_LINK_BUTTON_LABEL,
				url: ''
			})
			.component();

		linkAccountButton.onDidClick(async (event) => {
			await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
			await this.populateAzureAccountsDropdown();
			this.wizard.message = {
				text: ''
			};
		});

		const flexContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([this._azureAccountsDropdown, linkAccountButton])
			.component();

		return {
			title: '',
			component: flexContainer
		};
	}

	private createAzureTenantContainer(view: azdata.ModelView): azdata.FormComponent {

		const azureTenantDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.AZURE_TENANT,
			CSSStyles: {
				'margin': '0px'
			}
		}).component();

		this._accountTenantDropdown = view.modelBuilder.dropDown().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		this._accountTenantDropdown.onValueChanged(value => {
			/**
			 * Replacing all the tenants in azure account with the tenant user has selected.
			 * All azure requests will only run on this tenant from now on
			 */
			if (value.selected) {
				this.migrationStateModel._azureAccount.properties.tenants = [this.migrationStateModel.getTenant(value.index)];
				this.migrationStateModel._subscriptions = undefined!;
				this.migrationStateModel._targetSubscription = undefined!;
				this.migrationStateModel._databaseBackup.subscription = undefined!;
			}
		});

		this._accountTenantFlexContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([
				azureTenantDropdownLabel,
				this._accountTenantDropdown
			])
			.withProps({
				CSSStyles: {
					'display': 'none'
				}
			})
			.component();

		return {
			title: '',
			component: this._accountTenantFlexContainer
		};
	}

	private async populateAzureAccountsDropdown(): Promise<void> {
		this._azureAccountsDropdown.loading = true;
		try {
			this._azureAccountsDropdown.values = await this.migrationStateModel.getAccountValues();
		} finally {
			this._azureAccountsDropdown.loading = false;
		}
	}

	public async onPageEnter(): Promise<void> {
		this.wizard.registerNavigationValidator(pageChangeInfo => {
			if (this.migrationStateModel._azureAccount.isStale === true) {
				this.wizard.message = {
					text: constants.ACCOUNT_STALE_ERROR(this.migrationStateModel._azureAccount)
				};
				return false;
			}
			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
