/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/accountDialog';
import 'vs/css!./media/accountActions';
import * as DOM from 'vs/base/browser/dom';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachButtonStyler, attachListStyler } from 'vs/platform/theme/common/styler';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { MenuId, Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { IContextKeyService, ContextKeyEqualsExpr } from 'vs/platform/contextkey/common/contextkey';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import * as azdata from 'azdata';

import { Button } from 'sql/base/browser/ui/button/button';
import { SqlIconId } from 'sql/base/common/codicons';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import { AccountViewModel } from 'sql/platform/accounts/common/accountViewModel';
import { AddAccountAction } from 'sql/platform/accounts/common/accountActions';
import { AccountListRenderer, AccountListDelegate } from 'sql/workbench/services/accountManagement/browser/accountListRenderer';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accounts/common/eventTypes';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPane';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { attachModalDialogStyler, attachPanelStyler } from 'sql/workbench/common/styler';
import { IViewDescriptorService, IViewsRegistry, Extensions as ViewContainerExtensions, IViewContainersRegistry, ViewContainerLocation } from 'vs/workbench/common/views';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { Iterable } from 'vs/base/common/iterator';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { Tenant, TenantListDelegate, TenantListRenderer } from 'sql/workbench/services/accountManagement/browser/tenantListRenderer';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

export const VIEWLET_ID = 'workbench.view.accountpanel';

export class AccountPaneContainer extends ViewPaneContainer {

}

export const ACCOUNT_VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: VIEWLET_ID,
	title: localize('accountExplorer.name', "Accounts"),
	ctorDescriptor: new SyncDescriptor(AccountPaneContainer),
	storageId: `${VIEWLET_ID}.state`
}, ViewContainerLocation.Dialog);

class AccountPanel extends ViewPane {
	public index?: number;
	private accountList?: List<azdata.Account>;
	private tenantList?: List<Tenant>;


	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IThemeService themeService: IThemeService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	protected override renderBody(container: HTMLElement): void {
		this.accountList = new List<azdata.Account>('AccountList', container, new AccountListDelegate(AccountDialog.ACCOUNTLIST_HEIGHT), [this.instantiationService.createInstance(AccountListRenderer)]);
		this.tenantList = new List<Tenant>('TenantList', container, new TenantListDelegate(AccountDialog.ACCOUNTLIST_HEIGHT), [this.instantiationService.createInstance(TenantListRenderer)]);
		this._register(attachListStyler(this.accountList, this.themeService));
		this._register(attachListStyler(this.tenantList, this.themeService));

		// Temporary workaround for https://github.com/microsoft/azuredatastudio/issues/14808 so that we can close an accessibility issue.
		this.tenantList.getHTMLElement().tabIndex = -1;
	}

	protected override layoutBody(size: number): void {
		this.accountList?.layout(size);
		this.tenantList?.layout(size);
	}

	public get length(): number {
		return this.accountList!.length;
	}

	public override focus() {
		this.accountList!.domFocus();
	}

	public updateAccounts(accounts: azdata.Account[]) {
		this.accountList!.splice(0, this.accountList!.length, accounts);
	}

	public setSelection(indexes: number[]) {
		this.accountList!.setSelection(indexes);
		this.updateTenants(this.accountList!.getSelectedElements()[0]);
	}

	private updateTenants(account: azdata.Account) {
		this.tenantList!.splice(0, this.tenantList!.length, account.properties?.tenants ?? []);
	}
}

export interface IProviderViewUiComponent {
	view: AccountPanel;
	addAccountAction: AddAccountAction;
}

export class AccountDialog extends Modal {
	public static ACCOUNTLIST_HEIGHT = 77;

	public viewModel: AccountViewModel;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _providerViewsMap = new Map<string, IProviderViewUiComponent>();
	private _loadingSpinner: LoadingSpinner;

	private _closeButton?: Button;
	private _addAccountButton?: Button;
	private _splitView?: SplitView;
	private _container?: HTMLElement;
	private _splitViewContainer?: HTMLElement;
	private _noaccountViewContainer?: HTMLElement;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onAddAccountErrorEmitter: Emitter<string>;
	public get onAddAccountErrorEvent(): Event<string> { return this._onAddAccountErrorEmitter.event; }

	private _onCloseEmitter: Emitter<void>;
	public get onCloseEvent(): Event<void> { return this._onCloseEmitter.event; }

	constructor(
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@IViewDescriptorService private viewDescriptorService: IViewDescriptorService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@INotificationService private _notificationService: INotificationService,
		@IOpenerService protected readonly openerService: IOpenerService,
		@ITelemetryService private readonly vstelemetryService: ITelemetryService,
		@IAccountManagementService private readonly _accountManagementService: IAccountManagementService,
	) {
		super(
			localize('linkedAccounts', "Linked accounts"),
			TelemetryKeys.ModalDialogName.Accounts,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService
		);

		// Setup the event emitters
		this._onAddAccountErrorEmitter = new Emitter<string>();
		this._onCloseEmitter = new Emitter<void>();

		// Create the view model and wire up the events
		this.viewModel = this._instantiationService.createInstance(AccountViewModel);
		this.viewModel.addProviderEvent(arg => { this.addProvider(arg); });
		this.viewModel.removeProviderEvent(arg => { this.removeProvider(arg); });
		this.viewModel.updateAccountListEvent(arg => { this.updateProviderAccounts(arg); });

		// Load the initial contents of the view model
		this.viewModel.initialize()
			.then(addedProviders => {
				for (const addedProvider of addedProviders) {
					this.addProvider(addedProvider);
				}
			});
	}

	// MODAL OVERRIDE METHODS //////////////////////////////////////////////
	protected layout(_height?: number): void {
		this._splitView!.layout(DOM.getContentHeight(this._container!));
	}

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this._closeButton = this.addFooterButton(localize('accountDialog.close', "Close"), () => this.close());
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		this._container = container;

		this._loadingSpinner = new LoadingSpinner(this._container, { showText: true, fullSize: true });

		this._splitViewContainer = DOM.$('div.account-view.monaco-pane-view');
		DOM.append(container, this._splitViewContainer);
		this._splitView = new SplitView(this._splitViewContainer);

		this._noaccountViewContainer = DOM.$('div.no-account-view');
		const noAccountTitle = DOM.append(this._noaccountViewContainer, DOM.$('.no-account-view-label'));
		const noAccountLabel = localize('accountDialog.noAccountLabel', "There is no linked account. Please add an account.");
		noAccountTitle.innerText = noAccountLabel;

		// Show the add account button for the first provider
		// Todo: If we have more than 1 provider, need to show all add account buttons for all providers
		const buttonSection = DOM.append(this._noaccountViewContainer, DOM.$('div.button-section'));
		this._addAccountButton = new Button(buttonSection);
		this._addAccountButton.label = localize('accountDialog.addConnection', "Add an account");

		this._register(this._addAccountButton.onDidClick(async () => {
			await this.runAddAccountAction();
		}));

		DOM.append(container, this._noaccountViewContainer);
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachButtonStyler(this._closeButton!, this._themeService));
		this._register(attachButtonStyler(this._addAccountButton!, this._themeService));
	}

	/* Overwrite escape key behavior */
	protected override onClose() {
		this.close();
	}

	/* Overwrite enter key behavior */
	protected override onAccept() {
		this.close('ok');
	}

	public close(hideReason: HideReason = 'close') {
		this._onCloseEmitter.fire();
		this.hide(hideReason);
	}

	public async open() {
		let accountMetadata = await this._accountManagementService.getAccountProviderMetadata();
		this.show();
		if (!this.isEmptyLinkedAccount()) {
			this.showSplitView();
		}
		else if (accountMetadata.length === 0) {
			this.showLoadingSpinner();
		}
		else {
			this.showNoAccountContainer();
		}

	}

	private showNoAccountContainer() {
		this._loadingSpinner.loading = false;
		this._splitViewContainer!.hidden = true;
		this._noaccountViewContainer!.hidden = false;
		this._addAccountButton!.focus();
	}

	private showLoadingSpinner() {
		this._loadingSpinner.loadingMessage = localize('accountDialog.loadingProviderLabel', "Loading accounts...");
		this._loadingSpinner.loading = true;
		this._splitViewContainer!.hidden = true;
		this._noaccountViewContainer!.hidden = true;
	}

	private showSplitView() {
		this._loadingSpinner.loading = false;
		this._splitViewContainer!.hidden = false;
		this._noaccountViewContainer!.hidden = true;
		if (Iterable.consume(this._providerViewsMap.values()).length > 0) {
			const firstView = this._providerViewsMap.values().next().value;
			if (firstView && firstView.view instanceof AccountPanel) {
				firstView.view.setSelection([0]);
				firstView.view.focus();
			}
		}
	}

	private isEmptyLinkedAccount(): boolean {
		for (const provider of this._providerViewsMap.values()) {
			const listView = provider.view;
			if (listView && listView.length > 0) {
				return false;
			}
		}
		return true;
	}

	public override dispose(): void {
		super.dispose();
		for (const provider of this._providerViewsMap.values()) {
			if (provider.addAccountAction) {
				provider.addAccountAction.dispose();
			}
			if (provider.view) {
				provider.view.dispose();
			}
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private addProvider(newProvider: AccountProviderAddedEventParams) {

		this.logService.debug(`Adding new provider ${newProvider.addedProvider.id}`);
		// Skip adding the provider if it already exists
		if (this._providerViewsMap.get(newProvider.addedProvider.id)) {
			this.logService.debug(`Provider ${newProvider.addedProvider.id} is already registered!`);
			return;
		}

		// Account provider doesn't exist, so add it
		// Create a scoped add account action
		let addAccountAction = this._instantiationService.createInstance(
			AddAccountAction,
			newProvider.addedProvider.id
		);
		addAccountAction.addAccountErrorEvent(msg => this._onAddAccountErrorEmitter.fire(msg));

		let providerView = new AccountPanel(
			{
				id: newProvider.addedProvider.id,
				title: newProvider.addedProvider.displayName
			},
			this._keybindingService,
			this._contextMenuService,
			this._configurationService,
			this._themeService,
			this.contextKeyService,
			this._instantiationService,
			this.viewDescriptorService,
			this.openerService,
			this.vstelemetryService
		);

		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
			id: newProvider.addedProvider.id,
			name: newProvider.addedProvider.displayName,
			ctorDescriptor: new SyncDescriptor(AccountPanel),
		}], ACCOUNT_VIEW_CONTAINER);

		this.registerActions(newProvider.addedProvider.id);

		attachPanelStyler(providerView, this._themeService);

		const insertIndex = this._splitView!.length;
		providerView.render();

		// Append the list view to the split view
		this._splitView!.addView(providerView, Sizing.Distribute, insertIndex);
		providerView.index = insertIndex;

		this._splitView!.layout(DOM.getContentHeight(this._container!));

		// Set the initial items of the list
		providerView.updateAccounts(newProvider.initialAccounts);

		if (newProvider.initialAccounts.length > 0 && this._splitViewContainer!.hidden) {
			this.showSplitView();
		}

		this.layout();

		this.logService.debug(`Storing view for provider ${newProvider.addedProvider.id}`);
		// Store the view for the provider and action
		this._providerViewsMap.set(newProvider.addedProvider.id, { view: providerView, addAccountAction: addAccountAction });
	}

	private removeProvider(removedProvider: azdata.AccountProviderMetadata) {
		this.logService.debug(`Removing provider ${removedProvider.id}`);
		// Skip removing the provider if it doesn't exist
		const providerView = this._providerViewsMap.get(removedProvider.id);
		if (!providerView || !providerView.view) {
			this.logService.warn(`Provider ${removedProvider.id} doesn't exist while removing`);
			return;
		}

		// Remove the list view from the split view
		this._splitView!.removeView(providerView.view.index!);
		this._splitView!.layout(DOM.getContentHeight(this._container!));

		// Remove the list view from our internal map
		this._providerViewsMap.delete(removedProvider.id);
		this.logService.debug(`Provider ${removedProvider.id} removed`);
		this.layout();
	}

	private updateProviderAccounts(args: UpdateAccountListEventParams) {
		const providerMapping = this._providerViewsMap.get(args.providerId);
		if (!providerMapping || !providerMapping.view) {
			return;
		}
		providerMapping.view.updateAccounts(args.accountList);

		if (args.accountList.length > 0 && this._splitViewContainer!.hidden) {
			this.showSplitView();
		}

		if (this.isEmptyLinkedAccount() && this._noaccountViewContainer!.hidden) {
			this.showNoAccountContainer();
		}

		this.layout();
	}

	private registerActions(viewId: string) {
		const that = this;
		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.accountDialog.${viewId}.addAccount`,
					title: { value: localize('accountDialog.addConnection', "Add an account"), original: 'Add an account' },
					f1: true,
					icon: { id: SqlIconId.addAccountAction },
					menu: {
						id: MenuId.ViewTitle,
						group: 'navigation',
						when: ContextKeyEqualsExpr.create('view', viewId),
						order: 1
					}
				});
			}

			async run() {
				await that.runAddAccountAction();
			}
		});
	}

	private async runAddAccountAction() {
		this.logService.debug(`Adding account - providers ${JSON.stringify(Iterable.consume(this._providerViewsMap.keys()))}`);
		const vals = Iterable.consume(this._providerViewsMap.values())[0];
		let pickedValue: string | undefined;
		if (vals.length === 0) {
			this._notificationService.error(localize('accountDialog.noCloudsRegistered', "You have no clouds enabled. Go to Settings -> Search Azure Account Configuration -> Enable at least one cloud"));
			return;
		}
		if (vals.length > 1) {
			const buttons: IQuickPickItem[] = vals.map(v => {
				return { label: v.view.title } as IQuickPickItem;
			});

			const picked = await this._quickInputService.pick(buttons, { canPickMany: false });

			pickedValue = picked?.label;
		} else {
			pickedValue = vals[0].view.title;
		}

		const v = vals.filter(v => v.view.title === pickedValue)?.[0];

		if (!v) {
			this._notificationService.error(localize('accountDialog.didNotPickAuthProvider', "You didn't select any authentication provider. Please try again."));
			return;
		}

		v.addAccountAction.run();
	}
}
