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
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
//import { FileBrowserTreeView } from 'sql/workbench/services/fileBrowser/browser/fileBrowserTreeView';
import { FileBrowserViewModel } from 'sql/workbench/services/fileBrowser/common/fileBrowserViewModel';
//import { AzureApi } from 'sql/extension';
//import { AzureResourceSubscription } from 'sql/base/azureapi/common/azureResource/azureResource';

import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
//import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { attachButtonStyler, attachInputBoxStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import * as DOM from 'vs/base/browser/dom';
import * as strings from 'vs/base/common/strings';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Account } from 'azdata';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

export class FileBrowserDialog extends Modal {
	//private _azureApi: AzureApi;
	private _accounts: Account[];
	private _restoreDialog: boolean;
	private _viewModel: FileBrowserViewModel;
	private _body: HTMLElement;
	private _accountSelectorBox: SelectBox;
	//private _linkAccountButton: Button;
	private _tenantSelectorBox: SelectBox;
	private _subscriptionSelectorBox: SelectBox;
	private _storageAccountSelectorBox: SelectBox;
	private _blobContainerSelectorBox: SelectBox;
	private _sasInputBox: InputBox;
	private _sasButton: Button;
	private _backupFileSelectorBox: SelectBox;
	//private _filePathInputBox: InputBox;
	//private _fileFilterSelectBox: SelectBox;
	private _okButton: Button;
	private _cancelButton: Button;
	private _onOk = new Emitter<string>();
	public onOk: Event<string> = this._onOk.event;

	//private _treeContainer: HTMLElement;
	//private _fileBrowserTreeView: FileBrowserTreeView;
	//private _selectedFilePath: string;
	//private _isFolderSelected: boolean;

	constructor(title: string,
		restoreDialog: boolean,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IAccountManagementService private _accountManagementService: IAccountManagementService
	) {
		super(title, TelemetryKeys.ModalDialogName.FileBrowser, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'flyout', hasTitleIcon: false, hasBackButton: true, hasSpinner: true });
		this._viewModel = this._instantiationService.createInstance(FileBrowserViewModel);
		this._viewModel.onAddFileTree(args => this.handleOnAddFileTree(args.rootNode, args.selectedNode, args.expandedNodes).catch(err => onUnexpectedError(err)));
		this._viewModel.onPathValidate(args => this.handleOnValidate(args.succeeded, args.message));
		this._restoreDialog = restoreDialog;
		//this._azureApi = new AzureApi();
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

		//this._treeContainer = DOM.append(this._body, DOM.$('.tree-view'));

		let tableContainer: HTMLElement = DOM.append(DOM.append(this._body, DOM.$('.option-section')), DOM.$('table.file-table-content'));
		tableContainer.setAttribute('role', 'presentation');

		let azureAccountLabel = localize('azurebrowser.account', "Azure Account");
		this._accountSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._accountSelectorBox.setAriaLabel(azureAccountLabel);
		let accountSelector = DialogHelper.appendRow(tableContainer, azureAccountLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(accountSelector, this._accountSelectorBox);
		this._accountSelectorBox.onDidSelect(e => this.onAccountSelectorBoxChanged(e.index));
		this._accountManagementService.getAccounts().then((accounts) => this.setAccountSelectorBoxOptions(accounts)).catch((reason) => this.setAccountSelectorBoxError());

		let linkAccountButton = DialogHelper.appendRow(tableContainer, '', 'file-input-label', 'file-input-box');
		let anchorNode: HTMLAnchorElement = DOM.append(linkAccountButton, DOM.$('a.anchor'));
		anchorNode.title = 'Link account';
		anchorNode.text = 'Link account';
		anchorNode.href = 'https://google.com';
		/*this._linkAccountButton = new Button(linkAccountButton, { title: 'Link account' });
		this._linkAccountButton.label = 'Link account';
		this._linkAccountButton.title = 'Link account';*/

		let tenantLabel = localize('azurebrowser.tenant', "Azure AD Tenant");
		this._tenantSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._tenantSelectorBox.setAriaLabel(tenantLabel);
		let tenantSelector = DialogHelper.appendRow(tableContainer, tenantLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(tenantSelector, this._tenantSelectorBox);
		this._tenantSelectorBox.onDidSelect(selectedTenant => this.onTenantSelectorBoxChanged(selectedTenant.index));

		let subscriptionLabel = localize('azurebrowser.subscription', "Azure subscription");
		this._subscriptionSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._subscriptionSelectorBox.setAriaLabel(subscriptionLabel);
		let subscriptionSelector = DialogHelper.appendRow(tableContainer, subscriptionLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(subscriptionSelector, this._subscriptionSelectorBox);
		this._subscriptionSelectorBox.setOptions(['Subscription 1', 'Subscription 2']);
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


		let sharedAccessSignatureLabel = localize('azurebrowser.sharedAccessSignature', "Shared access signature generated");
		let sasInput = DialogHelper.appendRow(tableContainer, sharedAccessSignatureLabel, 'file-input-label', 'file-input-box');
		this._sasInputBox = new InputBox(sasInput, this._contextViewService, { flexibleHeight: true });

		let sasButtonLabel = DialogHelper.appendRow(tableContainer, '', 'file-input-label', 'file-input-box');
		this._sasButton = new Button(sasButtonLabel, { title: 'Create Credentials' });
		this._sasButton.label = 'Create Credentials';
		this._sasButton.title = 'Create Credentials';

		let backupFileLabel = localize('azurebrowser.backupFile', "Backup file");
		this._backupFileSelectorBox = new SelectBox(['*'], '*', this._contextViewService);
		this._backupFileSelectorBox.setAriaLabel(backupFileLabel);

		if (this._restoreDialog) {
			let backupFileSelector = DialogHelper.appendRow(tableContainer, backupFileLabel, 'file-input-label', 'file-input-box');
			DialogHelper.appendInputSelectBox(backupFileSelector, this._backupFileSelectorBox);
			this._backupFileSelectorBox.setOptions(['backup-file.bak', 'backup-file2.bak']);
			this._backupFileSelectorBox.select(0);
		}

		/*let pathLabel = localize('filebrowser.filepath', "Selected path");
		let pathBuilder = DialogHelper.appendRow(tableContainer, pathLabel, 'file-input-label', 'file-input-box');
		this._filePathInputBox = new InputBox(pathBuilder, this._contextViewService, {
			ariaLabel: pathLabel
		});*/


		/*let filterLabel = localize('fileFilter', "Files of type");
		this._fileFilterSelectBox = new SelectBox(['*'], '*', this._contextViewService);
		this._fileFilterSelectBox.setAriaLabel(filterLabel);
		let filterBuilder = DialogHelper.appendRow(tableContainer, filterLabel, 'file-input-label', 'file-input-box');
		DialogHelper.appendInputSelectBox(filterBuilder, this._fileFilterSelectBox);*/

		this._okButton = this.addFooterButton(localize('fileBrowser.ok', "OK"), () => this.ok());
		this._okButton.enabled = false;
		this._cancelButton = this.addFooterButton(localize('fileBrowser.discard', "Discard"), () => this.close(), 'right', true);

		this.registerListeners();
		this.updateTheme();
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
	}

	private onTenantSelectorBoxChanged(checkedAccount: number) {
		//if (this._accounts) {
		//const selectedAccount = this._accounts[checkedAccount];
		//this._azureApi.getSubscriptions(selectedAccount);
		//.then(getSubscriptionResult => this.changeSubscriptionSelectorBoxOptions(getSubscriptionResult.subscriptions));
		//}
		//
		//.catch(getSubscriptionResult => this.printErrorInSubscriptionSelectorBox(getSubscriptionResult.error)));
	}

	//private changeSubscriptionSelectorBoxOptions(subscriptions: AzureResourceSubscription[]) {
	//	const subscriptionDisplayNames: string[] = subscriptions.map(subscription => subscription.name);
	//	this._subscriptionSelectorBox.setOptions(subscriptionDisplayNames);
	//}

	//private printErrorInSubscriptionSelectorBox(getSubscriptionResult: any) {

	//}

	public open(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
	): void {
		this._viewModel.initialize(ownerUri, expandPath, fileFilters, fileValidationServiceType);
		//this._fileFilterSelectBox.setOptions(this._viewModel.formattedFileFilters);
		//this._fileFilterSelectBox.select(0);
		//this._filePathInputBox.value = expandPath;
		//this._isFolderSelected = true;
		this.enableOkButton();
		this.spinner = true;
		this.show();

		//this._fileBrowserTreeView = this._instantiationService.createInstance(FileBrowserTreeView);
		//this._fileBrowserTreeView.setOnClickedCallback((arg) => this.onClicked(arg));
		//this._fileBrowserTreeView.setOnDoubleClickedCallback((arg) => this.onDoubleClicked(arg));
		this._viewModel.openFileBrowser(0, false).catch(err => onUnexpectedError(err));
	}

	/* enter key */
	protected override onAccept() {
		let selectedValue = this._sasInputBox.value;
		if (this._okButton.enabled === true && selectedValue !== '') {
			this.ok();
		}
	}

	private async handleOnAddFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): Promise<void> {
		await this.updateFileTree(rootNode, selectedNode, expandedNodes);
		this.spinner = false;
	}

	private enableOkButton() {
		//if (strings.isFalsyOrWhitespace(this._selectedFilePath) || this._isFolderSelected === true) {
		if (strings.isFalsyOrWhitespace(this._blobContainerSelectorBox.value)) {
			this._okButton.enabled = false;
		} else {
			this._okButton.enabled = true;
		}
		//} else {
		//	this._okButton.enabled = true;
		//}
	}

	/*private onClicked(selectedNode: FileNode) {
		this._filePathInputBox.value = selectedNode.fullPath;

		//if (selectedNode.isFile === true) {
		//	this._isFolderSelected = false;
		//} else {
		//	this._isFolderSelected = true;
		//}

		this.enableOkButton();
	}

	private onDoubleClicked(selectedNode: FileNode) {
		if (selectedNode.isFile === true) {
			this.ok();
		}
	}*/

	/*private onFilePathChange(filePath: string) {
		//this._isFolderSelected = false;
		//this._selectedFilePath = filePath;

		//this._filePathInputBox.hideMessage();
		this.enableOkButton();
	}*/

	/*private async onFilePathBlur(params: OnLoseFocusParams): Promise<boolean> {
		if (!strings.isFalsyOrWhitespace(params.value)) {
			return this._viewModel.validateFilePaths([params.value]);
		}
		return true;
	}*/

	private ok() {
		this._onOk.fire(this._blobContainerSelectorBox.value);
		this.close('ok');
	}

	private handleOnValidate(succeeded: boolean, errorMessage: string) {
		if (succeeded === false) {
			if (strings.isFalsyOrWhitespace(errorMessage)) {
				errorMessage = 'The provided path is invalid.';
			}
			//this._filePathInputBox.showMessage({ type: MessageType.ERROR, content: errorMessage });
		}
	}

	private close(hideReason: HideReason = 'close'): void {
		//if (this._fileBrowserTreeView) {
		//	this._fileBrowserTreeView.dispose();
		//}
		this._onOk.dispose();
		this.hide(hideReason);
		this._viewModel.closeFileBrowser().catch(err => onUnexpectedError(err));
	}

	private async updateFileTree(rootNode: FileNode, selectedNode: FileNode, expandedNodes: FileNode[]): Promise<void> {
		//await this._fileBrowserTreeView.renderBody(this._treeContainer, rootNode, selectedNode, expandedNodes);
		//this._fileBrowserTreeView.setVisible(true);
		//this._fileBrowserTreeView.layout(DOM.getTotalHeight(this._treeContainer));
	}

	/*private async onFilterSelectChanged(filterIndex): Promise<void> {
		this.spinner = true;
		await this._viewModel.openFileBrowser(filterIndex, true);
	}*/

	private registerListeners(): void {
		/*this._register(this._fileFilterSelectBox.onDidSelect(selectData => {
			this.onFilterSelectChanged(selectData.index).catch(err => onUnexpectedError(err));
		}));*/
		/*this._register(this._filePathInputBox.onDidChange(e => {
			this.onFilePathChange(e);
		}));
		this._register(this._filePathInputBox.onLoseFocus((params: OnLoseFocusParams) => {
			this.onFilePathBlur(params).catch(err => onUnexpectedError(err));
		}));*/

		// Theme styler
		this._register(attachSelectBoxStyler(this._tenantSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._accountSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._subscriptionSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._storageAccountSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._blobContainerSelectorBox, this._themeService));
		this._register(attachSelectBoxStyler(this._backupFileSelectorBox, this._themeService));
		this._register(attachInputBoxStyler(this._sasInputBox, this._themeService));
		this._register(attachButtonStyler(this._sasButton, this._themeService));
		//this._register(attachButtonStyler(this._linkAccountButton, this._themeService));
		//this._register(attachInputBoxStyler(this._filePathInputBox, this._themeService));
		//this._register(attachSelectBoxStyler(this._fileFilterSelectBox, this._themeService));
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));

		this._register(this._themeService.onDidColorThemeChange(e => this.updateTheme()));
	}

	// Update theming that is specific to file browser
	private updateTheme(): void {
		//if (this._treeContainer) {
		//	this._treeContainer.style.backgroundColor = this.headerAndFooterBackground;
		//}
	}
}
