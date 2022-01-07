/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/table';
import 'vs/css!./media/slick.grid';
import 'vs/css!./media/slickColorTheme';

import { TableDataView } from './tableDataView';
import { ITableSorter, ITableMouseEvent, ITableConfiguration, ITableStyles } from 'sql/base/browser/ui/table/interfaces';

import * as DOM from 'vs/base/browser/dom';
import { mixin } from 'vs/base/common/objects';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { Widget } from 'vs/base/browser/ui/widget';
import { isArray, isBoolean } from 'vs/base/common/types';
import { Event, Emitter } from 'vs/base/common/event';
import { range } from 'vs/base/common/arrays';
import { AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';

function getDefaultOptions<T>(): Slick.GridOptions<T> {
	return <Slick.GridOptions<T>>{
		syncColumnCellResize: true,
		enableColumnReorder: false,
		emulatePagingWhenScrolling: false
	};
}

export class Table<T extends Slick.SlickData> extends Widget implements IDisposable {
	private styleElement: HTMLStyleElement;
	private idPrefix: string;

	private _grid: Slick.Grid<T>;
	private _columns: Slick.Column<T>[];
	private _data: IDisposableDataProvider<T>;
	private _sorter?: ITableSorter<T>;

	private _autoscroll?: boolean;
	private _container: HTMLElement;
	private _tableContainer: HTMLElement;

	private _classChangeTimeout: any;

	private _onContextMenu = new Emitter<ITableMouseEvent>();
	public readonly onContextMenu: Event<ITableMouseEvent> = this._onContextMenu.event;

	private _onClick = new Emitter<ITableMouseEvent>();
	public readonly onClick: Event<ITableMouseEvent> = this._onClick.event;

	private _onDoubleClick = new Emitter<ITableMouseEvent>();
	public readonly onDoubleClick: Event<ITableMouseEvent> = this._onDoubleClick.event;

	private _onHeaderClick = new Emitter<ITableMouseEvent>();
	public readonly onHeaderClick: Event<ITableMouseEvent> = this._onHeaderClick.event;

	private _onColumnResize = new Emitter<void>();
	public readonly onColumnResize = this._onColumnResize.event;

	constructor(parent: HTMLElement, configuration?: ITableConfiguration<T>, options?: Slick.GridOptions<T>) {
		super();
		if (!configuration || !configuration.dataProvider || isArray(configuration.dataProvider)) {
			this._data = new TableDataView<T>(configuration && configuration.dataProvider as Array<T>);
		} else {
			this._data = configuration.dataProvider;
		}

		this._register(this._data);

		if (configuration && configuration.columns) {
			this._columns = configuration.columns;
		} else {
			this._columns = new Array<Slick.Column<T>>();
		}

		let newOptions = mixin(options || {}, getDefaultOptions<T>(), false);

		this._container = document.createElement('div');
		this._container.className = 'monaco-table';
		this._register(DOM.addDisposableListener(this._container, DOM.EventType.FOCUS, (e: FocusEvent) => {
			clearTimeout(this._classChangeTimeout);
			this._classChangeTimeout = setTimeout(() => {
				this._container.classList.add('focused');
			}, 100);
		}, true));

		this._register(DOM.addDisposableListener(this._container, DOM.EventType.BLUR, () => {
			clearTimeout(this._classChangeTimeout);
			this._classChangeTimeout = setTimeout(() => {
				this._container.classList.remove('focused');
			}, 100);
		}, true));

		parent.appendChild(this._container);
		this.styleElement = DOM.createStyleSheet(this._container);
		this._tableContainer = document.createElement('div');
		this._container.appendChild(this._tableContainer);
		this.styleElement = DOM.createStyleSheet(this._container);
		this._grid = new Slick.Grid<T>(this._tableContainer, this._data, this._columns, newOptions);
		this.idPrefix = this._tableContainer.classList[0];
		this._container.classList.add(this.idPrefix);
		if (configuration && configuration.sorter) {
			this._sorter = configuration.sorter;
			this._grid.onSort.subscribe((e, args) => {
				this._sorter!(args);
				this._grid.invalidate();
				this._grid.render();
			});
		}

		this._register({
			dispose: () => {
				this._grid.destroy();
			}
		});

		this.mapMouseEvent(this._grid.onContextMenu, this._onContextMenu);
		this.mapMouseEvent(this._grid.onClick, this._onClick);
		this.mapMouseEvent(this._grid.onHeaderClick, this._onHeaderClick);
		this.mapMouseEvent(this._grid.onDblClick, this._onDoubleClick);
		this._grid.onColumnsResized.subscribe(() => this._onColumnResize.fire());
	}

	public rerenderGrid() {
		this._grid.updateRowCount();
		this._grid.setColumns(this._grid.getColumns());
		this._grid.invalidateAllRows();
		this._grid.render();
	}

	private mapMouseEvent(slickEvent: Slick.Event<any>, emitter: Emitter<ITableMouseEvent>) {
		slickEvent.subscribe((e: Slick.EventData) => {
			const originalEvent = (e as JQuery.Event).originalEvent;
			const cell = this._grid.getCellFromEvent(originalEvent);
			const anchor = originalEvent instanceof MouseEvent ? { x: originalEvent.x, y: originalEvent.y } : originalEvent.srcElement as HTMLElement;
			emitter.fire({ anchor, cell });
		});
	}

	public override dispose() {
		this._container.remove();
		super.dispose();
	}

	public invalidateRows(rows: number[], keepEditor: boolean) {
		this._grid.invalidateRows(rows, keepEditor);
		this._grid.render();
	}

	public updateRowCount() {
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

	setData(data: Array<T>): void;
	setData(data: TableDataView<T>): void;
	setData(data: AsyncDataProvider<T>): void;
	setData(data: Array<T> | TableDataView<T> | AsyncDataProvider<T>): void {
		if (data instanceof TableDataView || data instanceof AsyncDataProvider) {
			this._data = data;
		} else {
			this._data = new TableDataView<T>(data);
		}
		this._grid.setData(this._data, true);
	}

	getData(): IDisposableDataProvider<T> {
		return this._data;
	}

	get columns(): Slick.Column<T>[] {
		return this._grid.getColumns();
	}

	public setSelectedRows(rows: number[] | boolean) {
		if (isBoolean(rows)) {
			this._grid.setSelectedRows(range(this._grid.getDataLength()));
		} else {
			this._grid.setSelectedRows(rows);
		}
	}

	public getSelectedRows(): number[] {
		return this._grid.getSelectedRows();
	}

	onSelectedRowsChanged(fn: (e: Slick.EventData, data: Slick.OnSelectedRowsChangedEventArgs<T>) => any): IDisposable;
	onSelectedRowsChanged(fn: (e: DOMEvent, data: Slick.OnSelectedRowsChangedEventArgs<T>) => any): IDisposable;
	onSelectedRowsChanged(fn: any): IDisposable {
		this._grid.onSelectedRowsChanged.subscribe(fn);
		return {
			dispose: () => {
				if (this._grid && this._grid.onSelectedRowsChanged) {
					this._grid.onSelectedRowsChanged.unsubscribe(fn);
				}
			}
		};
	}

	setSelectionModel(model: Slick.SelectionModel<T, Array<Slick.Range>>) {
		this._grid.setSelectionModel(model);
	}

	getSelectionModel(): Slick.SelectionModel<T, Array<Slick.Range>> {
		return this._grid.getSelectionModel();
	}

	getSelectedRanges(): Slick.Range[] {
		let selectionModel = this._grid.getSelectionModel();
		if (selectionModel && selectionModel.getSelectedRanges) {
			return selectionModel.getSelectedRanges();
		}
		return <Slick.Range[]><unknown>undefined;
	}

	focus(): void {
		this._grid.focus();
	}

	setActiveCell(row: number, cell: number): void {
		this._grid.setActiveCell(row, cell);
	}

	get activeCell(): Slick.Cell | null {
		return this._grid.getActiveCell();
	}

	registerPlugin(plugin: Slick.Plugin<T>): void {
		this._grid.registerPlugin(plugin);
	}

	unregisterPlugin(plugin: Slick.Plugin<T>): void {
		this._grid.unregisterPlugin(plugin);
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
			if (orientation === Orientation.VERTICAL) {
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
			// handle no coloring during drag
			content.push(`.monaco-table.${this.idPrefix} .drag .slick-row:hover { background-color: inherit; }`);

		}

		if (styles.listHoverForeground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row:hover { color:  ${styles.listHoverForeground}; }`);
			// handle no coloring during drag
			content.push(`.monaco-table.${this.idPrefix} .drag .slick-row:hover { color: inherit; }`);
		}

		if (styles.listSelectionOutline) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected.active { outline: 1px dotted ${styles.listSelectionOutline}; outline-offset: -1px; }`);
		}

		if (styles.listFocusOutline) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected { outline: 1px solid ${styles.listFocusOutline}; outline-offset: -1px; }`);
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected.active { outline: 2px solid ${styles.listFocusOutline}; outline-offset: -1px; }`);
		}

		if (styles.listInactiveFocusOutline) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected .active { outline: 1px dotted ${styles.listInactiveFocusOutline}; outline-offset: -1px; }`);
		}

		if (styles.listHoverOutline) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row:hover { outline: 1px dashed ${styles.listHoverOutline}; outline-offset: -1px; }`);
		}

		this.styleElement.innerHTML = content.join('\n');
	}

	public setOptions(newOptions: Slick.GridOptions<T>) {
		this._grid.setOptions(newOptions);
		this._grid.invalidate();
	}

	public setTableTitle(title: string): void {
		this._tableContainer.title = title;
	}

	public removeAriaRowCount(): void {
		this._tableContainer.removeAttribute('aria-rowcount');
	}

	public set ariaRowCount(value: number) {
		this._tableContainer.setAttribute('aria-rowcount', value.toString());
	}

	public removeAriaColumnCount(): void {
		this._tableContainer.removeAttribute('aria-colcount');
	}

	public set ariaColumnCount(value: number) {
		this._tableContainer.setAttribute('aria-colcount', value.toString());
	}

	public set ariaRole(value: string) {
		this._tableContainer.setAttribute('role', value);
	}

	public set ariaLabel(value: string) {
		this._tableContainer.setAttribute('aria-label', value);
	}

	public get container(): HTMLElement {
		return this._tableContainer;
	}
}
