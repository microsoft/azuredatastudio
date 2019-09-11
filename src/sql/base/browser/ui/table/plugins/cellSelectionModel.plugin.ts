// Drag select selection model gist taken from https://gist.github.com/skoon/5312536
// heavily modified

import { mixin } from 'vs/base/common/objects';
import { isUndefinedOrNull } from 'vs/base/common/types';

import { CellRangeSelector, ICellRangeSelector } from 'sql/base/browser/ui/table/plugins/cellRangeSelector';

export interface ICellSelectionModelOptions {
	cellRangeSelector?: any;
	selectActiveCell?: boolean;
}

const defaults: ICellSelectionModelOptions = {
	selectActiveCell: true
};

export class CellSelectionModel<T> implements Slick.SelectionModel<T, Array<Slick.Range>> {
	private grid: Slick.Grid<T>;
	private selector: ICellRangeSelector<T>;
	private ranges: Array<Slick.Range> = [];
	private _handler = new Slick.EventHandler();

	public onSelectedRangesChanged = new Slick.Event<Array<Slick.Range>>();

	constructor(private options: ICellSelectionModelOptions = defaults) {
		this.options = mixin(this.options, defaults, false);

		if (this.options.cellRangeSelector) {
			this.selector = this.options.cellRangeSelector;
		} else {
			// this is added by the noderequires above
			this.selector = new CellRangeSelector({ selectionCss: { 'border': '2px dashed grey' } });
		}
	}

	public init(grid: Slick.Grid<T>) {
		this.grid = grid;
		this._handler.subscribe(this.grid.onClick, (e: MouseEvent, args: Slick.OnActiveCellChangedEventArgs<T>) => this.handleActiveCellChange(e, args));
		this._handler.subscribe(this.grid.onKeyDown, (e: KeyboardEvent) => this.handleKeyDown(e));
		this._handler.subscribe(this.grid.onClick, (e: MouseEvent, args: Slick.OnClickEventArgs<T>) => this.handleIndividualCellSelection(e, args));
		this._handler.subscribe(this.grid.onHeaderClick, (e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>) => this.handleHeaderClick(e, args));
		this.grid.registerPlugin(this.selector);
		this._handler.subscribe(this.selector.onCellRangeSelected, (e: Event, range: Slick.Range) => this.handleCellRangeSelected(e, range, false));
		this._handler.subscribe(this.selector.onAppendCellRangeSelected, (e: Event, range: Slick.Range) => this.handleCellRangeSelected(e, range, true));

		this._handler.subscribe(this.selector.onBeforeCellRangeSelected, (e: Event, cell: Slick.Cell) => this.handleBeforeCellRangeSelected(e, cell));
	}

	public destroy() {
		this._handler.unsubscribeAll();
		this.grid.unregisterPlugin(this.selector);
	}

	private removeInvalidRanges(ranges: Array<Slick.Range>): Array<Slick.Range> {
		let result: Array<Slick.Range> = [];

		for (let i = 0; i < ranges.length; i++) {
			let r = ranges[i];
			if (this.grid.canCellBeSelected(r.fromRow, r.fromCell) && this.grid.canCellBeSelected(r.toRow, r.toCell)) {
				result.push(r);
			} else if (this.grid.canCellBeSelected(r.fromRow, r.fromCell + 1) && this.grid.canCellBeSelected(r.toRow, r.toCell)) {
				// account for number row
				result.push(new Slick.Range(r.fromRow, r.fromCell + 1, r.toRow, r.toCell));
			}
		}

		return result;
	}

	public setSelectedRanges(ranges: Array<Slick.Range>): void {
		// simple check for: empty selection didn't change, prevent firing onSelectedRangesChanged
		if ((!this.ranges || this.ranges.length === 0) && (!ranges || ranges.length === 0)) {
			return;
		}

		this.ranges = this.removeInvalidRanges(ranges);
		this.onSelectedRangesChanged.notify(this.ranges);
	}

	public getSelectedRanges() {
		return this.ranges;
	}

	private handleBeforeCellRangeSelected(e: Event, args: Slick.Cell) {
		if (this.grid.getEditorLock().isActive()) {
			e.stopPropagation();
			return false;
		}
		return true;
	}

	private handleCellRangeSelected(e: Event, range: Slick.Range, append: boolean) {
		this.grid.setActiveCell(range.fromRow, range.fromCell, false, false, true);

		if (append) {
			this.setSelectedRanges(this.insertIntoSelections(this.getSelectedRanges(), range));
		} else {
			this.setSelectedRanges([range]);
		}
	}

	private handleActiveCellChange(e: MouseEvent, args: Slick.OnActiveCellChangedEventArgs<T>) {
		if (this.options.selectActiveCell && !isUndefinedOrNull(args.row) && !isUndefinedOrNull(args.cell) && !e.ctrlKey) {
			this.setSelectedRanges([new Slick.Range(args.row, args.cell)]);
		} else if (!this.options.selectActiveCell) {
			// clear the previous selection once the cell changes
			this.setSelectedRanges([]);
		}
	}

	private handleHeaderClick(e: MouseEvent, args: Slick.OnHeaderClickEventArgs<T>) {
		if (!isUndefinedOrNull(args.column)) {
			let columnIndex = this.grid.getColumnIndex(args.column.id!);
			if (this.grid.canCellBeSelected(0, columnIndex)) {
				let ranges: Array<Slick.Range>;
				if (e.shiftKey) {
					ranges = this.getSelectedRanges();
					ranges.push(new Slick.Range(0, columnIndex, this.grid.getDataLength() - 1, columnIndex));
				} else {
					ranges = [new Slick.Range(0, columnIndex, this.grid.getDataLength() - 1, columnIndex)];
				}
				this.grid.setActiveCell(0, columnIndex);
				this.setSelectedRanges(ranges);
			}
		}
	}


	/**
	 * DO NOT CALL THIS DIRECTLY - GO THROUGH INSERT INTO SELECTIONS
	 *
	 */
	private mergeSelections(ranges: Array<Slick.Range>, range: Slick.Range) {
		// New ranges selection
		let newRanges: Array<Slick.Range> = [];

		// Have we handled this value
		let handled = false;
		for (let current of ranges) {
			// We've already processed everything. Add everything left back to the list.
			if (handled) {
				newRanges.push(current);
				continue;
			}
			let newRange: Slick.Range | undefined = undefined;

			// if the ranges are the same.
			if (current.fromRow === range.fromRow &&
				current.fromCell === range.fromCell &&
				current.toRow === range.toRow &&
				current.toCell === range.toCell) {
				// If we're actually not going to handle it during this loop
				// this region will be added with the handled boolean check
				continue;
			}

			// Rows are the same - horizontal merging of the selection area
			if (current.fromRow === range.fromRow && current.toRow === range.toRow) {
				// Check if the new region is adjacent to the old selection group
				if (range.toCell + 1 === current.fromCell || range.fromCell - 1 === current.toCell) {
					handled = true;
					let fromCell = Math.min(range.fromCell, current.fromCell, range.toCell, current.toCell);
					let toCell = Math.max(range.fromCell, current.fromCell, range.toCell, current.toCell);
					newRange = new Slick.Range(range.fromRow, fromCell, range.toRow, toCell);
				}
				// Cells are the same - vertical merging of the selection area
			} else if (current.fromCell === range.fromCell && current.toCell === range.toCell) {
				// Check if the new region is adjacent to the old selection group
				if (range.toRow + 1 === current.fromRow || range.fromRow - 1 === current.toRow) {
					handled = true;
					let fromRow = Math.min(range.fromRow, current.fromRow, range.fromRow, current.fromRow);
					let toRow = Math.max(range.toRow, current.toRow, range.toRow, current.toRow);
					newRange = new Slick.Range(fromRow, range.fromCell, toRow, range.toCell);
				}
			}

			if (newRange) {
				newRanges.push(newRange);
			} else {
				newRanges.push(current);
			}
		}

		if (!handled) {
			newRanges.push(range);
		}

		return {
			newRanges,
			handled
		};
	}

	private insertIntoSelections(ranges: Array<Slick.Range>, range: Slick.Range): Array<Slick.Range> {
		let result = this.mergeSelections(ranges, range);
		let newRanges = result.newRanges;

		// Keep merging the rows until we stop having changes
		let i = 0;
		while (true) {
			if (i++ > 10000) {
				console.error('InsertIntoSelection infinite loop: Report this error on github');
				break;
			}
			let shouldContinue = false;
			for (let current of newRanges) {
				result = this.mergeSelections(newRanges, current);
				if (result.handled) {
					shouldContinue = true;
					newRanges = result.newRanges;
					break;
				}
			}

			if (shouldContinue) {
				continue;
			}
			break;
		}

		return newRanges;
	}

	private handleIndividualCellSelection(e: MouseEvent, args: Slick.OnClickEventArgs<T>) {
		if (!e.ctrlKey) {
			return;
		}

		let ranges: Array<Slick.Range>;

		ranges = this.getSelectedRanges();
		ranges = this.insertIntoSelections(ranges, new Slick.Range(args.row, args.cell));

		this.grid.setActiveCell(args.row, args.cell);
		this.setSelectedRanges(ranges);

		e.preventDefault();
		e.stopImmediatePropagation();
	}

	private handleKeyDown(e: KeyboardEvent) {
		/***
		 * Кey codes
		 * 37 left
		 * 38 up
		 * 39 right
		 * 40 down
		 */
		let active = this.grid.getActiveCell();
		let metaKey = e.ctrlKey || e.metaKey;

		if (active && e.shiftKey && !metaKey && !e.altKey &&
			(e.which === 37 || e.which === 39 || e.which === 38 || e.which === 40)) {
			let ranges = this.getSelectedRanges(), last: Slick.Range;

			ranges = this.getSelectedRanges();
			if (!ranges.length) {
				ranges.push(new Slick.Range(active.row, active.cell));
			}

			// keyboard can work with last range only
			last = ranges.pop()!; // this is guarenteed since if ranges is empty we add one

			// can't handle selection out of active cell
			if (!last.contains(active.row, active.cell)) {
				last = new Slick.Range(active.row, active.cell);
			}

			let dRow = last.toRow - last.fromRow,
				dCell = last.toCell - last.fromCell,
				// walking direction
				dirRow = active.row === last.fromRow ? 1 : -1,
				dirCell = active.cell === last.fromCell ? 1 : -1;

			if (e.which === 37) {
				dCell -= dirCell;
			} else if (e.which === 39) {
				dCell += dirCell;
			} else if (e.which === 38) {
				dRow -= dirRow;
			} else if (e.which === 40) {
				dRow += dirRow;
			}

			// define new selection range
			let new_last = new Slick.Range(active.row, active.cell, active.row + dirRow * dRow, active.cell + dirCell * dCell);
			if (this.removeInvalidRanges([new_last]).length) {
				ranges.push(new_last);
				let viewRow = dirRow > 0 ? new_last.toRow : new_last.fromRow;
				let viewCell = dirCell > 0 ? new_last.toCell : new_last.fromCell;
				this.grid.scrollRowIntoView(viewRow, false);
				this.grid.scrollCellIntoView(viewRow, viewCell, false);
			} else {
				ranges.push(last);
			}

			this.setSelectedRanges(ranges);

			e.preventDefault();
			e.stopPropagation();
		}
	}
}
