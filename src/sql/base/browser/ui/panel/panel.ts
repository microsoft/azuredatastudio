/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemable } from 'vs/platform/theme/common/styler';
import * as objects from 'sql/base/common/objects';
import Event, { Emitter } from 'vs/base/common/event';
import { Dimension, $, Builder } from 'vs/base/browser/builder';
import { EventType } from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { IActionOptions, ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import './panelStyles';
import { Disposable } from 'vs/base/common/lifecycle';

export interface IPanelStyles {

}

export interface IPanelView {
	render(container: HTMLElement): void;
	layout(dimension: Dimension): void;
}

export interface IPanelTab {
	title: string;
	identifier: string;
	view: IPanelView;
}

interface IInternalPanelTab extends IPanelTab {
	header: Builder;
	label: Builder;
}

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

	private _onTabChange = new Emitter<PanelTabIdentifier>();
	public onTabChange: Event<PanelTabIdentifier> = this._onTabChange.event;

	constructor(private container: HTMLElement) {
		super();
		this.$parent = this._register($('.tabbedPanel'));
		this.$parent.appendTo(container);
		this.$header = $('.composite.title');
		this.$tabList = $('.tabList');
		this.$tabList.style('height', this.headersize + 'px');
		this.$header.append(this.$tabList);
		let actionbarcontainer = $('.title-actions');
		this._actionbar = new ActionBar(actionbarcontainer);
		this.$header.append(actionbarcontainer);
		this.$parent.append(this.$header);
		this.$body = $('tabBody');
		this.$parent.append(this.$body);
	}

	public pushTab(tab: IPanelTab): PanelTabIdentifier {
		let internalTab = objects.clone(tab) as IInternalPanelTab;
		this._tabMap.set(tab.identifier, internalTab);
		this._createTab(internalTab);
		if (!this._shownTab) {
			this.showTab(tab.identifier);
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
	}

	public showTab(id: PanelTabIdentifier): void {
		if (this._shownTab && this._shownTab === id) {
			return;
		}

		if (this._shownTab) {
			this._tabMap.get(this._shownTab).label.removeClass('active');
			this._tabMap.get(this._shownTab).header.removeClass('active');
		}

		this._shownTab = id;
		this.$body.clearChildren();
		let tab = this._tabMap.get(this._shownTab);
		tab.label.addClass('active');
		tab.header.addClass('active');
		tab.view.render(this.$body.getHTMLElement());
		this._onTabChange.fire(id);
		if (this._currentDimensions) {
			this._layoutCurrentTab(new Dimension(this._currentDimensions.width, this._currentDimensions.height - this.headersize));
		}
	}

	public removeTab(tab: PanelTabIdentifier) {
		this._tabMap.get(tab).header.destroy();
		this._tabMap.delete(tab);
	}

	public style(styles: IPanelStyles): void {

	}

	public layout(dimension: Dimension): void {
		this._currentDimensions = dimension;
		this.$header.style('width', dimension.width + 'px');
		this.$body.style('width', dimension.width + 'px');
		this.$body.style('height', (dimension.height - this.headersize) + 'px');
		this._layoutCurrentTab(new Dimension(dimension.width, dimension.height - this.headersize));
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
