/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';

export class AccountsSelectionPage extends MigrationWizardPage {
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountsMap: Map<string, azdata.Account> = new Map();

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ACCOUNTS_SELECTION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					await this.createAzureAccountsDropdown(view)
				]
			);
		await view.initializeModel(form.component());
		await this.populateAzureAccountsDropdown();
	}

	private createAzureAccountsDropdown(view: azdata.ModelView): azdata.FormComponent {

		this._azureAccountsDropdown = view.modelBuilder.dropDown().withValidation((c) => {
			if ((<azdata.CategoryValue>c.value).displayName === constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR) {
				this.wizard.message = {
					text: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			if (this._azureAccountsDropdown.value) {
				const selectedAccount = (this._azureAccountsDropdown.value as azdata.CategoryValue).name;
				this.migrationStateModel.azureAccount = this._accountsMap.get(selectedAccount)!;
			}
		});

		const addAccountButton = view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: constants.ACCOUNT_ADD_BUTTON_LABEL,
				width: '100px'
			})
			.component();

		addAccountButton.onDidClick(async (event) => {
			await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
			await this.populateAzureAccountsDropdown();
		});

		const flexContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([this._azureAccountsDropdown, addAccountButton], { CSSStyles: { 'margin': '10px', } })
			.component();

		return {
			title: '',
			component: flexContainer
		};
	}

	private async populateAzureAccountsDropdown(): Promise<void> {
		this._azureAccountsDropdown.loading = true;
		let accounts = await azdata.accounts.getAllAccounts();

		if (accounts.length === 0) {
			this._azureAccountsDropdown.value = {
				displayName: constants.ACCOUNT_SELECTION_PAGE_NO_LINKED_ACCOUNTS_ERROR,
				name: ''
			};
			return;
		}

		this._azureAccountsDropdown.values = accounts.map((account): azdata.CategoryValue => {
			let accountCategoryValue = {
				displayName: account.displayInfo.displayName,
				name: account.displayInfo.userId
			};
			this._accountsMap.set(accountCategoryValue.name, account);
			return accountCategoryValue;
		});

		this.migrationStateModel.azureAccount = accounts[0];
		this._azureAccountsDropdown.loading = false;
	}

	public async onPageEnter(): Promise<void> {
	}

	public async onPageLeave(): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
