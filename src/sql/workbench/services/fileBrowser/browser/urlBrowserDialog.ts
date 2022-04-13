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
import { Event, Emitter } from 'vs/base/common/event';
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
import { Blob, BlobContainer, AzureGraphResource, AzureResourceSubscription, GetBlobsResult } from 'azurecore';
import { IAzureBlobService } from 'sql/platform/azureBlob/common/azureBlobService';


const ERROR_GETTING_BLOB_CONTAINERS = localize('urlBrowserDialog.getBlobContainersError', "Error getting blob containers");

export class UrlBrowserDialog extends Modal {

	private _defaultBackupName: string;

	private _accounts: Account[];
	private _selectedAccount: Account;
	private _subscriptions: AzureResourceSubscription[];
	private _selectedSubscription: AzureResourceSubscription;
	private _storageAccounts: AzureGraphResource[];
	private _selectedStorageAccount: AzureGraphResource;
	private _blobContainers: BlobContainer[];
	private _selectedBlobContainer: BlobContainer;
	private _backupFiles: Blob[];

	private _ownerUri: string;
	private _restoreDialog: boolean;
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
	private _onOk = new Emitter<string>();
	public onOk: Event<string> = this._onOk.event;


	constructor(title: string,
		restoreDialog: boolean,
		defaultBackupName: string,
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
		@IAzureBlobService private _blobService: IAzureBlobService
	) {
		super(title, TelemetryKeys.ModalDialogName.FileBrowser, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'flyout', hasTitleIcon: false, hasBackButton: true, hasSpinner: true });
		this._defaultBackupName = defaultBackupName;
		this._restoreDialog = restoreDialog;
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

		let azureAccountLabel = localize('azurebrowser.account', "Azure Account");
		this._accountSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._accountSelectorBox.setAriaLabel(azureAccountLabel);
		let accountSelector = DialogHelper.appendRow(tableContainer, azureAccountLabel, 'url-input-label', 'url-input-box');
		DialogHelper.appendInputSelectBox(accountSelector, this._accountSelectorBox);
		this._accountManagementService.getAccounts().then((accounts) => this.setAccountSelectorBoxOptions(accounts)).catch((reason) => this.setAccountSelectorBoxError());

		let linkAccountText = localize('urlBrowserDialog.linkAccount', "Link account");
		let linkAccountButton = DialogHelper.appendRow(tableContainer, '', 'file-input-label', 'file-input-box');
		let anchorNode: HTMLAnchorElement = DOM.append(linkAccountButton, DOM.$('a.anchor'));
		anchorNode.title = linkAccountText;
		anchorNode.text = linkAccountText;
		anchorNode.href = '';
		anchorNode.onclick = async (event) => {
			await this._accountManagementService.openAccountListDialog();
		};

		let tenantLabel = localize('azurebrowser.tenant', "Azure AD Tenant");
		this._tenantSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._tenantSelectorBox.setAriaLabel(tenantLabel);
		let tenantSelector = DialogHelper.appendRow(tableContainer, tenantLabel, 'url-input-label', 'url-input-box');
		DialogHelper.appendInputSelectBox(tenantSelector, this._tenantSelectorBox);

		let subscriptionLabel = localize('azurebrowser.subscription', "Azure subscription");
		this._subscriptionSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._subscriptionSelectorBox.setAriaLabel(subscriptionLabel);
		let subscriptionSelector = DialogHelper.appendRow(tableContainer, subscriptionLabel, 'url-input-label', 'url-input-box');
		DialogHelper.appendInputSelectBox(subscriptionSelector, this._subscriptionSelectorBox);

		let storageAccountLabel = localize('azurebrowser.storageAccount', "Storage account");
		this._storageAccountSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._storageAccountSelectorBox.setAriaLabel(storageAccountLabel);
		let storageAccountSelector = DialogHelper.appendRow(tableContainer, storageAccountLabel, 'url-input-label', 'url-input-box');
		DialogHelper.appendInputSelectBox(storageAccountSelector, this._storageAccountSelectorBox);

		let blobContainerLabel = localize('azurebrowser.blobContainer', "Blob container");
		this._blobContainerSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._blobContainerSelectorBox.setAriaLabel(blobContainerLabel);
		let blobContainerSelector = DialogHelper.appendRow(tableContainer, blobContainerLabel, 'url-input-label', 'url-input-box');
		DialogHelper.appendInputSelectBox(blobContainerSelector, this._blobContainerSelectorBox);


		let sharedAccessSignatureLabel = localize('azurebrowser.sharedAccessSignature', "Shared access signature generated");
		let sasInput = DialogHelper.appendRow(tableContainer, sharedAccessSignatureLabel, 'url-input-label', 'url-input-box');
		this._sasInputBox = new InputBox(sasInput, this._contextViewService, { flexibleHeight: true });
		this._sasInputBox.disable();
		this._register(this._sasInputBox.onDidChange(() => this.enableOkButton()));

		let sasButtonLabel = DialogHelper.appendRow(tableContainer, '', 'url-input-label', 'url-input-box');
		this._sasButton = new Button(sasButtonLabel, { title: 'Create Credentials' });
		this._sasButton.label = 'Create Credentials';
		this._sasButton.title = 'Create Credentials';
		this._register(this._sasButton.onDidClick(e => this.generateSharedAccessSignature()));

		let backupFileLabel = localize('azurebrowser.backupFile', "Backup file");
		this._backupFileSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._backupFileSelectorBox.setAriaLabel(backupFileLabel);

		if (this._restoreDialog) {
			let backupFileSelector = DialogHelper.appendRow(tableContainer, backupFileLabel, 'url-input-label', 'url-input-box');
			DialogHelper.appendInputSelectBox(backupFileSelector, this._backupFileSelectorBox);
			this._backupFileSelectorBox.setOptions(['backup-file.bak', 'backup-file2.bak']);
			this._backupFileSelectorBox.select(0);
		} else {
			let fileInput = DialogHelper.appendRow(tableContainer, backupFileLabel, 'url-input-label', 'url-input-box');
			this._backupFileInputBox = new InputBox(fileInput, this._contextViewService, { flexibleHeight: true });
			this.setBackupFileDefaultValue();
		}

		this._okButton = this.addFooterButton(localize('fileBrowser.ok', "OK"), () => this.ok());
		this._okButton.enabled = false;
		this._cancelButton = this.addFooterButton(localize('fileBrowser.discard', "Discard"), () => this.close(), 'right', true);

		this.registerListeners();
	}

	private setAccountSelectorBoxOptions(accounts: Account[]) {
		this._accounts = accounts.filter(account => !account.isStale);
		const accountDisplayNames: string[] = accounts.map(account => account.displayInfo.displayName);
		this._accountSelectorBox.setOptions(accountDisplayNames);
		this._accountSelectorBox.select(0);
	}

	private setAccountSelectorBoxError() {
		this._accountSelectorBox.setOptions([localize('urlBrowserDialog.noLinkedAzureAccount', "Please link Azure account")]);
		this._accountSelectorBox.select(0);
		this._accountSelectorBox.disable();
	}

	private onAccountSelectorBoxChanged(checkedAccount: number) {
		const account = this._accounts[checkedAccount];
		const tenants = account.properties.tenants;
		const tenantsDisplayNames = tenants.map(tenant => tenant.displayName);
		this._tenantSelectorBox.setOptions(tenantsDisplayNames);
		this._tenantSelectorBox.select(0);
	}

	private onTenantSelectorBoxChanged(checkedAccount: number) {
		if (this._accounts) {
			this._selectedAccount = this._accounts[checkedAccount];
			this._azureAccountService.getSubscriptions(this._selectedAccount)
				.then(getSubscriptionResult => this.setSubscriptionsSelectorBoxOptions(getSubscriptionResult.subscriptions))
				.catch(getSubscriptionResult => this.setSubscriptionSelectorBoxError(getSubscriptionResult.error));
		}
	}

	private setSubscriptionsSelectorBoxOptions(subscriptions: AzureResourceSubscription[]) {
		this._subscriptions = subscriptions;
		const subscriptionDisplayNames: string[] = subscriptions.map(subscription => subscription.name);
		this._subscriptionSelectorBox.setOptions(subscriptionDisplayNames);
		this._subscriptionSelectorBox.select(0);
		this._subscriptionSelectorBox.enable();
	}

	private setSubscriptionSelectorBoxError(getSubscriptionsError: any) {
		this._subscriptionSelectorBox.setOptions([localize('urlBrowserDialog.getAzureSubscriptionError', "Error getting Azure subscriptions")]);
		this._subscriptionSelectorBox.disable();
	}

	private onSubscriptionSelectorBoxChanged(checkedSubscription: number) {
		if (this._subscriptions) {
			this._selectedSubscription = this._subscriptions[checkedSubscription];
			this._azureAccountService.getStorageAccounts(this._selectedAccount, [this._selectedSubscription])
				.then(getStorageAccountsResult => this.setStorageAccountSelectorBoxOptions(getStorageAccountsResult.resources))
				.catch(getStorageAccountsResult => this.setStorageAccountSelectorBoxError(getStorageAccountsResult.errors));
		}
	}

	private setStorageAccountSelectorBoxOptions(storageAccounts: AzureGraphResource[]) {
		this._storageAccounts = storageAccounts;
		const storageAccountDisplayNames: string[] = this._storageAccounts.map(storageAccount => storageAccount.name);
		this._storageAccountSelectorBox.setOptions(storageAccountDisplayNames);
		this._storageAccountSelectorBox.select(0);
		this._storageAccountSelectorBox.enable();
	}

	private setStorageAccountSelectorBoxError(errors: any) {
		this._storageAccountSelectorBox.setOptions([localize('urlBrowserDialog.getStorageAccountsError', "Error getting storage accounts")]);
		this._storageAccountSelectorBox.disable();
	}

	private onStorageAccountSelectorBoxChanged(checkedStorageAccount: number) {
		if (this._storageAccounts) {
			this._selectedStorageAccount = this._storageAccounts[checkedStorageAccount];
			this._azureAccountService.getBlobContainers(this._selectedAccount, this._selectedSubscription, this._selectedStorageAccount)
				.then(getBlobContainersResult => this.setBlobContainersSelectorBoxOptions(getBlobContainersResult.blobContainers))
				.catch(getBlobContainersResult => this.setBlobContainersSelectorBoxErrors(getBlobContainersResult.errors));
		}
	}

	private setBlobContainersSelectorBoxOptions(blobContainers: BlobContainer[]) {
		this._blobContainers = blobContainers;
		const blobContainersDisplayNames: string[] = this._blobContainers.map(blobContainer => blobContainer.name);
		this._blobContainerSelectorBox.setOptions(blobContainersDisplayNames);
		this._blobContainerSelectorBox.select(0);
		this._blobContainerSelectorBox.enable();
	}

	private setBlobContainersSelectorBoxErrors(errors: any) {
		this._blobContainers = [];
		this._blobContainerSelectorBox.setOptions([ERROR_GETTING_BLOB_CONTAINERS]);
		this._blobContainerSelectorBox.select(0);
		this._blobContainerSelectorBox.disable();
	}

	private onBlobContainersSelectorBoxChanged(checkedBlobContainer: number) {
		if (this._blobContainers && this._restoreDialog) {
			this._selectedBlobContainer = this._blobContainers[checkedBlobContainer];
			this._azureAccountService.getBlobs(this._selectedAccount, this._selectedSubscription, this._selectedStorageAccount, this._selectedBlobContainer.name, true)
				.then(getBlobsResult => this.setBackupFilesOptions(getBlobsResult))
				.catch(getBlobsResult => this.setBackupFilesSelectorError(getBlobsResult));
		}
		this.enableCreateCredentialsButton();
	}

	private setBackupFilesOptions(getBlobsResult: GetBlobsResult) {
		this._backupFiles = getBlobsResult.blobs;
		const backupFilesDisplayNames: string[] = this._backupFiles.map(backupFile => backupFile.name);
		this._backupFileSelectorBox.setOptions(backupFilesDisplayNames);
		this._backupFileSelectorBox.select(0);
		this._backupFileSelectorBox.enable();
	}

	setBackupFilesSelectorError(getBlobsResult: GetBlobsResult) {
		this._backupFileSelectorBox.setOptions([localize('urlBrowserDialog.getBackupFilesError', "Error getting backup files")]);
		this._backupFileSelectorBox.disable();
	}

	private setBackupFileDefaultValue() {
		this._backupFileInputBox.value = this._defaultBackupName;
	}

	public open(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
	): void {
		this._ownerUri = ownerUri;
		this.enableOkButton();
		this.enableCreateCredentialsButton();
		this.spinner = true;
		this.show();
		this.spinner = false;
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
		if (strings.isFalsyOrWhitespace(this._blobContainerSelectorBox.label) || this._blobContainerSelectorBox.label === ERROR_GETTING_BLOB_CONTAINERS || this._blobContainerSelectorBox.label === '*') {
			this._sasButton.enabled = false;
		} else {
			this._sasButton.enabled = true;
		}
	}

	private ok() {
		let returnValue = '';
		if (this._restoreDialog) {
			returnValue = `https://${this._storageAccountSelectorBox.value}.blob.core.windows.net/${this._blobContainerSelectorBox.value}/${this._backupFileSelectorBox.value}`;
		} else {
			returnValue = `https://${this._storageAccountSelectorBox.value}.blob.core.windows.net/${this._blobContainerSelectorBox.value}/${this._backupFileInputBox.value}`;
		}
		this._onOk.fire(returnValue);
		this.close('ok');
	}


	private close(hideReason: HideReason = 'close'): void {
		this._onOk.dispose();
		this.hide(hideReason);
	}

	private generateSharedAccessSignature() {
		this.spinner = true;
		const blobContainerUri = `https://${this._storageAccountSelectorBox.value}.blob.core.windows.net/${this._blobContainerSelectorBox.value}`;
		this._azureAccountService.getStorageAccountAccessKey(this._selectedAccount, this._selectedSubscription, this._selectedStorageAccount)
			.then(getStorageAccountAccessKeyResult => {
				const key1 = getStorageAccountAccessKeyResult.keyName1;
				this._blobService.createSas(this._ownerUri, blobContainerUri, key1, this._selectedStorageAccount.name, this.nextYear())
					.then(
						result => {
							const sas = result.sharedAccessSignature;
							this._sasInputBox.value = sas;
							this.spinner = false;
						});
			})
			.catch(error => {
				this.spinner = false;
			});

	}

	private nextYear(): string {
		const today = new Date();
		const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDay());
		return nextYear.toLocaleString().split(',')[0];
	}

	private registerListeners(): void {
		this._register(this._accountSelectorBox.onDidSelect(e => this.onAccountSelectorBoxChanged(e.index)));
		this._register(this._tenantSelectorBox.onDidSelect(selectedTenant => this.onTenantSelectorBoxChanged(selectedTenant.index)));
		this._register(this._subscriptionSelectorBox.onDidSelect(selectedSubscription => this.onSubscriptionSelectorBoxChanged(selectedSubscription.index)));
		this._register(this._storageAccountSelectorBox.onDidSelect(selectedStorageAccount => this.onStorageAccountSelectorBoxChanged(selectedStorageAccount.index)));
		this._register(this._blobContainerSelectorBox.onDidSelect(selectedBlobContainer => this.onBlobContainersSelectorBoxChanged(selectedBlobContainer.index)));

		// Theme styler
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
