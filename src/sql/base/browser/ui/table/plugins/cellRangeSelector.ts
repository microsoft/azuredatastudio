import { mixin } from 'vs/base/common/objects';

require.__$__nodeRequire('slickgrid/plugins/slick.cellrangedecorator');

const defaultOptions: ICellRangeSelectorOptions = {
	selectionCss: {
		'border': '2px dashed blue'
	}
};

export interface ICellRangeSelectorOptions {
	selectionCss?: { [key: string]: string };
	cellDecorator?: ICellRangeDecorator;
}

export interface ICellRangeSelector<T> extends Slick.Plugin<T> {
	onCellRangeSelected: Slick.Event<{ range: Slick.Range }>;
	onBeforeCellRangeSelected: Slick.Event<Slick.Cell>;
}

export interface ICellRangeDecorator {
	show(range: Slick.Range);
	hide();
}

export class CellRangeSelector<T> implements ICellRangeSelector<T> {
	private grid: Slick.Grid<T>;
	private dragging: boolean;
	private handler = new Slick.EventHandler();
	private decorator: ICellRangeDecorator;
	private canvas: HTMLCanvasElement;
	private currentlySelectedRange: { start: Slick.Cell, end: Slick.Cell };

	public onBeforeCellRangeSelected = new Slick.Event<Slick.Cell>();
	public onCellRangeSelected = new Slick.Event<{ range: Slick.Range }>();

	constructor(private options: ICellRangeSelectorOptions) {
		this.options = mixin(this.options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>) {
		this.decorator = this.options.cellDecorator || new (<any>Slick).CellRangeDecorator(grid, this.options);
		this.grid = grid;
		this.canvas = this.grid.getCanvasNode();
		this.handler
			.subscribe(this.grid.onDragInit, e => this.handleDragInit(e))
			.subscribe(this.grid.onDragStart, (e, dd) => this.handleDragStart(e, dd))
			.subscribe(this.grid.onDrag, (e, dd) => this.handleDrag(e, dd))
			.subscribe(this.grid.onDragEnd, (e, dd) => this.handleDragEnd(e, dd));
	}

	public destroy() {
		this.handler.unsubscribeAll();
	}

	public getCellDecorator() {
		return this.decorator;
	}

	public getCurrentRange() {
		return this.currentlySelectedRange;
	}

	private handleDragInit(e: DOMEvent) {
		// prevent the grid from cancelling drag'n'drop by default
		e.stopImmediatePropagation();
	}

	private handleDragStart(e: MouseEvent, dd: Slick.OnDragStartEventArgs<T>) {
		let cell = this.grid.getCellFromEvent(e);
		if (this.onBeforeCellRangeSelected.notify(cell) !== false) {
			if (this.grid.canCellBeSelected(cell.row, cell.cell)) {
				this.dragging = true;
				e.stopImmediatePropagation();
			}
		}
		if (!this.dragging) {
			return;
		}

		this.grid.focus();

		let start = this.grid.getCellFromPoint(
			dd.startX - $(this.canvas).offset().left,
			dd.startY - $(this.canvas).offset().top);

		dd.range = { start: start, end: undefined };
		this.currentlySelectedRange = dd.range;
		return this.decorator.show(new Slick.Range(start.row, start.cell));
	}

	private handleDrag(e: MouseEvent, dd: Slick.OnDragEventArgs<T>) {
		if (!this.dragging) {
			return;
		}

		e.stopImmediatePropagation();

		let end = this.grid.getCellFromPoint(
			e.pageX - $(this.canvas).offset().left,
			e.pageY - $(this.canvas).offset().top);

		if (!this.grid.canCellBeSelected(end.row, end.cell)) {
			return;
		}

		dd.range.end = end;
		this.currentlySelectedRange = dd.range;
		this.decorator.show(new Slick.Range(dd.range.start.row, dd.range.start.cell, end.row, end.cell));
	}

	private handleDragEnd(e: MouseEvent, dd: Slick.OnDragEndEventArgs<T>) {
		if (!this.dragging) {
			return;
		}

		this.dragging = false;
		e.stopImmediatePropagation();

		this.decorator.hide();
		this.onCellRangeSelected.notify({
			range: new Slick.Range(
				dd.range.start.row,
				dd.range.start.cell,
				dd.range.end.row,
				dd.range.end.cell
			)
		});
	}
}
