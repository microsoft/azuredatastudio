// Adopted and converted to typescript from https://github.com/6pac/SlickGrid/blob/master/plugins/slick.rowselectionmodel.js
// heavily modified
import { mixin } from 'vs/base/common/objects';

const defaultOptions: IRowSelectionModelOptions = {
	selectActiveRow: true
};

export interface IRowSelectionModelOptions extends Slick.PluginOptions {
	selectActiveRow?: boolean;
}

export class RowSelectionModel<T extends Slick.SlickData> implements Slick.SelectionModel<T, Array<Slick.Range>> {
	private _options: IRowSelectionModelOptions;
	private _grid!: Slick.Grid<T>;
	private _handler = new Slick.EventHandler();
	private _ranges: Array<Slick.Range> = [];

	public onSelectedRangesChanged = new Slick.Event<Array<Slick.Range>>();

	constructor(options?: Slick.PluginOptions) {
		this._options = mixin(options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>) {
		this._grid = grid;
		this._handler
			.subscribe(this._grid.onActiveCellChanged, (e: Event, data: Slick.OnActiveCellChangedEventArgs<T>) => this.handleActiveCellChange(e, data))
			.subscribe(this._grid.onKeyDown, (e: DOMEvent) => this.handleKeyDown(e as KeyboardEvent))
			.subscribe(this._grid.onClick, (e: DOMEvent) => this.handleClick(e as MouseEvent));
	}

	private rangesToRows(ranges: Slick.Range[]): number[] {
		const rows: Array<number> = [];
		for (let i = 0; i < ranges.length; i++) {
			for (let j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
				rows.push(j);
			}
		}
		return rows;
	}

	private rowsToRanges(rows: number[]): Slick.Range[] {
		const ranges: Array<Slick.Range> = [];
		const lastCell = this._grid.getColumns().length - 1;
		for (let i = 0; i < rows.length; i++) {
			ranges.push(new Slick.Range(rows[i], 0, rows[i], lastCell));
		}
		return ranges;
	}

	public getSelectedRows(): number[] {
		return this.rangesToRows(this._ranges);
	}

	public setSelectedRows(rows: number[]): void {
		this.setSelectedRanges(this.rowsToRanges(rows));
	}

	public setSelectedRanges(ranges: Slick.Range[]): void {
		// simle check for: empty selection didn't change, prevent firing onSelectedRangesChanged
		if ((!this._ranges || this._ranges.length === 0) && (!ranges || ranges.length === 0)) { return; }
		this._ranges = ranges;
		this.onSelectedRangesChanged.notify(this._ranges);
	}

	public getSelectedRanges(): Slick.Range[] {
		return this._ranges;
	}

	private getRowsRange(from: number, to: number): number[] {
		let i: number, rows: Array<number> = [];
		for (i = from; i <= to; i++) {
			rows.push(i);
		}
		for (i = to; i < from; i++) {
			rows.push(i);
		}
		return rows;
	}

	private handleActiveCellChange(e: Event, data: Slick.OnActiveCellChangedEventArgs<T>): void {
		if (this._options.selectActiveRow && data.row !== null) {
			this.setSelectedRanges([new Slick.Range(data.row, 0, data.row, this._grid.getColumns().length - 1)]);
		}
	}

	private handleKeyDown(e: KeyboardEvent): void {
		const activeRow = this._grid.getActiveCell();
		if (activeRow && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && (e.which === 38 || e.which === 40)) {
			let selectedRows = this.getSelectedRows();
			selectedRows.sort((x, y) => x - y);

			if (!selectedRows.length) {
				selectedRows = [activeRow.row];
			}

			let top = selectedRows[0];
			let bottom = selectedRows[selectedRows.length - 1];
			let active;

			if (e.which === 40) {
				active = activeRow.row < bottom || top === bottom ? ++bottom : ++top;
			} else {
				active = activeRow.row < bottom ? --bottom : --top;
			}

			if (active >= 0 && active < this._grid.getDataLength()) {
				this._grid.scrollRowIntoView(active);
				const tempRanges = this.rowsToRanges(this.getRowsRange(top, bottom));
				this.setSelectedRanges(tempRanges);
			}

			e.preventDefault();
			e.stopPropagation();
		}
	}

	private handleClick(e: MouseEvent): boolean {
		const cell = this._grid.getCellFromEvent(e);
		if (!cell || !this._grid.canCellBeActive(cell.row, cell.cell)) {
			return false;
		}

		if (!this._grid.getOptions().multiSelect || (
			!e.ctrlKey && !e.shiftKey && !e.metaKey)) {
			return false;
		}

		let selection = this.rangesToRows(this._ranges);
		const idx = jQuery.inArray(cell.row, selection);

		if (idx === -1 && (e.ctrlKey || e.metaKey)) {
			selection.push(cell.row);
			this._grid.setActiveCell(cell.row, cell.cell);
		} else if (idx !== -1 && (e.ctrlKey || e.metaKey)) {
			selection = selection.filter(o => o !== cell.row);
			this._grid.setActiveCell(cell.row, cell.cell);
		} else if (selection.length && e.shiftKey) {
			const last = selection.pop();
			if (last) {
				const from = Math.min(cell.row, last);
				const to = Math.max(cell.row, last);
				selection = [];
				for (let i = from; i <= to; i++) {
					if (i !== last) {
						selection.push(i);
					}
				}
				selection.push(last);
			}
			this._grid.setActiveCell(cell.row, cell.cell);
		}

		const tempRanges = this.rowsToRanges(selection);
		this.setSelectedRanges(tempRanges);
		e.stopImmediatePropagation();

		return true;
	}

	public destroy() {
		this._handler.unsubscribeAll();
	}

}
