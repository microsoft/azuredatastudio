/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/panel';

import { Event, Emitter } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { IActionOptions, ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { Color } from 'vs/base/common/color';
import { isUndefinedOrNull } from 'vs/base/common/types';
import * as map from 'vs/base/common/map';

export interface ITabbedPanelStyles {
	titleActiveForeground?: Color;
	titleActiveBorder?: Color;
	titleInactiveForeground?: Color;
	focusBorder?: Color;
	outline?: Color;
}

export interface IPanelOptions {
	showHeaderWhenSingleView?: boolean;
}

export interface IPanelView {
	render(container: HTMLElement): void;
	layout(dimension: DOM.Dimension): void;
	focus(): void;
	remove?(): void;
	onShow?(): void;
	onHide?(): void;
}

export interface IPanelTab {
	title: string;
	identifier: string;
	view: IPanelView;
	tabSelectedHandler?(): void;
}

interface IInternalPanelTab {
	tab: IPanelTab;
	header: HTMLElement;
	disposables: DisposableStore;
	label: HTMLElement;
	body?: HTMLElement;
	destroyTabBody?: boolean;
}

const defaultOptions: IPanelOptions = {
	showHeaderWhenSingleView: true
};

export type PanelTabIdentifier = string;

export class TabbedPanel extends Disposable {
	private _tabMap = new Map<PanelTabIdentifier, IInternalPanelTab>();
	private _shownTabId?: PanelTabIdentifier;
	public readonly headersize = 35;
	private header: HTMLElement;
	private tabList: HTMLElement;
	private body: HTMLElement;
	private parent: HTMLElement;
	private _actionbar: ActionBar;
	private _currentDimensions: DOM.Dimension;
	private _collapsed = false;
	private _headerVisible: boolean;
	private _styleElement: HTMLStyleElement;

	private _onTabChange = new Emitter<PanelTabIdentifier>();
	public onTabChange: Event<PanelTabIdentifier> = this._onTabChange.event;

	private tabHistory: string[] = [];
	private _tabOrder: PanelTabIdentifier[] = [];

	constructor(container: HTMLElement, private options: IPanelOptions = defaultOptions) {
		super();
		this.parent = DOM.$('.tabbedPanel');
		this._styleElement = DOM.createStyleSheet(this.parent);
		container.appendChild(this.parent);
		this.header = DOM.$('.composite.title');
		this.header.setAttribute('tabindex', '0');
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
		this.parent.appendChild(this.body);
		this._register(DOM.addDisposableListener(this.header, DOM.EventType.FOCUS, e => this.focusCurrentTab()));
	}

	public dispose() {
		this.header.remove();
		this.tabList.remove();
		this.body.remove();
		this.parent.remove();
		this._styleElement.remove();
	}

	public contains(tab: IPanelTab): boolean {
		return this._tabMap.has(tab.identifier);
	}

	public pushTab(tab: IPanelTab, index?: number, destroyTabBody?: boolean): PanelTabIdentifier {
		let internalTab = { tab } as IInternalPanelTab;
		internalTab.disposables = new DisposableStore();
		internalTab.destroyTabBody = destroyTabBody;
		this._tabMap.set(tab.identifier, internalTab);
		this._createTab(internalTab, index);
		if (!this._shownTabId) {
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

	private _createTab(tab: IInternalPanelTab, index?: number): void {
		let tabHeaderElement = DOM.$('.tab-header');
		tabHeaderElement.setAttribute('tabindex', '-1');
		tabHeaderElement.setAttribute('role', 'tab');
		tabHeaderElement.setAttribute('aria-selected', 'false');
		tabHeaderElement.setAttribute('aria-controls', tab.tab.identifier);
		let tabElement = DOM.$('.tab');
		tabHeaderElement.appendChild(tabElement);
		let tabLabel = DOM.$('a.tabLabel');
		tabLabel.innerText = tab.tab.title;
		tabElement.appendChild(tabLabel);
		const invokeTabSelectedHandler = () => {
			if (tab.tab.tabSelectedHandler) {
				tab.tab.tabSelectedHandler();
			}
		};
		tab.disposables.add(DOM.addDisposableListener(tabHeaderElement, DOM.EventType.CLICK, e => {
			this.showTab(tab.tab.identifier);
			invokeTabSelectedHandler();
		}));

		tab.disposables.add(DOM.addDisposableListener(tabHeaderElement, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.showTab(tab.tab.identifier);
				invokeTabSelectedHandler();
				e.stopImmediatePropagation();
			}
			if (event.equals(KeyCode.RightArrow)) {
				let currentIndex = this._tabOrder.findIndex(x => x === tab.tab.identifier);
				this.focusNextTab(currentIndex + 1);
			}
			if (event.equals(KeyCode.LeftArrow)) {
				let currentIndex = this._tabOrder.findIndex(x => x === tab.tab.identifier);
				this.focusNextTab(currentIndex - 1);
			}
			if (event.equals(KeyCode.Tab)) {
				e.preventDefault();
				if (this._shownTabId) {
					const shownTab = this._tabMap.get(this._shownTabId);
					if (shownTab) {
						shownTab.tab.view.focus();
					}
				}
			}
		}));

		const insertBefore = !isUndefinedOrNull(index) ? this.tabList.children.item(index) : undefined;
		if (insertBefore) {
			this._tabOrder.copyWithin(index! + 1, index!);
			this._tabOrder[index!] = tab.tab.identifier;
			this.tabList.insertBefore(tabHeaderElement, insertBefore);
		} else {
			this.tabList.append(tabHeaderElement);
			this._tabOrder.push(tab.tab.identifier);
		}
		tab.header = tabHeaderElement;
		tab.label = tabLabel;
	}

	public showTab(id: PanelTabIdentifier): void {
		if (this._shownTabId === id || !this._tabMap.has(id)) {
			return;
		}

		if (this._shownTabId) {
			const shownTab = this._tabMap.get(this._shownTabId);
			if (shownTab) {
				DOM.removeClass(shownTab.label, 'active');
				DOM.removeClass(shownTab.header, 'active');
				shownTab.header.setAttribute('aria-selected', 'false');
				if (shownTab.body) {
					shownTab.body.remove();
					if (shownTab.tab.view.onHide) {
						shownTab.tab.view.onHide();
					}
				}
			}
		}

		this._shownTabId = id;
		this.tabHistory.push(id);
		const tab = this._tabMap.get(this._shownTabId)!; // @anthonydresser we know this can't be undefined since we check further up if the map contains the id

		if (tab.destroyTabBody && tab.body) {
			tab.body.remove();
			tab.body = undefined;
		}

		if (!tab.body) {
			tab.body = DOM.$('.tab-container');
			tab.body.style.width = '100%';
			tab.body.style.height = '100%';
			tab.tab.view.render(tab.body);
		}
		this.body.appendChild(tab.body);
		this.body.setAttribute('aria-labelledby', tab.tab.identifier);
		DOM.addClass(tab.label, 'active');
		DOM.addClass(tab.header, 'active');
		tab.header.setAttribute('aria-selected', 'true');
		this._onTabChange.fire(id);
		if (tab.tab.view.onShow) {
			tab.tab.view.onShow();
		}
		if (this._currentDimensions) {
			this._layoutCurrentTab(new DOM.Dimension(this._currentDimensions.width, this._currentDimensions.height - this.headersize));
		}
	}

	public removeTab(tab: PanelTabIdentifier) {
		const actualTab = this._tabMap.get(tab);
		if (!actualTab) {
			return;
		}
		if (actualTab.tab.view && actualTab.tab.view.remove) {
			actualTab.tab.view.remove();
		}
		if (actualTab.header && actualTab.header.remove) {
			actualTab.header.remove();
		}
		if (actualTab.body && actualTab.body.remove) {
			actualTab.body.remove();
		}
		actualTab.disposables.dispose();
		this._tabMap.delete(tab);
		let index = this._tabOrder.findIndex(t => t === tab);
		this._tabOrder.splice(index, 1);
		if (this._shownTabId === tab) {
			this._shownTabId = undefined;
			while (this._shownTabId === undefined && this.tabHistory.length > 0) {
				let lastTab = this.tabHistory.shift();
				if (lastTab) {
					if (this._tabMap.get(lastTab)) {
						this.showTab(lastTab);
					}
				}
			}
			if (!this._shownTabId && this._tabMap.size > 0) {
				this.showTab(map.values(this._tabMap)[0].tab.identifier);
			}
		}

		if (!this.options.showHeaderWhenSingleView && this._tabMap.size === 1 && this._headerVisible) {
			this.header.remove();
			this._headerVisible = false;
			this.layout(this._currentDimensions);
		}
	}

	private focusNextTab(index: number): void {
		if (index < 0 || index > this.tabList.children.length) {
			return;
		}
		let tab = (<HTMLElement>this.tabList.children[index]);
		if (tab) {
			tab.focus();
		}
	}

	private focusCurrentTab(): void {
		if (this._shownTabId) {
			const tab = this._tabMap.get(this._shownTabId);
			if (tab) {
				tab.header.focus();
			}
		}
	}

	public style(styles: ITabbedPanelStyles): void {
		const content: string[] = [];

		if (styles.titleActiveForeground && styles.titleActiveBorder) {
			content.push(`
			.tabbedPanel > .title .tabList .tab:hover .tabLabel,
			.tabbedPanel > .title .tabList .tab .tabLabel.active {
				color: ${styles.titleActiveForeground};
				border-bottom-color: ${styles.titleActiveBorder};
				border-bottom-width: 2px;
			}

			.tabbedPanel > .title .tabList .tab-header.active {
				outline: none;
			}`);
		}

		if (styles.titleInactiveForeground) {
			content.push(`
			.tabbedPanel > .title .tabList .tab .tabLabel {
				color: ${styles.titleInactiveForeground};
			}`);
		}

		if (styles.focusBorder && styles.titleActiveForeground) {
			content.push(`
			.tabbedPanel > .title .tabList .tab .tabLabel:focus {
				color: ${styles.titleActiveForeground};
				border-bottom-color: ${styles.focusBorder} !important;
				border-bottom: 1px solid;
				outline: none;
			}`);
		}

		if (styles.outline) {
			content.push(`
			.tabbedPanel > .title .tabList .tab-header.active,
			.tabbedPanel > .title .tabList .tab-header:hover {
				outline-color: ${styles.outline};
				outline-width: 1px;
				outline-style: solid;
				padding-bottom: 0;
				outline-offset: -5px;
			}

			.tabbedPanel > .title .tabList .tab-header:hover:not(.active) {
				outline-style: dashed;
			}`);
		}

		const newStyles = content.join('\n');
		if (newStyles !== this._styleElement.innerHTML) {
			this._styleElement.innerHTML = newStyles;
		}
	}

	public layout(dimension: DOM.Dimension): void {
		if (dimension) {
			this._currentDimensions = dimension;
			this.parent.style.height = dimension.height + 'px';
			this.header.style.width = dimension.width + 'px';
			this.body.style.width = dimension.width + 'px';
			const bodyHeight = dimension.height - (this._headerVisible ? this.headersize : 0);
			this.body.style.height = bodyHeight + 'px';
			this._layoutCurrentTab(new DOM.Dimension(dimension.width, bodyHeight));
		}
	}

	private _layoutCurrentTab(dimension: DOM.Dimension): void {
		if (this._shownTabId) {
			const tab = this._tabMap.get(this._shownTabId);
			if (tab && tab.body) {
				tab.body.style.width = dimension.width + 'px';
				tab.body.style.height = dimension.height + 'px';
				tab.tab.view.layout(dimension);
			}
		}
	}

	public focus(): void {
		if (this._shownTabId) {
			const tab = this._tabMap.get(this._shownTabId);
			if (tab) {
				tab.tab.view.focus();
			}
		}
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
