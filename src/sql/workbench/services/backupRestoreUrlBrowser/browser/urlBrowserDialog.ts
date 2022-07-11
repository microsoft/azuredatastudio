/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/urlBrowserDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { attachButtonStyler, attachInputBoxStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import * as DOM from 'vs/base/browser/dom';
import * as strings from 'vs/base/common/strings';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Account } from 'azdata';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { IAzureAccountService } from 'sql/platform/azureAccount/common/azureAccountService';
import { azureResource } from 'azurecore';
import { IAzureBlobService } from 'sql/platform/azureBlob/common/azureBlobService';
import { Link } from 'vs/platform/opener/browser/link';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { onUnexpectedError } from 'vs/base/common/errors';
import { Deferred } from 'sql/base/common/promise';

/**
 * This function adds one year to the current date and returns it in the UTC format.
 * It's used to pass an expiration date argument to the create shared access signature RPC.
 * It returns the date in the UTC format for locale time zone independence.
 * @returns next year's UTC date
 */
function nextYear(): string {
	const today = new Date();
	const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
	return nextYear.toUTCString();
}

export class BackupRestoreUrlBrowserDialog extends Modal {

	private _accounts: Account[];
	private _selectedAccount: Account;
	private _subscriptions: azureResource.AzureResourceSubscription[];
	private _selectedSubscription: azureResource.AzureResourceSubscription;
	private _storageAccounts: azureResource.AzureGraphResource[];
	private _selectedStorageAccount: azureResource.AzureGraphResource;
	private _blobContainers: azureResource.BlobContainer[];
	private _selectedBlobContainer: azureResource.BlobContainer;
	private _backupFiles: azureResource.Blob[];

	private _ownerUri: string;
	private _body: HTMLElement;
	private _accountSelectorBox: SelectBox;
	private _tenantSelectorBox: SelectBox;
	private _subscriptionSelectorBox: SelectBox;
	private _storageAccountSelectorBox: SelectBox;
	private _blobContainerSelectorBox: SelectBox;
	private _sasInputBox: InputBox;
	private _sasButton: Button;
	private _backupFileInputBox: InputBox;
	private _backupFileSelectorBox: SelectBox;
	private _okButton: Button;
	private _cancelButton: Button;
	public onOk: Deferred<string> | undefined = new Deferred();


	constructor(title: string,
		private _restoreDialog: boolean,
		private _defaultBackupName: string,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService,
		@IAzureAccountService private _azureAccountService: IAzureAccountService,
		@IAzureBlobService private _blobService: IAzureBlobService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(title, TelemetryKeys.ModalDialogName.UrlBrowser, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'flyout', hasTitleIcon: false, hasBackButton: true, hasSpinner: true });
	}

	protected layout(height?: number): void {
	}

	protected renderBody(container: HTMLElement) {
		this._body = DOM.append(container, DOM.$('.url-browser-dialog'));
	}

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {

			this._register(this.backButton.onDidClick(() => {
				this.close();
			}));

			this._register(attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND }));
		}

		let tableContainer: HTMLElement = DOM.append(DOM.append(this._body, DOM.$('.option-section')), DOM.$('table.url-table-content'));
		tableContainer.setAttribute('role', 'presentation');

		let azureAccountLabel = localize('backupRestoreUrlBrowserDialog.account', "Azure Account");
		this._accountSelectorBox = this._register(new SelectBox([''], '', this._contextViewService, null, { ariaLabel: azureAccountLabel }));
		this._accountSelectorBox.disable();
		let accountSelector = DialogHelper.appendRow(tableContainer, azureAccountLabel, 'url-input-label', 'url-input-box', null, true);
		DialogHelper.appendInputSelectBox(accountSelector, this._accountSelectorBox);
		this._accountManagementService.getAccounts().then((accounts) => this.setAccountSelectorBoxOptions(accounts)).catch((err) => {
			this.setAccountSelectorBoxOptions([]);
			onUnexpectedError(err);
		});

		let linkAccountText = localize('backupRestoreUrlBrowserDialog.linkAccount', "Link account");
		let linkAccountButton = DialogHelper.appendRow(tableContainer, '', 'url-input-label', 'url-input-box');
		const linkAccount: Link = this._register(this._instantiationService.createInstance(Link,
			linkAccountButton,
			{
				label: linkAccountText,
				title: linkAccountText,
				href: ''
			},
			{
				opener: async (href: string) => {
					await this._accountManagementService.openAccountListDialog();
					this._accountManagementService.getAccounts().then((accounts) => this.setAccountSelectorBoxOptions(accounts)).catch((err) => {
						this.setAccountSelectorBoxOptions([]);
						onUnexpectedError(err);
					});
				}
			}
		));
		linkAccountButton.appendChild(linkAccount.el);

		let tenantLabel = localize('backupRestoreUrlBrowserDialog.tenant', "Azure AD Tenant");
		this._tenantSelectorBox = this._register(new SelectBox([], '', this._contextViewService, null, { ariaLabel: tenantLabel }));
		this._tenantSelectorBox.disable();
		let tenantSelector = DialogHelper.appendRow(tableContainer, tenantLabel, 'url-input-label', 'url-input-box', null, true);
		DialogHelper.appendInputSelectBox(tenantSelector, this._tenantSelectorBox);

		let subscriptionLabel = localize('backupRestoreUrlBrowserDialog.subscription', "Azure subscription");
		this._subscriptionSelectorBox = this._register(new SelectBox([], '', this._contextViewService, null, { ariaLabel: subscriptionLabel }));
		this._subscriptionSelectorBox.disable();
		let subscriptionSelector = DialogHelper.appendRow(tableContainer, subscriptionLabel, 'url-input-label', 'url-input-box', null, true);
		DialogHelper.appendInputSelectBox(subscriptionSelector, this._subscriptionSelectorBox);

		let storageAccountLabel = localize('backupRestoreUrlBrowserDialog.storageAccount', "Storage account");
		this._storageAccountSelectorBox = this._register(new SelectBox([], '', this._contextViewService, null, { ariaLabel: storageAccountLabel }));
		this._storageAccountSelectorBox.disable();
		let storageAccountSelector = DialogHelper.appendRow(tableContainer, storageAccountLabel, 'url-input-label', 'url-input-box', null, true);
		DialogHelper.appendInputSelectBox(storageAccountSelector, this._storageAccountSelectorBox);

		let blobContainerLabel = localize('backupRestoreUrlBrowserDialog.blobContainer', "Blob container");
		this._blobContainerSelectorBox = this._register(new SelectBox([], '', this._contextViewService, null, { ariaLabel: blobContainerLabel }));
		this._blobContainerSelectorBox.disable();
		let blobContainerSelector = DialogHelper.appendRow(tableContainer, blobContainerLabel, 'url-input-label', 'url-input-box', null, true);
		DialogHelper.appendInputSelectBox(blobContainerSelector, this._blobContainerSelectorBox);


		let sharedAccessSignatureLabel = localize('backupRestoreUrlBrowserDialog.sharedAccessSignature', "Shared access signature generated");
		let sasInput = DialogHelper.appendRow(tableContainer, sharedAccessSignatureLabel, 'url-input-label', 'url-input-box', null, true);
		this._sasInputBox = this._register(new InputBox(sasInput, this._contextViewService, { flexibleHeight: true }));
		this._sasInputBox.disable();
		this._register(this._sasInputBox.onDidChange(() => this.enableOkButton()));

		let sasButtonContainer = DialogHelper.appendRow(tableContainer, '', 'url-input-label', 'url-input-box');
		let sasButtonLabel = localize('backupRestoreUrlBrowserDialog.sharedAccessSignatureButton', "Create Credentials");
		this._sasButton = this._register(new Button(sasButtonContainer, { title: sasButtonLabel }));
		this._sasButton.label = sasButtonLabel;
		this._sasButton.title = sasButtonLabel;
		this._register(this._sasButton.onDidClick(e => this.generateSharedAccessSignature()));

		let backupFileLabel = localize('backupRestoreUrlBrowserDialog.backupFile', "Backup file");

		if (this._restoreDialog) {
			this._backupFileSelectorBox = this._register(new SelectBox([], '', this._contextViewService, null, { ariaLabel: backupFileLabel }));
			let backupFileSelector = DialogHelper.appendRow(tableContainer, backupFileLabel, 'url-input-label', 'url-input-box', null, true);
			DialogHelper.appendInputSelectBox(backupFileSelector, this._backupFileSelectorBox);
			this._backupFileSelectorBox.setOptions([]);
			this._backupFileSelectorBox.disable();
		} else {
			let fileInput = DialogHelper.appendRow(tableContainer, backupFileLabel, 'url-input-label', 'url-input-box', null, true);
			this._backupFileInputBox = this._register(new InputBox(fileInput, this._contextViewService, { flexibleHeight: true }));
			this._backupFileInputBox.value = this._defaultBackupName;
		}

		this._okButton = this.addFooterButton(localize('fileBrowser.ok', "OK"), () => this.ok());
		this._okButton.enabled = false;
		this._cancelButton = this.addFooterButton(localize('fileBrowser.discard', "Discard"), () => this.close(), 'right', true);

		this.registerListeners();
		this.registerThemeStylers();
	}

	private setAccountSelectorBoxOptions(accounts: Account[]) {
		this._accounts = accounts.filter(account => !account.isStale);
		const accountDisplayNames: string[] = this._accounts.map(account => account.displayInfo.displayName);
		this._accountSelectorBox.setOptions(accountDisplayNames);
		this._accountSelectorBox.select(0);
		if (this._accounts.length === 0) {
			this._accountSelectorBox.disable();
			this.onTenantSelectorBoxChanged(0);
		} else {
			this._accountSelectorBox.enable();
		}
	}

	private onAccountSelectorBoxChanged(checkedAccount: number) {
		if (this._accounts.length !== 0) {
			this._selectedAccount = this._accounts[checkedAccount];
			const tenants = this._selectedAccount.properties.tenants;
			const tenantsDisplayNames = tenants.map(tenant => tenant.displayName);
			this._tenantSelectorBox.setOptions(tenantsDisplayNames);
			this._tenantSelectorBox.select(0);
			if (tenantsDisplayNames.length === 0) {
				this._tenantSelectorBox.disable();
			} else {
				this._tenantSelectorBox.enable();
			}
		} else {
			this._tenantSelectorBox.setOptions([]);
			this._tenantSelectorBox.select(0);
			this._tenantSelectorBox.disable();
		}
	}

	private onTenantSelectorBoxChanged(checkedTenant: number) {
		if (this._accounts.length !== 0) {
			this._azureAccountService.getSubscriptions(this._selectedAccount)
				.then(getSubscriptionResult => this.setSubscriptionsSelectorBoxOptions(getSubscriptionResult.subscriptions))
				.catch(getSubscriptionResult => {
					this.setSubscriptionsSelectorBoxOptions([]);
					onUnexpectedError(getSubscriptionResult.errors);
				});
		} else {
			this._tenantSelectorBox.setOptions([]);
			this._tenantSelectorBox.disable();
			this.setSubscriptionsSelectorBoxOptions([]);
		}
	}

	private setSubscriptionsSelectorBoxOptions(subscriptions: azureResource.AzureResourceSubscription[]) {
		this._subscriptions = subscriptions;
		const subscriptionDisplayNames: string[] = subscriptions.map(subscription => subscription.name);
		this._subscriptionSelectorBox.setOptions(subscriptionDisplayNames);
		this._subscriptionSelectorBox.select(0);
		if (this._subscriptions.length === 0) {
			this._subscriptionSelectorBox.disable();
		} else {
			this._subscriptionSelectorBox.enable();
		}
	}

	private onSubscriptionSelectorBoxChanged(checkedSubscription: number) {
		if (this._subscriptions.length !== 0) {
			this._selectedSubscription = this._subscriptions[checkedSubscription];
			this._azureAccountService.getStorageAccounts(this._selectedAccount, [this._selectedSubscription])
				.then(getStorageAccountsResult => this.setStorageAccountSelectorBoxOptions(getStorageAccountsResult.resources))
				.catch(getStorageAccountsResult => {
					this.setStorageAccountSelectorBoxOptions([]);
					onUnexpectedError(getStorageAccountsResult.errors);
				});
		} else {
			this.setStorageAccountSelectorBoxOptions([]);
		}
	}

	private setStorageAccountSelectorBoxOptions(storageAccounts: azureResource.AzureGraphResource[]) {
		this._storageAccounts = storageAccounts;
		const storageAccountDisplayNames: string[] = this._storageAccounts.map(storageAccount => storageAccount.name);
		this._storageAccountSelectorBox.setOptions(storageAccountDisplayNames);
		this._storageAccountSelectorBox.select(0);
		if (storageAccounts.length === 0) {
			this._storageAccountSelectorBox.disable();
		} else {
			this._storageAccountSelectorBox.enable();
		}
	}

	private onStorageAccountSelectorBoxChanged(checkedStorageAccount: number) {
		if (this._storageAccounts.length !== 0) {
			this._selectedStorageAccount = this._storageAccounts[checkedStorageAccount];
			this._azureAccountService.getBlobContainers(this._selectedAccount, this._selectedSubscription, this._selectedStorageAccount)
				.then(getBlobContainersResult => this.setBlobContainersSelectorBoxOptions(getBlobContainersResult.blobContainers))
				.catch(getBlobContainersResult => {
					this.setBlobContainersSelectorBoxOptions([]);
					onUnexpectedError(getBlobContainersResult.errors);
				});
		} else {
			this.setBlobContainersSelectorBoxOptions([]);
		}
	}

	private setBlobContainersSelectorBoxOptions(blobContainers: azureResource.BlobContainer[]) {
		this._blobContainers = blobContainers;
		const blobContainersDisplayNames: string[] = this._blobContainers.map(blobContainer => blobContainer.name);
		this._blobContainerSelectorBox.setOptions(blobContainersDisplayNames);
		this._blobContainerSelectorBox.select(0);
		if (this._blobContainers.length === 0) {
			this._blobContainerSelectorBox.disable();
		} else {
			this._blobContainerSelectorBox.enable();
		}
	}

	private onBlobContainersSelectorBoxChanged(checkedBlobContainer: number) {
		this._sasInputBox.value = '';
		if (this._restoreDialog) {
			if (this._blobContainers.length !== 0) {
				this._selectedBlobContainer = this._blobContainers[checkedBlobContainer];
				this._azureAccountService.getBlobs(this._selectedAccount, this._selectedSubscription, this._selectedStorageAccount, this._selectedBlobContainer.name, true)
					.then(getBlobsResult => this.setBackupFilesOptions(getBlobsResult.blobs))
					.catch(getBlobsResult => {
						this.setBackupFilesOptions([]);
						onUnexpectedError(getBlobsResult.errors);
					});
			} else {
				this.setBackupFilesOptions([]);
			}
		}
		this.enableCreateCredentialsButton();
	}

	private setBackupFilesOptions(blobs: azureResource.Blob[]) {
		this._backupFiles = blobs;
		const backupFilesDisplayNames: string[] = this._backupFiles.map(backupFile => backupFile.name);
		this._backupFileSelectorBox.setOptions(backupFilesDisplayNames);
		this._backupFileSelectorBox.select(0);
		if (this._backupFiles.length === 0) {
			this._backupFileSelectorBox.disable();
		} else {
			this._backupFileSelectorBox.enable();
		}
	}

	public open(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
	): void {
		this._ownerUri = ownerUri;
		this.enableOkButton();
		this.enableCreateCredentialsButton();
		this.show();
	}

	/* enter key */
	protected override onAccept() {
		let selectedValue = this._sasInputBox.value;
		if (this._okButton.enabled === true && selectedValue !== '') {
			this.ok();
		}
	}


	private enableOkButton() {
		if (strings.isFalsyOrWhitespace(this._blobContainerSelectorBox.value) || strings.isFalsyOrWhitespace(this._sasInputBox.value) || (this._restoreDialog && strings.isFalsyOrWhitespace(this._blobContainerSelectorBox.value)) || (!this._restoreDialog && strings.isFalsyOrWhitespace(this._backupFileInputBox.value))) {
			this._okButton.enabled = false;
		} else {
			this._okButton.enabled = true;
		}
	}

	private enableCreateCredentialsButton() {
		if (strings.isFalsyOrWhitespace(this._blobContainerSelectorBox.label)) {
			this._sasButton.enabled = false;
		} else {
			this._sasButton.enabled = true;
		}
	}

	private ok() {
		let returnValue = '';
		if (this._restoreDialog) {
			returnValue = `https://${this._storageAccountSelectorBox.value}.blob${this._selectedAccount.properties.providerSettings.settings.azureStorageResource.endpointSuffix}/${this._blobContainerSelectorBox.value}/${this._backupFileSelectorBox.value}`;
		} else {
			returnValue = `https://${this._storageAccountSelectorBox.value}.blob${this._selectedAccount.properties.providerSettings.settings.azureStorageResource.endpointSuffix}/${this._blobContainerSelectorBox.value}/${this._backupFileInputBox.value}`;
		}
		this.onOk.resolve(returnValue);
		this.close('ok');
	}


	private close(hideReason: HideReason = 'close'): void {
		this.hide(hideReason);
	}

	private async generateSharedAccessSignature() {
		this.spinner = true;
		const blobContainerUri = `https://${this._storageAccountSelectorBox.value}.blob${this._selectedAccount.properties.providerSettings.settings.azureStorageResource.endpointSuffix}/${this._blobContainerSelectorBox.value}`;
		const getStorageAccountAccessKeyResult = await this._azureAccountService.getStorageAccountAccessKey(this._selectedAccount, this._selectedSubscription, this._selectedStorageAccount);
		const key1 = getStorageAccountAccessKeyResult.keyName1;
		const createSasResult = await this._blobService.createSas(this._ownerUri, blobContainerUri, key1, this._selectedStorageAccount.name, nextYear());
		const sas = createSasResult.sharedAccessSignature;
		this._sasInputBox.value = sas;
		this.spinner = false;
	}

	private registerListeners(): void {
		this._register(this._accountSelectorBox.onDidSelect(e => this.onAccountSelectorBoxChanged(e.index)));
		this._register(this._tenantSelectorBox.onDidSelect(selectedTenant => this.onTenantSelectorBoxChanged(selectedTenant.index)));
		this._register(this._subscriptionSelectorBox.onDidSelect(selectedSubscription => this.onSubscriptionSelectorBoxChanged(selectedSubscription.index)));
		this._register(this._storageAccountSelectorBox.onDidSelect(selectedStorageAccount => this.onStorageAccountSelectorBoxChanged(selectedStorageAccount.index)));
		this._register(this._blobContainerSelectorBox.onDidSelect(selectedBlobContainer => {
			this.onBlobContainersSelectorBoxChanged(selectedBlobContainer.index);
			this.enableOkButton();
		}));

		if (this._backupFileInputBox) {
			this._register(this._backupFileInputBox.onDidChange(e => this.enableOkButton()));
		}
		if (this._backupFileSelectorBox) {
			this._register(this._backupFileSelectorBox.onDidSelect(e => this.enableOkButton()));
		}
	}


	private registerThemeStylers(): void {
		this._register(attachSelectBoxStyler(this._tenantSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._accountSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._subscriptionSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._storageAccountSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._blobContainerSelectorBox, this._themeService));
		this._register(attachInputBoxStyler(this._sasInputBox, this._themeService));

		if (this._backupFileInputBox) {
			this._register(attachInputBoxStyler(this._backupFileInputBox, this._themeService));
		}
		if (this._backupFileSelectorBox) {
			this._register(attachSelectBoxStyler(this._backupFileSelectorBox, this._themeService));
		}
		this._register(attachButtonStyler(this._sasButton, this._themeService));
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
	}
}
