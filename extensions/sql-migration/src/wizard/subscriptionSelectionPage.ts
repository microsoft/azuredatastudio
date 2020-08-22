/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { SUBSCRIPTION_SELECTION_PAGE_TITLE, SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE, SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE, SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE } from '../models/strings';
import { Disposable } from 'vscode';

interface AccountValue extends azdata.CategoryValue {
	account: azdata.Account;
}

export class SubscriptionSelectionPage extends MigrationWizardPage {
	private disposables: Disposable[] = [];

	// For future reference: DO NOT EXPOSE WIZARD DIRECTLY THROUGH HERE.
	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(SUBSCRIPTION_SELECTION_PAGE_TITLE), migrationStateModel);
	}


	protected async registerContent(view: azdata.ModelView): Promise<void> {
		await this.initialState(view);
	}

	private accountDropDown?: azdata.FormComponent<azdata.DropDownComponent>;
	private subscriptionDropDown?: azdata.FormComponent<azdata.DropDownComponent>;
	private productDropDown?: azdata.FormComponent<azdata.DropDownComponent>;
	private async initialState(view: azdata.ModelView) {
		this.accountDropDown = this.createAccountDropDown(view);
		this.subscriptionDropDown = this.createSubscriptionDropDown(view);
		this.productDropDown = this.createProdcutDropDown(view);

		const form = view.modelBuilder.formContainer().withFormItems(
			[
				this.accountDropDown,
				this.subscriptionDropDown,
				this.productDropDown
			]
		);

		await view.initializeModel(form.component());
	}

	private createAccountDropDown(view: azdata.ModelView): azdata.FormComponent<azdata.DropDownComponent> {
		const dropDown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
			values: [],
		});

		return {
			component: dropDown.component(),
			title: SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE
		};
	}

	private createSubscriptionDropDown(view: azdata.ModelView): azdata.FormComponent<azdata.DropDownComponent> {
		const dropDown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
			values: [],
		});
		this.setupSubscriptionListener();

		return {
			component: dropDown.component(),
			title: SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE
		};
	}

	private createProdcutDropDown(view: azdata.ModelView): azdata.FormComponent<azdata.DropDownComponent> {
		const dropDown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
			values: [],
		});
		this.setupProductListener();

		return {
			component: dropDown.component(),
			title: SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE
		};
	}


	private setupSubscriptionListener(): void {
		this.disposables.push(this.accountDropDown!.component.onValueChanged((event) => {
			console.log(event);
		}));
	}

	private setupProductListener(): void {
		this.disposables.push(this.subscriptionDropDown!.component.onValueChanged((event) => {
			console.log(event);
		}));
	}

	private async populateAccountValues(): Promise<void> {


		let accounts = await azdata.accounts.getAllAccounts();
		accounts = accounts.filter(a => a.key.providerId.startsWith('azure') && !a.isStale);

		const values: AccountValue[] = accounts.map(a => {
			return {
				displayName: a.displayInfo.displayName,
				name: a.key.accountId,
				account: a
			};
		});

		this.accountDropDown!.component.values = values;
	}

	public async onPageEnter(): Promise<void> {
		this.disposables.push(this.migrationStateModel.stateChangeEvent(async (e) => this.onStateChangeEvent(e)));
		await this.populateAccountValues();
	}

	public async onPageLeave(): Promise<void> {
		this.disposables.forEach(d => d.dispose());
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
