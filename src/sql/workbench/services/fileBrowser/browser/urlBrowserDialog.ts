/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/fileBrowserDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { InputBox, /*OnLoseFocusParams*/ } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
//import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
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

export class UrlBrowserDialog extends Modal {
	private _accounts: Account[];
	private _restoreDialog: boolean;
	//private _viewModel: FileBrowserViewModel;
	private _body: HTMLElement;
	private _accountSelectorBox: SelectBox;
	private _tenantSelectorBox: SelectBox;
	private _subscriptionSelectorBox: SelectBox;
	private _storageAccountSelectorBox: SelectBox;
	private _blobContainerSelectorBox: SelectBox;
	private _sasInputBox: InputBox;
	private _sasButton: Button;
	private _backupFileSelectorBox: SelectBox;
	private _okButton: Button;
	private _cancelButton: Button;
	private _onOk = new Emitter<string>();
	public onOk: Event<string> = this._onOk.event;


	constructor(title: string,
		restoreDialog: boolean,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		//@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super(title, TelemetryKeys.ModalDialogName.FileBrowser, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'flyout', hasTitleIcon: false, hasBackButton: true, hasSpinner: true });
		//this._viewModel = this._instantiationService.createInstance(FileBrowserViewModel);
		//this._viewModel.onAddFileTree(args => this.handleOnAddFileTree(args.rootNode, args.selectedNode, args.expandedNodes).catch(err => onUnexpectedError(err)));
		//this._viewModel.onPathValidate(args => this.handleOnValidate(args.succeeded, args.message));
		this._restoreDialog = restoreDialog;
	}

	protected layout(height?: number): void {
	}

	protected renderBody(container: HTMLElement) {
		this._body = DOM.append(container, DOM.$('.file-browser-dialog'));
	}

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {

			this.backButton.onDidClick(() => {
				this.close();
			});

			this._register(attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND }));
		}

		let tableContainer: HTMLElement = DOM.append(DOM.append(this._body, DOM.$('.option-section')), DOM.$('table.file-table-content'));
		tableContainer.setAttribute('role', 'presentation');

		let azureAccountLabel = localize('azurebrowser.account', "Azure Account");
		this._accountSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._accountSelectorBox.setAriaLabel(azureAccountLabel);
		let accountSelector = DialogHelper.appendRow(tableContainer, azureAccountLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(accountSelector, this._accountSelectorBox);
		this._accountManagementService.getAccounts().then((accounts) => this.setAccountSelectorBoxOptions(accounts)).catch((reason) => this.setAccountSelectorBoxError());

		let linkAccountButton = DialogHelper.appendRow(tableContainer, '', 'file-input-label', 'file-input-box');
		let anchorNode: HTMLAnchorElement = DOM.append(linkAccountButton, DOM.$('a.anchor'));
		anchorNode.title = 'Link account';
		anchorNode.text = 'Link account';
		anchorNode.href = 'https://google.com';
		anchorNode.onclick = async (event) => {
			await this._accountManagementService.openAccountListDialog();
		};

		let tenantLabel = localize('azurebrowser.tenant', "Azure AD Tenant");
		this._tenantSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._tenantSelectorBox.setAriaLabel(tenantLabel);
		let tenantSelector = DialogHelper.appendRow(tableContainer, tenantLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(tenantSelector, this._tenantSelectorBox);

		let subscriptionLabel = localize('azurebrowser.subscription', "Azure subscription");
		this._subscriptionSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._subscriptionSelectorBox.setAriaLabel(subscriptionLabel);
		let subscriptionSelector = DialogHelper.appendRow(tableContainer, subscriptionLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(subscriptionSelector, this._subscriptionSelectorBox);
		this._subscriptionSelectorBox.setOptions(['Storage account 1', 'Storage account 2']);
		this._subscriptionSelectorBox.select(0);

		let storageAccountLabel = localize('azurebrowser.storageAccount', "Storage account");
		this._storageAccountSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._storageAccountSelectorBox.setAriaLabel(storageAccountLabel);
		let storageAccountSelector = DialogHelper.appendRow(tableContainer, storageAccountLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(storageAccountSelector, this._storageAccountSelectorBox);
		this._storageAccountSelectorBox.setOptions(['Storage account 1', 'Storage account 2']);
		this._storageAccountSelectorBox.select(0);

		let blobContainerLabel = localize('azurebrowser.blobContainer', "Blob container");
		this._blobContainerSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._blobContainerSelectorBox.setAriaLabel(blobContainerLabel);
		let blobContainerSelector = DialogHelper.appendRow(tableContainer, blobContainerLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(blobContainerSelector, this._blobContainerSelectorBox);
		this._blobContainerSelectorBox.setOptions(['Blob container 1', 'Blob container 2']);
		this._blobContainerSelectorBox.select(0);
		this._blobContainerSelectorBox.onDidSelect(() => this.enableOkButton());


		let sharedAccessSignatureLabel = localize('azurebrowser.sharedAccessSignature', "Shared access signature generated");
		let sasInput = DialogHelper.appendRow(tableContainer, sharedAccessSignatureLabel, 'file-input-label', 'file-input-box');
		this._sasInputBox = new InputBox(sasInput, this._contextViewService, { flexibleHeight: true });
		this._sasInputBox.onDidChange(() => this.enableOkButton());

		let sasButtonLabel = DialogHelper.appendRow(tableContainer, '', 'file-input-label', 'file-input-box');
		this._sasButton = new Button(sasButtonLabel, { title: 'Create Credentials' });
		this._sasButton.label = 'Create Credentials';
		this._sasButton.title = 'Create Credentials';
		this._sasButton.onDidClick(e => this.generateSharedAccessSignature());

		let backupFileLabel = localize('azurebrowser.backupFile', "Backup file");
		this._backupFileSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._backupFileSelectorBox.setAriaLabel(backupFileLabel);

		if (this._restoreDialog) {
			let backupFileSelector = DialogHelper.appendRow(tableContainer, backupFileLabel, 'file-input-label', 'file-input-box');
			DialogHelper.appendInputSelectBox(backupFileSelector, this._backupFileSelectorBox);
			this._backupFileSelectorBox.setOptions(['backup-file.bak', 'backup-file2.bak']);
			this._backupFileSelectorBox.select(0);
		}

		this._okButton = this.addFooterButton(localize('fileBrowser.ok', "OK"), () => this.ok());
		this._okButton.enabled = false;
		this._cancelButton = this.addFooterButton(localize('fileBrowser.discard', "Discard"), () => this.close(), 'right', true);

		this.registerListeners();
	}

	private setAccountSelectorBoxOptions(accounts: Account[]) {
		this._accounts = accounts;
		const accountDisplayNames: string[] = accounts.map(account => account.displayInfo.displayName);
		this._accountSelectorBox.setOptions(accountDisplayNames);
		this._accountSelectorBox.select(0);
	}

	private setAccountSelectorBoxError() {
		this._accountSelectorBox.setOptions(['Please link Azure account']);
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

	/*private onTenantSelectorBoxChanged(checkedAccount: number) {
		if (this._accounts) {
			const selectedAccount = this._accounts[checkedAccount];
			this._azureApi.getSubscriptions(selectedAccount)
				.then(getSubscriptionResult => this.changeSubscriptionSelectorBoxOptions(getSubscriptionResult.subscriptions))
				.catch(getSubscriptionResult => this.printErrorInSubscriptionSelectorBox(getSubscriptionResult.error));
		}
	}

	private changeSubscriptionSelectorBoxOptions(subscriptions: AzureResourceSubscription[]) {
		const subscriptionDisplayNames: string[] = subscriptions.map(subscription => subscription.name);
		this._subscriptionSelectorBox.setOptions(subscriptionDisplayNames);
		this._subscriptionSelectorBox.select(0);
	}

	private printErrorInSubscriptionSelectorBox(getSubscriptionResult: any) {
	}*/

	public open(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
	): void {
		this.enableOkButton();
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
		if (strings.isFalsyOrWhitespace(this._blobContainerSelectorBox.value) || strings.isFalsyOrWhitespace(this._sasInputBox.value)) {
			this._okButton.enabled = false;
		} else {
			this._okButton.enabled = true;
		}
	}

	private ok() {
		this._onOk.fire(this._blobContainerSelectorBox.value);
		this.close('ok');
	}


	private close(hideReason: HideReason = 'close'): void {
		this._onOk.dispose();
		this.hide(hideReason);
	}

	private generateSharedAccessSignature() {
		this._sasInputBox.value = 'mocked shared access signature';
	}

	private registerListeners(): void {
		this._register(this._accountSelectorBox.onDidSelect(e => this.onAccountSelectorBoxChanged(e.index)));
		//this._register(this._tenantSelectorBox.onDidSelect(selectedTenant => this.onTenantSelectorBoxChanged(selectedTenant.index)));

		// Theme styler
		this._register(attachSelectBoxStyler(this._tenantSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._accountSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._subscriptionSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._storageAccountSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._blobContainerSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._backupFileSelectorBox, this._themeService));
		this._register(attachInputBoxStyler(this._sasInputBox, this._themeService));
		this._register(attachButtonStyler(this._sasButton, this._themeService));
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));

	}


}
