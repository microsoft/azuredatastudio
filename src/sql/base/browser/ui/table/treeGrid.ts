/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/slick.grid';

import { FilterableColumn, ITableConfiguration, ITableStyles } from 'sql/base/browser/ui/table/interfaces';
import { Table } from 'sql/base/browser/ui/table/table';
import { IDisposableDataProvider } from 'sql/base/common/dataProvider';
import { generateUuid } from 'vs/base/common/uuid';
import { CellValueGetter, defaultCellValueGetter, defaultFilter, TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { AsyncDataProvider } from 'sql/base/browser/ui/table/asyncDataView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { createTreeGridExpandableColumnFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { escape } from 'sql/base/common/strings';

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

/**
 * TreeGrid component displays a hierarchical table data grouped into expandable and collapsible nodes.
 */
export class TreeGrid<T extends Slick.SlickData> extends Table<T> {
	constructor(parent: HTMLElement, configuration?: ITableConfiguration<T>, options?: Slick.GridOptions<T>) {
		super(parent, configuration, options);
		this._tableContainer.setAttribute('role', 'treegrid');
		if (configuration?.dataProvider && configuration.dataProvider instanceof TableDataView) {
			this._data = configuration.dataProvider;
		} else {
			this._data = new TableDataView<T>(configuration && configuration.dataProvider as Array<T>,
				undefined,
				undefined,
				defaultTreeGridFilter,
				undefined);
		}

		this._grid.onClick.subscribe((e, data) => {
			this.setRowExpandedState(data.row);
			return false;
		});

		// The events returned by grid are Jquery events. These events can be handled by returning false which executes preventDefault and stopPropagation
		this._grid.onKeyDown.subscribe((e, data) => {
			const keyboardEvent = (<any>e).originalEvent;
			if (keyboardEvent instanceof KeyboardEvent) {
				let event = new StandardKeyboardEvent(keyboardEvent);
				if (event.keyCode === KeyCode.Enter) {
					// toggle the collapsed state of the row
					this.setRowExpandedState(data.row);
					return false;
				} else if (event.keyCode === KeyCode.LeftArrow) {
					// Left arrow on first cell of the expanded row collapses it
					if (data.cell === 0) {
						this.setRowExpandedState(data.row, false); // Collapsing state
						return false;
					}
				} else if (event.keyCode === KeyCode.RightArrow) {
					// Right arrow on last cell of the collapsed row expands it.
					if (data.cell === (this._grid.getColumns().length - 1)) {
						this.setRowExpandedState(data.row, true);
						return false;
					}
				}
			}
			return true;
		});

		this._grid.onRendered.subscribe((e, data) => {
			const visibleRows = this._grid.getViewport();
			for (let i = visibleRows.top; i <= visibleRows.bottom; i++) {
				const rowData = this._data.getItem(i);
				// Getting the row div that corresponds to the data row
				const rowElement = this._tableContainer.querySelector(`div [role="row"][aria-rowindex="${(i + 1)}"]`);
				// If the row element is found in the dom, we are setting the required aria attributes for it.
				if (rowElement) {
					const cellDiv = <HTMLElement>rowElement.querySelector(`.slick-cell.l0`);
					if (cellDiv) {
						if (rowData.expanded !== undefined) {
							cellDiv.ariaExpanded = rowData.expanded;
						} else {
							cellDiv.removeAttribute('aria-expanded');
						}
					}
					if (rowData.setSize !== undefined) {
						rowElement.ariaSetSize = rowData.setSize;
					} else {
						rowElement.removeAttribute('aria-setsize');
					}
					if (rowData.posInSet !== undefined) {
						rowElement.ariaPosInSet = rowData.posInSet;
					} else {
						rowElement.removeAttribute('aria-posinset');
					}
					if (rowData.level !== undefined) {
						rowElement.ariaLevel = rowData.level;
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
		this.addTreeGridDataAttributes(this._data);
		this._grid.setData(this._data, true);
		this._data.filter(this._grid.getColumns());
	}

	public override set columns(columns: Slick.Column<T>[]) {
		if (columns[0]) {
			// Create a new formatter for the first column that adds level based indentation and a chevron icon.
			columns[0].formatter = createTreeGridExpandableColumnFormatter(columns[0].formatter ?? textFormatter);
		}
		super.columns = columns;
	}

	/**
	 *  Sets the expanded state to the specified value, or if undefined toggles the current state of the cell
	 */
	private setRowExpandedState(row: number, expanded?: boolean): void {
		const rowData = this._data.getItem(row);
		if (rowData['isParent']) {
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

	/**
	 * Adds additional properties to data rows necessary for displaying as part of the tree grid structure.
	 */
	private addTreeGridDataAttributes(data: IDisposableDataProvider<T>): void {
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
				if (parentRow.expanded === undefined) {
					parentRow.expanded = false;
				}
				parentRow.isParent = true;
				if (!parentRow._guid) {
					parentRow._guid = generateUuid();
				}
				dataRow.parentGuid = parentRow._guid;
			}
		}
	}

	override style(styles: ITableStyles): void {
		super.style(styles);
		const content: string[] = [];

		if (styles.listFocusAndSelectionForeground) {
			content.push(`.monaco-table.${this.idPrefix}.focused .slick-row .selected.active .codicon.toggle { color: ${styles.listFocusAndSelectionForeground}; }`);
		}

		if (styles.listInactiveSelectionForeground) {
			content.push(`.monaco-table.${this.idPrefix} .slick-row .selected.active .codicon.toggle { color: ${styles.listInactiveSelectionForeground}; }`);
		}

		if (content.length > 0) {
			this.styleElement.innerText += escape('\n' + content.join('\n'));
		}
	}
}
