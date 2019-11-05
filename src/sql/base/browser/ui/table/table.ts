/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/table';
import 'vs/css!./media/slick.grid';
import 'vs/css!./media/slickColorTheme';
import 'vs/css!./media/slickGrid';

import { TableDataView } from './tableDataView';
import { IDisposableDataProvider, ITableSorter, ITableMouseEvent, ITableConfiguration, ITableStyles } from 'sql/base/browser/ui/table/interfaces';


//Angular components used to make it compatible for editData.
import {Component, Input, Output, Inject, forwardRef, OnChanges, OnInit, OnDestroy, ElementRef, SimpleChange, EventEmitter, ViewEncapsulation, HostListener, AfterViewInit} from '@angular/core';
import { Observable, Subscription } from 'rxjs/Rx';

import * as DOM from 'vs/base/browser/dom';
import { mixin } from 'vs/base/common/objects';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Orientation } from 'vs/base/browser/ui/splitview/splitview';
import { Widget } from 'vs/base/browser/ui/widget';
import { isArray, isBoolean } from 'vs/base/common/types';
import { Event, Emitter } from 'vs/base/common/event';
import { range } from 'vs/base/common/arrays';

function getDefaultOptions<T>(): Slick.GridOptions<T> {
	return <Slick.GridOptions<T>>{
		syncColumnCellResize: true,
		enableColumnReorder: false,
		emulatePagingWhenScrolling: false
	};
}

//my code here.

interface ISlickGridData {
    // https://github.com/mleibman/SlickGrid/wiki/DataView
    getLength(): number;
    getItem(index: number): any;
    getRange(start: number, end: number): any; // only available in the forked SlickGrid
    getItemMetadata(index: number): any;
}

export enum CollectionChange {
    ItemsReplaced = 0,
}

export interface IObservableCollection<T> {
    getLength(): number;
    at(index: number): T;
    getRange(start: number, end: number): T[];
    setCollectionChangedCallback(callback: (change: CollectionChange, startIndex: number, count: number) => void): void;
    resetWindowsAroundIndex(index: number): void;
}

//Component for compatability with angular.
@Component({

    selector: 'table',

    template: '<div class="grid" (window:resize)="onResize()"></div>',

    encapsulation: ViewEncapsulation.None

})


export class Table<T extends Slick.SlickData> extends Widget implements IDisposable {
	//need to add input injectors for Angular to run this.

	//invalid.
	@Input() columnDefinitions: Slick.Column<any>[];

    @Input() dataRows: IObservableCollection<{}>;

    @Input() resized: Observable<any>;

    @Input() highlightedCells: { row: number, column: number }[] = [];

    @Input() blurredColumns: string[] = [];

    @Input() contextColumns: string[] = [];

    @Input() columnsLoading: string[] = [];

    @Input() showHeader: boolean = true;

    @Input() enableColumnReorder: boolean = false;

    @Input() enableAsyncPostRender: boolean = false;

    @Input() selectionModel: string | Slick.SelectionModel<any, any> = '';

    @Input() plugins: Array<string | Slick.Plugin<any>> = [];

    @Input() enableEditing: boolean = false;

    @Input() topRowNumber: number;



    @Input() overrideCellFn: (rowNumber, columnId, value?, data?) => string;

    @Input() isCellEditValid: (row: number, column: number, newValue: any) => boolean;

    @Input() BeforeAppendCell: (row: number, column: number) => string;



    @Output() onScroll: EventEmitter<Slick.OnScrollEventArgs<any>> = new EventEmitter<Slick.OnScrollEventArgs<any>>();

    @Output() onActiveCellChanged: EventEmitter<Slick.OnActiveCellChangedEventArgs<any>> = new EventEmitter<Slick.OnActiveCellChangedEventArgs<any>>();

    @Output() onBeforeEditCell: EventEmitter<Slick.OnBeforeEditCellEventArgs<any>> = new EventEmitter<Slick.OnBeforeEditCellEventArgs<any>>();

    @Output() onCellChange: EventEmitter<Slick.OnCellChangeEventArgs<any>> = new EventEmitter<Slick.OnCellChangeEventArgs<any>>();

    @Output() onRendered: EventEmitter<Slick.OnRenderedEventArgs<any>> = new EventEmitter<Slick.OnRenderedEventArgs<any>>();

	@Output() loadFinished: EventEmitter<void> = new EventEmitter<void>();


	private _resizeSubscription: Subscription;
	private _gridSyncSubscription: Subscription;
	private _columnNameToIndex: any;
	private _gridData: ISlickGridData;

	//old inputs
	private styleElement: HTMLStyleElement;
	private idPrefix: string;

	private _grid: Slick.Grid<T>;
	private _columns: Slick.Column<T>[];
	private _data: IDisposableDataProvider<T>;
	private _sorter: ITableSorter<T>;

	private _autoscroll: boolean;
	private _container: HTMLElement;
	private _tableContainer: HTMLElement;

	private _classChangeTimeout: any;

	private _onContextMenu = new Emitter<ITableMouseEvent>();
	public readonly onContextMenu: Event<ITableMouseEvent> = this._onContextMenu.event;

	private _onClick = new Emitter<ITableMouseEvent>();
	public readonly onClick: Event<ITableMouseEvent> = this._onClick.event;

	private _onColumnResize = new Emitter<void>();
	public readonly onColumnResize = this._onColumnResize.event;

	public selection: Slick.Range[] | boolean;

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
		if (configuration && configuration.sorter) {
			this._sorter = configuration.sorter;
			this._grid.onSort.subscribe((e, args) => {
				this._sorter(args);
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
		this._grid.onColumnsResized.subscribe(() => this._onColumnResize.fire());
	}

	//own code begins here:


	private changeEditSession(enabled: boolean): void {
        this.enableEditing = enabled;
        let options: any = this._grid.getOptions();
        options.editable = enabled;
        options.enableAddRow = false; // TODO change to " options.enableAddRow = false;" when we support enableAddRow
        this._grid.setOptions(options);
    }




	private updateSchema(): void {
        if (!this.columnDefinitions) {
            return;
        }
        this._columns = this.columnDefinitions;
    }

	private setCallbackOnDataRowsChanged(): void {

        if (this.dataRows) {

            // We must wait until we get the first set of dataRows before we enable editing or slickgrid will complain

            if (this.enableEditing) {

                this.enterEditSession();

            }



            this.dataRows.setCollectionChangedCallback((change: CollectionChange, startIndex: number, count: number) => {

                this.renderGridDataRowsRange(startIndex, count);

            });

        }

    }

	private invalidateRange(start: number, end: number): void {
        let refreshedRows = _.range(start, end);
        this._grid.invalidateRows(refreshedRows, true);
        this._grid.render();
    }

    private renderGridDataRowsRange(startIndex: number, count: number): void {

        let editor = this._grid.getCellEditor();
        let oldValue = editor ? (<Slick.Editors.Text<T>> editor).getValue() : undefined;
        let wasValueChanged = editor ? editor.isValueChanged() : false;
		this.invalidateRange(startIndex, startIndex + count);

        let activeCell = this.activeCell;
        if (editor && activeCell.row >= startIndex && activeCell.row < startIndex + count) {
            if (oldValue && wasValueChanged) {
                (<Slick.Editors.Text<T>> editor).setValue(oldValue);
            }
        }
	}


	private onResize(): void {
		if (this._grid !== undefined) {
            // this will make sure the grid header and body to be re-rendered\
            this._grid.resizeCanvas();
        }
    }



	ngOnInit(): void {

        // ngOnInit() will be called *after* the first time ngOnChanges() is called

        // so, grid must be there already

        if (this.topRowNumber === undefined) {
            this.topRowNumber = 0;
        }

        if (this.dataRows && this.dataRows.getLength() > 0) {
            this._grid.scrollRowToTop(this.topRowNumber);
        }



        if (this.resized) {
            // Re-rendering the grid is expensive. Throttle so we only do so every 100ms.
            this.resized.throttleTime(100).subscribe(() => this.onResize());
        }



        // subscribe to slick events

        // https://github.com/mleibman/SlickGrid/wiki/Grid-Events
        this.setupEvents();
    }

	private setupEvents(): void {

        this._grid.onScroll.subscribe((e, args) => {

            this.onScroll.emit(args);

        });

        this._grid.onCellChange.subscribe((e, args) => {

            this.onCellChange.emit(args);

        });

        this._grid.onBeforeEditCell.subscribe((e, args) => {

            this.onBeforeEditCell.emit(args);

        });

        // Subscribe to all active cell changes to be able to catch when we tab to the header on the next row

        this._grid.onActiveCellChanged.subscribe((e, args) => {

            // Emit that we've changed active cells

            this.onActiveCellChanged.emit(args);

        });

        /*this._grid.onContextMenu.subscribe((e, args) => {

            this.onContextMenu.emit(e);

        });*/

        this.onBeforeEditCell.subscribe((e, args) => {
            // Since we need to return a string here, we are using calling a function instead of event emitter like other events handlers
            return this.BeforeAppendCell ? this.BeforeAppendCell(args.row, args.cell) : undefined;
        });

        this._grid.onRendered.subscribe((e, args) => {
            this.onRendered.emit(args);
        });
    }


    ngAfterViewInit(): void {
        this.loadFinished.emit();
    }



    ngOnDestroy(): void {
        if (this._resizeSubscription !== undefined) {
            this._resizeSubscription.unsubscribe();
		}

        if (this._gridSyncSubscription !== undefined) {
            this._gridSyncSubscription.unsubscribe();
        }
    }

	ngOnChanges(changes: { [propName: string]: SimpleChange }): void {
        let columnDefinitionChanges = changes['columnDefinitions'];
        let activeCell = this._grid ? this._grid.getActiveCell() : undefined;
        let hasGridStructureChanges = false;
        let wasEditing = this._grid ? !!this._grid.getCellEditor() : false;
        if (columnDefinitionChanges && !_.isEqual(columnDefinitionChanges.previousValue, columnDefinitionChanges.currentValue)) {
            this.updateSchema();
            if (!this._grid) {
				//this.initGrid();
				console.log('Grid failed to be initialized');
            } else {
                this._grid.resetActiveCell();
                this._grid.setColumns(this._columns);
            }
            hasGridStructureChanges = true;
            if (!columnDefinitionChanges.currentValue || columnDefinitionChanges.currentValue.length === 0) {
                activeCell = undefined;
            }

            if (activeCell) {
                let columnThatContainedActiveCell = columnDefinitionChanges.previousValue[Math.max(activeCell.cell - 1, 0)];
                let newActiveColumnIndex = columnThatContainedActiveCell ? columnDefinitionChanges.currentValue.findIndex(c => c.id === columnThatContainedActiveCell.id) : -1;
                activeCell.cell = newActiveColumnIndex !== -1 ? newActiveColumnIndex + 1 : 0;
            }
		}

        if (changes['dataRows']

            || (changes['highlightedCells'] && !_.isEqual(changes['highlightedCells'].currentValue, changes['highlightedCells'].previousValue))

            || (changes['blurredColumns'] && !_.isEqual(changes['blurredColumns'].currentValue, changes['blurredColumns'].previousValue))

            || (changes['columnsLoading'] && !_.isEqual(changes['columnsLoading'].currentValue, changes['columnsLoading'].previousValue))) {

            this.setCallbackOnDataRowsChanged();

            this._grid.updateRowCount();

            this._grid.setColumns(this._grid.getColumns());

            this._grid.invalidateAllRows();

			this._grid.render();

            hasGridStructureChanges = true;
        }



        if (hasGridStructureChanges) {

            if (activeCell) {

                this._grid.setActiveCell(activeCell.row, activeCell.cell);

            } else {

                this._grid.resetActiveCell();

            }

        }



        if (wasEditing && hasGridStructureChanges) {

            this._grid.editActiveCell(this._grid.getCellEditor());

        }

    }

//my code ends here.

	private mapMouseEvent(slickEvent: Slick.Event<any>, emitter: Emitter<ITableMouseEvent>) {
		slickEvent.subscribe((e: JQuery.Event) => {
			const originalEvent = e.originalEvent;
			const cell = this._grid.getCellFromEvent(originalEvent);
			const anchor = originalEvent instanceof MouseEvent ? { x: originalEvent.x, y: originalEvent.y } : originalEvent.srcElement as HTMLElement;
			emitter.fire({ anchor, cell });
		});
	}

	public dispose() {
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
	setData(data: Array<T> | TableDataView<T>): void {
		if (data instanceof TableDataView) {
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
		return this._grid.getSelectionModel().getSelectedRanges();
	}

	focus(): void {
		this._grid.focus();
	}

	setActiveCell(row: number, cell: number): void {
		this._grid.setActiveCell(row, cell);
	}

	setActive(): void {
		this._grid.setActiveCell(0, 1);
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

	//Additional public functions here:
	// Enables editing on the grid

    public enterEditSession(): void {
        this.changeEditSession(true);
    }

    // Disables editing on the grid

    public endEditSession(): void {
        this.changeEditSession(false);
    }


}
