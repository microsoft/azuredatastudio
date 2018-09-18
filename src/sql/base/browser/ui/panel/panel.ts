/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemable } from 'vs/platform/theme/common/styler';
import { Event, Emitter } from 'vs/base/common/event';
import { Dimension, EventType } from 'vs/base/browser/dom';
import { $, Builder } from 'vs/base/browser/builder';
import { IAction } from 'vs/base/common/actions';
import { IActionOptions, ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import './panelStyles';
import { Disposable } from 'vs/base/common/lifecycle';

export interface IPanelStyles {
}

export interface IPanelOptions {
	showHeaderWhenSingleView?: boolean;
}

export interface IPanelView {
	render(container: HTMLElement): void;
	layout(dimension: Dimension): void;
	remove?(): void;
}

export interface IPanelTab {
	title: string;
	identifier: string;
	view: IPanelView;
}

interface IInternalPanelTab extends IPanelTab {
	header: Builder;
	label: Builder;
	dispose(): void;
}

const defaultOptions: IPanelOptions = {
	showHeaderWhenSingleView: true
};

export type PanelTabIdentifier = string;

export class TabbedPanel extends Disposable implements IThemable {
	private _tabMap = new Map<PanelTabIdentifier, IInternalPanelTab>();
	private _shownTab: PanelTabIdentifier;
	public readonly headersize = 35;
	private $header: Builder;
	private $tabList: Builder;
	private $body: Builder;
	private $parent: Builder;
	private _actionbar: ActionBar;
	private _currentDimensions: Dimension;
	private _collapsed = false;
	private _headerVisible: boolean;

	private _onTabChange = new Emitter<PanelTabIdentifier>();
	public onTabChange: Event<PanelTabIdentifier> = this._onTabChange.event;

	private tabHistory: string[] = [];

	constructor(private container: HTMLElement, private options: IPanelOptions = defaultOptions) {
		super();
		this.$parent = this._register($('.tabbedPanel'));
		this.$parent.appendTo(container);
		this.$header = $('.composite.title');
		this.$tabList = $('.tabList');
		this.$tabList.attr('role', 'tablist');
		this.$tabList.style('height', this.headersize + 'px');
		this.$header.append(this.$tabList);
		let actionbarcontainer = $('.title-actions');
		this._actionbar = new ActionBar(actionbarcontainer.getHTMLElement());
		this.$header.append(actionbarcontainer);
		if (options.showHeaderWhenSingleView) {
			this._headerVisible = true;
			this.$parent.append(this.$header);
		} else {
			this._headerVisible = false;
		}
		this.$body = $('.tabBody');
		this.$body.attr('role', 'tabpanel');
		this.$body.attr('tabindex', '0');
		this.$parent.append(this.$body);
	}

	public contains(tab: IPanelTab): boolean {
		return this._tabMap.has(tab.identifier);
	}

	public pushTab(tab: IPanelTab): PanelTabIdentifier {
		let internalTab = tab as IInternalPanelTab;
		this._tabMap.set(tab.identifier, internalTab);
		this._createTab(internalTab);
		if (!this._shownTab) {
			this.showTab(tab.identifier);
		}
		if (this._tabMap.size > 1 && !this._headerVisible) {
			this.$parent.append(this.$header, 0);
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
		let tabHeaderElement = $('.tab-header');
		tabHeaderElement.attr('tabindex', '0');
		tabHeaderElement.attr('role', 'tab');
		tabHeaderElement.attr('aria-selected', 'false');
		tabHeaderElement.attr('aria-controls', tab.identifier);
		let tabElement = $('.tab');
		tabHeaderElement.append(tabElement);
		let tabLabel = $('a.tabLabel');
		tabLabel.safeInnerHtml(tab.title);
		tabElement.append(tabLabel);
		tabHeaderElement.on(EventType.CLICK, e => this.showTab(tab.identifier));
		tabHeaderElement.on(EventType.KEY_DOWN, (e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.showTab(tab.identifier);
				e.stopImmediatePropagation();
			}
		});
		this.$tabList.append(tabHeaderElement);
		tab.header = tabHeaderElement;
		tab.label = tabLabel;
		tab.dispose = () => {
			tab.header.dispose();
			tab.label.dispose();
		};
		this._register(tab);
	}

	public showTab(id: PanelTabIdentifier): void {
		if (this._shownTab && this._shownTab === id) {
			return;
		}

		if (this._shownTab) {
			this._tabMap.get(this._shownTab).label.removeClass('active');
			this._tabMap.get(this._shownTab).header.removeClass('active').attr('aria-selected', 'false');
		}

		this._shownTab = id;
		this.tabHistory.push(id);
		this.$body.clearChildren();
		let tab = this._tabMap.get(this._shownTab);
		this.$body.attr('aria-labelledby', tab.identifier);
		tab.label.addClass('active');
		tab.header.addClass('active');
		tab.header.attr('aria-selected', 'true');
		tab.view.render(this.$body.getHTMLElement());
		this._onTabChange.fire(id);
		if (this._currentDimensions) {
			this._layoutCurrentTab(new Dimension(this._currentDimensions.width, this._currentDimensions.height - this.headersize));
		}
	}

	public removeTab(tab: PanelTabIdentifier) {
		let actualTab = this._tabMap.get(tab);
		actualTab.header.destroy();
		if (actualTab.view.remove) {
			actualTab.view.remove();
		}
		this._tabMap.get(tab).header.destroy();
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
			this.$header.offDOM();
			this._headerVisible = false;
			this.layout(this._currentDimensions);
		}
	}

	public style(styles: IPanelStyles): void {

	}

	public layout(dimension: Dimension): void {
		if (dimension) {
			this._currentDimensions = dimension;
			this.$parent.style('height', dimension.height + 'px');
			this.$parent.style('width', dimension.width + 'px');
			this.$header.style('width', dimension.width + 'px');
			this.$body.style('width', dimension.width + 'px');
			const bodyHeight = dimension.height - (this._headerVisible ? this.headersize : 0);
			this.$body.style('height', bodyHeight + 'px');
			this._layoutCurrentTab(new Dimension(dimension.width, bodyHeight));
		}
	}

	private _layoutCurrentTab(dimension: Dimension): void {
		if (this._shownTab) {
			this._tabMap.get(this._shownTab).view.layout(dimension);
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
			this.$body.offDOM();
		} else {
			this.$parent.append(this.$body);
		}
	}

	public get collapsed(): boolean {
		return this._collapsed;
	}
}
