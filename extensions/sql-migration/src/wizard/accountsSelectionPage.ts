/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';

export class AccountsSelectionPage extends MigrationWizardPage {
	private _azureAccountsDropdown!: azdata.DropDownComponent;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.ACCOUNTS_SELECTION_PAGE_TITLE), migrationStateModel);
		this.wizardPage.description = constants.ACCOUNTS_SELECTION_PAGE_DESCRIPTION;
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
				return true;
			}).component();

		this._azureAccountsDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.migrationStateModel._azureAccount = this.migrationStateModel.getAccount(value.index);
				this.migrationStateModel._subscriptions = undefined!;
				this.migrationStateModel._targetSubscription = undefined!;
				this.migrationStateModel._databaseBackup.subscription = undefined!;
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
		});

		const flexContainer = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([this._azureAccountsDropdown, linkAccountButton], { CSSStyles: { 'margin': '2px', } })
			.component();

		return {
			title: '',
			component: flexContainer
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
	}

	public async onPageLeave(): Promise<void> {
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
