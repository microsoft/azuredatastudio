/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as azurecore from 'azurecore';
import { MigrationLocalStorage, MigrationServiceContext } from '../../models/migrationLocalStorage';
import { azureResource } from 'azureResource';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import { findDropDownItemIndex, selectDefaultDropdownValue, deepClone } from '../../api/utils';
import { getFullResourceGroupFromId, getLocations, getSqlMigrationServices, getSubscriptions, SqlMigrationService } from '../../api/azure';
import { logError, TelemetryViews } from '../../telemtery';

const CONTROL_MARGIN = '20px';
const INPUT_COMPONENT_WIDTH = '100%';
const STYLE_HIDE = { 'display': 'none' };
const STYLE_ShOW = { 'display': 'inline' };
export const BODY_CSS = {
	'font-size': '13px',
	'line-height': '18px',
	'margin': '4px 0',
};
const LABEL_CSS = {
	...styles.LABEL_CSS,
	'margin': '0 0 0 0',
	'font-weight': '600',
};
const DROPDOWN_CSS = {
	'margin': '-1em 0 0 0',
};
const TENANT_DROPDOWN_CSS = {
	'margin': '1em 0 0 0',
};

export class SelectMigrationServiceDialog {
	private _dialog: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];
	private _serviceContext!: MigrationServiceContext;
	private _azureAccounts!: azdata.Account[];
	private _accountTenants!: azurecore.Tenant[];
	private _subscriptions!: azureResource.AzureResourceSubscription[];
	private _locations!: azureResource.AzureLocation[];
	private _resourceGroups!: azureResource.AzureResourceResourceGroup[];
	private _sqlMigrationServices!: SqlMigrationService[];
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;
	private _azureSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _azureServiceDropdownLabel!: azdata.TextComponent;
	private _azureServiceDropdown!: azdata.DropDownComponent;
	private _deleteButton!: azdata.window.Button;

	constructor(
		private readonly _onClosedCallback: () => Promise<void>) {
		this._dialog = azdata.window.createModelViewDialog(
			constants.MIGRATION_SERVICE_SELECT_TITLE,
			'SelectMigraitonServiceDialog',
			460,
			'normal');
	}

	async initialize(): Promise<void> {
		this._serviceContext = await MigrationLocalStorage.getMigrationServiceContext();

		await this._dialog.registerContent(async (view: azdata.ModelView) => {
			this._disposables.push(
				view.onClosed(e => {
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));
			await this.registerContent(view);
		});

		this._dialog.okButton.label = constants.MIGRATION_SERVICE_SELECT_APPLY_LABEL;
		this._dialog.okButton.position = 'left';
		this._dialog.cancelButton.position = 'right';

		this._deleteButton = azdata.window.createButton(
			constants.MIGRATION_SERVICE_CLEAR,
			'right');
		this._disposables.push(
			this._deleteButton.onClick(async (value) => {
				await MigrationLocalStorage.saveMigrationServiceContext({});
				await this._onClosedCallback();
				azdata.window.closeDialog(this._dialog);
			}));
		this._dialog.customButtons = [this._deleteButton];

		azdata.window.openDialog(this._dialog);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const flexContainer = this._view.modelBuilder
			.flexContainer()
			.withItems([
				this._createHeading(),
				this._createAzureAccountsDropdown(),
				this._createAzureTenantContainer(),
				this._createServiceSelectionContainer(),
			])
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'padding': CONTROL_MARGIN } })
			.component();

		await this._view.initializeModel(flexContainer);
		await this._populateAzureAccountsDropdown();
	}

	private _createHeading(): azdata.TextComponent {
		return this._view.modelBuilder.text()
			.withProps({
				value: constants.MIGRATION_SERVICE_SELECT_HEADING,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();
	}

	private _createAzureAccountsDropdown(): azdata.FlexContainer {
		const azureAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._azureAccountsDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.ACCOUNTS_SELECTION_PAGE_TITLE,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SIGN_IN_TO_AZURE,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureAccountsDropdown.onValueChanged(async (value) => {
				const selectedIndex = findDropDownItemIndex(this._azureAccountsDropdown, value);
				this._serviceContext.azureAccount = (selectedIndex > -1)
					? deepClone(this._azureAccounts[selectedIndex])
					: undefined!;
				await this._populateTentantsDropdown();
			}));

		const linkAccountButton = this._view.modelBuilder.hyperlink()
			.withProps({
				label: constants.ACCOUNT_LINK_BUTTON_LABEL,
				url: '',
				CSSStyles: { ...styles.BODY_CSS },
			}).component();

		this._disposables.push(
			linkAccountButton.onDidClick(async (event) => {
				await vscode.commands.executeCommand('workbench.actions.modal.linkedAccount');
				await this._populateAzureAccountsDropdown();
			}));

		return this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				azureAccountLabel,
				this._azureAccountsDropdown,
				linkAccountButton,
			]).component();
	}

	private _createAzureTenantContainer(): azdata.FlexContainer {
		const azureTenantDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_TENANT,
				CSSStyles: { ...LABEL_CSS, ...TENANT_DROPDOWN_CSS },
			}).component();
		this._accountTenantDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.AZURE_TENANT,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				fireOnTextChange: true,
				placeholder: constants.SIGN_IN_TO_AZURE,
			}).component();
		this._disposables.push(
			this._accountTenantDropdown.onValueChanged(async value => {
				const selectedIndex = findDropDownItemIndex(this._accountTenantDropdown, value);
				this._serviceContext.tenant = (selectedIndex > -1)
					? deepClone(this._accountTenants[selectedIndex])
					: undefined!;
				await this._populateSubscriptionDropdown();
			}));

		this._accountTenantFlexContainer = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				azureTenantDropdownLabel,
				this._accountTenantDropdown,
			])
			.withProps({ CSSStyles: { ...STYLE_HIDE, } })
			.component();
		return this._accountTenantFlexContainer;
	}

	private _createServiceSelectionContainer(): azdata.FlexContainer {
		const subscriptionDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				description: constants.TARGET_SUBSCRIPTION_INFO,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._azureSubscriptionDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.SUBSCRIPTION,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_AZURE_ACCOUNT_FOR_SUBSCRIPTIONS,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureSubscriptionDropdown.onValueChanged(async (value) => {
				const selectedIndex = findDropDownItemIndex(this._azureSubscriptionDropdown, value);
				this._serviceContext.subscription = (selectedIndex > -1)
					? deepClone(this._subscriptions[selectedIndex])
					: undefined!;
				await this._populateLocationDropdown();
			}));

		const azureLocationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				description: constants.TARGET_LOCATION_INFO,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._azureLocationDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.LOCATION,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_LOCATION_FOR_RESOURCEGROUPS,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureLocationDropdown.onValueChanged(async (value) => {
				const selectedIndex = findDropDownItemIndex(this._azureLocationDropdown, value);
				this._serviceContext.location = (selectedIndex > -1)
					? deepClone(this._locations[selectedIndex])
					: undefined!;
				await this._populateResourceGroupDropdown();
			}));

		const azureResourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				description: constants.TARGET_RESOURCE_GROUP_INFO,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._azureResourceGroupDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.RESOURCE_GROUP,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_LOCATION_FOR_RESOURCEGROUPS,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureResourceGroupDropdown.onValueChanged(async (value) => {
				const selectedIndex = findDropDownItemIndex(this._azureResourceGroupDropdown, value);
				this._serviceContext.resourceGroup = (selectedIndex > -1)
					? deepClone(this._resourceGroups[selectedIndex])
					: undefined!;
				await this._populateMigrationServiceDropdown();
			}));

		this._azureServiceDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.MIGRATION_SERVICE_SELECT_SERVICE_LABEL,
				description: constants.TARGET_RESOURCE_INFO,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._azureServiceDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.MIGRATION_SERVICE_SELECT_SERVICE_LABEL,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_RESOURCE_GROUP_FOR_SERVICES,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureServiceDropdown.onValueChanged(async (value) => {
				const selectedIndex = findDropDownItemIndex(this._azureServiceDropdown, value, true);
				this._serviceContext.migrationService = (selectedIndex > -1)
					? deepClone(this._sqlMigrationServices.find(service => service.name === value))
					: undefined!;
				await this._updateButtonState();
			}));

		this._disposables.push(
			this._dialog.okButton.onClick(async (value) => {
				await MigrationLocalStorage.saveMigrationServiceContext(this._serviceContext);
				await this._onClosedCallback();
			}));

		return this._view.modelBuilder.flexContainer()
			.withItems([
				subscriptionDropdownLabel,
				this._azureSubscriptionDropdown,
				azureLocationLabel,
				this._azureLocationDropdown,
				azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
				this._azureServiceDropdownLabel,
				this._azureServiceDropdown,
			]).withLayout({ flexFlow: 'column' })
			.component();
	}

	private async _updateButtonState(): Promise<void> {
		this._dialog.okButton.enabled = this._serviceContext.migrationService !== undefined;
	}

	private async _populateAzureAccountsDropdown(): Promise<void> {
		try {
			this._azureAccountsDropdown.loading = true;
			this._azureAccountsDropdown.values = await this._getAccountDropdownValues();
			if (this._azureAccountsDropdown.values.length === 0) {
				this._azureAccountsDropdown.placeholder = constants.SIGN_IN_TO_AZURE;
			} else {
				selectDefaultDropdownValue(
					this._azureAccountsDropdown,
					this._serviceContext.azureAccount?.displayInfo?.userId,
					false);
				this._azureAccountsDropdown.placeholder = constants.SELECT_AN_ACCOUNT;
				this._azureAccountsDropdown.loading = false;
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateAzureAccountsDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_ACCOUNT_ERROR,
				error.message);
		} finally {
			this._azureAccountsDropdown.loading = false;
		}
	}

	private async _populateTentantsDropdown(): Promise<void> {
		try {
			this._accountTenantDropdown.loading = true;
			this._accountTenantDropdown.values = this._getTenantDropdownValues(
				this._serviceContext.azureAccount);
			await this._accountTenantFlexContainer.updateCssStyles(
				this._accountTenants.length > 1
					? STYLE_ShOW
					: STYLE_HIDE);
			if (this._accountTenantDropdown.values.length === 0) {
				this._accountTenantDropdown.placeholder = constants.SIGN_IN_TO_AZURE;
				return;
			} else {
				selectDefaultDropdownValue(
					this._accountTenantDropdown,
					this._serviceContext.tenant?.id,
					false);
				this._accountTenantDropdown.placeholder = constants.SELECT_A_TENANT;
				this._accountTenantDropdown.loading = false;
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateTentantsDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_TENANT_ERROR,
				error.message);
		} finally {
			this._accountTenantDropdown.loading = false;
		}
	}

	private async _populateSubscriptionDropdown(): Promise<void> {
		try {
			this._azureSubscriptionDropdown.loading = true;
			this._azureSubscriptionDropdown.values = await this._getSubscriptionDropdownValues(
				this._serviceContext.azureAccount);
			if (this._azureSubscriptionDropdown.values.length === 0) {
				this._azureSubscriptionDropdown.placeholder = constants.SELECT_AZURE_ACCOUNT_FOR_SUBSCRIPTIONS;
			} else {
				selectDefaultDropdownValue(
					this._azureSubscriptionDropdown,
					this._serviceContext.subscription?.id,
					false);
				this._azureSubscriptionDropdown.placeholder = constants.SELECT_A_SUBSCRIPTION;
				this._azureSubscriptionDropdown.loading = false;
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateSubscriptionDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_SUBSCRIPTION_ERROR,
				error.message);
		} finally {
			this._azureSubscriptionDropdown.loading = false;
		}
	}

	private async _populateLocationDropdown(): Promise<void> {
		try {
			this._azureLocationDropdown.loading = true;
			this._azureLocationDropdown.values = await this._getAzureLocationDropdownValues(
				this._serviceContext.azureAccount,
				this._serviceContext.subscription);
			if (this._azureLocationDropdown.values.length === 0) {
				this._azureLocationDropdown.placeholder = constants.SELECT_SUBSCRIPTION_FOR_LOCATIONS;
			} else {
				selectDefaultDropdownValue(
					this._azureLocationDropdown,
					this._serviceContext.location?.displayName,
					true);
				this._azureLocationDropdown.placeholder = constants.SELECT_A_LOCATION;
				this._azureLocationDropdown.loading = false;
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateLocationDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_LOCATION_ERROR,
				error.message);
		} finally {
			this._azureLocationDropdown.loading = false;
		}
	}

	private async _populateResourceGroupDropdown(): Promise<void> {
		try {
			this._azureResourceGroupDropdown.loading = true;
			this._azureResourceGroupDropdown.values = await this._getAzureResourceGroupDropdownValues(
				this._serviceContext.location);
			if (this._azureResourceGroupDropdown.values.length === 0) {
				this._azureResourceGroupDropdown.placeholder = constants.SELECT_LOCATION_FOR_RESOURCEGROUPS;
			} else {
				selectDefaultDropdownValue(
					this._azureResourceGroupDropdown,
					this._serviceContext.resourceGroup?.id,
					false);
				this._azureResourceGroupDropdown.placeholder = constants.SELECT_A_RESOURCE_GROUP;
				this._azureResourceGroupDropdown.loading = false;
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateResourceGroupDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_RESOURCE_GROUP_ERROR,
				error.message);
		} finally {
			this._azureResourceGroupDropdown.loading = false;
		}
	}

	private async _populateMigrationServiceDropdown(): Promise<void> {
		try {
			this._azureServiceDropdown.loading = true;
			const services = await this._getMigrationServiceDropdownValues(
				this._serviceContext.azureAccount,
				this._serviceContext.subscription,
				this._serviceContext.location,
				this._serviceContext.resourceGroup);

			if (!services || services.length < 1) {
				this._azureServiceDropdown.value = undefined;
			} else {
			}
			this._azureServiceDropdown.values = services;
			if (this._azureServiceDropdown.values.length === 0) {
				this._azureServiceDropdown.placeholder = constants.SELECT_RESOURCE_GROUP_FOR_SERVICES;
			} else {
				selectDefaultDropdownValue(
					this._azureServiceDropdown,
					this._serviceContext?.migrationService?.id,
					false);
				this._azureServiceDropdown.placeholder = constants.SELECT_A_SERVICE;
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateMigrationServiceDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_SERVICE_ERROR,
				error.message);
		} finally {
			this._azureServiceDropdown.loading = false;
		}
	}

	private async _getAccountDropdownValues(): Promise<azdata.CategoryValue[]> {
		this._azureAccounts = await azdata.accounts.getAllAccounts() || [];
		return this._azureAccounts.map(account => {
			return {
				name: account.displayInfo.userId,
				displayName: account.displayInfo.displayName,
			};
		});
	}

	private async _getSubscriptionDropdownValues(account?: azdata.Account): Promise<azdata.CategoryValue[]> {
		this._subscriptions = [];
		if (account !== undefined) {
			try {
				this._subscriptions = await getSubscriptions(account);
				this._subscriptions.sort((a, b) => a.name.localeCompare(b.name));
			} catch (error) {
				logError(TelemetryViews.SelectMigrationServiceDialog, '_getSubscriptionDropdownValues', error);
				void vscode.window.showErrorMessage(
					constants.SELECT_SUBSCRIPTION_ERROR,
					error.message);
			}
		}

		return this._subscriptions.map(subscription => {
			return {
				name: subscription.id,
				displayName: `${subscription.name} - ${subscription.id}`,
			};
		});
	}

	private _getTenantDropdownValues(account?: azdata.Account): azdata.CategoryValue[] {
		this._accountTenants = account?.properties?.tenants || [];
		return this._accountTenants.map(tenant => {
			return {
				name: tenant.id,
				displayName: tenant.displayName,
			};
		});
	}

	private async _getAzureLocationDropdownValues(
		account?: azdata.Account,
		subscription?: azureResource.AzureResourceSubscription): Promise<azdata.CategoryValue[]> {
		let locations: azureResource.AzureLocation[] = [];
		if (account && subscription) {
			// get all available locations
			locations = await getLocations(account, subscription);
			this._sqlMigrationServices = await getSqlMigrationServices(
				account,
				subscription) || [];
			this._sqlMigrationServices.sort((a, b) => a.name.localeCompare(b.name));
		} else {
			this._sqlMigrationServices = [];
		}

		// keep locaitons with services only
		this._locations = locations.filter(
			(loc, i) => this._sqlMigrationServices.some(service => service.location === loc.name));
		this._locations.sort((a, b) => a.name.localeCompare(b.name));
		return this._locations.map(loc => {
			return {
				name: loc.name,
				displayName: loc.displayName,
			};
		});
	}

	private async _getAzureResourceGroupDropdownValues(location?: azureResource.AzureLocation): Promise<azdata.CategoryValue[]> {
		this._resourceGroups = location
			? this._getMigrationServicesResourceGroups(location)
			: [];
		this._resourceGroups.sort((a, b) => a.name.localeCompare(b.name));
		return this._resourceGroups.map(rg => {
			return {
				name: rg.id,
				displayName: rg.name,
			};
		});
	}

	private _getMigrationServicesResourceGroups(location?: azureResource.AzureLocation): azureResource.AzureResourceResourceGroup[] {
		const resourceGroups = this._sqlMigrationServices
			.filter(service => service.location === location?.name)
			.map(service => service.properties.resourceGroup);

		return resourceGroups
			.filter((rg, i, arr) => arr.indexOf(rg) === i)
			.map(rg => {
				return <azureResource.AzureResourceResourceGroup>{
					id: getFullResourceGroupFromId(rg),
					name: rg,
				};
			});
	}

	private async _getMigrationServiceDropdownValues(
		account?: azdata.Account,
		subscription?: azureResource.AzureResourceSubscription,
		location?: azureResource.AzureLocation,
		resourceGroup?: azureResource.AzureResourceResourceGroup): Promise<azdata.CategoryValue[]> {

		const locationName = location?.name?.toLowerCase();
		const resourceGroupName = resourceGroup?.name?.toLowerCase();

		return this._sqlMigrationServices
			.filter(service =>
				service.location?.toLowerCase() === locationName &&
				service.properties?.resourceGroup?.toLowerCase() === resourceGroupName)
			.map(service => {
				return ({
					name: service.id,
					displayName: `${service.name}`,
				});
			});
	}
}
