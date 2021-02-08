/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { azureResource } from 'azureResource';
import { getAvailableManagedInstanceProducts, getSubscriptions, SqlManagedInstance, Subscription } from '../api/azure';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';

export class TempTargetSelectionPage extends MigrationWizardPage {

	private _managedInstanceSubscriptionDropdown!: azdata.DropDownComponent;
	private _managedInstanceDropdown!: azdata.DropDownComponent;
	private _subscriptionDropdownValues: azdata.CategoryValue[] = [];
	private _subscriptionMap: Map<string, Subscription> = new Map();


	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.TARGET_SELECTION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {

		const managedInstanceSubscriptionDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION
		}).component();
		this._managedInstanceSubscriptionDropdown = view.modelBuilder.dropDown().component();
		this._managedInstanceSubscriptionDropdown.onValueChanged((e) => {
			this.populateManagedInstanceDropdown();
		});
		const managedInstanceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();
		this._managedInstanceDropdown = view.modelBuilder.dropDown().component();

		const targetContainer = view.modelBuilder.flexContainer().withItems(
			[
				managedInstanceSubscriptionDropdownLabel,
				this._managedInstanceSubscriptionDropdown,
				managedInstanceDropdownLabel,
				this._managedInstanceDropdown
			]
		).withLayout({
			flexFlow: 'column'
		}).component();

		const form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: targetContainer
					}
				]
			);
		await view.initializeModel(form.component());
	}
	public async onPageEnter(): Promise<void> {
		this.populateSubscriptionDropdown();
	}
	public async onPageLeave(): Promise<void> {
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		this._managedInstanceSubscriptionDropdown.loading = true;
		this._managedInstanceDropdown.loading = true;
		let subscriptions: azureResource.AzureResourceSubscription[] = [];
		try {
			subscriptions = await getSubscriptions(this.migrationStateModel.azureAccount);
			subscriptions.forEach((subscription) => {
				this._subscriptionMap.set(subscription.id, subscription);
				this._subscriptionDropdownValues.push({
					name: subscription.id,
					displayName: subscription.name + ' - ' + subscription.id,
				});
			});

			if (!this._subscriptionDropdownValues || this._subscriptionDropdownValues.length === 0) {
				this._subscriptionDropdownValues = [
					{
						displayName: constants.NO_SUBSCRIPTIONS_FOUND,
						name: ''
					}
				];
			}

			this._managedInstanceSubscriptionDropdown.values = this._subscriptionDropdownValues;
		} catch (error) {
			this.setEmptyDropdownPlaceHolder(this._managedInstanceSubscriptionDropdown, constants.NO_SUBSCRIPTIONS_FOUND);
			this._managedInstanceDropdown.loading = false;
		}
		this.populateManagedInstanceDropdown();
		this._managedInstanceSubscriptionDropdown.loading = false;
	}

	private async populateManagedInstanceDropdown(): Promise<void> {
		this._managedInstanceDropdown.loading = true;
		let mis: SqlManagedInstance[] = [];
		let miValues: azdata.CategoryValue[] = [];
		try {
			const subscriptionId = (<azdata.CategoryValue>this._managedInstanceSubscriptionDropdown.value).name;

			mis = await getAvailableManagedInstanceProducts(this.migrationStateModel.azureAccount, this._subscriptionMap.get(subscriptionId)!);
			mis.forEach((mi) => {
				miValues.push({
					name: mi.name,
					displayName: mi.name
				});
			});

			if (!miValues || miValues.length === 0) {
				miValues = [
					{
						displayName: constants.NO_MANAGED_INSTANCE_FOUND,
						name: ''
					}
				];
			}

			this._managedInstanceDropdown.values = miValues;
		} catch (error) {
			this.setEmptyDropdownPlaceHolder(this._managedInstanceDropdown, constants.NO_MANAGED_INSTANCE_FOUND);
		}

		this._managedInstanceDropdown.loading = false;
	}

	private setEmptyDropdownPlaceHolder(dropDown: azdata.DropDownComponent, placeholder: string): void {
		dropDown.values = [{
			displayName: placeholder,
			name: ''
		}];
	}
}
