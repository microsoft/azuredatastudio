/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/accountDialog';
import 'vs/css!sql/parts/accountManagement/common/media/accountActions';
import * as DOM from 'vs/base/browser/dom';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IAction } from 'vs/base/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { values } from 'vs/base/common/map';

import * as sqlops from 'sqlops';

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler, attachButtonStyler, attachPanelStyler } from 'sql/platform/theme/common/styler';
import { AccountViewModel } from 'sql/parts/accountManagement/accountDialog/accountViewModel';
import { AddAccountAction } from 'sql/parts/accountManagement/common/accountActions';
import { AccountListRenderer, AccountListDelegate } from 'sql/parts/accountManagement/common/accountListRenderer';
import { AccountProviderAddedEventParams, UpdateAccountListEventParams } from 'sql/platform/accountManagement/common/eventTypes';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import * as TelemetryKeys from 'sql/common/telemetryKeys';

class AccountPanel extends ViewletPanel {
	public index: number;
	private accountList: List<sqlops.Account>;

	constructor(
		private options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IThemeService private themeService: IThemeService
	) {
		super(options, keybindingService, contextMenuService, configurationService);
	}

	protected renderBody(container: HTMLElement): void {
		this.accountList = new List<sqlops.Account>(container, new AccountListDelegate(AccountDialog.ACCOUNTLIST_HEIGHT), [this.instantiationService.createInstance(AccountListRenderer)]);
		this.disposables.push(attachListStyler(this.accountList, this.themeService));
	}

	protected layoutBody(size: number): void {
		if (this.accountList) {
			this.accountList.layout(size);
		}
	}

	public get length(): number {
		return this.accountList.length;
	}

	public focus() {
		this.accountList.domFocus();
	}

	public updateAccounts(accounts: sqlops.Account[]) {
		this.accountList.splice(0, this.accountList.length, accounts);
	}

	public setSelection(indexes: number[]) {
		this.accountList.setSelection(indexes);
	}

	public getActions(): IAction[] {
		return [this.instantiationService.createInstance(
			AddAccountAction,
			this.options.id
		)];
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

	private _closeButton: Button;
	private _addAccountButton: Button;
	private _splitView: SplitView;
	private _container: HTMLElement;
	private _splitViewContainer: HTMLElement;
	private _noaccountViewContainer: HTMLElement;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onAddAccountErrorEmitter: Emitter<string>;
	public get onAddAccountErrorEvent(): Event<string> { return this._onAddAccountErrorEmitter.event; }

	private _onCloseEmitter: Emitter<void>;
	public get onCloseEvent(): Event<void> { return this._onCloseEmitter.event; }

	constructor(
		@IPartService partService: IPartService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super(
			localize('linkedAccounts', 'Linked accounts'),
			TelemetryKeys.Accounts,
			partService,
			telemetryService,
			clipboardService,
			themeService,
			contextKeyService,
			{ hasSpinner: true }
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
				for (let addedProvider of addedProviders) {
					this.addProvider(addedProvider);
				}
			});
	}

	// MODAL OVERRIDE METHODS //////////////////////////////////////////////
	protected layout(height?: number): void {
		this._splitView.layout(DOM.getContentHeight(this._container));
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this._closeButton = this.addFooterButton(localize('accountDialog.close', 'Close'), () => this.close());
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		this._container = container;
		this._splitViewContainer = DOM.$('div.account-view.monaco-panel-view');
		DOM.append(container, this._splitViewContainer);
		this._splitView = new SplitView(this._splitViewContainer);

		this._noaccountViewContainer = DOM.$('div.no-account-view');
		let noAccountTitle = DOM.append(this._noaccountViewContainer, DOM.$('.no-account-view-label'));
		let noAccountLabel = localize('accountDialog.noAccountLabel', 'There is no linked account. Please add an account.');
		noAccountTitle.innerText = noAccountLabel;

		// Show the add account button for the first provider
		// Todo: If we have more than 1 provider, need to show all add account buttons for all providers
		let buttonSection = DOM.append(this._noaccountViewContainer, DOM.$('div.button-section'));
		this._addAccountButton = new Button(buttonSection);
		this._addAccountButton.label = localize('accountDialog.addConnection', 'Add an account');
		this._register(this._addAccountButton.onDidClick(() => {
			(<IProviderViewUiComponent>values(this._providerViewsMap)[0]).addAccountAction.run();
		}));

		DOM.append(container, this._noaccountViewContainer);
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachButtonStyler(this._closeButton, this._themeService));
		this._register(attachButtonStyler(this._addAccountButton, this._themeService));
	}

	/* Overwrite escape key behavior */
	protected onClose() {
		this.close();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.close();
	}

	public close() {
		this._onCloseEmitter.fire();
		this.hide();
	}

	public open() {
		this.show();
		if (!this.isEmptyLinkedAccount()) {
			this.showSplitView();
		} else {
			this.showNoAccountContainer();
		}

	}

	private showNoAccountContainer() {
		this._splitViewContainer.hidden = true;
		this._noaccountViewContainer.hidden = false;
		this._addAccountButton.focus();
	}

	private showSplitView() {
		this._splitViewContainer.hidden = false;
		this._noaccountViewContainer.hidden = true;
		if (values(this._providerViewsMap).length > 0) {
			let firstView = values(this._providerViewsMap)[0];
			if (firstView instanceof AccountPanel) {
				firstView.setSelection([0]);
				firstView.focus();
			}
		}
	}

	private isEmptyLinkedAccount(): boolean {
		for (let provider of values(this._providerViewsMap)) {
			let listView = provider.view;
			if (listView && listView.length > 0) {
				return false;
			}
		}
		return true;
	}

	public dispose(): void {
		super.dispose();
		for (let provider of values(this._providerViewsMap)) {
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

		// Skip adding the provider if it already exists
		if (this._providerViewsMap.get(newProvider.addedProvider.id)) {
			return;
		}

		// Account provider doesn't exist, so add it
		// Create a scoped add account action
		let addAccountAction = this._instantiationService.createInstance(
			AddAccountAction,
			newProvider.addedProvider.id
		);
		addAccountAction.addAccountCompleteEvent(() => { this.hideSpinner(); });
		addAccountAction.addAccountErrorEvent(msg => { this._onAddAccountErrorEmitter.fire(msg); });
		addAccountAction.addAccountStartEvent(() => { this.showSpinner(); });

		let providerView = new AccountPanel(
			{
				id: newProvider.addedProvider.id,
				title: newProvider.addedProvider.displayName,
				ariaHeaderLabel: newProvider.addedProvider.displayName
			},
			this._keybindingService,
			this._contextMenuService,
			this._configurationService,
			this._instantiationService,
			this._themeService
		);

		attachPanelStyler(providerView, this._themeService);

		const insertIndex = this._splitView.length;
		// Append the list view to the split view
		this._splitView.addView(providerView, Sizing.Distribute, insertIndex);
		providerView.render();
		providerView.index = insertIndex;

		this._splitView.layout(DOM.getContentHeight(this._container));

		// Set the initial items of the list
		providerView.updateAccounts(newProvider.initialAccounts);

		if (newProvider.initialAccounts.length > 0 && this._splitViewContainer.hidden) {
			this.showSplitView();
		}

		this.layout();

		// Store the view for the provider and action
		this._providerViewsMap.set(newProvider.addedProvider.id, { view: providerView, addAccountAction: addAccountAction });
	}

	private removeProvider(removedProvider: sqlops.AccountProviderMetadata) {
		// Skip removing the provider if it doesn't exist
		let providerView = this._providerViewsMap.get(removedProvider.id);
		if (!providerView || !providerView.view) {
			return;
		}

		// Remove the list view from the split view
		this._splitView.removeView(providerView.view.index);
		this._splitView.layout(DOM.getContentHeight(this._container));

		// Remove the list view from our internal map
		this._providerViewsMap.delete(removedProvider.id);
		this.layout();
	}

	private updateProviderAccounts(args: UpdateAccountListEventParams) {
		let providerMapping = this._providerViewsMap.get(args.providerId);
		if (!providerMapping || !providerMapping.view) {
			return;
		}
		providerMapping.view.updateAccounts(args.accountList);

		if (args.accountList.length > 0 && this._splitViewContainer.hidden) {
			this.showSplitView();
		}

		if (this.isEmptyLinkedAccount() && this._noaccountViewContainer.hidden) {
			this.showNoAccountContainer();
		}

		this.layout();
	}
}
