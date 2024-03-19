/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as azurecore from 'azurecore';
import { MigrationServiceContext } from '../../models/migrationLocalStorage';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';
import * as utils from '../../api/utils';
import { StorageAccount } from '../../api/azure';
import { logError, TelemetryViews } from '../../telemetry';
import { MigrationStateModel } from '../../models/stateMachine';
import { StorageSharedKeyCredential, BlockBlobClient, BlobSASPermissions, generateBlobSASQueryParameters } from '@azure/storage-blob';
import { getStorageAccountAccessKeys } from '../../api/azure';
import { MigrationTargetType } from '../../api/utils';

const INPUT_COMPONENT_WIDTH = '100%';
const STYLE_HIDE = { 'display': 'none' };
const STYLE_ShOW = { 'display': 'inline' };
const CONTROL_MARGIN = '20px';
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

export class SelectStorageAccountDialog {
	private _dialog: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _disposables: vscode.Disposable[] = [];
	private _serviceContext!: MigrationServiceContext;
	private _azureAccounts!: azdata.Account[];
	private _accountTenants!: azurecore.Tenant[];
	private _azureTenant!: azurecore.Tenant;
	private _subscriptions!: azurecore.azureResource.AzureResourceSubscription[];
	private _targetSubscription!: azurecore.azureResource.AzureResourceSubscription;
	private _locations!: azurecore.azureResource.AzureLocation[];
	private _location!: azurecore.azureResource.AzureLocation;
	private _resourceGroups!: azurecore.azureResource.AzureResourceResourceGroup[];
	private _resourceGroup!: azurecore.azureResource.AzureResourceResourceGroup;
	private _storageAccounts!: StorageAccount[];
	public _azureAccount!: azdata.Account;
	public _blobContainers!: azurecore.azureResource.BlobContainer[];
	public _blobContainer!: azurecore.azureResource.BlobContainer;
	public _storageAccount!: azurecore.azureResource.AzureGraphResource;
	private _azureAccountsDropdown!: azdata.DropDownComponent;
	private _accountTenantDropdown!: azdata.DropDownComponent;
	private _accountTenantFlexContainer!: azdata.FlexContainer;
	private _azureSubscriptionDropdown!: azdata.DropDownComponent;
	private _azureLocationDropdown!: azdata.DropDownComponent;
	private _azureResourceGroupDropdown!: azdata.DropDownComponent;
	private _azureStorageAccountLabel!: azdata.TextComponent;
	private _azureStorageAccountDropdown!: azdata.DropDownComponent;
	private _blobContainerLabel!: azdata.TextComponent;
	private _blobContainerDropdown!: azdata.DropDownComponent;

	constructor(
		protected readonly migrationStateModel: MigrationStateModel, public _targetType: MigrationTargetType
	) {
		this._dialog = azdata.window.createModelViewDialog(
			constants.SELECT_STORAGE_ACCOUNT_TITLE,
			'SelectStorageAccountDialog',
			460,
			'normal'
		);
	}

	async initialize(): Promise<void> {
		this._dialog.registerContent(async (view: azdata.ModelView) => {
			this._disposables.push(
				view.onClosed(e => {
					this._disposables.forEach(
						d => { try { d.dispose(); } catch { } });
				}));
			await this.registerContent(view);


		});

		this._dialog.okButton.label = constants.SAVE_LABEL;
		this._disposables.push(
			this._dialog.okButton.onClick(async (value) => {
				await this.uploadTemplate();
			}));
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
				this._createStorageAccountContainer()
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
				value: constants.STORAGE_ACCOUNT_SELECT_HEADING,
				CSSStyles: { ...styles.PAGE_TITLE_CSS }
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
					const selectedAccount = this._azureAccounts?.find(account => account.displayInfo.displayName === value);
					this._azureAccount = (selectedAccount)
						? utils.deepClone(selectedAccount)!
						: undefined!;
				} else {
					this._azureAccount = undefined!;
				}
				await utils.clearDropDown(this._accountTenantDropdown);
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
				placeholder: constants.SELECT_A_TENANT,
			}).component();
		this._disposables.push(
			this._accountTenantDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedTenant = this._accountTenants?.find(tenant => tenant.displayName === value);
					this._azureTenant = selectedTenant
						? utils.deepClone(selectedTenant)
						: undefined!;
				} else {
					this._azureTenant = undefined!;
				}
				await utils.clearDropDown(this._azureSubscriptionDropdown);
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

	private _createStorageAccountContainer(): azdata.FlexContainer {
		const subscriptionDropdownLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.SUBSCRIPTION,
				description: constants.STORAGE_ACCOUNT_SUBSCRIPTION_INFO,
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
			})
			.component();
		this._disposables.push(
			this._azureSubscriptionDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined' && value !== constants.NO_SUBSCRIPTIONS_FOUND) {
					const selectedSubscription = this._subscriptions?.find(
						subscription => `${subscription.name} - ${subscription.id}` === value);
					this._targetSubscription = (selectedSubscription)
						? utils.deepClone(selectedSubscription)!
						: undefined!;
				} else {
					this._targetSubscription = undefined!;
				}

				await utils.clearDropDown(this._azureLocationDropdown);
				await this._populateLocationDropdown();
			}));

		const azureLocationLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.LOCATION,
				description: constants.STORAGE_ACCOUNT_LOCATION,
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
				if (value && value !== 'undefined' && value !== constants.NO_LOCATION_FOUND) {
					const selectedLocation = this._locations?.find(location => location.displayName === value);
					this._location = (selectedLocation)
						? utils.deepClone(selectedLocation)!
						: undefined!;
				} else {
					this.migrationStateModel._location = undefined!;
				}

				await utils.clearDropDown(this._azureResourceGroupDropdown);
				await this._populateResourceGroupDropdown();
			}));

		const azureResourceGroupLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.RESOURCE_GROUP,
				description: constants.STORAGE_ACCOUNT_RESOURCE_GROUP_INFO,
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
				if (value && value !== 'undefined' && value !== constants.RESOURCE_GROUP_NOT_FOUND) {
					const selectedResourceGroup = this._resourceGroups?.find(rg => rg.name === value);
					this._resourceGroup = (selectedResourceGroup)
						? utils.deepClone(selectedResourceGroup)!
						: undefined!;
				} else {
					this._resourceGroup = undefined!;
				}
				await utils.clearDropDown(this._azureStorageAccountDropdown);
				await this._populateBlobStorageAccount();
			}));

		this._azureStorageAccountLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.STORAGE_ACCOUNT_SELECT_LABEL,
				description: constants.TARGET_STORAGE_ACCOUNT_INFO,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._azureStorageAccountDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.STORAGE_ACCOUNT_SELECT_LABEL,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_A_STORAGE_ACCOUNT,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();
		this._disposables.push(
			this._azureStorageAccountDropdown.onValueChanged(async (value) => {
				if (value && value !== 'undefined') {
					const selectedStorageAccount = this._storageAccounts.find(as => as.name === value);
					this._storageAccount = (selectedStorageAccount)
						? utils.deepClone(selectedStorageAccount)!
						: undefined!;
				} else {
					this._serviceContext.migrationService = undefined;
				}
				await utils.clearDropDown(this._blobContainerDropdown);
				await this._populateBlobContainer();
			}));

		this._blobContainerLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.BLOB_CONTAINER,
				description: constants.TARGET_BLOB_CONTAINER_INFO,
				requiredIndicator: true,
				CSSStyles: { ...LABEL_CSS }
			}).component();
		this._blobContainerDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				ariaLabel: constants.BLOB_CONTAINER,
				width: INPUT_COMPONENT_WIDTH,
				editable: true,
				required: true,
				fireOnTextChange: true,
				placeholder: constants.SELECT_BLOB_CONTAINER,
				CSSStyles: { ...DROPDOWN_CSS },
			}).component();

		return this._view.modelBuilder.flexContainer()
			.withItems([
				subscriptionDropdownLabel,
				this._azureSubscriptionDropdown,
				azureLocationLabel,
				this._azureLocationDropdown,
				azureResourceGroupLabel,
				this._azureResourceGroupDropdown,
				this._azureStorageAccountLabel,
				this._azureStorageAccountDropdown,
				this._blobContainerLabel,
				this._blobContainerDropdown
			]).withLayout({ flexFlow: 'column' })
			.component();
	}

	private async _populateAzureAccountsDropdown(): Promise<void> {
		try {
			this._azureAccountsDropdown.loading = true;
			await utils.clearDropDown(this._azureAccountsDropdown);
			this._azureAccounts = await utils.getAzureAccounts();

			this._azureAccountsDropdown.values = await utils.getAzureAccountsDropdownValues(this._azureAccounts);

			utils.selectDefaultDropdownValue(
				this._azureAccountsDropdown);
			const selectedAccount = this._azureAccounts?.find(account => account.displayInfo.displayName === (<azdata.CategoryValue>this._azureAccountsDropdown.value)?.displayName);
			this._azureAccount = (selectedAccount)
				? utils.deepClone(selectedAccount)!
				: undefined!;
		} catch (e) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateAzureAccountsError', e);
		} finally {
			this._azureAccountsDropdown.loading = false;
		}
	}

	private async _populateTentantsDropdown(): Promise<void> {
		try {
			this._accountTenantDropdown.loading = true;
			this._accountTenants = utils.getAzureTenants(this._azureAccount);

			this._accountTenantDropdown.values = utils.getAzureTenantsDropdownValues(this._accountTenants);
			await this._accountTenantFlexContainer.updateCssStyles(
				this.migrationStateModel._azureAccount?.properties?.tenants?.length > 1
					? STYLE_ShOW
					: STYLE_HIDE
			);

			utils.selectDefaultDropdownValue(
				this._accountTenantDropdown);

			const selectedTenant = this._accountTenants?.find(tenant => tenant.displayName === (<azdata.CategoryValue>this._accountTenantDropdown.value)?.displayName);
			this._azureTenant = selectedTenant
				? utils.deepClone(selectedTenant)
				: undefined!;
			await this._azureAccountsDropdown.validate();
		} catch (e) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateTenantsError', e);
		} finally {
			this._accountTenantDropdown.loading = false;

		}
	}

	private async _populateSubscriptionDropdown(): Promise<void> {
		try {
			this._azureSubscriptionDropdown.loading = true;
			this._subscriptions = await utils.getAzureSubscriptions(
				this._azureAccount,
				this._azureTenant?.id);


			this._azureSubscriptionDropdown.values = await utils.getAzureSubscriptionsDropdownValues(this._subscriptions);

			utils.selectDefaultDropdownValue(
				this._azureSubscriptionDropdown);
			const selectedSubscription = this._subscriptions?.find(
				subscription => `${subscription.name} - ${subscription.id}` === (<azdata.CategoryValue>this._azureSubscriptionDropdown.value)?.displayName);
			this._targetSubscription = (selectedSubscription)
				? utils.deepClone(selectedSubscription)!
				: undefined!;

		} catch (e) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateSubscriptionsError', e);
		} finally {
			this._azureSubscriptionDropdown.loading = false;
		}
	}

	private async _populateLocationDropdown(): Promise<void> {
		try {
			this._azureLocationDropdown.loading = true;
			this._storageAccounts = await utils.getStorageAccounts(
				this._azureAccount,
				this._targetSubscription
			);
			this._locations = await utils.getResourceLocations(
				this._azureAccount,
				this._targetSubscription,
				this._storageAccounts);

			this._azureLocationDropdown.values = utils.getAzureLocationsDropdownValues(this._locations);
			utils.selectDefaultDropdownValue(
				this._azureLocationDropdown);
			const selectedLocation = this._locations?.find(location => location.displayName === (<azdata.CategoryValue>this._azureLocationDropdown.value)?.displayName);
			this._location = (selectedLocation)
				? utils.deepClone(selectedLocation)!
				: undefined!;
		} catch (e) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateLocationsError', e);
		} finally {
			this._azureLocationDropdown.loading = false;
		}
	}

	private async _populateResourceGroupDropdown(): Promise<void> {
		try {
			this._azureResourceGroupDropdown.loading = true;

			this._resourceGroups = utils.getServiceResourceGroupsByLocation(
				this._storageAccounts,
				this._location);

			this._azureResourceGroupDropdown.values = utils.getResourceDropdownValues(
				this._resourceGroups,
				constants.RESOURCE_GROUP_NOT_FOUND);

			utils.selectDefaultDropdownValue(
				this._azureResourceGroupDropdown);

			const selectedResourceGroup = this._resourceGroups?.find(rg => rg.name === (<azdata.CategoryValue>this._azureResourceGroupDropdown.value)?.displayName);
			this._resourceGroup = (selectedResourceGroup)
				? utils.deepClone(selectedResourceGroup)!
				: undefined!;
		} catch (e) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateResourceGroupsError', e);
		} finally {
			this._azureResourceGroupDropdown.loading = false;
		}
	}

	private async _populateBlobStorageAccount(): Promise<void> {
		try {
			this._azureStorageAccountDropdown.loading = true;

			this._storageAccounts = await utils.getStorageAccounts(
				this._azureAccount,
				this._targetSubscription
			);


			this._azureStorageAccountDropdown.values = utils.getAzureResourceDropdownValues(
				this._storageAccounts,
				this._location!,
				this._resourceGroup?.name,
				constants.NO_STORAGE_ACCOUNT_FOUND);

			utils.selectDefaultDropdownValue(
				this._azureStorageAccountDropdown
			);

			const selectedBlobStorage = this._storageAccounts?.find(rg => rg.name === (<azdata.CategoryValue>this._azureStorageAccountDropdown.value)?.displayName);
			this._storageAccount = (selectedBlobStorage)
				? utils.deepClone(selectedBlobStorage)!
				: undefined!;

		} catch (error) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateStorageAccountError', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_SERVICE_ERROR,
				error.message);
		} finally {
			this._azureStorageAccountDropdown.loading = false;
		}
	}

	private async _populateBlobContainer(): Promise<void> {
		try {
			this._dialog.okButton.enabled = false;
			this._blobContainerDropdown.loading = true;

			this._blobContainers = await utils.getBlobContainer(this._azureAccount, this._targetSubscription, this._storageAccount);

			this._blobContainerDropdown.values = utils.getResourceDropdownValues(
				this._blobContainers,
				constants.NO_BLOBCONTAINERS_FOUND);

			utils.selectDefaultDropdownValue(
				this._blobContainerDropdown
			);

			const selectedBlobContainer = this._blobContainers?.find(rg => rg.name === (<azdata.CategoryValue>this._blobContainerDropdown.value)?.displayName);
			this._blobContainer = (selectedBlobContainer)
				? utils.deepClone(selectedBlobContainer)!
				: undefined!;

			if ((<azdata.CategoryValue>this._blobContainerDropdown.value)?.displayName !== constants.NO_BLOBCONTAINERS_FOUND) {
				this._dialog.okButton.enabled = true;
			}


		} catch (error) {
			logError(TelemetryViews.UploadArmTemplateDialog, '_populateBlobContainerError', error);
			void vscode.window.showErrorMessage(
				constants.SELECT_SERVICE_ERROR,
				error.message);
		} finally {
			this._blobContainerDropdown.loading = false;
		}
	}

	private async uploadTemplate(): Promise<void> {
		const storageKeys = await getStorageAccountAccessKeys(this._azureAccount, this._targetSubscription, this._storageAccount);
		const accountName = this._storageAccount.name;
		const containerName = this._blobContainer.name;
		const blobName = utils.generateTemplatePath(this.migrationStateModel, this._targetType);

		const sharedKeyCredential = new StorageSharedKeyCredential(this._storageAccount.name, storageKeys.keyName1);

		const sasToken = generateBlobSASQueryParameters({
			containerName,
			blobName,
			permissions: BlobSASPermissions.parse("racwd"),
			expiresOn: new Date(new Date().valueOf() + 86400),
		},
			sharedKeyCredential
		).toString();

		const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
		try {
			const blockBlobClient = new BlockBlobClient(sasUrl);
			const template = this.migrationStateModel._armTemplateResult.template!;
			if (template) {
				await blockBlobClient.upload(template, template.length);
				void vscode.window.showInformationMessage(constants.UPLOAD_TEMPLATE_SUCCESS);
			}
		}
		catch (e) {
			logError(TelemetryViews.UploadArmTemplateDialog, 'ArmTemplateUploadError', e);
			void vscode.window.showErrorMessage(constants.UPLOAD_TEMPLATE_FAIL);
		}
	}
}
