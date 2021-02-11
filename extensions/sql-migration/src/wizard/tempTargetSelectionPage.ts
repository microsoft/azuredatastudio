/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WIZARD_INPUT_COMPONENT_WIDTH } from '../constants';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';

export class TempTargetSelectionPage extends MigrationWizardPage {

	private _managedInstanceSubscriptionDropdown!: azdata.DropDownComponent;
	private _managedInstanceDropdown!: azdata.DropDownComponent;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.TARGET_SELECTION_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {

		const managedInstanceSubscriptionDropdownLabel = view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION
			}).component();

		this._managedInstanceSubscriptionDropdown = view.modelBuilder.dropDown()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._managedInstanceSubscriptionDropdown.onValueChanged((e) => {
			if (e.selected) {
				this.migrationStateModel._targetSubscription = this.migrationStateModel.getSubscription(e.index);
				this.migrationStateModel._targetManagedInstances = undefined!;
				this.populateManagedInstanceDropdown();
			}
		});

		const managedInstanceDropdownLabel = view.modelBuilder.text().withProps({
			value: constants.MANAGED_INSTANCE
		}).component();

		this._managedInstanceDropdown = view.modelBuilder.dropDown()
			.withProps({
				width: WIZARD_INPUT_COMPONENT_WIDTH
			}).component();
		this._managedInstanceDropdown.onValueChanged((e) => {
			if (e.selected) {
				this.migrationStateModel.migrationControllers = undefined!;
				this.migrationStateModel._targetManagedInstance = this.migrationStateModel.getManagedInstance(e.index);
			}
		});

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
		console.log(this.migrationStateModel._targetSubscription);
		console.log(this.migrationStateModel._targetManagedInstance);
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		this._managedInstanceSubscriptionDropdown.loading = true;
		this._managedInstanceDropdown.loading = true;

		try {
			this._managedInstanceSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
			this.migrationStateModel._targetSubscription = this.migrationStateModel.getSubscription(0);
		} catch (e) {
			this.migrationStateModel._targetManagedInstances = undefined!;
		} finally {
			this.populateManagedInstanceDropdown();
			this._managedInstanceSubscriptionDropdown.loading = false;
			this._managedInstanceDropdown.loading = false;
		}
	}

	private async populateManagedInstanceDropdown(): Promise<void> {
		this._managedInstanceDropdown.loading = true;
		try {
			this._managedInstanceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(this.migrationStateModel._targetSubscription);
			this.migrationStateModel._targetManagedInstance = this.migrationStateModel.getManagedInstance(0);
		} finally {
			this._managedInstanceDropdown.loading = false;
		}
	}
}
