// Adapted from https://github.com/naresh-n/slickgrid-column-data-autosize/blob/master/src/slick.autocolumnsize.js

import { mixin, clone } from 'sql/base/common/objects';
import { isInDOM } from 'vs/base/browser/dom';

export interface IAutoColumnSizeOptions extends Slick.PluginOptions {
	maxWidth?: number;
	autoSizeOnRender?: boolean;
}

const defaultOptions: IAutoColumnSizeOptions = {
	maxWidth: 200,
	autoSizeOnRender: false
};

export class AutoColumnSize<T> implements Slick.Plugin<T> {
	private _grid: Slick.Grid<T>;
	private _$container: JQuery;
	private _context: CanvasRenderingContext2D;
	private _options: IAutoColumnSizeOptions;
	private onPostEventHandler = new Slick.EventHandler();

	constructor(options: IAutoColumnSizeOptions = defaultOptions) {
		this._options = mixin(options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>) {
		this._grid = grid;

		if (this._options.autoSizeOnRender) {
			this.onPostEventHandler.subscribe(this._grid.onRendered, () => this.onPostRender());
		}

		this._$container = $(this._grid.getContainerNode());
		this._$container.on('dblclick.autosize', '.slick-resizable-handle', e => this.handleDoubleClick(e));
		this._context = document.createElement('canvas').getContext('2d');
	}

	public destroy() {
		this._$container.off();
	}

	private onPostRender() {
		// this doesn't do anything if the grid isn't on the dom
		if (!isInDOM(this._grid.getContainerNode())) {
			return;
		}

		// since data can be async we want to only do this if we have the data to actual
		// work on since we are measuring the physical length of data
		let data = this._grid.getData();
		let item = data.getItem(0);
		if (item && Object.keys(item).length > 0) {
			let hasValue = false;
			for (let key in item) {
				if (item.hasOwnProperty(key)) {
					if (item[key]) {
						hasValue = true;
						break;
					}
				}
			}
			if (!hasValue) {
				return;
			}
		} else {
			return;
		}

		let headerColumnsQuery = $(this._grid.getContainerNode()).find('.slick-header-columns');
		if (headerColumnsQuery && headerColumnsQuery.length) {
			let headerColumns = headerColumnsQuery[0];
			let origCols = this._grid.getColumns();
			let allColumns = clone(origCols);
			allColumns.forEach((col, index) => {
				col.formatter = origCols[index].formatter;
				col.asyncPostRender = origCols[index].asyncPostRender;
			});
			let change = false;
			for (let i = 0; i <= headerColumns.children.length; i++) {
				let headerEl = $(headerColumns.children.item(i));
				let columnDef = headerEl.data('column');
				if (columnDef) {
					let headerWidth = this.getElementWidth(headerEl[0]);
					let colIndex = this._grid.getColumnIndex(columnDef.id);
					let column = allColumns[colIndex];
					let autoSizeWidth = Math.max(headerWidth, this.getMaxColumnTextWidth(columnDef, colIndex)) + 1;
					if (autoSizeWidth !== column.width) {
						allColumns[colIndex].width = autoSizeWidth;
						change = true;
					}
				}
			}
			if (change) {
				this.onPostEventHandler.unsubscribeAll();
				this._grid.setColumns(allColumns);
				this._grid.onColumnsResized.notify();
			}
		}
	}

	private handleDoubleClick(e: JQuery.Event<HTMLElement, string>) {
		let headerEl = $(e.currentTarget).closest('.slick-header-column');
		let columnDef = headerEl.data('column');

		if (!columnDef || !columnDef.resizable) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		this.reSizeColumn(headerEl, columnDef);
	}

	private reSizeColumn(headerEl: JQuery, columnDef: Slick.Column<T>) {
		let headerWidth = this.getElementWidth(headerEl[0]);
		let colIndex = this._grid.getColumnIndex(columnDef.id);
		let origCols = this._grid.getColumns();
		let allColumns = clone(origCols);
		allColumns.forEach((col, index) => {
			col.formatter = origCols[index].formatter;
			col.asyncPostRender = origCols[index].asyncPostRender;
		});
		let column = allColumns[colIndex];

		let autoSizeWidth = Math.max(headerWidth, this.getMaxColumnTextWidth(columnDef, colIndex)) + 1;

		if (autoSizeWidth !== column.width) {
			allColumns[colIndex].width = autoSizeWidth;
			this._grid.setColumns(allColumns);
			this._grid.onColumnsResized.notify();
		}
	}

	private getMaxColumnTextWidth(columnDef, colIndex: number): number {
		let texts = [];
		let rowEl = this.createRow(columnDef);
		let data = this._grid.getData();
		let viewPort = this._grid.getViewport();
		let start = Math.max(0, viewPort.top);
		let end = Math.min(data.getLength(), viewPort.bottom);
		for (let i = start; i < end; i++) {
			texts.push(data.getItem(i)[columnDef.field]);
		}
		let template = this.getMaxTextTemplate(texts, columnDef, colIndex, data, rowEl);
		let width = this.getTemplateWidth(rowEl, template);
		this.deleteRow(rowEl);
		return width;
	}

	private getTemplateWidth(rowEl: JQuery, template: JQuery | HTMLElement): number {
		let cell = $(rowEl.find('.slick-cell'));
		cell.append(template);
		$(cell).find('*').css('position', 'relative');
		return cell.outerWidth() + 1;
	}

	private getMaxTextTemplate(texts: string[], columnDef, colIndex: number, data, rowEl: JQuery): JQuery | HTMLElement {
		let max = 0,
			maxTemplate = null;
		let formatFun = columnDef.formatter;
		texts.forEach((text, index) => {
			let template;
			if (formatFun) {
				template = $('<span>' + formatFun(index, colIndex, text, columnDef, data[index]) + '</span>');
				text = template.text() || text;
			}
			let length = text ? this.getElementWidthUsingCanvas(rowEl, text) : 0;
			if (length > max) {
				max = length;
				maxTemplate = template || text;
			}
		});
		return maxTemplate;
	}

	private createRow(columnDef): JQuery {
		let rowEl = $('<div class="slick-row"><div class="slick-cell"></div></div>');
		rowEl.find('.slick-cell').css({
			'visibility': 'hidden',
			'text-overflow': 'initial',
			'white-space': 'nowrap'
		});
		let gridCanvas = this._$container.find('.grid-canvas');
		$(gridCanvas).append(rowEl);
		return rowEl;
	}

	private deleteRow(rowEl: JQuery) {
		$(rowEl).remove();
	}

	private getElementWidth(element: HTMLElement): number {
		let width, clone = element.cloneNode(true) as HTMLElement;
		clone.style.cssText = 'position: absolute; visibility: hidden;right: auto;text-overflow: initial;white-space: nowrap;';
		element.parentNode.insertBefore(clone, element);
		width = clone.offsetWidth;
		clone.parentNode.removeChild(clone);
		return width;
	}

	private getElementWidthUsingCanvas(element: JQuery, text: string): number {
		this._context.font = element.css('font-size') + ' ' + element.css('font-family');
		let metrics = this._context.measureText(text);
		return metrics.width;
	}
}
