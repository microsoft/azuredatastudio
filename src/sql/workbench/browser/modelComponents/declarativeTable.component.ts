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
import { find, equals as arrayEquals } from 'vs/base/common/arrays';
import { localize } from 'vs/nls';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { convertSize } from 'sql/base/browser/dom';

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
export default class DeclarativeTableComponent extends ContainerBase<any> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private data: any[][] = [];
	private columns: azdata.DeclarativeTableColumn[] = [];

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
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
		return cellData;
	}

	public onInputBoxChanged(e: string, rowIdx: number, colIdx: number): void {
		this.onCellDataChanged(e, rowIdx, colIdx);
	}

	public onCheckBoxChanged(e: boolean, rowIdx: number, colIdx: number): void {
		this.onCellDataChanged(e, rowIdx, colIdx);
		if (this.columns[colIdx].showCheckAll) {
			if (e) {
				for (let rowIdx = 0; rowIdx < this.data.length; rowIdx++) {
					if (!this.data[rowIdx][colIdx]) {
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
			if (row[colIdx] !== e) {
				this.onCellDataChanged(e, rowIdx, colIdx);
			}
		});
		this._changeRef.detectChanges();
	}

	public trackByFnCols(index: number, item: any): any {
		return index;
	}

	public onSelectBoxChanged(e: ISelectData | string, rowIdx: number, colIdx: number): void {

		let column: azdata.DeclarativeTableColumn = this.columns[colIdx];
		if (column.categoryValues) {
			if (typeof e === 'string') {
				let category = find(column.categoryValues, c => c.displayName === e);
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

	private onCellDataChanged(newValue: any, rowIdx: number, colIdx: number): void {
		this.data[rowIdx][colIdx] = newValue;
		this.setPropertyFromUI<azdata.DeclarativeTableProperties, any[][]>((props, value) => props.data = value, this.data);
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
			let category = find(column.categoryValues, v => v.name === cellData);
			if (category) {
				return category.displayName;
			} else if (this.isEditableSelectBox(colIdx)) {
				return cellData;
			} else {
				return undefined;
			}
		} else {
			return '';
		}
	}

	public getAriaLabel(rowIdx: number, colIdx: number): string {
		const cellData = this.data[rowIdx][colIdx];
		return this.isLabel(colIdx) ? (cellData && cellData !== '' ? cellData : localize('blankValue', "blank")) : '';
	}

	public getItemDescriptor(componentId: string): IComponentDescriptor {
		return this.modelStore.getComponentDescriptor(componentId);
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		const newData = properties.data ?? [];
		this.columns = properties.columns ?? [];

		// check whether the data property is changed before actually setting the properties.
		const isDataPropertyChanged = !arrayEquals(this.data, newData ?? [], (a, b) => {
			return arrayEquals(a, b);
		});

		// the angular is using reference compare to determine whether the data is changed or not
		// so we are only updating it when the actual data has changed by doing the deep comparison.
		// if the data property is changed, we need add child components to the container,
		// so that the events can be passed upwards through the control hierarchy.
		if (isDataPropertyChanged) {
			this.clearContainer();
			this.data = newData;
			this.data?.forEach(row => {
				for (let i = 0; i < row.length; i++) {
					if (this.isComponent(i)) {
						this.addToContainer(this.getItemDescriptor(row[i] as string), undefined);
					}
				}
			});
		}
		super.setProperties(properties);
	}
}
