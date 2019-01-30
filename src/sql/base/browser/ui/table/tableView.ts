/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from './table';
import { TableDataView } from './tableDataView';
import { View, AbstractCollapsibleView, HeaderView, ICollapsibleViewOptions, IViewOptions, CollapsibleState } from 'sql/base/browser/ui/splitview/splitview';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import * as lifecycle from 'vs/base/common/lifecycle';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { $ } from 'sql/base/browser/builder';

export class TableBasicView<T> extends View {
	private _table: Table<T>;
	private _container: HTMLElement;

	constructor(
		viewOpts: IViewOptions,
		data?: Array<T> | TableDataView<T>,
		columns?: Slick.Column<T>[],
		tableOpts?: Slick.GridOptions<T>
	) {
		super(undefined, viewOpts);
		this._container = document.createElement('div');
		this._container.className = 'table-view';
		this._table = new Table<T>(this._container, { dataProvider: data, columns }, tableOpts);
	}

	public get table(): Table<T> {
		return this._table;
	}

	render(container: HTMLElement, orientation: Orientation): void {
		container.appendChild(this._container);
	}

	focus(): void {
		this._table.focus();
	}

	layout(size: number, orientation: Orientation): void {
		this._table.layout(size, orientation);
	}
}

export class TableHeaderView<T> extends HeaderView {
	private _table: Table<T>;
	private _container: HTMLElement;

	constructor(
		private _viewTitle: string,
		viewOpts: IViewOptions,
		data?: Array<T> | TableDataView<T>,
		columns?: Slick.Column<T>[],
		tableOpts?: Slick.GridOptions<T>
	) {
		super(undefined, viewOpts);
		this._container = document.createElement('div');
		this._container.className = 'table-view';
		this._table = new Table<T>(this._container, { dataProvider: data, columns }, tableOpts);
	}

	public get table(): Table<T> {
		return this._table;
	}

	protected renderHeader(container: HTMLElement): void {
		const titleDiv = $('div.title').appendTo(container);
		$('span').text(this._viewTitle).appendTo(titleDiv);
	}

	protected renderBody(container: HTMLElement): void {
		container.appendChild(this._container);
	}

	protected layoutBody(size: number): void {
		this._table.layout(size, Orientation.VERTICAL);
	}

	focus(): void {
		this._table.focus();
	}
}

export class TableCollapsibleView<T> extends AbstractCollapsibleView {
	private _table: Table<T>;
	private _container: HTMLElement;
	private _headerTabListener: lifecycle.IDisposable;

	constructor(
		private _viewTitle: string,
		viewOpts: ICollapsibleViewOptions,
		data?: Array<T> | TableDataView<T>,
		columns?: Slick.Column<T>[],
		tableOpts?: Slick.GridOptions<T>
	) {
		super(undefined, viewOpts);
		this._container = document.createElement('div');
		this._container.className = 'table-view';
		this._table = new Table<T>(this._container, { dataProvider: data, columns }, tableOpts);
	}

	public render(container: HTMLElement, orientation: Orientation): void {
		super.render(container, orientation);
		this._headerTabListener = DOM.addDisposableListener(this.header, DOM.EventType.KEY_DOWN, (e) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Tab) && this.state === CollapsibleState.EXPANDED) {
				let element = this._table.getSelectedRows();
				if (!element || element.length === 0) {
					this._table.setSelectedRows([0]);
					this._table.setActiveCell(0, 1);
					e.stopImmediatePropagation();
				}
			}
		});
	}

	public dispose(): void {
		if (this._headerTabListener) {
			this._headerTabListener.dispose();
			this._headerTabListener = null;
		}
		super.dispose();
	}

	public addContainerClass(className: string) {
		this._container.classList.add(className);
	}

	public get table(): Table<T> {
		return this._table;
	}

	protected renderHeader(container: HTMLElement): void {
		const titleDiv = $('div.title').appendTo(container);
		$('span').text(this._viewTitle).appendTo(titleDiv);
	}

	protected renderBody(container: HTMLElement): void {
		container.appendChild(this._container);
	}

	protected layoutBody(size: number): void {
		this._table.layout(size, Orientation.VERTICAL);
	}
}
