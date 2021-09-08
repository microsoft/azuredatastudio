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
import { deepClone, findDropDownItemIndex, selectDropDownIndex } from '../api/utils';
import { getSubscriptions } from '../api/azure';
import * as styles from '../constants/styles';

export class AccountsSelectionPage extends MigrationWizardPage {
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ACCOUNTS_SELECTION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		const pageDescription = {
			title: '',
			component: view.modelBuilder.text().withProps({
				value: constants.ACCOUNTS_SELECTION_PAGE_DESCRIPTION,
				CSSStyles: {
					...styles.BODY_CSS
				}
			}).component()
		};

		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					pageDescription,
					await this.createAzureAccountsDropdown(view),
					await this.createAzureTenantContainer(view),
				]
			).withProps({
				CSSStyles: {
					'padding-top': '0'
				}
			}).component();
		await view.initializeModel(form);
		await this.populateAzureAccountsDropdown();
		this._disposables.push(view.onClosed(e =>
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } })));
	}

	private createAzureAccountsDropdown(view: azdata.ModelView): azdata.FormComponent {

		const azureAccountLabel = view.modelBuilder.text().withProps({
			value: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this._azureAccountsDropdown = view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: true,
				fireOnTextChange: true,
			})
			.withValidation((c) => {
				if (c.value) {
					if ((<azdata.CategoryValue>c.value)?.displayName === constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR) {
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
				}
				return false;
			}).component();

		this._disposables.push(this._azureAccountsDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._azureAccountsDropdown, value);
			if (selectedIndex > -1) {
				const selectedAzureAccount = this.migrationStateModel.getAccount(selectedIndex);
				// Making a clone of the account object to preserve the original tenants
				this.migrationStateModel._azureAccount = deepClone(selectedAzureAccount);
				if (this.migrationStateModel._azureAccount.properties.tenants.length > 1) {
					this.migrationStateModel._accountTenants = selectedAzureAccount.properties.tenants;
					this._accountTenantDropdown.values = await this.migrationStateModel.getTenantValues();
					selectDropDownIndex(this._accountTenantDropdown, 0);
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
				await this._azureAccountsDropdown.validate();
			}
		}));

		const linkAccountButton = view.modelBuilder.hyperlink()
			.withProps({
				label: constants.ACCOUNT_LINK_BUTTON_LABEL,
				url: '',
				CSSStyles: {
					...styles.BODY_CSS
				}
			})
			.component();

		this._disposables.push(linkAccountButton.onDidClick(async (event) => {
			await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
			await this.populateAzureAccountsDropdown();
			this.wizard.message = {
				text: ''
			};
			this._azureAccountsDropdown.validate();
		}));

		const flexContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([
				azureAccountLabel,
				this._azureAccountsDropdown,
				linkAccountButton
			])
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
				...styles.LABEL_CSS
			}
		}).component();

		this._accountTenantDropdown = view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.AZURE_TENANT,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			fireOnTextChange: true,
		}).component();

		this._disposables.push(this._accountTenantDropdown.onValueChanged(value => {
			/**
			 * Replacing all the tenants in azure account with the tenant user has selected.
			 * All azure requests will only run on this tenant from now on
			 */
			const selectedIndex = findDropDownItemIndex(this._accountTenantDropdown, value);
			if (selectedIndex > -1) {
				this.migrationStateModel._azureAccount.properties.tenants = [this.migrationStateModel.getTenant(selectedIndex)];
				this.migrationStateModel._subscriptions = undefined!;
				this.migrationStateModel._targetSubscription = undefined!;
				this.migrationStateModel._databaseBackup.subscription = undefined!;
			}
		}));

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

		selectDropDownIndex(this._azureAccountsDropdown, 0);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator(async pageChangeInfo => {
			try {
				if (!this.migrationStateModel._azureAccount?.isStale) {
					const subscriptions = await getSubscriptions(this.migrationStateModel._azureAccount);
					if (subscriptions?.length > 0) {
						return true;
					}
				}

				this.wizard.message = { text: constants.ACCOUNT_STALE_ERROR(this.migrationStateModel._azureAccount) };
			} catch (error) {
				this.wizard.message = { text: constants.ACCOUNT_ACCESS_ERROR(this.migrationStateModel._azureAccount, error) };
			}

			return false;
		});
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
