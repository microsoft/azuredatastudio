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
	}

	public destroy() {
	}

	private handleClick(e: MouseEvent, args: Slick.OnClickEventArgs<T>): void {
		if (this.grid.getColumns()[args.cell].id === 'rowNumber') {
			this.grid.setSelectedRows([args.row]);
		}
	}

	public getColumnDefinition(): Slick.Column<T> {
		return {
			id: 'rowNumber',
			name: '',
			field: 'rowNumber',
			width: this.options.numberOfRows.toString().length * sizePerDigit,
			resizable: false,
			cssClass: this.options.cssClass,
			focusable: false,
			selectable: false,
			formatter: (r, c, v, cd, dc) => this.formatter(r, c, v, cd, dc)
		};
	}

	private formatter(row, cell, value, columnDef: Slick.Column<T>, dataContext): string {
		if (dataContext) {
			return `<span>${row}</span>`;
		}
		return null;
	}
}
