/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from './table';
import { TableDataView } from './tableDataView';
import { $ } from 'vs/base/browser/builder';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import * as lifecycle from 'vs/base/common/lifecycle';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { ViewletPanel, IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export class TableCollapsibleView<T> extends ViewletPanel {
	private _table: Table<T>;
	private _container: HTMLElement;
	private _headerTabListener: lifecycle.IDisposable;

	constructor(
		private _viewTitle: string,
		viewOpts: IViewletPanelOptions,
		data: Array<T> | TableDataView<T>,
		columns: Slick.Column<T>[],
		tableOpts: Slick.GridOptions<T>,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextmenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(_viewTitle, viewOpts, keybindingService, contextmenuService, configurationService);
		this._container = document.createElement('div');
		this._container.className = 'table-view';
		this._table = new Table<T>(this._container, data, columns, tableOpts);
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
		this._table.layout(size, Orientation.HORIZONTAL);
	}
}
