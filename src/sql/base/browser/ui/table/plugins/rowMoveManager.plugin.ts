// Adopted and converted to typescript from https://github.com/mleibman/SlickGrid/blob/gh-pages/plugins/slick.rowmovemanager.js
// heavily modified
import { mixin } from 'vs/base/common/objects';

const defaultOptions: IRowMoveManagerOptions = {
	cancelEditOnDrag: false
};

export interface IRowMoveManagerOptions extends Slick.PluginOptions {
	cancelEditOnDrag?: boolean;
}

export class RowMoveManager<T extends Slick.SlickData> implements Slick.Plugin<T> {

	private _options: IRowMoveManagerOptions;
	private _grid: Slick.Grid<T>;
	private _canvas: HTMLCanvasElement;
	private _dragging: boolean;
	private _handler = new Slick.EventHandler();

	constructor(options?: Slick.PluginOptions) {
		this._options = mixin(options, defaultOptions, false);
	}


	public init(grid: Slick.Grid<T>) {
		this._grid = grid;
		this._canvas = this._grid.getCanvasNode();
		this._handler
			.subscribe(this._grid.onDragInit, (e: Event, data: Slick.OnDragInitEventArgs<T>) => this.onDragInit(e, data))
			.subscribe(this._grid.onDragStart, (e: DOMEvent, data: Slick.OnDragStartEventArgs<T>) => this.onDragStart(e, data))
			.subscribe(this._grid.onDrag, (e: DOMEvent, data: Slick.OnDragEventArgs<T>) => this.onDrag(e, data))
			.subscribe(this._grid.onDragEnd, (e: DOMEvent, data: Slick.OnDragEndEventArgs<T>) => this.onDragEnd(e, data));
	}

	public destroy(): void {
		this._handler.unsubscribeAll();
	}

	private onDragInit(e: Event, data: Slick.OnDragInitEventArgs<T>) {
		e.stopImmediatePropagation();
	}

	private onDragStart(e: Event, data: Slick.OnDragStartEventArgs<T>) {

	}

	private onDrag(e: Event, data: Slick.OnDragEventArgs<T>) {

	}

	private onDragEnd(e: Event, data: Slick.OnDragEndEventArgs<T>) {

	}

}
