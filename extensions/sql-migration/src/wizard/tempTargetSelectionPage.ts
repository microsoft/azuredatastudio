/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../models/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';

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
				this.migrationStateModel._targetManagedInstance = undefined!;
				this.migrationStateModel._migrationController = undefined!;
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
				this.migrationStateModel._migrationControllers = undefined!;
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
	}
	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		if (!this.migrationStateModel._targetSubscription) {
			this._managedInstanceSubscriptionDropdown.loading = true;
			this._managedInstanceDropdown.loading = true;
			try {
				this._managedInstanceSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
			} catch (e) {
				console.log(e);
			} finally {
				this._managedInstanceSubscriptionDropdown.loading = false;
			}
		}
	}

	private async populateManagedInstanceDropdown(): Promise<void> {
		if (!this.migrationStateModel._targetManagedInstance) {
			this._managedInstanceDropdown.loading = true;
			try {
				this._managedInstanceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(this.migrationStateModel._targetSubscription);
			} catch (e) {
				console.log(e);
			} finally {
				this._managedInstanceDropdown.loading = false;
			}
		}
	}
}
