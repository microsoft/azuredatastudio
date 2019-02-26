/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemable } from 'vs/platform/theme/common/styler';
import { Event, Emitter } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { IActionOptions, ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import './panelStyles';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';

export interface IPanelStyles {
}

export interface IPanelOptions {
	showHeaderWhenSingleView?: boolean;
}

export interface IPanelView {
	render(container: HTMLElement): void;
	layout(dimension: DOM.Dimension): void;
	remove?(): void;
}

export interface IPanelTab {
	title: string;
	identifier: string;
	view: IPanelView;
}

interface IInternalPanelTab extends IPanelTab {
	header: HTMLElement;
	disposables: IDisposable[];
	label: HTMLElement;
	body: HTMLElement;
}

const defaultOptions: IPanelOptions = {
	showHeaderWhenSingleView: true
};

export type PanelTabIdentifier = string;

export class TabbedPanel extends Disposable implements IThemable {
	private _tabMap = new Map<PanelTabIdentifier, IInternalPanelTab>();
	private _shownTab: PanelTabIdentifier;
	public readonly headersize = 35;
	private header: HTMLElement;
	private tabList: HTMLElement;
	private body: HTMLElement;
	private parent: HTMLElement;
	private _actionbar: ActionBar;
	private _currentDimensions: DOM.Dimension;
	private _collapsed = false;
	private _headerVisible: boolean;

	private _onTabChange = new Emitter<PanelTabIdentifier>();
	public onTabChange: Event<PanelTabIdentifier> = this._onTabChange.event;

	private tabHistory: string[] = [];

	constructor(container: HTMLElement, private options: IPanelOptions = defaultOptions) {
		super();
		this.parent = DOM.$('.tabbedPanel');
		container.appendChild(this.parent);
		this.header = DOM.$('.composite.title');
		this.tabList = DOM.$('.tabList');
		this.tabList.setAttribute('role', 'tablist');
		this.tabList.style.height = this.headersize + 'px';
		this.header.appendChild(this.tabList);
		let actionbarcontainer = DOM.$('.title-actions');
		this._actionbar = new ActionBar(actionbarcontainer);
		this.header.appendChild(actionbarcontainer);
		if (options.showHeaderWhenSingleView) {
			this._headerVisible = true;
			this.parent.appendChild(this.header);
		} else {
			this._headerVisible = false;
		}
		this.body = DOM.$('.tabBody');
		this.body.setAttribute('role', 'tabpanel');
		this.body.setAttribute('tabindex', '0');
		this.parent.appendChild(this.body);
	}

	public dispose() {
		this.header.remove();
		this.tabList.remove();
		this.body.remove();
		this.parent.remove();
	}

	public contains(tab: IPanelTab): boolean {
		return this._tabMap.has(tab.identifier);
	}

	public pushTab(tab: IPanelTab): PanelTabIdentifier {
		let internalTab = tab as IInternalPanelTab;
		internalTab.disposables = [];
		this._tabMap.set(tab.identifier, internalTab);
		this._createTab(internalTab);
		if (!this._shownTab) {
			this.showTab(tab.identifier);
		}
		if (this._tabMap.size > 1 && !this._headerVisible) {
			this.parent.insertBefore(this.header, this.parent.firstChild);
			this._headerVisible = true;
			this.layout(this._currentDimensions);
		}
		return tab.identifier as PanelTabIdentifier;
	}

	public pushAction(arg: IAction | IAction[], options: IActionOptions = {}): void {
		this._actionbar.push(arg, options);
	}

	public set actionBarContext(context: any) {
		this._actionbar.context = context;
	}

	private _createTab(tab: IInternalPanelTab): void {
		let tabHeaderElement = DOM.$('.tab-header');
		tabHeaderElement.setAttribute('tabindex', '0');
		tabHeaderElement.setAttribute('role', 'tab');
		tabHeaderElement.setAttribute('aria-selected', 'false');
		tabHeaderElement.setAttribute('aria-controls', tab.identifier);
		let tabElement = DOM.$('.tab');
		tabHeaderElement.appendChild(tabElement);
		let tabLabel = DOM.$('a.tabLabel');
		tabLabel.innerText = tab.title;
		tabElement.appendChild(tabLabel);
		tab.disposables.push(DOM.addDisposableListener(tabHeaderElement, DOM.EventType.CLICK, e => this.showTab(tab.identifier)));
		tab.disposables.push(DOM.addDisposableListener(tabHeaderElement, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.showTab(tab.identifier);
				e.stopImmediatePropagation();
			}
		}));
		this.tabList.appendChild(tabHeaderElement);
		tab.header = tabHeaderElement;
		tab.label = tabLabel;
	}

	public showTab(id: PanelTabIdentifier): void {
		if (this._shownTab && this._shownTab === id) {
			return;
		}

		if (this._shownTab) {
			DOM.removeClass(this._tabMap.get(this._shownTab).label, 'active');
			DOM.removeClass(this._tabMap.get(this._shownTab).header, 'active');
			this._tabMap.get(this._shownTab).header.setAttribute('aria-selected', 'false');
		}

		let prevTab = this._tabMap.get(this._shownTab);
		if (prevTab) {
			prevTab.body.remove();
		}

		this._shownTab = id;
		this.tabHistory.push(id);
		let tab = this._tabMap.get(this._shownTab);
		if (!tab.body) {
			tab.body = DOM.$('.tab-container');
			tab.body.style.width = '100%';
			tab.body.style.height = '100%';
			tab.view.render(tab.body);
		}
		this.body.appendChild(tab.body);
		this.body.setAttribute('aria-labelledby', tab.identifier);
		DOM.addClass(tab.label, 'active');
		DOM.addClass(tab.header, 'active');
		tab.header.setAttribute('aria-selected', 'true');
		this._onTabChange.fire(id);
		if (this._currentDimensions) {
			this._layoutCurrentTab(new DOM.Dimension(this._currentDimensions.width, this._currentDimensions.height - this.headersize));
		}
	}

	public removeTab(tab: PanelTabIdentifier) {
		let actualTab = this._tabMap.get(tab);
		if (actualTab.view.remove) {
			actualTab.view.remove();
		}
		actualTab.header.remove();
		actualTab.body.remove();
		dispose(actualTab.disposables);
		this._tabMap.delete(tab);
		if (this._shownTab === tab) {
			this._shownTab = undefined;
			while (this._shownTab === undefined && this.tabHistory.length > 0) {
				let lastTab = this.tabHistory.shift();
				if (this._tabMap.get(lastTab)) {
					this.showTab(lastTab);
				}
			}

			// this shouldn't happen but just in case
			if (this._shownTab === undefined && this._tabMap.size > 0) {
				this.showTab(this._tabMap.keys().next().value);
			}
		}

		if (!this.options.showHeaderWhenSingleView && this._tabMap.size === 1 && this._headerVisible) {
			this.header.remove();
			this._headerVisible = false;
			this.layout(this._currentDimensions);
		}
	}

	public style(styles: IPanelStyles): void {

	}

	public layout(dimension: DOM.Dimension): void {
		if (dimension) {
			this._currentDimensions = dimension;
			this.parent.style.height = dimension.height + 'px';
			this.parent.style.height = dimension.width + 'px';
			this.header.style.width = dimension.width + 'px';
			this.body.style.width = dimension.width + 'px';
			const bodyHeight = dimension.height - (this._headerVisible ? this.headersize : 0);
			this.body.style.height = bodyHeight + 'px';
			this._layoutCurrentTab(new DOM.Dimension(dimension.width, bodyHeight));
		}
	}

	private _layoutCurrentTab(dimension: DOM.Dimension): void {
		if (this._shownTab) {
			let tab = this._tabMap.get(this._shownTab);
			tab.body.style.width = dimension.width + 'px';
			tab.body.style.height = dimension.height + 'px';
			tab.view.layout(dimension);
		}
	}

	public focus(): void {

	}

	public set collapsed(val: boolean) {
		if (val === this._collapsed) {
			return;
		}

		this._collapsed = val === false ? false : true;
		if (this.collapsed) {
			this.body.remove();
		} else {
			this.parent.appendChild(this.body);
		}
	}

	public get collapsed(): boolean {
		return this._collapsed;
	}
}
