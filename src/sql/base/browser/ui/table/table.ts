/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/table';
import { TableDataView } from './tableDataView';

import { IThemable } from 'vs/platform/theme/common/styler';
import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import * as DOM from 'vs/base/browser/dom';
import { Color } from 'vs/base/common/color';
import { mixin } from 'vs/base/common/objects';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { Widget } from 'vs/base/browser/ui/widget';

export interface ITableStyles extends IListStyles {
	tableHeaderBackground?: Color;
	tableHeaderForeground?: Color;
}

function getDefaultOptions<T>(): Slick.GridOptions<T> {
	return <Slick.GridOptions<T>>{
		syncColumnCellResize: true,
		enableColumnReorder: false
	};
}

export class Table<T extends Slick.SlickData> extends Widget implements IThemable {
	private styleElement: HTMLStyleElement;
	private idPrefix: string;

	private _grid: Slick.Grid<T>;
	private _columns: Slick.Column<T>[];
	private _data: TableDataView<T>;
	private _autoscroll: boolean;
	private _onRowCountChangeListener: IDisposable;
	private _container: HTMLElement;
	private _tableContainer: HTMLElement;

	private _classChangeTimeout: number;

	constructor(parent: HTMLElement, data?: Array<T> | TableDataView<T>, columns?: Slick.Column<T>[], options?: Slick.GridOptions<T>) {
		super();
		if (data instanceof TableDataView) {
			this._data = data;
		} else {
			this._data = new TableDataView<T>(data);
		}

		if (columns) {
			this._columns = columns;
		} else {
			this._columns = new Array<Slick.Column<T>>();
		}

		let newOptions = mixin(options || {}, getDefaultOptions<T>(), false);

		this._container = document.createElement('div');
		this._container.className = 'monaco-table';
		this._register(DOM.addDisposableListener(this._container, DOM.EventType.FOCUS, () => {
			clearTimeout(this._classChangeTimeout);
			this._classChangeTimeout = setTimeout(() => {
				DOM.addClass(this._container, 'focused');
			}, 100);
		}, true));

		this._register(DOM.addDisposableListener(this._container, DOM.EventType.BLUR, () => {
			clearTimeout(this._classChangeTimeout);
			this._classChangeTimeout = setTimeout(() => {
				DOM.removeClass(this._container, 'focused');
			}, 100);
		}, true));

		parent.appendChild(this._container);
		this.styleElement = DOM.createStyleSheet(this._container);
		this._tableContainer = document.createElement('div');
		this._container.appendChild(this._tableContainer);
		this.styleElement = DOM.createStyleSheet(this._container);
		this._grid = new Slick.Grid<T>(this._tableContainer, this._data, this._columns, newOptions);
		this.idPrefix = this._tableContainer.classList[0];
		DOM.addClass(this._container, this.idPrefix);
		this._onRowCountChangeListener = this._data.onRowCountChange(() => this._handleRowCountChange());
		this._grid.onSort.subscribe((e, args) => {
			this._data.sort(args);
			this._grid.invalidate();
			this._grid.render();
		});
	}

	private _handleRowCountChange() {
		this._grid.updateRowCount();
		this._grid.render();
		if (this._autoscroll) {
			this._grid.scrollRowIntoView(this._data.getLength() - 1, false);
		}
	}

	set columns(columns: Slick.Column<T>[]) {
		this._grid.setColumns(columns);
	}

	public get grid(): Slick.Grid<T> {
		return this._grid;
	}

	setData(data: Array<T>);
	setData(data: TableDataView<T>);
	setData(data: Array<T> | TableDataView<T>) {
		if (data instanceof TableDataView) {
			this._data = data;
		} else {
			this._data = new TableDataView<T>(data);
		}
		this._onRowCountChangeListener.dispose();
		this._grid.setData(this._data, true);
		this._onRowCountChangeListener = this._data.onRowCountChange(() => this._handleRowCountChange());
	}

	get columns(): Slick.Column<T>[] {
		return this._grid.getColumns();
	}

	setSelectedRows(rows: number[]) {
		this._grid.setSelectedRows(rows);
	}

	getSelectedRows(): number[] {
		return this._grid.getSelectedRows();
	}

	onSelectedRowsChanged(fn: (e: Slick.EventData, data: Slick.OnSelectedRowsChangedEventArgs<T>) => any): IDisposable;
	onSelectedRowsChanged(fn: (e: DOMEvent, data: Slick.OnSelectedRowsChangedEventArgs<T>) => any): IDisposable;
	onSelectedRowsChanged(fn: any): IDisposable {
		this._grid.onSelectedRowsChanged.subscribe(fn);
		return {
			dispose: () => {
				this._grid.onSelectedRowsChanged.unsubscribe(fn);
			}
		};
	}

	onContextMenu(fn: (e: Slick.EventData, data: Slick.OnContextMenuEventArgs<T>) => any): IDisposable;
	onContextMenu(fn: (e: DOMEvent, data: Slick.OnContextMenuEventArgs<T>) => any): IDisposable;
	onContextMenu(fn: any): IDisposable {
		this._grid.onContextMenu.subscribe(fn);
		return {
			dispose: () => {
				this._grid.onContextMenu.unsubscribe(fn);
			}
		};
	}

	getCellFromEvent(e: DOMEvent): Slick.Cell {
		return this._grid.getCellFromEvent(e);
	}

	setSelectionModel(model: Slick.SelectionModel<T, Array<Slick.Range>>) {
		this._grid.setSelectionModel(model);
	}

	focus(): void {
		this._grid.focus();
	}

	setActiveCell(row: number, cell: number): void {
		this._grid.setActiveCell(row, cell);
	}

	get activeCell(): Slick.Cell {
		return this._grid.getActiveCell();
	}

	registerPlugin(plugin: Slick.Plugin<T>): void {
		this._grid.registerPlugin(plugin);
	}

	/**
	 * This function needs to be called if the table is drawn off dom.
	 */
	resizeCanvas() {
		this._grid.resizeCanvas();
	}

	layout(dimension: DOM.Dimension): void;
	layout(size: number, orientation: Orientation): void;
	layout(sizing: number | DOM.Dimension, orientation?: Orientation): void {
		if (sizing instanceof DOM.Dimension) {
			this._container.style.width = sizing.width + 'px';
			this._container.style.height = sizing.height + 'px';
			this._tableContainer.style.width = sizing.width + 'px';
			this._tableContainer.style.height = sizing.height + 'px';
		} else {
			if (orientation === Orientation.HORIZONTAL) {
				this._container.style.width = '100%';
				this._container.style.height = sizing + 'px';
				this._tableContainer.style.width = '100%';
				this._tableContainer.style.height = sizing + 'px';
			} else {
				this._container.style.width = sizing + 'px';
				this._container.style.height = '100%';
				this._tableContainer.style.width = sizing + 'px';
				this._tableContainer.style.height = '100%';
			}
		}
		this.resizeCanvas();
	}

	autosizeColumns() {
		this._grid.autosizeColumns();
	}

	set autoScroll(active: boolean) {
		this._autoscroll = active;
	}

	style(styles: ITableStyles): void {
		const content: string[] = [];

		if (styles.tableHeaderBackground) {
			content.push(`.monaco-table .${this.idPrefix} .slick-header .slick-header-column { background-color: ${styles.tableHeaderBackground}; }`);
		}

		if (styles.tableHeaderForeground) {
			content.push(`.monaco-table .${this.idPrefix} .slick-header .slick-header-column { color: ${styles.tableHeaderForeground}; }`);
		}

		if (styles.listFocusBackground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .active { background-color: ${styles.listFocusBackground}; }`);
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .active:hover { background-color: ${styles.listFocusBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listFocusForeground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .active { color: ${styles.listFocusForeground}; }`);
		}

		if (styles.listActiveSelectionBackground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected { background-color: ${styles.listActiveSelectionBackground}; }`);
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected:hover { background-color: ${styles.listActiveSelectionBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listActiveSelectionForeground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected { color: ${styles.listActiveSelectionForeground}; }`);
		}

		if (styles.listFocusAndSelectionBackground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected.active { background-color: ${styles.listFocusAndSelectionBackground}; }`);
		}

		if (styles.listFocusAndSelectionForeground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected.active { color: ${styles.listFocusAndSelectionForeground}; }`);
		}

		if (styles.listInactiveFocusBackground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected.active { background-color:  ${styles.listInactiveFocusBackground}; }`);
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected.active:hover { background-color:  ${styles.listInactiveFocusBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listInactiveSelectionBackground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected { background-color:  ${styles.listInactiveSelectionBackground}; }`);
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected:hover { background-color:  ${styles.listInactiveSelectionBackground}; }`); // overwrite :hover style in this case!
		}

		if (styles.listInactiveSelectionForeground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected { color: ${styles.listInactiveSelectionForeground}; }`);
		}

		if (styles.listHoverBackground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row:hover { background-color:  ${styles.listHoverBackground}; }`);
		}

		if (styles.listHoverForeground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row:hover { color:  ${styles.listHoverForeground}; }`);
		}

		if (styles.listSelectionOutline) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected.active { outline: 1px dotted ${styles.listSelectionOutline}; outline-offset: -1px; }`);
		}

		if (styles.listFocusOutline) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }`);
		}

		if (styles.listInactiveFocusOutline) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected .active { outline: 1px dotted ${styles.listInactiveFocusOutline}; outline-offset: -1px; }`);
		}

		if (styles.listHoverOutline) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
		}

		this.styleElement.innerHTML = content.join('\n');
	}
}
