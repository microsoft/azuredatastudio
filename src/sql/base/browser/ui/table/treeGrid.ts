/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/slick.grid';

import { FilterableColumn, ITableConfiguration } from 'sql/base/browser/ui/table/interfaces';
import { Table } from 'sql/base/browser/ui/table/table';
import { treeGridExpandableColumnFormatter } from 'sql/base/browser/ui/table/formatters';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { generateUuid } from 'vs/base/common/uuid';
import { CellValueGetter, defaultCellValueGetter, defaultFilter, TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { isArray } from 'vs/base/common/types';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';


function defaultTreeGridFilter<T extends Slick.SlickData>(data: T[], columns: FilterableColumn<T>[], cellValueGetter: CellValueGetter = defaultCellValueGetter): T[] {
	let filteredData = defaultFilter(data, columns, cellValueGetter);

	// filtering out rows which have parent/grandparents collapsed.
	filteredData = filteredData.filter((item) => {
		let parent = data[item.parent];
		while (parent) {
			if (!parent.expanded) {
				return false;
			}
			parent = data[parent.parent];
		}
		return true;
	});

	return filteredData;
}


export class TreeGrid<T extends Slick.SlickData> extends Table<T> {
	constructor(parent: HTMLElement, configuration?: ITableConfiguration<T>, options?: Slick.GridOptions<T>) {
		super(parent, configuration, options);

		if (!configuration || !configuration.dataProvider || isArray(configuration.dataProvider)) {
			this._data = new TableDataView<T>(configuration && configuration.dataProvider as Array<T>,
				undefined,
				undefined,
				defaultTreeGridFilter,
				undefined);
		} else {
			this._data = configuration.dataProvider;
		}

		this._grid.onClick.subscribe((e, data) => {
			this.setCellExpandedState(data.row, data.cell);
			return false;
		});

		this._grid.onKeyDown.subscribe((e, data) => {
			const keyboardEvent = (<any>e).originalEvent;
			if (keyboardEvent instanceof KeyboardEvent) {
				let event = new StandardKeyboardEvent(keyboardEvent);
				if (event.keyCode === KeyCode.Enter) {
					// toggle the collapsed state of the row
					this.setCellExpandedState(data.row, data.cell);
				} else if (event.keyCode === KeyCode.LeftArrow) {
					// Left arrow on first cell of the expanded row collapses it
					if (data.cell === 0) {
						this.setCellExpandedState(data.row, this.expandableColumnIndex(), false);
					}
				} else if (event.keyCode === KeyCode.RightArrow) {
					// Right arrow on last cell of the collapsed row expands it.
					if (data.cell === (this._grid.getColumns().length - 1)) {
						this.setCellExpandedState(data.row, this.expandableColumnIndex(), true);
					}
				}
			}
			return false;
		});

		this._grid.onRendered.subscribe((e, data) => {
			// Changing table role from grid to treegrid
			this._tableContainer.setAttribute('role', 'treegrid');
			for (let i = 0; i < this._data.getLength(); i++) {
				const rowData = this._data.getItem(i);
				// Getting the row div that corresponds to the data row
				const rowElement = this._tableContainer.querySelector(`div [role="row"][aria-rowindex="${(i + 1)}"]`);
				// If the row element is found in the dom, we are setting the required aria attributes for it.
				if (rowElement) {
					if (rowData.expanded !== undefined) {
						rowElement.ariaExpanded = rowData.expanded;
					}
					if (rowData.level !== undefined) {
						rowElement.ariaLevel = rowData.level;
					}
					if (rowData.setSize !== undefined) {
						rowElement.ariaSetSize = rowData.setSize;
					}
					if (rowData.posInSet !== undefined) {
						rowElement.ariaPosInSet = rowData.posInSet;
					}
				}
			}
			return false;
		});
	}

	override setData(data: Array<T>): void;
	override setData(data: TableDataView<T>): void;
	override setData(data: AsyncDataProvider<T>): void;
	override setData(data: Array<T> | TableDataView<T> | AsyncDataProvider<T>): void {
		if (data instanceof TableDataView || data instanceof AsyncDataProvider) {
			this._data = data;
		} else {
			this._data = new TableDataView<T>(data, undefined, undefined, defaultTreeGridFilter);
		}
		this.transformData(this._data);
		this._grid.setData(this._data, true);
		this._data.filter(this._grid.getColumns());
	}

	private setCellExpandedState(row: number, cell: number, expanded?: boolean): void {
		const rowData = this._data.getItem(row);
		if (rowData['isParent'] && this._grid.getColumns()[cell].formatter === treeGridExpandableColumnFormatter) {
			if (expanded === undefined) {
				(<any>rowData).expanded = !rowData.expanded;
			} else {
				(<any>rowData).expanded = expanded;
			}
			this._data.filter(this._grid.getColumns());
			this.rerenderGrid();
			this.focus();
		}
	}


	// Gets the index for the expandable column
	private expandableColumnIndex(): number {
		return this._grid.getColumns().findIndex(c => c.formatter === treeGridExpandableColumnFormatter);
	}


	// We need to transform the grid data to include required aria attributes to the rows
	private transformData(data: IDisposableDataProvider<T>): IDisposableDataProvider<T> {
		for (let i = 0; i < data.getLength(); i++) {
			const dataRow = <any>data.getItem(i);
			if (dataRow.parent === undefined || dataRow.parent === -1) {
				dataRow.level = 1;
			} else {
				const parentRow = <any>data.getItem(dataRow.parent);
				dataRow.level = parentRow.level + 1;
				if (parentRow.setSize === undefined) {
					parentRow.setSize = 1;
				} else {
					parentRow.setSize += 1;
				}
				dataRow.posInSet = parentRow.setSize;
				parentRow.expanded = false;
				parentRow.isParent = true;
				if (!parentRow._guid) {
					parentRow._guid = generateUuid();
				}
				dataRow.parentGuid = parentRow._guid;
			}
		}
		return data;
	}
}
