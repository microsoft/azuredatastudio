/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { SUBSCRIPTION_SELECTION_PAGE_TITLE, SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE, SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE, SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE } from '../constants/strings';
import { Disposable } from 'vscode';
import { getSubscriptions, Subscription, getAvailableManagedInstanceProducts, AzureProduct, getAvailableSqlServers } from '../api/azure';
import { selectDropDownIndex } from '../api/utils';

interface GenericValue<T> extends azdata.CategoryValue {
	value: T;
}

type AccountValue = GenericValue<azdata.Account>;
type SubscriptionValue = GenericValue<Subscription>;
type ProductValue = GenericValue<AzureProduct>;

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
		this.productDropDown = this.createProductDropDown(view);

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
		const dropDown = view.modelBuilder.dropDown().withProps({
			ariaLabel: SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE,
			values: [],
			editable: true,
			fireOnTextChange: true,
		});

		this.disposables.push(dropDown.component().onValueChanged(async () => {
			await this.accountValueChanged().catch(console.error);
		}));

		return {
			component: dropDown.component(),
			title: SUBSCRIPTION_SELECTION_AZURE_ACCOUNT_TITLE
		};
	}

	private createSubscriptionDropDown(view: azdata.ModelView): azdata.FormComponent<azdata.DropDownComponent> {
		const dropDown = view.modelBuilder.dropDown().withProps({
			ariaLabel: SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE,
			values: [],
			editable: true,
			fireOnTextChange: true,
		});

		this.disposables.push(dropDown.component().onValueChanged(async () => {
			await this.subscriptionValueChanged().catch(console.error);
		}));

		return {
			component: dropDown.component(),
			title: SUBSCRIPTION_SELECTION_AZURE_SUBSCRIPTION_TITLE
		};
	}

	private createProductDropDown(view: azdata.ModelView): azdata.FormComponent<azdata.DropDownComponent> {
		const dropDown = view.modelBuilder.dropDown().withProps({
			ariaLabel: SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE,
			values: [],
			editable: true,
			fireOnTextChange: true,
		});

		return {
			component: dropDown.component(),
			title: SUBSCRIPTION_SELECTION_AZURE_PRODUCT_TITLE
		};
	}

	private async accountValueChanged(): Promise<void> {
		const account = this.getPickedAccount();
		if (account) {
			const subscriptions = await getSubscriptions(account);
			await this.populateSubscriptionValues(subscriptions);
		}
	}

	private async subscriptionValueChanged(): Promise<void> {
		const account = this.getPickedAccount();
		const subscription = this.getPickedSubscription();

		const results = await getAvailableManagedInstanceProducts(account!, subscription!);
		await getAvailableSqlServers(account!, subscription!);

		this.populateProductValues(results);
	}

	private getPickedAccount(): azdata.Account | undefined {
		const accountValue: AccountValue | undefined = this.accountDropDown?.component.value as AccountValue;
		return accountValue?.value;
	}

	private getPickedSubscription(): Subscription | undefined {
		const accountValue: SubscriptionValue | undefined = this.subscriptionDropDown?.component.value as SubscriptionValue;
		return accountValue?.value;
	}

	private async populateAccountValues(): Promise<void> {
		let accounts = await azdata.accounts.getAllAccounts();
		accounts = accounts.filter(a => a.key.providerId.startsWith('azure') && !a.isStale);

		const values: AccountValue[] = accounts.map(a => {
			return {
				displayName: a.displayInfo.displayName,
				name: a.key.accountId,
				value: a
			};
		});

		this.accountDropDown!.component.values = values;
		selectDropDownIndex(this.accountDropDown!.component, 0);
		await this.accountValueChanged();
	}

	private async populateSubscriptionValues(subscriptions: Subscription[]): Promise<void> {
		const values: SubscriptionValue[] = subscriptions.map(sub => {
			return {
				displayName: sub.name,
				name: sub.id,
				value: sub
			};
		});

		this.subscriptionDropDown!.component.values = values;
		selectDropDownIndex(this.subscriptionDropDown!.component, 0);
		await this.subscriptionValueChanged();
	}

	private async populateProductValues(products: AzureProduct[]) {
		const values: ProductValue[] = products.map(prod => {
			return {
				displayName: prod.name,
				name: prod.id,
				value: prod
			};
		});

		this.productDropDown!.component.values = values;
		selectDropDownIndex(this.productDropDown!.component, 0);
	}

	public async onPageEnter(): Promise<void> {
		this.disposables.push(this.migrationStateModel.stateChangeEvent(async (e) => this.onStateChangeEvent(e)));
		await this.populateAccountValues();
	}

	public async onPageLeave(): Promise<void> {
		this.disposables.forEach(d => { try { d.dispose(); } catch { } });
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}
}
