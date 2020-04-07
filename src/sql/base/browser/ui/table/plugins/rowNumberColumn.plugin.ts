/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IRowNumberColumnOptions {
	numberOfRows: number;
	cssClass?: string;
}

export class RowNumberColumn<T> implements Slick.Plugin<T> {
	private handler = new Slick.EventHandler();
	private grid!: Slick.Grid<T>;

	constructor(private options: IRowNumberColumnOptions) {
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
			formatter: r => this.formatter(r)
		};
	}

	private formatter(row: number): string {
		// row is zero-based, we need make it 1 based for display in the result grid
		return `<span>${row + 1}</span>`;
	}
}
