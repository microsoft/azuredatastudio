/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!./media/accountPicker';
import { Builder } from 'sql/base/browser/builder';
import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IDropdownOptions } from 'vs/base/browser/ui/dropdown/dropdown';
import { IListEvent } from 'vs/base/browser/ui/list/list';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { buttonBackground } from 'vs/platform/theme/common/colorRegistry';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';

import * as sqlops from 'sqlops';
import { DropdownList } from 'sql/base/browser/ui/dropdownList/dropdownList';
import { attachDropdownStyler } from 'sql/platform/theme/common/styler';
import { AddAccountAction, RefreshAccountAction } from 'sql/parts/accountManagement/common/accountActions';
import { AccountPickerListRenderer, AccountListDelegate } from 'sql/parts/accountManagement/common/accountListRenderer';
import { AccountPickerViewModel } from 'sql/platform/accountManagement/common/accountPickerViewModel';

export class AccountPicker extends Disposable {
	public static ACCOUNTPICKERLIST_HEIGHT = 47;
	public viewModel: AccountPickerViewModel;
	private _accountList: List<sqlops.Account>;
	private _rootElement: HTMLElement;
	private _refreshContainer: HTMLElement;
	private _listContainer: HTMLElement;
	private _dropdown: DropdownList;
	private _refreshAccountAction: RefreshAccountAction;

	// EVENTING ////////////////////////////////////////////////////////////
	private _addAccountCompleteEmitter: Emitter<void>;
	public get addAccountCompleteEvent(): Event<void> { return this._addAccountCompleteEmitter.event; }

	private _addAccountErrorEmitter: Emitter<string>;
	public get addAccountErrorEvent(): Event<string> { return this._addAccountErrorEmitter.event; }

	private _addAccountStartEmitter: Emitter<void>;
	public get addAccountStartEvent(): Event<void> { return this._addAccountStartEmitter.event; }

	private _onAccountSelectionChangeEvent: Emitter<sqlops.Account>;
	public get onAccountSelectionChangeEvent(): Event<sqlops.Account> { return this._onAccountSelectionChangeEvent.event; }

	constructor(
		private _providerId: string,
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextViewService private _contextViewService: IContextViewService
	) {
		super();

		// Create event emitters
		this._addAccountCompleteEmitter = new Emitter<void>();
		this._addAccountErrorEmitter = new Emitter<string>();
		this._addAccountStartEmitter = new Emitter<void>();
		this._onAccountSelectionChangeEvent = new Emitter<sqlops.Account>();

		// Create the view model, wire up the events, and initialize with baseline data
		this.viewModel = this._instantiationService.createInstance(AccountPickerViewModel, this._providerId);
		this.viewModel.updateAccountListEvent(arg => {
			if (arg.providerId === this._providerId) {
				this.updateAccountList(arg.accountList);
			}
		});
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Render account picker
	 */
	public render(container: HTMLElement): void {
		DOM.append(container, this._rootElement);
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	/**
	 * Create account picker component
	 */
	public createAccountPickerComponent() {
		// Create an account list
		let delegate = new AccountListDelegate(AccountPicker.ACCOUNTPICKERLIST_HEIGHT);
		let accountRenderer = new AccountPickerListRenderer();
		this._listContainer = DOM.$('div.account-list-container');
		this._accountList = new List<sqlops.Account>(this._listContainer, delegate, [accountRenderer]);
		this._register(attachListStyler(this._accountList, this._themeService));

		this._rootElement = DOM.$('div.account-picker-container');

		// Create a dropdown for account picker
		let option: IDropdownOptions = {
			contextViewProvider: this._contextViewService,
			labelRenderer: (container) => this.renderLabel(container)
		};

		// Create the add account action
		let addAccountAction = this._instantiationService.createInstance(AddAccountAction, this._providerId);
		addAccountAction.addAccountCompleteEvent(() => this._addAccountCompleteEmitter.fire());
		addAccountAction.addAccountErrorEvent((msg) => this._addAccountErrorEmitter.fire(msg));
		addAccountAction.addAccountStartEvent(() => this._addAccountStartEmitter.fire());

		this._dropdown = this._register(new DropdownList(this._rootElement, option, this._listContainer, this._accountList, this._themeService, addAccountAction));
		this._register(attachDropdownStyler(this._dropdown, this._themeService));
		this._register(this._accountList.onSelectionChange((e: IListEvent<sqlops.Account>) => {
			if (e.elements.length === 1) {
				this._dropdown.renderLabel();
				this.onAccountSelectionChange(e.elements[0]);
			}
		}));

		// Create refresh account action
		this._refreshContainer = DOM.append(this._rootElement, DOM.$('div.refresh-container'));
		DOM.append(this._refreshContainer, DOM.$('div.sql icon warning'));
		let actionBar = new ActionBar(this._refreshContainer, { animated: false });
		this._refreshAccountAction = this._instantiationService.createInstance(RefreshAccountAction);
		actionBar.push(this._refreshAccountAction, { icon: false, label: true });

		if (this._accountList.length > 0) {
			this._accountList.setSelection([0]);
			this.onAccountSelectionChange(this._accountList.getSelectedElements()[0]);
		} else {
			new Builder(this._refreshContainer).hide();
		}

		this._register(this._themeService.onThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getTheme());

		// Load the initial contents of the view model
		this.viewModel.initialize()
			.then((accounts: sqlops.Account[]) => {
				this.updateAccountList(accounts);
			});
	}

	public dispose() {
		super.dispose();
		if (this._accountList) {
			this._accountList.dispose();
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private onAccountSelectionChange(account: sqlops.Account) {
		this.viewModel.selectedAccount = account;
		if (account && account.isStale) {
			this._refreshAccountAction.account = account;
			new Builder(this._refreshContainer).show();
		} else {
			new Builder(this._refreshContainer).hide();
		}

		this._onAccountSelectionChangeEvent.fire(account);
	}

	private renderLabel(container: HTMLElement): IDisposable {
		if (container.hasChildNodes()) {
			for (let i = 0; i < container.childNodes.length; i++) {
				container.removeChild(container.childNodes.item(i));
			}
		}

		let selectedAccounts = this._accountList.getSelectedElements();
		let account = selectedAccounts ? selectedAccounts[0] : null;
		if (account) {
			const badge = DOM.$('div.badge');
			const row = DOM.append(container, DOM.$('div.selected-account-container'));
			const icon = DOM.append(row, DOM.$('div.icon'));
			DOM.append(icon, badge);
			const badgeContent = DOM.append(badge, DOM.$('div.badge-content'));
			const label = DOM.append(row, DOM.$('div.label'));

			// Set the account icon
			icon.classList.add('icon', account.displayInfo.accountType);

			// TODO: Pick between the light and dark logo
			label.innerText = account.displayInfo.displayName + ' (' + account.displayInfo.contextualDisplayName + ')';

			if (account.isStale) {
				badgeContent.className = 'badge-content icon warning-badge';
			} else {
				badgeContent.className = 'badge-content';
			}
		} else {
			const row = DOM.append(container, DOM.$('div.no-account-container'));
			row.innerText = AddAccountAction.LABEL + '...';
		}
		return null;
	}

	private updateAccountList(accounts: sqlops.Account[]): void {
		// keep the selection to the current one
		let selectedElements = this._accountList.getSelectedElements();

		// find selected index
		let selectedIndex: number;
		if (selectedElements.length > 0 && accounts.length > 0) {
			selectedIndex = accounts.findIndex((account) => {
				return (account.key.accountId === selectedElements[0].key.accountId);
			});
		}

		// Replace the existing list with the new one
		this._accountList.splice(0, this._accountList.length, accounts);

		if (this._accountList.length > 0) {
			if (selectedIndex && selectedIndex !== -1) {
				this._accountList.setSelection([selectedIndex]);
			} else {
				this._accountList.setSelection([0]);
			}
		} else {
			// if the account is empty, re-render dropdown label
			this.onAccountSelectionChange(undefined);
			this._dropdown.renderLabel();
		}

		this._accountList.layout(this._accountList.contentHeight);
	}

	/**
	 * Update theming that is specific to account picker
	 */
	private updateTheme(theme: ITheme): void {
		let linkColor = theme.getColor(buttonBackground);
		let link = linkColor ? linkColor.toString() : null;
		this._refreshContainer.style.color = link;
		if (this._refreshContainer) {
			this._refreshContainer.style.color = link;
		}
	}
}