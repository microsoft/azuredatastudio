// Drag select selection model gist taken from https://gist.github.com/skoon/5312536
// heavily modified

import { clone } from 'sql/base/common/objects';

export class DragCellSelectionModel<T> implements Slick.SelectionModel<T, Array<Slick.Range>> {
	private readonly keyColResizeIncr = 5;

	private _grid: Slick.Grid<T>;
	private _ranges: Array<Slick.Range> = [];
	private _dragging = false;
	private _handler = new Slick.EventHandler();

	public onSelectedRangesChanged = new Slick.Event<Slick.Range[]>();

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._handler.subscribe(this._grid.onActiveCellChanged, (e: Event, data: Slick.OnActiveCellChangedEventArgs<T>) => this.handleActiveCellChange(e, data));
		this._handler.subscribe(this._grid.onKeyDown, (e: JQueryInputEventObject) => this.handleKeyDown(e));
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

	private handleActiveCellChange(e: Event, data: Slick.OnActiveCellChangedEventArgs<T>) { }

	private isNavigationKey(e: BaseJQueryEventObject) {
		// Nave keys (home, end, arrows) are all in sequential order so use a
		switch (e.which) {
			case $.ui.keyCode.HOME:
			case $.ui.keyCode.END:
			case $.ui.keyCode.LEFT:
			case $.ui.keyCode.UP:
			case $.ui.keyCode.RIGHT:
			case $.ui.keyCode.DOWN:
				return true;
			default:
				return false;
		}
	}

	private navigateLeft(e: JQueryInputEventObject, activeCell: Slick.Cell) {
		if (activeCell.cell > 1) {
			let isHome = e.which === $.ui.keyCode.HOME;
			let newActiveCellColumn = isHome ? 1 : activeCell.cell - 1;
			// Unsure why but for range, must record 1 index less than expected
			let newRangeColumn = newActiveCellColumn - 1;

			if (e.shiftKey) {
				let last = this._ranges.pop();

				// If we are on the rightmost edge of the range and we navigate left,
				// we want to deselect the rightmost cell
				if (last.fromCell <= newRangeColumn) { last.toCell -= 1; }

				let fromRow = Math.min(activeCell.row, last.fromRow);
				let fromCell = Math.min(newRangeColumn, last.fromCell);
				let toRow = Math.max(activeCell.row, last.toRow);
				let toCell = Math.max(newRangeColumn, last.toCell);
				this._ranges = [new Slick.Range(fromRow, fromCell, toRow, toCell)];
			} else {
				this._ranges = [new Slick.Range(activeCell.row, newRangeColumn, activeCell.row, newRangeColumn)];
			}

			this._grid.setActiveCell(activeCell.row, newActiveCellColumn);
			this.setSelectedRanges(this._ranges);
		}
	}

	private navigateRight(e: JQueryInputEventObject, activeCell: Slick.Cell) {
		let columnLength = this._grid.getColumns().length;
		if (activeCell.cell < columnLength) {
			let isEnd = e.which === $.ui.keyCode.END;
			let newActiveCellColumn = isEnd ? columnLength : activeCell.cell + 1;
			// Unsure why but for range, must record 1 index less than expected
			let newRangeColumn = newActiveCellColumn - 1;
			if (e.shiftKey) {
				let last = this._ranges.pop();

				// If we are on the leftmost edge of the range and we navigate right,
				// we want to deselect the leftmost cell
				if (newRangeColumn <= last.toCell) { last.fromCell += 1; }

				let fromRow = Math.min(activeCell.row, last.fromRow);
				let fromCell = Math.min(newRangeColumn, last.fromCell);
				let toRow = Math.max(activeCell.row, last.toRow);
				let toCell = Math.max(newRangeColumn, last.toCell);

				this._ranges = [new Slick.Range(fromRow, fromCell, toRow, toCell)];
			} else {
				this._ranges = [new Slick.Range(activeCell.row, newRangeColumn, activeCell.row, newRangeColumn)];
			}
			this._grid.setActiveCell(activeCell.row, newActiveCellColumn);
			this.setSelectedRanges(this._ranges);
		}
	}

	private handleKeyDown(e: JQueryInputEventObject) {
		let activeCell = this._grid.getActiveCell();

		if (activeCell) {
			// navigation keys
			if (this.isNavigationKey(e)) {
				e.stopImmediatePropagation();
				if (e.ctrlKey || e.metaKey) {
					let event = new CustomEvent('gridnav', {
						detail: {
							which: e.which,
							ctrlKey: e.ctrlKey,
							metaKey: e.metaKey,
							shiftKey: e.shiftKey,
							altKey: e.altKey
						}
					});
					window.dispatchEvent(event);
					return;
				}
				// end key
				if (e.which === $.ui.keyCode.END) {
					this.navigateRight(e, activeCell);
				}
				// home key
				if (e.which === $.ui.keyCode.HOME) {
					this.navigateLeft(e, activeCell);
				}
				// left arrow
				if (e.which === $.ui.keyCode.LEFT) {
					// column resize
					if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
						let allColumns = clone(this._grid.getColumns());
						allColumns[activeCell.cell - 1].width = allColumns[activeCell.cell - 1].width - this.keyColResizeIncr;
						this._grid.setColumnWidths(allColumns);
					} else {
						this.navigateLeft(e, activeCell);
					}
					// up arrow
				} else if (e.which === $.ui.keyCode.UP && activeCell.row > 0) {
					if (e.shiftKey) {
						let last = this._ranges.pop();

						// If we are on the bottommost edge of the range and we navigate up,
						// we want to deselect the bottommost row
						let newRangeRow = activeCell.row - 1;
						if (last.fromRow <= newRangeRow) { last.toRow -= 1; }

						let fromRow = Math.min(activeCell.row - 1, last.fromRow);
						let fromCell = Math.min(activeCell.cell - 1, last.fromCell);
						let toRow = Math.max(newRangeRow, last.toRow);
						let toCell = Math.max(activeCell.cell - 1, last.toCell);
						this._ranges = [new Slick.Range(fromRow, fromCell, toRow, toCell)];
					} else {
						this._ranges = [new Slick.Range(activeCell.row - 1, activeCell.cell - 1, activeCell.row - 1, activeCell.cell - 1)];
					}
					this._grid.setActiveCell(activeCell.row - 1, activeCell.cell);
					this.setSelectedRanges(this._ranges);
					// right arrow
				} else if (e.which === $.ui.keyCode.RIGHT) {
					// column resize
					if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
						let allColumns = clone(this._grid.getColumns());
						allColumns[activeCell.cell - 1].width = allColumns[activeCell.cell - 1].width + this.keyColResizeIncr;
						this._grid.setColumnWidths(allColumns);
					} else {
						this.navigateRight(e, activeCell);
					}
					// down arrow
				} else if (e.which === $.ui.keyCode.DOWN && activeCell.row < this._grid.getDataLength() - 1) {
					if (e.shiftKey) {
						let last = this._ranges.pop();

						// If we are on the topmost edge of the range and we navigate down,
						// we want to deselect the topmost row
						let newRangeRow = activeCell.row + 1;
						if (newRangeRow <= last.toRow) { last.fromRow += 1; }

						let fromRow = Math.min(activeCell.row + 1, last.fromRow);
						let fromCell = Math.min(activeCell.cell - 1, last.fromCell);
						let toRow = Math.max(activeCell.row + 1, last.toRow);
						let toCell = Math.max(activeCell.cell - 1, last.toCell);
						this._ranges = [new Slick.Range(fromRow, fromCell, toRow, toCell)];
					} else {
						this._ranges = [new Slick.Range(activeCell.row + 1, activeCell.cell - 1, activeCell.row + 1, activeCell.cell - 1)];
					}
					this._grid.setActiveCell(activeCell.row + 1, activeCell.cell);
					this.setSelectedRanges(this._ranges);
				}
			}
		}
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
			this._grid.setActiveCell(0, columnIndex + 1);
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