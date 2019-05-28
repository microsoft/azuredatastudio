/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/table';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/electron-browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/workbench/electron-browser/modelComponents/interfaces';

import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { CheckboxSelectColumn, ICheckboxCellActionEventArgs, ActionOnCheck } from 'sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin';
import { Emitter, Event as vsEvent } from 'vs/base/common/event';

@Component({
	selector: 'modelview-table',
	template: `
		<div #table style="width: 100%;height:100%" [style.font-size]="fontSize"></div>
	`
})
export default class TableComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _table: Table<Slick.SlickData>;
	private _tableData: TableDataView<Slick.SlickData>;
	private _tableColumns;
	private _checkboxColumns: CheckboxSelectColumn<{}>[] = [];
	private _onCheckBoxChanged = new Emitter<ICheckboxCellActionEventArgs>();
	public readonly onCheckBoxChanged: vsEvent<ICheckboxCellActionEventArgs> = this._onCheckBoxChanged.event;

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
						toolTip: col.toolTip
					});
				} else {
					mycolumns.push(<Slick.Column<any>>{
						name: <string>col,
						id: <string>col,
						field: <string>col
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



	public static transformData(rows: string[][], columns: any[]): { [key: string]: string }[] {
		if (rows && columns) {
			return rows.map(row => {
				let object: { [key: string]: string } = {};
				if (row.forEach) {
					row.forEach((val, index) => {
						let columnName: string = (columns[index].value) ? columns[index].value : <string>columns[index];
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
			this._tableData = new TableDataView<Slick.SlickData>();

			let options = <Slick.GridOptions<any>>{
				syncColumnCellResize: true,
				enableColumnReorder: false,
				enableCellNavigation: true,
				forceFitColumns: true
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
		let width: number = this.convertSizeToNumber(this.width);
		let height: number = this.convertSizeToNumber(this.height);
		this._table.layout(new Dimension(
			width && width > 0 ? width : getContentWidth(this._inputContainer.nativeElement),
			height && height > 0 ? height : getContentHeight(this._inputContainer.nativeElement)));
	}

	public setLayout(): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._tableData.clear();
		this._tableData.push(TableComponent.transformData(this.data, this.columns));
		this._tableColumns = this.transformColumns(this.columns);
		this._table.columns = this._tableColumns;
		this._table.setData(this._tableData);
		if (this.selectedRows) {
			this._table.setSelectedRows(this.selectedRows);
		}

		for (let col in this._checkboxColumns) {
			this.registerCheckboxPlugin(this._checkboxColumns[col]);
		}

		this.layoutTable();
		this.validate();
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

	// CSS-bound properties

	public get data(): any[][] {
		return this.getPropertyOrDefault<azdata.TableComponentProperties, any[]>((props) => props.data, []);
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
}
