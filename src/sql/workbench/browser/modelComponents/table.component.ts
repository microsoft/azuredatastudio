/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/table';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';

import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView, SlickTableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { attachTableStyler, attachButtonStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { CheckboxSelectColumn, ICheckboxCellActionEventArgs } from 'sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin';
import { Emitter, Event as vsEvent } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { slickGridDataItemColumnValueWithNoData, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { convertSizeToNumber } from 'sql/base/browser/dom';
import { RowDetailView, ExtendedItem } from 'sql/base/browser/ui/table/plugins/rowDetailView';
import { HeaderFilter } from 'sql/base/browser/ui/table/plugins/headerFilter.plugin';
import { find } from 'vs/base/common/arrays';
export enum ColumnSizingMode {
	ForceFit = 0,	// all columns will be sized to fit in viewable space, no horiz scroll bar
	AutoFit = 1,	// columns will be ForceFit up to a certain number; currently 3.  At 4 or more the behavior will switch to NO force fit
	DataFit = 2		// columns use sizing based on cell data, horiz scroll bar present if more cells than visible in view area
}

@Component({
	selector: 'modelview-table',
	template: `
		<div #table style="height:100%;" [style.font-size]="fontSize" [style.width]="width"></div>
	`
})
export default class TableComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _table: Table<Slick.SlickData>;
	//private _tableData: TableDataView<Slick.SlickData>;
	private _tableData: SlickTableDataView<Slick.SlickData>;
	private _tableColumns;
	private _checkboxColumns: CheckboxSelectColumn<{}>[] = [];
	private _onCheckBoxChanged = new Emitter<ICheckboxCellActionEventArgs>();
	public readonly onCheckBoxChanged: vsEvent<ICheckboxCellActionEventArgs> = this._onCheckBoxChanged.event;
	private rowDetail: RowDetailView<Slick.SlickData>;
	private filterPlugin: any;

	@ViewChild('table', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	transformColumns(columns: string[] | azdata.TableColumn[]): Slick.Column<any>[] {
		let tableColumns: any[] = <any[]>columns;
		if (tableColumns) {
			let mycolumns: Slick.Column<any>[] = [];
			let index: number = 0;
			(<any[]>columns).map(col => {
				if (col.type && col.type === 1) {
					this.createCheckBoxPlugin(col, index);
				}
				else if (col.value) {
					mycolumns.push(<Slick.Column<any>>{
						name: col.value,
						id: col.value,
						field: col.value,
						width: col.width,
						cssClass: col.cssClass,
						headerCssClass: col.headerCssClass,
						toolTip: col.toolTip,
						formatter: textFormatter,
					});
				} else {
					mycolumns.push(<Slick.Column<any>>{
						name: <string>col,
						id: <string>col,
						field: <string>col,
						formatter: textFormatter
					});
				}
				index++;
			});
			return mycolumns;
		} else {
			return (<string[]>columns).map(col => {
				return <Slick.Column<any>>{
					name: col,
					id: col,
					field: col
				};
			});
		}
	}

	public static transformData(rows: any[][], columns: any[]): { [key: string]: any }[] {
		if (rows && columns) {
			return rows.map(row => {
				let object: { [key: string]: any } = {};
				if (row.forEach) {
					row.forEach((val, index) => {
						let columnName: string = index < columns.length
							? (columns[index].value) ? columns[index].value : <string>columns[index]
							: '__detailsData__';
						object[columnName] = val;
					});
				}
				return object;
			});
		} else {
			return [];
		}
	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			//this._tableData = new TableDataView<Slick.SlickData>();
			this._tableData = new SlickTableDataView<Slick.SlickData>();

			let options = <Slick.GridOptions<any>>{
				syncColumnCellResize: true,
				enableColumnReorder: false,
				enableCellNavigation: true,
				forceFitColumns: true, // default to true during init, actual value will be updated when setProperties() is called
				dataItemColumnValueExtractor: slickGridDataItemColumnValueWithNoData // must change formatter if you are changing explicit column value extractor
			};

			this._table = new Table<Slick.SlickData>(this._inputContainer.nativeElement, { dataProvider: this._tableData, columns: this._tableColumns }, options);
			this._table.setData(this._tableData);
			this._table.setSelectionModel(new RowSelectionModel({ selectActiveRow: true }));

			this._register(this._table);
			this._register(attachTableStyler(this._table, this.themeService));
			this._register(this._table.onSelectedRowsChanged((e, data) => {
				this.selectedRows = data.rows;
				this.fireEvent({
					eventType: ComponentEventType.onSelectedRowChanged,
					args: e
				});
			}));

			this._table.grid.onKeyDown.subscribe((e: DOMEvent) => {
				if (this.moveFocusOutWithTab) {
					let event = new StandardKeyboardEvent(e as KeyboardEvent);
					if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
						e.stopImmediatePropagation();
						(<HTMLElement>(<HTMLElement>this._inputContainer.nativeElement).previousElementSibling).focus();

					} else if (event.equals(KeyCode.Tab)) {
						e.stopImmediatePropagation();
						(<HTMLElement>(<HTMLElement>this._inputContainer.nativeElement).nextElementSibling).focus();
					}
				}
			});

			const rowDetail = new RowDetailView({
				cssClass: '_detail_selector',
				process: (item) => {
					(<any>rowDetail).onAsyncResponse.notify({
						'itemDetail': item,
					}, undefined, this);
				},
				useRowClick: true,
				panelRows: 3,
				postTemplate: (itemDetail) => itemDetail.__detailsData__,
				preTemplate: () => '',
				loadOnce: true,
				width: 29
			});
			this.rowDetail = rowDetail;
			this._table.registerPlugin(<any>this.rowDetail);

			const filterPlugin = new HeaderFilter<Slick.SlickData>();
			this._register(attachButtonStyler(filterPlugin, this.themeService));
			this.filterPlugin = filterPlugin;
			this.filterPlugin.onFilterApplied.subscribe((e, args) => {
				let filterValues = args.column.filterValues;
				if (filterValues) {
					this._tableData.refresh();
					this._table.grid.resetActiveCell();
				}
			});
			//this.filterPlugin.onCommand.subscribe((e, args: any) => {
			//				this.columnSort(args.column.field, args.command === 'sort-asc');
			//});
			filterPlugin['getFilterValues'] = this.getFilterValues;
			filterPlugin['getAllFilterValues'] = this.getAllFilterValues;
			filterPlugin['getFilterValuesByInput'] = this.getFilterValuesByInput;
			this._table.registerPlugin(filterPlugin);

		}
	}

	public validate(): Thenable<boolean> {
		return super.validate().then(valid => {
			// TODO: table validation?
			return valid;
		});
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		this.layoutTable();
		super.layout();
	}

	private layoutTable(): void {
		let width: number = convertSizeToNumber(this.width);
		let height: number = convertSizeToNumber(this.height);
		let forceFit: boolean = true;

		// convert the tri-state viewmodel columnSizingMode to be either true or false for SlickGrid
		switch (this.forceFitColumns) {
			case ColumnSizingMode.DataFit: {
				forceFit = false;
				break;
			}
			case ColumnSizingMode.AutoFit: {
				// determine if force fit should be on or off based on the number of columns
				// this can be made more sophisticated if need be in the future.  a simple
				// check for 3 or less force fits causes the small number of columns to fill the
				// screen better.  4 or more, slickgrid seems to do a good job filling the view and having forceFit
				// false enables the scroll bar and avoids the over-packing should there be a very large
				// number of columns
				forceFit = (this._table.columns.length <= 3);
				break;
			}
			case ColumnSizingMode.ForceFit:
			default: {
				// default behavior for the table component (used primarily in wizards) is to forcefit the columns
				forceFit = true;
				break;
			}
		}
		let updateOptions = <Slick.GridOptions<any>>{
			forceFitColumns: forceFit
		};
		this._table.setOptions(updateOptions);

		this._table.layout(new Dimension(
			width && width > 0 ? width : getContentWidth(this._inputContainer.nativeElement),
			height && height > 0 ? height : getContentHeight(this._inputContainer.nativeElement)));
		this._table.resizeCanvas();
	}

	public setLayout(): void {

		// TODO allow configuring the look and feel
		this.layout();
	}
	private filter(item: any) {
		let columns = this._table.grid.getColumns();
		let value = true;
		for (let i = 0; i < columns.length; i++) {
			let col: any = columns[i];
			let filterValues = col.filterValues;
			if (filterValues && filterValues.length > 0) {
				if (item._parent) {
					value = value && find(filterValues, x => x === item._parent[col.field]);
				} else {
					let colValue = item[col.field];
					if (colValue instanceof Array) {
						value = value && find(filterValues, x => colValue.indexOf(x) >= 0);
					} else {
						value = value && find(filterValues, x => x === colValue);
					}
				}
			}
		}
		return value;
	}
	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._tableColumns = this.transformColumns(this.columns);
		this._tableColumns.unshift(this.rowDetail.getColumnDefinition());
		this._table.columns = this._tableColumns;


		if (this.properties['setData'] === true) {
			this._table.setData(this._tableData);
			this._tableData.setData(TableComponent.transformData(this.data, this.columns));
			this._tableData.setFilter((item) => this.filter(item));

		}
		if (this.properties['appendData'] !== undefined) {
			this._tableData.push(TableComponent.transformData(this.properties['appendData'], this.columns));
			this.data.push(...this.properties['appendData']);
		}

		this._table.setTableTitle(this.title);
		if (this.selectedRows) {
			this._table.setSelectedRows(this.selectedRows);
		}

		Object.keys(this._checkboxColumns).forEach(col => this.registerCheckboxPlugin(this._checkboxColumns[col]));

		if (this.ariaRowCount === -1) {
			this._table.removeAriaRowCount();
		}
		else {
			this._table.ariaRowCount = this.ariaRowCount;
		}

		if (this.ariaColumnCount === -1) {
			this._table.removeAriaColumnCount();
		}
		else {
			this._table.ariaColumnCount = this.ariaColumnCount;
		}

		if (this.ariaRole) {
			this._table.ariaRole = this.ariaRole;
		}

		if (this.ariaLabel) {
			this._table.ariaLabel = this.ariaLabel;
		}

		if (this.updateCells !== undefined) {
			this.updateTableCells(this.updateCells);
		}

		this.layoutTable();
		this.validate();
	}

	private updateTableCells(cellInfos): void {
		cellInfos.forEach((cellInfo) => {
			if (isUndefinedOrNull(cellInfo.column) || isUndefinedOrNull(cellInfo.row) || cellInfo.row < 0 || cellInfo.row > this.data.length) {
				return;
			}

			const checkInfo: azdata.CheckBoxCell = cellInfo as azdata.CheckBoxCell;
			if (checkInfo) {
				this._checkboxColumns[checkInfo.columnName].reactiveCheckboxCheck(checkInfo.row, checkInfo.checked);
			}
		});
	}

	private createCheckBoxPlugin(col: any, index: number) {
		let name = col.value;
		if (!this._checkboxColumns[col.value]) {
			this._checkboxColumns[col.value] = new CheckboxSelectColumn({
				title: col.value,
				toolTip: col.toolTip,
				width: col.width,
				cssClass: col.cssClass,
				headerCssClass: col.headerCssClass,
				actionOnCheck: col.options ? col.options.actionOnCheckbox : null
			}, index);

			this._register(this._checkboxColumns[col.value].onChange((state) => {
				this.fireEvent({
					eventType: ComponentEventType.onCellAction,
					args: {
						row: state.row,
						column: state.column,
						checked: state.checked,
						name: name
					}
				});
			}));
		}
	}

	private registerCheckboxPlugin(checkboxSelectColumn: CheckboxSelectColumn<{}>): void {
		this._tableColumns.splice(checkboxSelectColumn.index, 0, checkboxSelectColumn.getColumnDefinition());
		this._table.registerPlugin(checkboxSelectColumn);
		this._table.columns = this._tableColumns;
		this._table.autosizeColumns();
	}

	public focus(): void {
		if (this._table.grid.getDataLength() > 0) {
			if (!this._table.grid.getActiveCell()) {
				this._table.grid.setActiveCell(0, 0);
			}
			this._table.grid.getActiveCellNode().focus();
		}
	}

	private getFilterValues(dataView: Slick.DataProvider<Slick.SlickData>, column: Slick.Column<any>): Array<any> {
		const seen: Array<string> = [];
		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field!];
			if (value instanceof Array) {
				for (let item = 0; item < value.length; item++) {
					if (!seen.some(x => x === value[item])) {
						seen.push(value[item]);
					}
				}
			} else {
				if (!seen.some(x => x === value)) {
					seen.push(value);
				}
			}
		}
		return seen;
	}

	private getAllFilterValues(data: Array<Slick.SlickData>, column: Slick.Column<any>) {
		const seen: Array<any> = [];
		for (let i = 0; i < data.length; i++) {
			const value = data[i][column.field!];
			if (value instanceof Array) {
				for (let item = 0; item < value.length; item++) {
					if (!seen.some(x => x === value[item])) {
						seen.push(value[item]);
					}
				}
			} else {
				if (!seen.some(x => x === value)) {
					seen.push(value);
				}
			}
		}

		return seen.sort((v) => { return v; });
	}

	private getFilterValuesByInput($input: JQuery<HTMLElement>): Array<string> {
		const column = $input.data('column'),
			filter = $input.val() as string,
			dataView = this['grid'].getData() as Slick.DataProvider<Slick.SlickData>,
			seen: Array<any> = [];

		for (let i = 0; i < dataView.getLength(); i++) {
			const value = dataView.getItem(i)[column.field];
			if (value instanceof Array) {
				if (filter.length > 0) {
					const itemValue = !value ? [] : value;
					const lowercaseFilter = filter.toString().toLowerCase();
					const lowercaseVals = itemValue.map(v => v.toLowerCase());
					for (let valIdx = 0; valIdx < value.length; valIdx++) {
						if (!seen.some(x => x === value[valIdx]) && lowercaseVals[valIdx].indexOf(lowercaseFilter) > -1) {
							seen.push(value[valIdx]);
						}
					}
				}
				else {
					for (let item = 0; item < value.length; item++) {
						if (!seen.some(x => x === value[item])) {
							seen.push(value[item]);
						}
					}
				}

			} else {
				if (filter.length > 0) {
					const itemValue = !value ? '' : value;
					const lowercaseFilter = filter.toString().toLowerCase();
					const lowercaseVal = itemValue.toString().toLowerCase();

					if (!seen.some(x => x === value) && lowercaseVal.indexOf(lowercaseFilter) > -1) {
						seen.push(value);
					}
				}
				else {
					if (!seen.some(x => x === value)) {
						seen.push(value);
					}
				}
			}
		}

		return seen.sort((v) => { return v; });
	}

	// CSS-bound properties

	public get data(): any[][] {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, any[]>((props) => props.data, []);
	}

	public get setData(): boolean {
		return this.properties['setData'];
	}
	public set setData(newVal: boolean) {
		this.properties['setData'] = newVal;
	}

	public set data(newValue: any[][]) {
		this.setPropertyFromUI<azdata.TableComponentProperties, any[][]>((props, value) => props.data = value, newValue);
	}

	public get columns(): string[] {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, string[]>((props) => props.columns, []);
	}

	public get fontSize(): number | string {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, number | string>((props) => props.fontSize, '');
	}

	public set columns(newValue: string[]) {
		this.setPropertyFromUI<azdata.TableComponentProperties, string[]>((props, value) => props.columns = value, newValue);
	}

	public get selectedRows(): number[] {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, number[]>((props) => props.selectedRows, []);
	}

	public set selectedRows(newValue: number[]) {
		this.setPropertyFromUI<azdata.TableComponentProperties, number[]>((props, value) => props.selectedRows = value, newValue);
	}

	public get forceFitColumns() {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, ColumnSizingMode>((props) => props.forceFitColumns, ColumnSizingMode.ForceFit);
	}

	public get title() {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, string>((props) => props.title, '');
	}

	public get ariaRowCount(): number {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, number>((props) => props.ariaRowCount, -1);
	}

	public get ariaColumnCount(): number {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, number>((props) => props.ariaColumnCount, -1);
	}

	public set moveFocusOutWithTab(newValue: boolean) {
		this.setPropertyFromUI<azdata.TableComponentProperties, boolean>((props, value) => props.moveFocusOutWithTab = value, newValue);
	}

	public get moveFocusOutWithTab(): boolean {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, boolean>((props) => props.moveFocusOutWithTab, false);
	}

	public get updateCells(): azdata.TableCell[] {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, azdata.TableCell[]>((props) => props.updateCells, undefined);
	}

	public set updateCells(newValue: azdata.TableCell[]) {
		this.setPropertyFromUI<azdata.TableComponentProperties, azdata.TableCell[]>((properties, value) => { properties.updateCells = value; }, newValue);
	}
}
