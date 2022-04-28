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
import * as utils from '../api/utils';
import { azureResource } from 'azurecore';
import { SqlVMServer } from '../api/azure';
import { ProvisioningState } from '../models/migrationLocalStorage';

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

	private _migrationTargetPlatform!: MigrationTargetType;

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

		await this.populateAzureAccountsDropdown();
		if (this._migrationTargetPlatform !== this.migrationStateModel._targetType) {
			// if the user had previously selected values on this page, then went back to change the migration target platform
			// and came back, forcibly reload the location/resource group/resource values since they will now be different
			this._migrationTargetPlatform = this.migrationStateModel._targetType;
			await this.populateLocationDropdown();
			await this.populateResourceGroupDropdown();
			await this.populateResourceInstanceDropdown();
		}

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
					const targetMi = this.migrationStateModel._targetServerInstance as azureResource.AzureSqlManagedInstance;
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
					const targetVm = this.migrationStateModel._targetServerInstance as SqlVMServer;
					if (!targetVm || resourceDropdownValue === constants.NO_VIRTUAL_MACHINE_FOUND) {
						errors.push(constants.INVALID_VIRTUAL_MACHINE_ERROR);
						break;
					}
					if (targetVm.properties.provisioningState !== ProvisioningState.Succeeded) {
						errors.push(constants.VM_NOT_READY_ERROR(targetVm.name, targetVm.properties.provisioningState));
						break;
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
			fireOnTextChange: true,
			placeholder: constants.SELECT_AN_ACCOUNT,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureAccountsDropdown.onValueChanged(async (value) => {
			const selectedAccount = this.migrationStateModel._azureAccounts.find(account => account.displayInfo.displayName === value);
			this.migrationStateModel._azureAccount = utils.deepClone(selectedAccount)!;
			await this.populateTenantsDropdown();
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
			placeholder: constants.SELECT_A_TENANT
		}).component();

		this._disposables.push(this._accountTenantDropdown.onValueChanged(async (value) => {
			/**
			 * Replacing all the tenants in azure account with the tenant user has selected.
			 * All azure requests will only run on this tenant from now on
			 */
			const selectedTenant = this.migrationStateModel._accountTenants.find(tenant => tenant.displayName === value);
			this.migrationStateModel._azureTenant = utils.deepClone(selectedTenant)!;
			this.migrationStateModel._azureAccount.properties.tenants = [this.migrationStateModel._azureTenant];
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
			placeholder: constants.SELECT_A_SUBSCRIPTION,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureSubscriptionDropdown.onValueChanged(async (value) => {
			if (value && value !== constants.NO_SUBSCRIPTIONS_FOUND) {
				const selectedSubscription = this.migrationStateModel._subscriptions.find(subscription => `${subscription.name} - ${subscription.id}` === value);
				this.migrationStateModel._targetSubscription = utils.deepClone(selectedSubscription)!;
			}
			this.migrationStateModel.refreshDatabaseBackupPage = true;
			await this.populateLocationDropdown();
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
			placeholder: constants.SELECT_A_LOCATION,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureLocationDropdown.onValueChanged(async (value) => {
			if (value && value !== constants.NO_LOCATION_FOUND) {
				const selectedLocation = this.migrationStateModel._locations.find(location => location.displayName === value);
				this.migrationStateModel._location = utils.deepClone(selectedLocation)!;
			}
			this.migrationStateModel.refreshDatabaseBackupPage = true;
			await this.populateResourceGroupDropdown();
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
			placeholder: constants.SELECT_A_RESOURCE_GROUP,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureResourceGroupDropdown.onValueChanged(async (value) => {
			if (value && value !== constants.RESOURCE_GROUP_NOT_FOUND) {
				const selectedResourceGroup = this.migrationStateModel._resourceGroups.find(rg => rg.name === value);
				this.migrationStateModel._resourceGroup = utils.deepClone(selectedResourceGroup)!;
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
			placeholder: constants.SELECT_A_SERVICE,
			CSSStyles: {
				'margin-top': '-1em'
			},
		}).component();
		this._disposables.push(this._azureResourceDropdown.onValueChanged(async (value) => {
			if (value && value !== 'undefined' && value !== constants.NO_MANAGED_INSTANCE_FOUND && value !== constants.NO_VIRTUAL_MACHINE_FOUND) {
				this.migrationStateModel._sqlMigrationServices = undefined!;

				switch (this.migrationStateModel._targetType) {
					case MigrationTargetType.SQLVM:
						const selectedVm = this.migrationStateModel._targetSqlVirtualMachines.find(vm => vm.name === value || constants.UNAVAILABLE_TARGET_PREFIX(vm.name) === value);
						this.migrationStateModel._targetServerInstance = utils.deepClone(selectedVm)! as SqlVMServer;

						if (this.migrationStateModel._targetServerInstance.properties.provisioningState !== ProvisioningState.Succeeded) {
							this.wizard.message = {
								text: constants.VM_NOT_READY_ERROR(this.migrationStateModel._targetServerInstance.name, this.migrationStateModel._targetServerInstance.properties.provisioningState),
								level: azdata.window.MessageLevel.Error
							};
						} else {
							this.wizard.message = {
								text: '',
								level: azdata.window.MessageLevel.Error
							};
						}
						break;

					case MigrationTargetType.SQLMI:
						const selectedMi = this.migrationStateModel._targetManagedInstances.find(mi => mi.name === value || constants.UNAVAILABLE_TARGET_PREFIX(mi.name) === value);
						this.migrationStateModel._targetServerInstance = utils.deepClone(selectedMi)! as azureResource.AzureSqlManagedInstance;

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
			this.migrationStateModel._azureAccounts = await utils.getAzureAccounts();
			this._azureAccountsDropdown.values = await utils.getAzureAccountsDropdownValues(this.migrationStateModel._azureAccounts);
			utils.selectDefaultDropdownValue(this._azureAccountsDropdown, this.migrationStateModel._azureAccount?.displayInfo?.userId, false);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.AzureAccount, false);
		}
	}

	private async populateTenantsDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.Tenant, true);
			if (this.migrationStateModel._azureAccount && this.migrationStateModel._azureAccount.isStale === false && this.migrationStateModel._azureAccount.properties.tenants.length > 1) {
				this.migrationStateModel._accountTenants = utils.getAzureTenants(this.migrationStateModel._azureAccount);
				this._accountTenantDropdown.values = await utils.getAzureTenantsDropdownValues(this.migrationStateModel._accountTenants);
				utils.selectDefaultDropdownValue(this._accountTenantDropdown, this.migrationStateModel._azureTenant?.id, true);
				await this._accountTenantFlexContainer.updateCssStyles({
					'display': 'inline'
				});
			} else {
				await this._accountTenantFlexContainer.updateCssStyles({
					'display': 'none'
				});
			}
			await this._azureAccountsDropdown.validate();
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.Tenant, false);
			await this.populateSubscriptionDropdown();
		}
	}


	private async populateSubscriptionDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.Subscription, true);
			this.migrationStateModel._subscriptions = await utils.getAzureSubscriptions(this.migrationStateModel._azureAccount);
			this._azureSubscriptionDropdown.values = await utils.getAzureSubscriptionsDropdownValues(this.migrationStateModel._subscriptions);
			utils.selectDefaultDropdownValue(this._azureSubscriptionDropdown, this.migrationStateModel._targetSubscription?.id, false);
		} catch (e) {
			console.log(e);
		} finally {
			this.updateDropdownLoadingStatus(TargetDropDowns.Subscription, false);
		}
	}

	public async populateLocationDropdown(): Promise<void> {
		try {
			this.updateDropdownLoadingStatus(TargetDropDowns.Location, true);
			switch (this.migrationStateModel._targetType) {
				case MigrationTargetType.SQLMI:
					this.migrationStateModel._targetManagedInstances = await utils.getManagedInstances(this.migrationStateModel._azureAccount, this.migrationStateModel._targetSubscription);
					this.migrationStateModel._locations = await utils.getSqlManagedInstanceLocations(this.migrationStateModel._azureAccount, this.migrationStateModel._targetSubscription, this.migrationStateModel._targetManagedInstances);
					break;
				case MigrationTargetType.SQLVM:
					this.migrationStateModel._targetSqlVirtualMachines = await utils.getVirtualMachines(this.migrationStateModel._azureAccount, this.migrationStateModel._targetSubscription);
					this.migrationStateModel._locations = await utils.getSqlVirtualMachineLocations(this.migrationStateModel._azureAccount, this.migrationStateModel._targetSubscription, this.migrationStateModel._targetSqlVirtualMachines);
					break;
			}
			this._azureLocationDropdown.values = await utils.getAzureLocationsDropdownValues(this.migrationStateModel._locations);
			utils.selectDefaultDropdownValue(this._azureLocationDropdown, this.migrationStateModel._location?.displayName, true);
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
					this.migrationStateModel._resourceGroups = await utils.getSqlManagedInstanceResourceGroups(this.migrationStateModel._targetManagedInstances, this.migrationStateModel._location);
					break;
				case MigrationTargetType.SQLVM:
					this.migrationStateModel._resourceGroups = await utils.getSqlVirtualMachineResourceGroups(this.migrationStateModel._targetSqlVirtualMachines, this.migrationStateModel._location);
					break;
			}
			this._azureResourceGroupDropdown.values = await utils.getAzureResourceGroupsDropdownValues(this.migrationStateModel._resourceGroups);
			utils.selectDefaultDropdownValue(this._azureResourceGroupDropdown, this.migrationStateModel._resourceGroup?.id, false);
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
					this._azureResourceDropdown.values = await utils.getManagedInstancesDropdownValues(this.migrationStateModel._targetManagedInstances, this.migrationStateModel._location, this.migrationStateModel._resourceGroup);
					break;
				}
				case MigrationTargetType.SQLVM: {
					this._azureResourceDropdown.values = await utils.getVirtualMachinesDropdownValues(this.migrationStateModel._targetSqlVirtualMachines, this.migrationStateModel._location, this.migrationStateModel._resourceGroup);
					break;
				}
			}
			utils.selectDefaultDropdownValue(this._azureResourceDropdown, this.migrationStateModel._targetServerInstance?.name, true);
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
	Tenant,
	Subscription,
	Location,
	ResourceGroup,
	ResourceInstance,
}
