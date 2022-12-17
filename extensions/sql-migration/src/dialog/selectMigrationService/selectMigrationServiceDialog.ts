/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as azurecore from 'azurecore';
import { MigrationLocalStorage, MigrationServiceContext } from '../../models/migrationLocalStorage';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import * as utils from '../../api/utils';
import { SqlMigrationService } from '../../api/azure';
import { logError, TelemetryViews } from '../../telemtery';
import { ServiceContextChangeEvent } from '../../dashboard/tabBase';

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
	private _subscriptions!: azurecore.azureResource.AzureResourceSubscription[];
	private _locations!: azurecore.azureResource.AzureLocation[];
	private _resourceGroups!: azurecore.azureResource.AzureResourceResourceGroup[];
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
		private readonly onServiceContextChanged: vscode.EventEmitter<ServiceContextChangeEvent>) {
		this._dialog = azdata.window.createModelViewDialog(
			constants.MIGRATION_SERVICE_SELECT_TITLE,
			'SelectMigraitonServiceDialog',
			460,
			'normal');
	}

	async initialize(): Promise<void> {
		this._serviceContext = await MigrationLocalStorage.getMigrationServiceContext();

		this._dialog.registerContent(async (view: azdata.ModelView) => {
			this._disposables.push(
				view.onClosed(e => {
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));
			await this.registerContent(view);
		});

		this._dialog.okButton.label = constants.MIGRATION_SERVICE_SELECT_APPLY_LABEL;
		this._dialog.okButton.position = 'left';
		this._dialog.cancelButton.position = 'left';

		this._deleteButton = azdata.window.createButton(
			constants.MIGRATION_SERVICE_CLEAR,
			'right');
		this._disposables.push(
			this._deleteButton.onClick(async (value) => {
				await MigrationLocalStorage.saveMigrationServiceContext({}, this.onServiceContextChanged);
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
				placeholder: constants.SELECT_AN_ACCOUNT,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureAccountsDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedAccount = this._azureAccounts.find(account => account.displayInfo.displayName === value);
					this._serviceContext.azureAccount = (selectedAccount)
						? utils.deepClone(selectedAccount)
						: undefined!;
					await this._populateTentantsDropdown();
				}
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
				placeholder: constants.SELECT_A_TENANT,
			}).component();
		this._disposables.push(
			this._accountTenantDropdown.onValueChanged(async value => {
				if (value && value !== 'undefined') {
					const selectedTenant = this._accountTenants.find(tenant => tenant.displayName === value);
					if (selectedTenant) {
						this._serviceContext.tenant = utils.deepClone(selectedTenant);
						this._serviceContext.azureAccount!.properties.tenants = [selectedTenant];
					}
					await this._populateSubscriptionDropdown();
				}
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
				description: constants.DMS_SUBSCRIPTION_INFO,
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
				placeholder: constants.SELECT_A_SUBSCRIPTION,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureSubscriptionDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedSubscription = this._subscriptions.find(subscription => `${subscription.name} - ${subscription.id}` === value);
					this._serviceContext.subscription = (selectedSubscription)
						? utils.deepClone(selectedSubscription)
						: undefined!;
					await this._populateLocationDropdown();
				}
			}));

		const azureLocationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				description: constants.DMS_LOCATION_INFO,
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
				placeholder: constants.SELECT_A_LOCATION,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureLocationDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedLocation = this._locations.find(location => location.displayName === value);
					this._serviceContext.location = (selectedLocation)
						? utils.deepClone(selectedLocation)
						: undefined!;
					await this._populateResourceGroupDropdown();
					this._populateMigrationServiceDropdown();
				}
			}));

		const azureResourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				description: constants.DMS_RESOURCE_GROUP_INFO,
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
				placeholder: constants.SELECT_A_RESOURCE_GROUP,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureResourceGroupDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedResourceGroup = this._resourceGroups.find(rg => rg.name === value);
					this._serviceContext.resourceGroup = (selectedResourceGroup)
						? utils.deepClone(selectedResourceGroup)
						: undefined!;
					this._populateMigrationServiceDropdown();
				}
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
				placeholder: constants.SELECT_A_SERVICE,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureServiceDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedDms = this._sqlMigrationServices.find(dms => dms.name === value);
					this._serviceContext.migrationService = (selectedDms)
						? utils.deepClone(selectedDms)
						: undefined!;
					await this._updateButtonState();
				}
			}));

		this._disposables.push(
			this._dialog.okButton.onClick(async (value) =>
				await MigrationLocalStorage.saveMigrationServiceContext(
					this._serviceContext,
					this.onServiceContextChanged)));

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
			this._azureAccounts = await utils.getAzureAccounts();
			this._azureAccountsDropdown.values = await utils.getAzureAccountsDropdownValues(this._azureAccounts);
			if (this._azureAccountsDropdown.values.length > 0) {
				utils.selectDefaultDropdownValue(
					this._azureAccountsDropdown,
					this._serviceContext.azureAccount?.displayInfo?.userId,
					false);
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
			this._accountTenants = utils.getAzureTenants(this._serviceContext.azureAccount);
			this._accountTenantDropdown.values = await utils.getAzureTenantsDropdownValues(this._accountTenants);
			await this._accountTenantFlexContainer.updateCssStyles(
				this._accountTenants.length > 1
					? STYLE_ShOW
					: STYLE_HIDE);
			if (this._accountTenantDropdown.values.length > 0) {
				utils.selectDefaultDropdownValue(
					this._accountTenantDropdown,
					this._serviceContext.tenant?.id,
					false);
			}
		} catch (error) {
			logError(TelemetryViews.SelectMigrationServiceDialog, '_populateTentantsDropdown', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_TENANT_ERROR,
				error.message);
		} finally {
			this._accountTenantDropdown.loading = false;
			await this._populateSubscriptionDropdown();
		}
	}

	private async _populateSubscriptionDropdown(): Promise<void> {
		try {
			this._azureSubscriptionDropdown.loading = true;
			this._subscriptions = await utils.getAzureSubscriptions(this._serviceContext.azureAccount);
			this._azureSubscriptionDropdown.values = await utils.getAzureSubscriptionsDropdownValues(this._subscriptions);
			if (this._azureSubscriptionDropdown.values.length > 0) {
				utils.selectDefaultDropdownValue(
					this._azureSubscriptionDropdown,
					this._serviceContext.subscription?.id,
					false);
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
			this._sqlMigrationServices = await utils.getAzureSqlMigrationServices(
				this._serviceContext.azureAccount,
				this._serviceContext.subscription);
			this._locations = await utils.getResourceLocations(
				this._serviceContext.azureAccount,
				this._serviceContext.subscription,
				this._sqlMigrationServices);

			this._azureLocationDropdown.values = await utils.getAzureLocationsDropdownValues(this._locations);
			if (this._azureLocationDropdown.values.length > 0) {
				utils.selectDefaultDropdownValue(
					this._azureLocationDropdown,
					this._serviceContext.location?.displayName,
					true);
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
			this._resourceGroups = utils.getServiceResourceGroupsByLocation(
				this._sqlMigrationServices,
				this._serviceContext.location!);
			this._azureResourceGroupDropdown.values = utils.getResourceDropdownValues(
				this._resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);

			if (this._azureResourceGroupDropdown.values.length > 0) {
				utils.selectDefaultDropdownValue(
					this._azureResourceGroupDropdown,
					this._serviceContext.resourceGroup?.id,
					false);
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

	private _populateMigrationServiceDropdown(): void {
		try {
			this._azureServiceDropdown.loading = true;
			this._azureServiceDropdown.values = utils.getAzureResourceDropdownValues(
				this._sqlMigrationServices,
				this._serviceContext.location!,
				this._serviceContext.resourceGroup?.name,
				constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR);

			if (this._azureServiceDropdown.values.length > 0) {
				utils.selectDefaultDropdownValue(
					this._azureServiceDropdown,
					this._serviceContext?.migrationService?.id,
					false);
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
}
