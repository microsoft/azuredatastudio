/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/declarativeTable';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { equals as arrayEquals } from 'vs/base/common/arrays';
import { localize } from 'vs/nls';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';

export enum DeclarativeDataType {
	string = 'string',
	category = 'category',
	boolean = 'boolean',
	editableCategory = 'editableCategory',
	component = 'component'
}

@Component({
	selector: 'modelview-declarativeTable',
	templateUrl: decodeURI(require.toUrl('./declarativeTable.component.html'))
})
export default class DeclarativeTableComponent extends ContainerBase<any, azdata.DeclarativeTableProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _data: azdata.DeclarativeTableCellValue[][] = [];
	private columns: azdata.DeclarativeTableColumn[] = [];
	private _selectedRow: number;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	public isHeaderChecked(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.isChecked;
	}

	public isCheckBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.boolean;
	}

	public isControlEnabled(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return !column.isReadOnly;
	}

	private isLabel(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.isReadOnly && column.valueType === DeclarativeDataType.string;
	}

	public isChecked(rowIdx: number, colIdx: number): boolean {
		let cellData = this.data[rowIdx][colIdx];
		if (cellData?.value === false) {
			return false;
		}
		// Disabling it to check for null and undefined.
		// eslint-disable-next-line eqeqeq
		return cellData != undefined;
	}

	public onInputBoxChanged(e: string, rowIdx: number, colIdx: number): void {
		this.onCellDataChanged(e, rowIdx, colIdx);
	}

	public onCheckBoxChanged(e: boolean, rowIdx: number, colIdx: number): void {
		this.onCellDataChanged(e, rowIdx, colIdx);
		// If all of the rows in that column are now checked, let's update the header.
		if (this.columns[colIdx].showCheckAll) {
			if (e) {
				for (let rowIdx = 0; rowIdx < this.data.length; rowIdx++) {
					if (this.data[rowIdx][colIdx].value === false) {
						return;
					}
				}
			}
			this.columns[colIdx].isChecked = e;
			this._changeRef.detectChanges();
		}
	}

	public onHeaderCheckBoxChanged(e: boolean, colIdx: number): void {
		this.columns[colIdx].isChecked = e;
		this.data.forEach((row, rowIdx) => {
			if (row[colIdx].value !== e) {
				this.onCellDataChanged(e, rowIdx, colIdx);
			}
		});
		this._changeRef.detectChanges();
	}

	public trackByFnCols(index: number, _item: any): number {
		return index;
	}

	public onSelectBoxChanged(e: ISelectData | string, rowIdx: number, colIdx: number): void {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];

		if (column.categoryValues) {
			if (typeof e === 'string') {
				let category = column.categoryValues.find(c => c.displayName === e);
				if (category) {
					this.onCellDataChanged(category.name, rowIdx, colIdx);
				} else {
					this.onCellDataChanged(e, rowIdx, colIdx);
				}
			} else {
				this.onCellDataChanged(column.categoryValues[e.index].name, rowIdx, colIdx);
			}
		}
	}

	private onCellDataChanged(newValue: string | number | boolean | any, rowIdx: number, colIdx: number): void {
		this.data[rowIdx][colIdx].value = newValue;

		if (this.properties.data) {
			this.setPropertyFromUI<any[][]>((props, value) => props.data = value, this.data);
		} else {
			this.setPropertyFromUI<any[][]>((props, value) => props.dataValues = value, this.data);
		}

		let newCellData: azdata.TableCell = {
			row: rowIdx,
			column: colIdx,
			value: newValue
		};
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: newCellData
		});
	}

	public isSelectBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.category;
	}

	private isEditableSelectBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.editableCategory;
	}

	public isInputBox(colIdx: number): boolean {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.valueType === DeclarativeDataType.string && !column.isReadOnly;
	}

	public isComponent(colIdx: number): boolean {
		return this.columns[colIdx].valueType === DeclarativeDataType.component;
	}

	public getColumnWidth(col: number | azdata.DeclarativeTableColumn): string {
		let column = typeof col === 'number' ? this.columns[col] : col;
		return convertSize(column.width, '30px');
	}

	public getOptions(colIdx: number): string[] {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		return column.categoryValues ? column.categoryValues.map(x => x.displayName) : [];
	}

	public getSelectedOptionDisplayName(rowIdx: number, colIdx: number): string {
		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		let cellData = this.data[rowIdx][colIdx];
		if (cellData && column.categoryValues) {
			let category = column.categoryValues.find(v => v.name === cellData.value);
			if (category) {
				return category.displayName;
			} else if (this.isEditableSelectBox(colIdx)) {
				return String(cellData.value);
			} else {
				return undefined;
			}
		} else {
			return '';
		}
	}

	public getAriaLabel(rowIdx: number, colIdx: number): string {
		const cellData = this.data[rowIdx][colIdx];
		if (this.isLabel(colIdx)) {
			if (cellData) {
				if (cellData.ariaLabel) {
					return cellData.ariaLabel;
				} else if (cellData.value) {
					return String(cellData.value);
				}
			} else {
				return localize('blankValue', "blank");
			}
		}

		return '';
	}

	public getCheckAllColumnAriaLabel(colIdx: number): string {
		return localize('checkAllColumnLabel', "check all checkboxes in column: {0}", this.columns[colIdx].displayName);
	}

	public getHeaderAriaLabel(colIdx: number): string {
		const column = this.columns[colIdx];
		return (column.ariaLabel) ? column.ariaLabel : column.displayName;
	}

	public getItemDescriptor(componentId: string): IComponentDescriptor {
		return this.modelStore.getComponentDescriptor(componentId);
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	private static ACCEPTABLE_VALUES = new Set<string>(['number', 'string', 'boolean']);
	public setProperties(properties: azdata.DeclarativeTableProperties): void {
		const basicData: any[][] = properties.data ?? [];
		const complexData: azdata.DeclarativeTableCellValue[][] = properties.dataValues ?? [];
		let finalData: azdata.DeclarativeTableCellValue[][];

		finalData = basicData.map(row => {
			return row.map((value): azdata.DeclarativeTableCellValue => {
				if (DeclarativeTableComponent.ACCEPTABLE_VALUES.has(typeof (value))) {
					return {
						value: value
					};
				} else {
					return {
						value: JSON.stringify(value)
					};
				}
			});
		});

		if (finalData.length <= 0) {
			finalData = complexData;
		}

		this.columns = properties.columns ?? [];

		// check whether the data property is changed before actually setting the properties.
		const isDataPropertyChanged = !arrayEquals(this.data, finalData ?? [], (a, b) => {
			return arrayEquals(a, b);
		});

		// the angular is using reference compare to determine whether the data is changed or not
		// so we are only updating it when the actual data has changed by doing the deep comparison.
		// if the data property is changed, we need add child components to the container,
		// so that the events can be passed upwards through the control hierarchy.
		if (isDataPropertyChanged) {
			this.clearContainer();
			this._data = finalData;
		}
		super.setProperties(properties);
	}

	public get data(): azdata.DeclarativeTableCellValue[][] {
		return this._data;
	}

	public isRowSelected(row: number): boolean {
		// Only react when the user wants you to
		if (this.getProperties().selectEffect !== true) {
			return false;
		}
		return this._selectedRow === row;
	}

	public onCellClick(row: number) {
		// Only react when the user wants you to
		if (this.getProperties().selectEffect !== true) {
			return;
		}
		if (!this.isRowSelected(row)) {
			this._selectedRow = row;
			this._changeRef.detectChanges();

			this.fireEvent({
				eventType: ComponentEventType.onDidClick,
				args: {
					row
				}
			});
		}
	}
}
