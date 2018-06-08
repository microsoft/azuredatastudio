/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';

import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { attachTableStyler } from 'sql/common/theme/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';

@Component({
	selector: 'modelview-table',
	template: `
		<div #table style="width: 100%"></div>
	`
})
export default class TableComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _table: Table<Slick.SlickData>;
	private _tableData: TableDataView<Slick.SlickData>;
	private _tableColumns;

	@ViewChild('table', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	transformColumns(columns: string[] | sqlops.TableColumn[]): Slick.Column<any>[] {
		let tableColumns: any[] = <any[]>columns;
		if (tableColumns) {
			return (<any[]>columns).map(col => {
				if (col.value) {
					return <Slick.Column<any>>{
						name: col.value,
						id: col.value,
						field: col.value
					};
				} else {
					return <Slick.Column<any>>{
						name: <string>col,
						id: <string>col,
						field: <string>col
					};
				}
			});
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

	transformData(rows: string[][], columns: any[]): { [key: string]: string }[] {
		return rows.map(row => {
			let object: { [key: string]: string } = {};
			row.forEach((val, index) => {
				let columnName: string = (columns[index].value) ? columns[index].value : <string>columns[index];
				object[columnName] = val;
			});
			return object;
		});
	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this._tableData = new TableDataView<Slick.SlickData>();

			let options = <Slick.GridOptions<any>>{
				syncColumnCellResize: true,
				enableColumnReorder: false,
				rowHeight: 45,
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
				this._onEventEmitter.fire({
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
		this._table.layout(new Dimension(
			this.width ? this.width : getContentWidth(this._inputContainer.nativeElement),
			this.height ? this.height : getContentHeight(this._inputContainer.nativeElement)));

		this._changeRef.detectChanges();
	}

	public setLayout(): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._tableData.clear();
		this._tableData.push(this.transformData(this.data, this.columns));
		this._tableColumns = this.transformColumns(this.columns);
		this._table.columns = this._tableColumns;
		this._table.setData(this._tableData);
		if (this.selectedRows) {
			this._table.setSelectedRows(this.selectedRows);
		}
		this._table.layout(new Dimension(
			this.width ? this.width : getContentWidth(this._inputContainer.nativeElement),
			this.height ? this.height : getContentHeight(this._inputContainer.nativeElement)));

		this.validate();
	}

	// CSS-bound properties

	public get data(): any[][] {
		return this.getPropertyOrDefault<sqlops.TableComponentProperties, any[]>((props) => props.data, []);
	}

	public set data(newValue: any[][]) {
		this.setPropertyFromUI<sqlops.TableComponentProperties, any[][]>((props, value) => props.data = value, newValue);
	}

	public get columns(): string[] {
		return this.getPropertyOrDefault<sqlops.TableComponentProperties, string[]>((props) => props.columns, []);
	}

	public set columns(newValue: string[]) {
		this.setPropertyFromUI<sqlops.TableComponentProperties, string[]>((props, value) => props.columns = value, newValue);
	}

	public get selectedRows(): number[] {
		return this.getPropertyOrDefault<sqlops.TableComponentProperties, number[]>((props) => props.selectedRows, []);
	}

	public set selectedRows(newValue: number[]) {
		this.setPropertyFromUI<sqlops.TableComponentProperties, number[]>((props, value) => props.selectedRows = value, newValue);
	}

	public get height(): number {
		return this.getPropertyOrDefault<sqlops.TableComponentProperties, number>((props) => props.height, undefined);
	}

	public set height(newValue: number) {
		this.setPropertyFromUI<sqlops.TableComponentProperties, number>((props, value) => props.height = value, newValue);
	}

	public get width(): number {
		return this.getPropertyOrDefault<sqlops.TableComponentProperties, number>((props) => props.width, undefined);
	}

	public set width(newValue: number) {
		this.setPropertyFromUI<sqlops.TableComponentProperties, number>((props, value) => props.width = value, newValue);
	}
}
