/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FilterableColumn } from 'sql/base/browser/ui/table/interfaces';
import { mixin } from 'vs/base/common/objects';

export interface IRowNumberColumnOptions {
	cssClass?: string;
	/**
	 * Controls the cell selection behavior. If the value is true or not specified, the entire row will be selected when a cell is clicked,
	 * and when the header is clicked, the entire table will be selected. If the value is false, the auto selection will not happen.
	 */
	autoCellSelection?: boolean;
}

const defaultOptions: IRowNumberColumnOptions = {
	autoCellSelection: true
};

export class RowNumberColumn<T> implements Slick.Plugin<T> {
	private handler = new Slick.EventHandler();
	private grid!: Slick.Grid<T>;

	constructor(private options?: IRowNumberColumnOptions) {
		this.options = mixin(this.options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>) {
		this.grid = grid;
		this.handler
			.subscribe(this.grid.onClick, (e: DOMEvent, args: Slick.OnClickEventArgs<T>) => this.handleClick(e as MouseEvent, args))
			.subscribe(this.grid.onHeaderClick, (e: DOMEvent, args: Slick.OnHeaderClickEventArgs<T>) => this.handleHeaderClick(e as MouseEvent, args));
	}

	public destroy() {
		this.handler.unsubscribeAll();
	}

	private handleClick(e: MouseEvent, args: Slick.OnClickEventArgs<T>): void {
		if (this.grid.getColumns()[args.cell].id === 'rowNumber' && this.options.autoCellSelection) {
			this.grid.setActiveCell(args.row, 1);
			if (this.grid.getSelectionModel()) {
				this.grid.setSelectedRows([args.row]);
			}
		}
	}

	private handleHeaderClick(e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>): void {
		if (args.column.id === 'rowNumber' && this.options.autoCellSelection) {
			this.grid.setActiveCell(this.grid.getViewport()?.top ?? 0, 1);
			let selectionModel = this.grid.getSelectionModel();
			if (selectionModel) {
				selectionModel.setSelectedRanges([new Slick.Range(0, 0, this.grid.getDataLength() - 1, this.grid.getColumns().length - 1)]);
			}
		}
	}

	public getColumnDefinition(): FilterableColumn<T> {
		// that smallest we can make it is 22 due to padding and margins in the cells
		return {
			id: 'rowNumber',
			name: '',
			field: 'rowNumber',
			width: 22,
			resizable: true,
			cssClass: this.options.cssClass,
			focusable: false,
			selectable: false,
			filterable: false,
			formatter: r => this.formatter(r)
		};
	}

	private formatter(row: number): string {
		// row is zero-based, we need make it 1 based for display in the result grid
		return `<span>${row + 1}</span>`;
	}
}
