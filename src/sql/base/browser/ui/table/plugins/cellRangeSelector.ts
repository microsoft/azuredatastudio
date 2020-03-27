/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mixin } from 'vs/base/common/objects';

const defaultOptions: ICellRangeSelectorOptions = {
	selectionCss: {
		'border': '2px dashed blue'
	},
	offset: {
		top: -1,
		left: -1,
		height: 2,
		width: 2
	},
	dragClass: 'drag'
};

export interface ICellRangeSelectorOptions {
	selectionCss?: { [key: string]: string };
	cellDecorator?: ICellRangeDecorator;
	offset?: { top: number, left: number, height: number, width: number };
	dragClass?: string;
}

export interface ICellRangeSelector<T> extends Slick.Plugin<T> {
	onCellRangeSelected: Slick.Event<Slick.Range>;
	onBeforeCellRangeSelected: Slick.Event<Slick.Cell>;
	onAppendCellRangeSelected: Slick.Event<Slick.Range>;
}

export interface ICellRangeDecorator {
	show(range: Slick.Range): void;
	hide(): void;
}

export class CellRangeSelector<T> implements ICellRangeSelector<T> {
	private grid!: Slick.Grid<T>;
	private dragging?: boolean;
	private handler = new Slick.EventHandler();
	private decorator!: ICellRangeDecorator;
	private canvas!: HTMLCanvasElement;
	private currentlySelectedRange?: { start: Slick.Cell, end?: Slick.Cell };

	public onBeforeCellRangeSelected = new Slick.Event<Slick.Cell>();
	public onCellRangeSelected = new Slick.Event<Slick.Range>();
	public onAppendCellRangeSelected = new Slick.Event<Slick.Range>();

	constructor(private options: ICellRangeSelectorOptions) {

		this.options = mixin(this.options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>) {
		this.decorator = this.options.cellDecorator || new (<any>Slick).CellRangeDecorator(grid, this.options);
		this.grid = grid;
		this.canvas = this.grid.getCanvasNode();
		this.handler
			.subscribe(this.grid.onDragInit, e => this.handleDragInit(e))
			.subscribe(this.grid.onDragStart, (e: DOMEvent, dd) => this.handleDragStart(e as MouseEvent, dd))
			.subscribe(this.grid.onDrag, (e: DOMEvent, dd) => this.handleDrag(e as MouseEvent, dd))
			.subscribe(this.grid.onDragEnd, (e: DOMEvent, dd) => this.handleDragEnd(e as MouseEvent, dd));
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

		this.canvas.classList.add(this.options.dragClass!);

		this.grid.setActiveCell(cell.row, cell.cell);

		let start = this.grid.getCellFromPoint(
			dd.startX - jQuery(this.canvas).offset().left,
			dd.startY - jQuery(this.canvas).offset().top);

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
			e.pageX - jQuery(this.canvas).offset().left,
			e.pageY - jQuery(this.canvas).offset().top);

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

		this.canvas.classList.remove(this.options.dragClass!);
		this.dragging = false;
		e.stopImmediatePropagation();
		this.decorator.hide();
		// if this happens to fast there is a chance we don't have the necessary information to actually do proper selection
		if (!dd || !dd.range || !dd.range.start || !dd.range.end) {
			return;
		}

		let newRange = new Slick.Range(
			dd.range.start.row,
			dd.range.start.cell,
			dd.range.end.row,
			dd.range.end.cell
		);

		if (e.ctrlKey) {
			this.onAppendCellRangeSelected.notify(newRange);
		} else {
			this.onCellRangeSelected.notify(newRange);
		}
	}
}
