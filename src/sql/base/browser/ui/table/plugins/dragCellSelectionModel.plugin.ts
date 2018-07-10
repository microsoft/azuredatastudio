// Drag select selection model gist taken from https://gist.github.com/skoon/5312536
// heavily modified

import { clone } from 'sql/base/common/objects';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { isUndefinedOrNull } from 'vs/base/common/types';

export class DragCellSelectionModel<T> implements Slick.SelectionModel<T, Array<Slick.Range>> {
	private readonly keyColResizeIncr = 5;

	private _grid: Slick.Grid<T>;
	private _ranges: Array<Slick.Range> = [];
	private _dragging = false;
	private _handler = new Slick.EventHandler();

	public onSelectedRangesChanged = new Slick.Event<Slick.Range[]>();

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler.subscribe(this._grid.onKeyDown, (e: KeyboardEvent) => this.handleKeyDown(e));
		this._handler.subscribe(this._grid.onClick, (e: MouseEvent) => this.handleClick(e));
		this._handler.subscribe(this._grid.onDrag, (e: MouseEvent) => this.handleDrag(e));
		this._handler.subscribe(this._grid.onDragInit, (e: MouseEvent) => this.handleDragInit(e));
		this._handler.subscribe(this._grid.onDragStart, (e: MouseEvent) => this.handleDragStart(e));
		this._handler.subscribe(this._grid.onDragEnd, (e: MouseEvent) => this.handleDragEnd(e));
		this._handler.subscribe(this._grid.onHeaderClick, (e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>) => this.handleHeaderClick(e, args));
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	private rangesToRows(ranges: Array<Slick.Range>): Array<number> {
		let rows = [];
		for (let i = 0; i < ranges.length; i++) {
			for (let j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
				rows.push(j);
			}
		}
		return rows;
	}

	private rowsToRanges(rows: Array<number>): Array<Slick.Range> {
		let ranges = [];
		let lastCell = this._grid.getColumns().length - 1;
		for (let i = 0; i < rows.length; i++) {
			ranges.push(new Slick.Range(rows[i], 0, rows[i], lastCell));
		}
		return ranges;
	}

	public getSelectedRows(): Array<number> {
		return this.rangesToRows(this._ranges);
	}

	public setSelectedRows(rows: Array<number>) {
		this.setSelectedRanges(this.rowsToRanges(rows));
	}

	public setSelectedRanges(ranges: Array<Slick.Range>) {
		this._ranges = ranges;
		this.onSelectedRangesChanged.notify(this._ranges);
	}

	public getSelectedRanges(): Array<Slick.Range> {
		return this._ranges;
	}

	/**
	 * Navigate and replace selection
	 * @param cell The cell to navigate to
	 */
	private navigateTo(cell: Slick.Cell) {
		let ranges = [new Slick.Range(cell.row, cell.cell - 1)];
		this.setSelectedRanges(ranges);
		this._grid.setActiveCell(cell.row, cell.cell);
	}

	/**
	 * Navigate and add to selection
	 * @param cell The cell to navigate to
	 * @param inclusive Whether all cell between current cell and target cell should be selected
	 */
	private navigateWithSelection(cell: Slick.Cell, inclusive = true) {
		let rangesToPush: Array<Slick.Range> = this.getSelectedRanges();
		if (inclusive) {
			let selectedRange = rangesToPush.pop();
			let fromRow = Math.min(selectedRange.fromRow, cell.row);
			let fromCell = Math.min(selectedRange.fromCell, cell.cell - 1);
			let toRow = Math.max(selectedRange.toRow, cell.row);
			let toCell = Math.max(selectedRange.toCell, cell.cell - 1);
			rangesToPush.push(new Slick.Range(fromRow, fromCell, toRow, toCell));
		} else {
			rangesToPush.push(new Slick.Range(cell.row, cell.cell - 1));
		}
		this.setSelectedRanges(rangesToPush);
		this._grid.setActiveCell(cell.row, cell.cell);
	}

	/**
	 * Rules: If the row colum is active, (assumed to always be true), cells are 1 based; if not they are 0 based
	 * 		  However, selection is still done 0 base when there is a row column
	 * @param e
	 */
	private handleKeyDown(e: KeyboardEvent): boolean {
		let activeCell = this._grid.getActiveCell();
		let hasRowColumn = this._grid.getOptions().showRowNumber;

		if (activeCell) {
			let event = new StandardKeyboardEvent(e);
			let cell: number;
			let row: number;
			switch (event.keyCode) {
				case KeyCode.LeftArrow:
					if (event.ctrlKey || event.metaKey) {
						// same as Home
					} else {
						// navigate left if it is possible
						if ((hasRowColumn && activeCell.cell > 1) || (!hasRowColumn && activeCell.cell > 0)) {
							cell = activeCell.cell - 1;
							row = activeCell.row;
						}
					}
					break;
				case KeyCode.RightArrow:
					if (event.ctrlKey || event.metaKey) {
						// same as End
					} else {
						// navigate right if it is possible
						if ((hasRowColumn && activeCell.cell < this._grid.getColumns().length) || (!hasRowColumn && activeCell.cell < this._grid.getColumns().length - 1)) {
							cell = activeCell.cell + 1;
							row = activeCell.row;
						}
					}
					break;
				case KeyCode.UpArrow:
					if (event.ctrlKey || event.metaKey) {
						// same as PgUp
					} else {
						// navigate up if possible
						if (activeCell.row > 0) {
							cell = activeCell.cell;
							row = activeCell.row - 1;
						}
					}
					break;
				case KeyCode.DownArrow:
					if (event.ctrlKey || event.metaKey) {
						// same as PgDown
					} else {
						// navigate down if possible
						if (activeCell.row < this._grid.getDataLength() - 1) {
							cell = activeCell.cell;
							row = activeCell.row + 1;
						}
					}
					break;
				case KeyCode.Home:
					if (event.ctrlKey || event.metaKey) {
						// navigate to the first cell of the first row
						cell = hasRowColumn ? 1 : 0;
						row = 0;
					} else {
						// navigate to the first cell of the current row
						cell = hasRowColumn ? 1 : 0;
						row = activeCell.row;
					}
					break;
				case KeyCode.End:
					if (event.ctrlKey || event.metaKey) {
						// navigate to the last cell of the last row
						cell = hasRowColumn ? this._grid.getColumns().length : this._grid.getColumns().length - 1;
						row = this._grid.getDataLength() - 1;
					} else {
						// navigate to the last cell of the current row
						cell = hasRowColumn ? this._grid.getColumns().length : this._grid.getColumns().length - 1;
						row = activeCell.row;
					}
					break;
				case KeyCode.PageDown:
					if (event.ctrlKey || event.metaKey) {
						// IDK
					} else {
						// Page down
						let windowSize = Math.abs(this._grid.getViewport().top - this._grid.getViewport().bottom);
						if (activeCell.row + windowSize >= this._grid.getDataLength()) {
							cell = activeCell.cell;
							row = this._grid.getDataLength() - 1;
						} else {
							cell = activeCell.cell;
							row = activeCell.row + windowSize;
						}
					}
					break;
				case KeyCode.PageUp:
					if (event.ctrlKey || event.metaKey) {
						// IDK
					} else {
						// Page up
						let windowSize = Math.abs(this._grid.getViewport().top - this._grid.getViewport().bottom);
						if (activeCell.row - windowSize < 0) {
							cell = activeCell.cell;
							row = 0;
						} else {
							cell = activeCell.cell;
							row = activeCell.row - windowSize;
						}
					}
					break;
			}

			if (!isUndefinedOrNull(cell) && !isUndefinedOrNull(row)) {
				if (event.shiftKey) {
					this.navigateWithSelection({ cell, row });
				} else {
					this.navigateTo({ cell, row });
				}
			}
		}

		e.stopImmediatePropagation();
		e.stopPropagation();
		e.preventDefault();
		return true;
	}

	private handleHeaderClick(e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>) {
		let columnIndex = this._grid.getColumnIndex(args.column.id);
		if (e.ctrlKey || e.metaKey) {
			this._ranges.push(new Slick.Range(0, columnIndex, this._grid.getDataLength() - 1, columnIndex));
			this._grid.setActiveCell(0, columnIndex + 1);
		} else if (e.shiftKey && this._ranges.length) {
			let last = this._ranges.pop().fromCell;
			let from = Math.min(columnIndex, last);
			let to = Math.max(columnIndex, last);
			this._ranges = [];
			for (let i = from; i <= to; i++) {
				if (i !== last) {
					this._ranges.push(new Slick.Range(0, i, this._grid.getDataLength() - 1, i));
				}
			}
			this._ranges.push(new Slick.Range(0, last, this._grid.getDataLength() - 1, last));
		} else {
			this._ranges = [new Slick.Range(0, columnIndex, this._grid.getDataLength() - 1, columnIndex)];
			this._grid.resetActiveCell();
		}
		this.setSelectedRanges(this._ranges);
		e.stopImmediatePropagation();
		return true;
	}

	private handleClick(e: MouseEvent) {
		let cell = this._grid.getCellFromEvent(e);
		if (!cell || !this._grid.canCellBeActive(cell.row, cell.cell)) {
			return false;
		}

		if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
			if (cell.cell !== 0) {
				this._ranges = [new Slick.Range(cell.row, cell.cell - 1, cell.row, cell.cell - 1)];
				this.setSelectedRanges(this._ranges);
				this._grid.setActiveCell(cell.row, cell.cell);
				return true;
			} else {
				this._ranges = [new Slick.Range(cell.row, 0, cell.row, this._grid.getColumns().length - 1)];
				this.setSelectedRanges(this._ranges);
				this._grid.setActiveCell(cell.row, 1);
				return true;
			}
		}
		else if (this._grid.getOptions().multiSelect) {
			if (e.ctrlKey || e.metaKey) {
				if (cell.cell === 0) {
					this._ranges.push(new Slick.Range(cell.row, 0, cell.row, this._grid.getColumns().length - 1));
					this._grid.setActiveCell(cell.row, 1);
				} else {
					this._ranges.push(new Slick.Range(cell.row, cell.cell - 1, cell.row, cell.cell - 1));
					this._grid.setActiveCell(cell.row, cell.cell);
				}
			} else if (this._ranges.length && e.shiftKey) {
				let last = this._ranges.pop();
				if (cell.cell === 0) {
					let fromRow = Math.min(cell.row, last.fromRow);
					let toRow = Math.max(cell.row, last.fromRow);
					this._ranges = [new Slick.Range(fromRow, 0, toRow, this._grid.getColumns().length - 1)];
				} else {
					let fromRow = Math.min(cell.row, last.fromRow);
					let fromCell = Math.min(cell.cell - 1, last.fromCell);
					let toRow = Math.max(cell.row, last.toRow);
					let toCell = Math.max(cell.cell - 1, last.toCell);
					this._ranges = [new Slick.Range(fromRow, fromCell, toRow, toCell)];
				}
			}
		}

		this.setSelectedRanges(this._ranges);

		return true;
	}

	private handleDragInit(e: MouseEvent) {
		e.stopImmediatePropagation();
	}

	private handleDragStart(e: MouseEvent) {
		let cell = this._grid.getCellFromEvent(e);
		e.stopImmediatePropagation();
		this._dragging = true;
		if (e.ctrlKey || e.metaKey) {
			this._ranges.push(new Slick.Range(cell.row, cell.cell));
			this._grid.setActiveCell(cell.row, cell.cell);
		} else if (this._ranges.length && e.shiftKey) {
			let last = this._ranges.pop();
			let fromRow = Math.min(cell.row, last.fromRow);
			let fromCell = Math.min(cell.cell - 1, last.fromCell);
			let toRow = Math.max(cell.row, last.toRow);
			let toCell = Math.max(cell.cell - 1, last.toCell);
			this._ranges = [new Slick.Range(fromRow, fromCell, toRow, toCell)];
		} else {
			this._ranges = [new Slick.Range(cell.row, cell.cell)];
			this._grid.setActiveCell(cell.row, cell.cell);
		}
		this.setSelectedRanges(this._ranges);
	}

	private handleDrag(e: MouseEvent) {
		if (this._dragging) {
			let cell = this._grid.getCellFromEvent(e);
			let activeCell = this._grid.getActiveCell();
			if (!cell || !this._grid.canCellBeActive(cell.row, cell.cell)) {
				return false;
			}

			this._ranges.pop();

			if (activeCell.cell === 0) {
				let lastCell = this._grid.getColumns().length - 1;
				let firstRow = Math.min(cell.row, activeCell.row);
				let lastRow = Math.max(cell.row, activeCell.row);
				this._ranges.push(new Slick.Range(firstRow, 0, lastRow, lastCell));
			} else {
				let firstRow = Math.min(cell.row, activeCell.row);
				let lastRow = Math.max(cell.row, activeCell.row);
				let firstColumn = Math.min(cell.cell - 1, activeCell.cell - 1);
				let lastColumn = Math.max(cell.cell - 1, activeCell.cell - 1);
				this._ranges.push(new Slick.Range(firstRow, firstColumn, lastRow, lastColumn));
			}
			this.setSelectedRanges(this._ranges);
			return true;
		}
		return false;
	}

	private handleDragEnd(e: MouseEvent) {
		this._dragging = false;
	}
}