/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, Page, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import * as styles from '../constants/styles';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { deepClone, findDropDownItemIndex, selectDropDownIndex } from '../api/utils';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../telemtery';

export class TargetSelectionPage extends MigrationWizardPage {
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];

	private _pageDescription!: azdata.TextComponent;
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;
	private _azureSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _azureResourceDropdownLabel!: azdata.TextComponent;
	private _azureResourceDropdown!: azdata.DropDownComponent;


	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.AZURE_SQL_TARGET_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		this._pageDescription = this._view.modelBuilder.text().withProps({
			value: constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(),
			CSSStyles: {
				...styles.BODY_CSS,
				'margin': '0'
			}
		}).component();

		const form = this._view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this._pageDescription
					},
					{
						component: this.createAzureAccountsDropdown()
					},
					{
						component: this.createAzureTenantContainer()
					},
					{
						component: this.createTargetDropdownContainer()
					}
				]
			).withProps({
				CSSStyles: {
					'padding-top': '0'
				}
			}).component();

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));
		await this._view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {

		switch (this.migrationStateModel._targetType) {
			case MigrationTargetType.SQLMI:
				this._pageDescription.value = constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(constants.SKU_RECOMMENDATION_MI_CARD_TEXT);
				this._azureResourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				break;

			case MigrationTargetType.SQLVM:
				this._pageDescription.value = constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(constants.SKU_RECOMMENDATION_VM_CARD_TEXT);
				this._azureResourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				break;
		}

		await this.populateAzureAccountsDropdown();

		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			const errors: string[] = [];
			this.wizard.message = {
				text: '',
				level: azdata.window.MessageLevel.Error
			};

			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				return true;
			}

			if ((<azdata.CategoryValue>this._azureSubscriptionDropdown.value)?.displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
				errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
			}
			if ((<azdata.CategoryValue>this._azureLocationDropdown.value)?.displayName === constants.NO_LOCATION_FOUND) {
				errors.push(constants.INVALID_LOCATION_ERROR);
			}
			if ((<azdata.CategoryValue>this._azureResourceGroupDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
				errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
			}

			const resourceDropdownValue = (<azdata.CategoryValue>this._azureResourceDropdown.value)?.displayName;
			if (resourceDropdownValue === constants.NO_MANAGED_INSTANCE_FOUND) {
				errors.push(constants.INVALID_MANAGED_INSTANCE_ERROR);
			}
			else if (resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
				errors.push(constants.INVALID_VIRTUAL_MACHINE_ERROR);
			}

			if (errors.length > 0) {
				this.wizard.message = {
					text: errors.join(EOL),
					level: azdata.window.MessageLevel.Error
				};
				return false;
			}
			return true;
		});
	}

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		this.wizard.registerNavigationValidator((e) => {

			sendSqlMigrationActionEvent(
				TelemetryViews.MigrationWizardTargetSelectionPage,
				TelemetryAction.OnPageLeave,
				{
					'sessionId': this.migrationStateModel?._sessionId,
					'subscriptionId': this.migrationStateModel?._targetSubscription?.id,
					'resourceGroup': this.migrationStateModel?._resourceGroup?.name,
					'tenantId': this.migrationStateModel?._azureTenant?.id || this.migrationStateModel?._azureAccount?.properties?.tenants[0]?.id
				}, {});

			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private createAzureAccountsDropdown(): azdata.FlexContainer {
		const azureAccountLabel = this._view.modelBuilder.text().withProps({
			value: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-top': '-1em'
			}
		}).component();
		this._azureAccountsDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
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
					await this._accountTenantFlexContainer.updateCssStyles({
						'display': 'inline'
					});
				} else {
					await this._accountTenantFlexContainer.updateCssStyles({
						'display': 'none'
					});
				}
				await this._azureAccountsDropdown.validate();
				await this.populateSubscriptionDropdown();
			}
		}));

		const linkAccountButton = this._view.modelBuilder.hyperlink()
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
			await this._azureAccountsDropdown.validate();
		}));

		const flexContainer = this._view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column'
			})
			.withItems([
				azureAccountLabel,
				this._azureAccountsDropdown,
				linkAccountButton
			])
			.component();
		return flexContainer;
	}

	private createAzureTenantContainer(): azdata.FlexContainer {
		const azureTenantDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.AZURE_TENANT,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this._accountTenantDropdown = this._view.modelBuilder.dropDown().withProps({
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
			const selectedTenant = this.migrationStateModel.getTenant(selectedIndex);
			this.migrationStateModel._azureTenant = deepClone(selectedTenant);
			if (selectedIndex > -1) {
				this.migrationStateModel._azureAccount.properties.tenants = [this.migrationStateModel.getTenant(selectedIndex)];
				this.migrationStateModel._subscriptions = undefined!;
				this.migrationStateModel._targetSubscription = undefined!;
				this.migrationStateModel._databaseBackup.subscription = undefined!;
			}

		}));

		this._accountTenantFlexContainer = this._view.modelBuilder.flexContainer()
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
		return this._accountTenantFlexContainer;
	}

	private createTargetDropdownContainer(): azdata.FlexContainer {
		const subscriptionDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			description: constants.TARGET_SUBSCRIPTION_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS,
			}
		}).component();
		this._azureSubscriptionDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.SUBSCRIPTION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureSubscriptionDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._azureSubscriptionDropdown, value);
			if (selectedIndex > -1 &&
				value !== constants.NO_SUBSCRIPTIONS_FOUND) {
				this.migrationStateModel._targetSubscription = this.migrationStateModel.getSubscription(selectedIndex);
				this.migrationStateModel._targetServerInstance = undefined!;
				this.migrationStateModel._sqlMigrationService = undefined!;
				await this.populateLocationDropdown();
			}
		}));

		const azureLocationLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			description: constants.TARGET_LOCATION_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._azureLocationDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.LOCATION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureLocationDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._azureLocationDropdown, value);
			if (selectedIndex > -1 &&
				value !== constants.NO_LOCATION_FOUND) {
				this.migrationStateModel._location = this.migrationStateModel.getLocation(selectedIndex);
				await this.populateResourceGroupDropdown();
			}
		}));

		const azureResourceGroupLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			description: constants.TARGET_RESOURCE_GROUP_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._azureResourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.RESOURCE_GROUP,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureResourceGroupDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._azureResourceGroupDropdown, value);
			if (selectedIndex > -1) {
				if (value !== constants.RESOURCE_GROUP_NOT_FOUND) {
					this.migrationStateModel._resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
				}
				await this.populateResourceInstanceDropdown();
			}
		}));

		this._azureResourceDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE,
			description: constants.TARGET_RESOURCE_INFO,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._azureResourceDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureResourceDropdown.onValueChanged(value => {
			const selectedIndex = findDropDownItemIndex(this._azureResourceDropdown, value);
			if (selectedIndex > -1 &&
				value !== constants.NO_MANAGED_INSTANCE_FOUND &&
				value !== constants.NO_VIRTUAL_MACHINE_FOUND) {
				this.migrationStateModel._sqlMigrationServices = undefined!;

				switch (this.migrationStateModel._targetType) {
					case MigrationTargetType.SQLVM:
						this.migrationStateModel._targetServerInstance = this.migrationStateModel.getVirtualMachine(selectedIndex);
						break;

					case MigrationTargetType.SQLMI:
						this.migrationStateModel._targetServerInstance = this.migrationStateModel.getManagedInstance(selectedIndex);
						break;
				}
			}
		}));

		return this._view.modelBuilder.flexContainer().withItems(
			[
				subscriptionDropdownLabel,
				this._azureSubscriptionDropdown,
				azureLocationLabel,
				this._azureLocationDropdown,
				azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
				this._azureResourceDropdownLabel,
				this._azureResourceDropdown
			]
		).withLayout({
			flexFlow: 'column',
		}).component();
	}

	private async populateAzureAccountsDropdown(): Promise<void> {
		try {
			this._azureAccountsDropdown.loading = true;
			this._azureSubscriptionDropdown.loading = true;
			this._azureLocationDropdown.loading = true;
			this._azureResourceGroupDropdown.loading = true;
			this._azureResourceDropdown.loading = true;

			this._azureAccountsDropdown.values = await this.migrationStateModel.getAccountValues();

			if (this.hasSavedInfo() && this._azureAccountsDropdown.values) {
				(<azdata.CategoryValue[]>this._azureAccountsDropdown.values)?.forEach((account, index) => {
					if ((<azdata.CategoryValue>account).name.toLowerCase() === this.migrationStateModel.savedInfo.azureAccount?.displayInfo.userId.toLowerCase()) {
						selectDropDownIndex(this._azureAccountsDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureAccountsDropdown, 0);
			}
		} finally {
			this._azureAccountsDropdown.loading = false;
			this._azureSubscriptionDropdown.loading = false;
			this._azureLocationDropdown.loading = false;
			this._azureResourceGroupDropdown.loading = false;
			this._azureResourceDropdown.loading = false;
		}
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		try {
			this._azureSubscriptionDropdown.loading = true;
			this._azureLocationDropdown.loading = true;
			this._azureResourceGroupDropdown.loading = true;
			this._azureResourceDropdown.loading = true;

			this._azureSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
			if (this.hasSavedInfo() && this._azureSubscriptionDropdown.values) {
				this._azureSubscriptionDropdown.values!.forEach((subscription, index) => {
					if ((<azdata.CategoryValue>subscription).name.toLowerCase() === this.migrationStateModel.savedInfo?.subscription?.id.toLowerCase()) {
						selectDropDownIndex(this._azureSubscriptionDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureSubscriptionDropdown, 0);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._azureSubscriptionDropdown.loading = false;
			this._azureLocationDropdown.loading = false;
			this._azureResourceGroupDropdown.loading = false;
			this._azureResourceDropdown.loading = false;
		}
	}

	public async populateLocationDropdown(): Promise<void> {
		try {
			this._azureLocationDropdown.loading = true;
			this._azureResourceGroupDropdown.loading = true;
			this._azureResourceDropdown.loading = true;

			this._azureLocationDropdown.values = await this.migrationStateModel.getAzureLocationDropdownValues(this.migrationStateModel._targetSubscription);
			if (this.hasSavedInfo() && this._azureLocationDropdown.values) {
				this._azureLocationDropdown.values.forEach((location, index) => {
					if ((<azdata.CategoryValue>location)?.displayName.toLowerCase() === this.migrationStateModel.savedInfo?.location?.displayName.toLowerCase()) {
						selectDropDownIndex(this._azureLocationDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureLocationDropdown, 0);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._azureLocationDropdown.loading = false;
			this._azureResourceGroupDropdown.loading = false;
			this._azureResourceDropdown.loading = false;
		}
	}

	public async populateResourceGroupDropdown(): Promise<void> {
		try {
			this._azureResourceGroupDropdown.loading = true;
			this._azureResourceDropdown.loading = true;

			this._azureResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._targetSubscription);
			if (this.hasSavedInfo() && this._azureResourceGroupDropdown.values) {
				this._azureResourceGroupDropdown.values.forEach((resourceGroup, index) => {
					if ((<azdata.CategoryValue>resourceGroup)?.name.toLowerCase() === this.migrationStateModel.savedInfo?.resourceGroup?.id.toLowerCase()) {
						selectDropDownIndex(this._azureResourceGroupDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureResourceGroupDropdown, 0);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._azureResourceGroupDropdown.loading = false;
			this._azureResourceDropdown.loading = false;

		}
	}

	private async populateResourceInstanceDropdown(): Promise<void> {
		try {
			this._azureResourceDropdown.loading = true;

			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLVM:
					this._azureResourceDropdown.values = await this.migrationStateModel.getSqlVirtualMachineValues(
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._location,
						this.migrationStateModel._resourceGroup);
					break;

				case MigrationTargetType.SQLMI:
					this._azureResourceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._location,
						this.migrationStateModel._resourceGroup);
					break;
			}

			if (this.hasSavedInfo() && this._azureResourceDropdown.values) {
				this._azureResourceDropdown.values.forEach((resource, index) => {
					if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.targetServerInstance?.name.toLowerCase()) {
						selectDropDownIndex(this._azureResourceDropdown, index);
					}
				});
			} else {
				selectDropDownIndex(this._azureResourceDropdown, 0);
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._azureResourceDropdown.loading = false;
		}
	}

	private hasSavedInfo(): boolean {
		return this.migrationStateModel.retryMigration || (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.TargetSelection);
	}
}
