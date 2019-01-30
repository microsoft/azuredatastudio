/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { CollapsibleView, ICollapsibleViewOptions } from 'sql/base/browser/ui/views/browser/views';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IAction, ActionRunner } from 'vs/base/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { $ } from 'sql/base/browser/builder';
import { CountBadge } from 'vs/base/browser/ui/countBadge/countBadge';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachBadgeStyler } from 'vs/platform/theme/common/styler';
import { CollapsibleState } from 'sql/base/browser/ui/splitview/splitview';

export class FixedListView<T> extends CollapsibleView {
	private _badge: CountBadge;
	private _disposables: IDisposable[] = [];

	constructor(
		initialSize: number,
		initiallyCollapsed: boolean,
		private _viewTitle: string,
		private _list: List<T>,
		private _bodyContainer: HTMLElement,
		headerSize: number,
		private _actions: IAction[],
		actionRunner: ActionRunner,
		contextMenuService: IContextMenuService,
		keybindingService: IKeybindingService,
		private _themeService: IThemeService
	) {
		super(initialSize, <ICollapsibleViewOptions>{
			id: _viewTitle,
			name: _viewTitle,
			actionRunner: actionRunner,
			collapsed: initiallyCollapsed,
			ariaHeaderLabel: _viewTitle,
			sizing: headerSize,
			initialBodySize: undefined
		}, keybindingService, contextMenuService);
	}

	// RENDER METHODS //////////////////////////////////////////////////////
	public renderBody(container: HTMLElement): void {
		container.appendChild(this._bodyContainer);
	}

	public renderHeader(container: HTMLElement): void {
		const titleDiv = $('div.title').appendTo(container);
		$('span').text(this._viewTitle).appendTo(titleDiv);
		super.renderHeader(container);

		// show the badge
		this._badge = new CountBadge($('.count-badge-wrapper').appendTo(container).getHTMLElement());
		this._disposables.push(attachBadgeStyler(this._badge, this._themeService));
	}

	public updateList(content: T[]) {
		this._list.splice(0, this._list.length, content);
		this._badge.setCount(this._list.length);
		this._list.layout(this._list.contentHeight);
		this.setFixed(this.fixedSize);
	}

	public get list(): List<T> {
		return this._list;
	}

	public listContentHeight(): number {
		return this._list.contentHeight;
	}

	public get fixedSize(): number {
		return this.state === CollapsibleState.EXPANDED ? this.expandedSize : this.headerSize;
	}

	private get expandedSize(): number {
		if (this._list && this._list.contentHeight) {
			return this._list.contentHeight + this.headerSize;
		}

		return this.headerSize;
	}

	protected changeState(state: CollapsibleState): void {
		super.changeState(state);
		this.setFixed(this.fixedSize);
		if (this.list) {
			this.list.getHTMLElement().hidden = (state === CollapsibleState.COLLAPSED);
		}
	}

	/**
	 * Return actions for the view
	 */
	public getActions(): IAction[] {
		return this._actions;
	}

	public dispose(): void {
		this._disposables = dispose(this._disposables);
		super.dispose();
	}
}