/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, MigrationTargetType, StateChangeEvent } from '../models/stateMachine';
import * as constants from '../constants/strings';
import * as styles from '../constants/styles';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { deepClone, findDropDownItemIndex, selectDropDownIndex, selectDefaultDropdownValue } from '../api/utils';
import { azureResource } from 'azurecore';

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
				this._azureResourceDropdown.ariaLabel = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				break;

			case MigrationTargetType.SQLVM:
				this._pageDescription.value = constants.AZURE_SQL_TARGET_PAGE_DESCRIPTION(constants.SKU_RECOMMENDATION_VM_CARD_TEXT);
				this._azureResourceDropdownLabel.value = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				this._azureResourceDropdown.ariaLabel = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE;
				break;
		}

		await this.populateResourceInstanceDropdown();
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

			if (!this.migrationStateModel._azureAccount) {
				errors.push(constants.INVALID_ACCOUNT_ERROR);
			}

			if (!this.migrationStateModel._targetSubscription ||
				(<azdata.CategoryValue>this._azureSubscriptionDropdown.value)?.displayName === constants.NO_SUBSCRIPTIONS_FOUND) {
				errors.push(constants.INVALID_SUBSCRIPTION_ERROR);
			}
			if (!this.migrationStateModel._location ||
				(<azdata.CategoryValue>this._azureLocationDropdown.value)?.displayName === constants.NO_LOCATION_FOUND) {
				errors.push(constants.INVALID_LOCATION_ERROR);
			}
			if (!this.migrationStateModel._resourceGroup ||
				(<azdata.CategoryValue>this._azureResourceGroupDropdown.value)?.displayName === constants.RESOURCE_GROUP_NOT_FOUND) {
				errors.push(constants.INVALID_RESOURCE_GROUP_ERROR);
			}

			const resourceDropdownValue = (<azdata.CategoryValue>this._azureResourceDropdown.value)?.displayName;
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI: {
					let targetMi = this.migrationStateModel._targetServerInstance as azureResource.AzureSqlManagedInstance;
					if (!targetMi || resourceDropdownValue === constants.NO_MANAGED_INSTANCE_FOUND) {
						errors.push(constants.INVALID_MANAGED_INSTANCE_ERROR);
						break;
					}
					if (targetMi.properties.state !== 'Ready') {
						errors.push(constants.MI_NOT_READY_ERROR(targetMi.name, targetMi.properties.state));
						break;
					}
					break;
				}
				case MigrationTargetType.SQLVM: {
					if (!this.migrationStateModel._targetServerInstance ||
						resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
						errors.push(constants.INVALID_VIRTUAL_MACHINE_ERROR);
					}
					break;
				}
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
				if (selectedAzureAccount.isStale === false &&
					this.migrationStateModel._azureAccount.properties.tenants.length > 1) {
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
			} else {
				this.migrationStateModel._azureAccount = undefined!;
			}
			await this.populateSubscriptionDropdown();
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

		this._disposables.push(this._accountTenantDropdown.onValueChanged(async (value) => {
			/**
			 * Replacing all the tenants in azure account with the tenant user has selected.
			 * All azure requests will only run on this tenant from now on
			 */
			const selectedIndex = findDropDownItemIndex(this._accountTenantDropdown, value);
			const selectedTenant = this.migrationStateModel.getTenant(selectedIndex);
			this.migrationStateModel._azureTenant = deepClone(selectedTenant);
			if (selectedIndex > -1) {
				this.migrationStateModel._azureAccount.properties.tenants = [this.migrationStateModel.getTenant(selectedIndex)];
			}
			await this.populateSubscriptionDropdown();
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
			} else {
				this.migrationStateModel._targetSubscription = undefined!;
			}
			this.migrationStateModel.refreshDatabaseBackupPage = true;
			await this.populateLocationDropdown();
			await this.populateResourceGroupDropdown();
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
			} else {
				this.migrationStateModel._location = undefined!;
			}
			this.migrationStateModel.refreshDatabaseBackupPage = true;
			await this.populateResourceInstanceDropdown();
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
			if (selectedIndex > -1 &&
				value !== constants.RESOURCE_GROUP_NOT_FOUND) {
				this.migrationStateModel._resourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex);
			} else {
				this.migrationStateModel._resourceGroup = undefined!;
			}
			await this.populateResourceInstanceDropdown();
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
		this._disposables.push(this._azureResourceDropdown.onValueChanged(async (value) => {
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
						if (this.migrationStateModel._targetServerInstance.properties.state !== 'Ready') {
							this.wizard.message = {
								text: constants.MI_NOT_READY_ERROR(this.migrationStateModel._targetServerInstance.name, this.migrationStateModel._targetServerInstance.properties.state),
								level: azdata.window.MessageLevel.Error
							};
						} else {
							this.wizard.message = {
								text: '',
								level: azdata.window.MessageLevel.Error
							};
						}
						break;
				}
			} else {
				this.migrationStateModel._targetServerInstance = undefined!;
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
			this.updateDropdownLoadingStatus(TargetDropDowns.AzureAccount, true);
			this._azureAccountsDropdown.values = await this.migrationStateModel.getAccountValues();
			selectDefaultDropdownValue(this._azureAccountsDropdown, this.migrationStateModel._azureAccount?.displayInfo?.userId, false);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.AzureAccount, false);
		}
	}

	private async populateSubscriptionDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.Subscription, true);
			this._azureSubscriptionDropdown.values = await this.migrationStateModel.getSubscriptionsDropdownValues();
			selectDefaultDropdownValue(this._azureSubscriptionDropdown, this.migrationStateModel._targetSubscription?.id, false);
		} catch (e) {
			console.log(e);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.Subscription, false);
		}
	}

	public async populateLocationDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.Location, true);
			this._azureLocationDropdown.values = await this.migrationStateModel.getAzureLocationDropdownValues(this.migrationStateModel._targetSubscription);
			selectDefaultDropdownValue(this._azureLocationDropdown, this.migrationStateModel._location?.displayName, true);
		} catch (e) {
			console.log(e);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.Location, false);
		}
	}

	public async populateResourceGroupDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.ResourceGroup, true);
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					this._azureResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupForManagedInstancesDropdownValues(this.migrationStateModel._targetSubscription);
					break;
				case MigrationTargetType.SQLVM:
					this._azureResourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupForVirtualMachinesDropdownValues(this.migrationStateModel._targetSubscription);
					break;
			}
			selectDefaultDropdownValue(this._azureResourceGroupDropdown, this.migrationStateModel._resourceGroup?.id, false);
		} catch (e) {
			console.log(e);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.ResourceGroup, false);
		}
	}

	private async populateResourceInstanceDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.ResourceInstance, true);
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI: {
					this._azureResourceDropdown.values = await this.migrationStateModel.getManagedInstanceValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._location, this.migrationStateModel._resourceGroup);
					break;
				}
				case MigrationTargetType.SQLVM: {
					this._azureResourceDropdown.values = await this.migrationStateModel.getSqlVirtualMachineValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._location, this.migrationStateModel._resourceGroup);
					break;
				}
			}
			selectDefaultDropdownValue(this._azureResourceDropdown, this.migrationStateModel._targetServerInstance?.name, true);
		} catch (e) {
			console.log(e);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.ResourceInstance, false);
		}
	}

	private updateDropdownLoadingStatus(dropdown: TargetDropDowns, loading: boolean): void {
		switch (dropdown) {
			case TargetDropDowns.AzureAccount:
				this._azureAccountsDropdown.loading = loading;
			case TargetDropDowns.Subscription:
				this._azureSubscriptionDropdown.loading = loading;
			case TargetDropDowns.Location:
				this._azureLocationDropdown.loading = loading;
			case TargetDropDowns.ResourceGroup:
				this._azureResourceGroupDropdown.loading = loading;
			case TargetDropDowns.ResourceInstance:
				this._azureResourceDropdown.loading = loading;
		}
	}
}

export enum TargetDropDowns {
	AzureAccount,
	Subscription,
	Location,
	ResourceGroup,
	ResourceInstance,
}
