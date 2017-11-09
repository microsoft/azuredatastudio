/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemable } from 'vs/platform/theme/common/styler';
import * as objects from 'vs/base/common/objects';
import Event, { Emitter } from 'vs/base/common/event';
import { Dimension, Builder } from 'vs/base/browser/builder';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { IAction, IActionRunner, Action, IActionChangeEvent, ActionRunner } from 'vs/base/common/actions';
import { IActionOptions, ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import './panelStyles';

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
	header: HTMLElement;
	label: HTMLElement;
}

export type PanelTabIdentifier = string;

export class TabbedPanel implements IThemable {
	private _tabMap = new Map<PanelTabIdentifier, IInternalPanelTab>();
	private _shownTab: PanelTabIdentifier;
	public readonly headersize = 35;
	private _header: HTMLElement;
	private _tabList: HTMLElement;
	private _actionbar: ActionBar;
	private _body: HTMLElement;
	private _currentDimensions: Dimension;
	private _collapsed = false;
	private _parent: HTMLElement;

	private _onTabChange = new Emitter<PanelTabIdentifier>();
	public onTabChange: Event<PanelTabIdentifier> = this._onTabChange.event;

	constructor(private container: HTMLElement) {
		this._parent = document.createElement('div');
		this._parent.className = 'tabbedPanel';
		container.appendChild(this._parent);
		this._header = document.createElement('div');
		this._header.className = 'composite title';
		this._tabList = document.createElement('div');
		this._tabList.className = 'tabList';
		this._tabList.style.height = this.headersize + 'px';
		this._header.appendChild(this._tabList);
		let actionbarcontainer = document.createElement('div');
		actionbarcontainer.className = 'title-actions';
		this._actionbar = new ActionBar(actionbarcontainer);
		this._header.appendChild(actionbarcontainer);
		this._parent.appendChild(this._header);
		this._body = document.createElement('div');
		this._body.className = 'tabBody';
		this._parent.appendChild(this._body);
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
		let tabElement = document.createElement('div');
		tabElement.className = 'tab';
		let tabLabel = document.createElement('a');
		tabLabel.className = 'tabLabel';
		tabLabel.innerText = tab.title;
		tabElement.appendChild(tabLabel);
		addDisposableListener(tabElement, EventType.CLICK, (e) => this.showTab(tab.identifier));
		this._tabList.appendChild(tabElement);
		tab.header = tabElement;
		tab.label = tabLabel;
	}

	public showTab(id: PanelTabIdentifier): void {
		if (this._shownTab && this._shownTab === id) {
			return;
		}

		if (this._shownTab) {
			this._tabMap.get(this._shownTab).label.classList.remove('active');
		}

		this._shownTab = id;
		new Builder(this._body).empty();
		let tab = this._tabMap.get(this._shownTab);
		tab.label.classList.add('active');
		tab.view.render(this._body);
		this._onTabChange.fire(id);
		if (this._currentDimensions) {
			this._layoutCurrentTab(new Dimension(this._currentDimensions.width, this._currentDimensions.height - this.headersize));
		}
	}

	public removeTab(tab: PanelTabIdentifier) {
		this._tabMap.get(tab).header.remove();
		this._tabMap.delete(tab);
	}

	public style(styles: IPanelStyles): void {

	}

	public layout(dimension: Dimension): void {
		this._currentDimensions = dimension;
		this._header.style.width = dimension.width + 'px';
		this._body.style.width = dimension.width + 'px';
		this._body.style.height = (dimension.height - this.headersize) + 'px';
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
			this._body.remove();
		} else {
			this._parent.appendChild(this._body);
		}
	}

	public get collapsed(): boolean {
		return this._collapsed;
	}
}
