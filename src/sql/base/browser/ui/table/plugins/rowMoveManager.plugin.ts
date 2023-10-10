// Adopted and converted to typescript from https://github.com/mleibman/SlickGrid/blob/gh-pages/plugins/slick.rowmovemanager.js
// heavily modified

import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { BaseClickableColumn, ClickableColumnOptions, IconColumnOptions } from 'sql/base/browser/ui/table/plugins/tableColumn';
import { mixin } from 'vs/base/common/objects';

const defaultOptions: IRowMoveManagerOptions = {
	cancelEditOnDrag: false
};

export interface IRowMoveManagerOptions extends IconColumnOptions, ClickableColumnOptions, Slick.Column<Slick.SlickData> {
	cancelEditOnDrag?: boolean;
}

export interface RowMoveOnDragEventArgs {
	selectionProxy?: JQuery<HTMLElement>;
	guide?: JQuery<HTMLElement>;
	selectedRows?: number[];
	insertBefore?: number;
	canMove?: boolean;
}

export interface RowMoveOnDragEventData {
	rows?: number[];
	insertBefore: number;
}

// Wrapper interfaces for drag arguments to support selection
export interface OnRowMoveDragInitEventArgs<T extends Slick.SlickData> extends Slick.OnDragInitEventArgs<T>, RowMoveOnDragEventArgs { }
export interface OnRowMoveDragStartEventArgs<T extends Slick.SlickData> extends Slick.OnDragStartEventArgs<T>, RowMoveOnDragEventArgs { }
export interface OnRowMoveDragEventArgs<T extends Slick.SlickData> extends Slick.OnDragEventArgs<T>, RowMoveOnDragEventArgs { }
export interface OnRowMoveDragEndEventArgs<T extends Slick.SlickData> extends Slick.OnDragEndEventArgs<T>, RowMoveOnDragEventArgs { }

export class RowMoveManager<T extends Slick.SlickData> extends BaseClickableColumn<T> {

	private _canvas: HTMLCanvasElement;
	private _dragging: boolean;

	public onBeforeMoveRows: Slick.Event<any> = new Slick.Event();
	public onMoveRows: Slick.Event<any> = new Slick.Event();

	constructor(private options: IRowMoveManagerOptions) {
		super(options);
		this.options = mixin(options, defaultOptions, false);
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this.options.id || this.options.title || this.options.field,
			width: this.options.width ?? 26,
			name: this.options.name,
			resizable: this.options.resizable,
			selectable: false,
			behavior: this.options.behavior,
			cssClass: this.options.iconCssClass,
			toolTip: this.options.title
		};
	}


	public override init(grid: Slick.Grid<T>) {
		this._grid = grid;
		this._grid.setSelectionModel(new RowSelectionModel());
		this._canvas = this._grid.getCanvasNode();
		this._handler
			.subscribe(this._grid.onDragInit, (e: DOMEvent, data: OnRowMoveDragInitEventArgs<T>) => this.onDragInit(e as MouseEvent, data))
			.subscribe(this._grid.onDragStart, (e: DOMEvent, data: OnRowMoveDragStartEventArgs<T>) => this.onDragStart(e as MouseEvent, data))
			.subscribe(this._grid.onDrag, (e: DOMEvent, data: OnRowMoveDragEventArgs<T>) => this.onDrag(e as MouseEvent, data))
			.subscribe(this._grid.onDragEnd, (e: DOMEvent, data: OnRowMoveDragEndEventArgs<T>) => this.onDragEnd(e as MouseEvent, data));
	}

	private onDragInit(e: MouseEvent, data: OnRowMoveDragInitEventArgs<T>) {
		e.stopImmediatePropagation();
	}

	private onDragStart(e: MouseEvent, data: OnRowMoveDragStartEventArgs<T>) {
		const cell = this._grid.getCellFromEvent(e);
		const highlightStyle = {};
		const columns = this._grid.getColumns();
		highlightStyle[cell.row] = {};
		columns.forEach((c) => {
			highlightStyle[cell.row][c.id] = 'isDragging';
		});
		this._grid.setCellCssStyles('isDragging', highlightStyle);

		if (this.options.cancelEditOnDrag && this._grid.getEditorLock().isActive()) {
			this._grid.getEditorLock().cancelCurrentEdit();
		}

		if (this._grid.getEditorLock().isActive() || !/move|selectAndMove/.test(this._grid.getColumns()[cell.cell].behavior)) {
			return;
		}

		this._dragging = true;
		e.stopImmediatePropagation();

		let selectedRows = this._grid.getSelectedRows();

		if (selectedRows.length === 0 || jQuery.inArray(cell.row, selectedRows) === -1) {
			selectedRows = [cell.row];
			this._grid.setSelectedRows(selectedRows);
		}

		const rowHeight = this._grid.getOptions().rowHeight;

		data.selectedRows = selectedRows;

		data.selectionProxy = jQuery('<div class="slick-reorder-proxy"/>')
			.css('position', 'absolute')
			.css('zIndex', '99999')
			.css('width', jQuery(this._canvas).innerWidth())
			.css('height', rowHeight * selectedRows.length)
			.appendTo(this._canvas);

		data.guide = jQuery('<div class="slick-reorder-guide"/>')
			.css('position', 'absolute')
			.css('zIndex', '99998')
			.css('width', jQuery(this._canvas).innerWidth())
			.css('top', -1000)
			.appendTo(this._canvas);

		data.insertBefore = -1;
	}

	private onDrag(e: MouseEvent, data: OnRowMoveDragEventArgs<T>) {
		if (!this._dragging) {
			return;
		}

		e.stopImmediatePropagation();

		const top = e.pageY - jQuery(this._canvas).offset().top;
		data.selectionProxy.css('top', top - 5);

		const insertBefore = Math.max(0, Math.min(Math.round(top / this._grid.getOptions().rowHeight), this._grid.getDataLength()));
		if (insertBefore !== data.insertBefore) {
			const eventData: RowMoveOnDragEventData = {
				'rows': data.selectedRows,
				'insertBefore': insertBefore
			};

			if (this.onBeforeMoveRows.notify(eventData) === false) {
				data.guide.css('top', -1000);
				data.canMove = false;
			} else {
				data.guide.css('top', insertBefore * this._grid.getOptions().rowHeight);
				data.canMove = true;
			}

			data.insertBefore = insertBefore;
		}

	}

	private onDragEnd(e: MouseEvent, data: OnRowMoveDragEndEventArgs<T>) {
		if (!this._dragging) {
			return;
		}
		this._dragging = false;
		this._grid.removeCellCssStyles('isDragging');
		e.stopImmediatePropagation();

		data.guide.remove();
		data.selectionProxy.remove();

		if (data.canMove) {
			const eventData: RowMoveOnDragEventData = {
				'rows': data.selectedRows,
				'insertBefore': data.insertBefore
			};
			this.onMoveRows.notify(eventData);
		}
	}

}
