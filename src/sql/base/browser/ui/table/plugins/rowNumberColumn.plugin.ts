/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

export interface IRowNumberColumnOptions {
	numberOfRows: number;
	cssClass?: string;
}

const sizePerDigit = 15;

export class RowNumberColumn<T> implements Slick.Plugin<T> {
	private handler = new Slick.EventHandler();
	private grid: Slick.Grid<T>;

	constructor(private options: IRowNumberColumnOptions) {
	}

	public init(grid: Slick.Grid<T>) {
		this.grid = grid;
		this.handler
			.subscribe(this.grid.onClick, (e, args) => this.handleClick(e, args))
			.subscribe(this.grid.onHeaderClick, (e, args) => this.handleHeaderClick(e, args));
	}

	public destroy() {
		this.handler.unsubscribeAll();
	}

	private handleClick(e: MouseEvent, args: Slick.OnClickEventArgs<T>): void {
		if (this.grid.getColumns()[args.cell].id === 'rowNumber') {
			this.grid.setActiveCell(args.row, 1);
			if (this.grid.getSelectionModel()) {
				this.grid.setSelectedRows([args.row]);
			}
		}
	}

	private handleHeaderClick(e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>): void {
		if (args.column.id === 'rowNumber') {
			this.grid.setActiveCell(0, 1);
			let selectionModel = this.grid.getSelectionModel();
			if (selectionModel) {
				selectionModel.setSelectedRanges([new Slick.Range(0, 0, this.grid.getDataLength() - 1, this.grid.getColumns().length - 1)]);
			}
		}
	}

	public getColumnDefinition(): Slick.Column<T> {
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
			formatter: (r, c, v, cd, dc) => this.formatter(r, c, v, cd, dc)
		};
	}

	private formatter(row, cell, value, columnDef: Slick.Column<T>, dataContext): string {
		if (dataContext) {
			// row is zero-based, we need make it 1 based for display in the result grid
			//
			return `<span>${row + 1}</span>`;
		}
		return null;
	}
}
