// Adopted and converted to typescript from https://github.com/6pac/SlickGrid/blob/master/plugins/slick.rowdetailview.js
// heavily modified
import { escape } from 'sql/base/common/strings';
import { mixin } from 'vs/base/common/objects';
import * as nls from 'vs/nls';

export interface IRowDetailViewOptions<T> {
	columnId?: string;
	cssClass?: string;
	toolTip?: string;
	width?: number;
	panelRows: number;
	useRowClick?: boolean;
	loadOnce?: boolean;
	preTemplate: (item: ExtendedItem<T>) => string;
	process: (item: ExtendedItem<T>) => void;
	postTemplate: (item: ExtendedItem<T>) => string;
}

const defaultOptions = {
	columnId: '_detail_selector',
	toolTip: '',
	width: 30
};

export interface IExtendedItem<T extends Slick.SlickData> {
	_collapsed?: boolean;
	_parent?: IExtendedItem<T> & T;
	_detailContent?: string;
	_detailViewLoaded?: boolean;
	_sizePadding?: number;
	id?: string;
	_height?: number;
	_isPadding?: boolean;
	name?: string;
	_child?: IExtendedItem<T>;
	message?: string;
}

export type ExtendedItem<T extends Slick.SlickData> = T & IExtendedItem<T>;

interface AugmentedDataView<T extends Slick.SlickData> extends Slick.Data.DataView<T> {
	getItem(row: number): ExtendedItem<T>;
	getItemByIdx(row: number): ExtendedItem<T>;
}

export class RowDetailView<T extends Slick.SlickData> {

	public readonly onAsyncResponse = new Slick.Event<{ itemDetail: ExtendedItem<T>, detailView: string }>();
	public readonly onAsyncEndUpdate = new Slick.Event<{ grid: Slick.Grid<T>, itemDetail: T }>();
	public readonly onAfterRowDetailToggle = new Slick.Event<{ grid: Slick.Grid<T>, item: T }>();
	public readonly onBeforeRowDetailToggle = new Slick.Event<{ grid: Slick.Grid<T>, item: T }>();

	private _grid!: Slick.Grid<T>;
	private _expandedRows: Array<ExtendedItem<T>> = [];
	private _handler = new Slick.EventHandler();

	private _dataView!: AugmentedDataView<T>;
	private _options: IRowDetailViewOptions<T>;

	constructor(options: IRowDetailViewOptions<T>) {
		this._options = options || Object.create(null);
		mixin(this._options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<T>): void {
		this._grid = grid;
		this._dataView = this._grid.getData() as AugmentedDataView<T>; // this is a bad assumption but the code is written with this assumption

		// Update the minRowBuffer so that the view doesn't disappear when it's at top of screen + the original default 3
		this._grid.getOptions().minRowBuffer = this._options.panelRows + 3;

		this._handler
			.subscribe(this._grid.onClick, (e: DOMEvent, args: Slick.OnClickEventArgs<T>) => this.handleClick(e as MouseEvent, args))
			.subscribe(this._grid.onSort, () => this.handleSort())
			.subscribe(this._grid.onScroll, () => this.handleScroll());

		this._dataView.onRowCountChanged.subscribe(() => { this._grid.updateRowCount(); this._grid.render(); });
		this._dataView.onRowsChanged.subscribe((e, a) => { this._grid.invalidateRows(a.rows); this._grid.render(); });

		// subscribe to the onAsyncResponse so that the plugin knows when the user server side calls finished
		this.subscribeToOnAsyncResponse();
	}

	public destroy() {
		this._handler.unsubscribeAll();
		this.onAsyncResponse.unsubscribe();
		this.onAsyncEndUpdate.unsubscribe();
		this.onAfterRowDetailToggle.unsubscribe();
		this.onBeforeRowDetailToggle.unsubscribe();
	}

	public getOptions() {
		return this._options;
	}

	public setOptions(options: IRowDetailViewOptions<T>) {
		this._options = jQuery.extend(true, {}, this._options, options);
	}

	public handleClick(e: MouseEvent, args: Slick.OnClickEventArgs<T>): void {
		// clicking on a row select checkbox
		if (this._options.useRowClick || this._grid.getColumns()[args.cell].id === this._options.columnId && jQuery(e.target!).hasClass('detailView-toggle')) {
			// if editing, try to commit
			if (this._grid.getEditorLock().isActive() && !this._grid.getEditorLock().commitCurrentEdit()) {
				e.preventDefault();
				e.stopImmediatePropagation();
				return;
			}

			const item = this._dataView.getItem(args.row);

			// trigger an event before toggling
			this.onBeforeRowDetailToggle.notify({
				grid: this._grid,
				item: item
			}, e, this);

			this.toggleRowSelection(item);

			// trigger an event after toggling
			this.onAfterRowDetailToggle.notify({
				grid: this._grid,
				item: item
			}, e, this);

			e.stopPropagation();
			e.stopImmediatePropagation();
		}
	}

	// Sort will just collapse all of the open items
	public handleSort() {
		this.collapseAll();
	}

	// If we scroll save detail views that go out of cache range
	public handleScroll() {

		const range = this._grid.getRenderedRange();

		const start: number = (range.top > 0 ? range.top : 0);
		const end: number = (range.bottom > this._dataView.getLength() ? range.bottom : this._dataView.getLength());
		if (end <= 0) {
			return;
		}

		// Get the item at the top of the view
		const topMostItem = this._dataView.getItemByIdx(start);

		// Check it is a parent item
		if (topMostItem._parent === undefined) {
			// This is a standard row as we have no parent.
			const nextItem = this._dataView.getItemByIdx(start + 1);
			if (nextItem !== undefined && nextItem._parent !== undefined) {
				// This is likely the expanded Detail Row View
				// Check for safety
				if (nextItem._parent === topMostItem) {
					this.saveDetailView(topMostItem);
				}
			}
		}

		// Find the bottom most item that is likely to go off screen
		const bottomMostItem = this._dataView.getItemByIdx(end - 1);

		// If we are a detailView and we are about to go out of cache view
		if (bottomMostItem._parent !== undefined) {
			this.saveDetailView(bottomMostItem._parent);
		}
	}

	// Toggle between showing and hiding a row
	public toggleRowSelection(row: T) {
		this._dataView.beginUpdate();
		this.handleAccordionShowHide(row);
		this._dataView.endUpdate();
	}

	// Collapse all of the open items
	public collapseAll() {
		for (let i = this._expandedRows.length - 1; i >= 0; i--) {
			this.collapseItem(this._expandedRows[i]);
		}
	}

	// Saves the current state of the detail view
	public saveDetailView(item: ExtendedItem<T>) {
		const view = jQuery('#innerDetailView_' + item.id);
		if (view) {
			const html = jQuery('#innerDetailView_' + item.id).html();
			if (html !== undefined) {
				item._detailContent = html;
			}
		}
	}

	// Colapse an Item so it is notlonger seen
	public collapseItem(item: ExtendedItem<T>) {

		// Save the details on the collapse assuming onetime loading
		if (this._options.loadOnce) {
			this.saveDetailView(item);
		}

		item._collapsed = true;
		for (let idx = 1; idx <= item._sizePadding!; idx++) {
			this._dataView.deleteItem(item.id + '.' + idx);
		}
		item._sizePadding = 0;
		this._dataView.updateItem(item.id!, item);

		// Remove the item from the expandedRows
		this._expandedRows = this._expandedRows.filter((r) => {
			return r.id !== item.id;
		});
	}

	// Expand a row given the dataview item that is to be expanded
	public expandItem(item: ExtendedItem<T>) {
		item._collapsed = false;
		this._expandedRows.push(item);

		// In the case something went wrong loading it the first time such a scroll of screen before loaded
		if (!item._detailContent) {
			item._detailViewLoaded = false;
		}

		// display pre-loading template
		if (!item._detailViewLoaded || this._options.loadOnce !== true) {
			item._detailContent = this._options.preTemplate(item);
		} else {
			this.onAsyncResponse.notify({
				itemDetail: item,
				detailView: item._detailContent!
			}, undefined, this);
			this.applyTemplateNewLineHeight(item);
			this._dataView.updateItem(item.id!, item);

			return;
		}

		this.applyTemplateNewLineHeight(item);
		this._dataView.updateItem(item.id!, item);

		// async server call
		this._options.process(item);
	}

	/**
	 * subscribe to the onAsyncResponse so that the plugin knows when the user server side calls finished
	 * the response has to be as "args.itemDetail" with it's data back
	 */
	public subscribeToOnAsyncResponse() {
		this.onAsyncResponse.subscribe((e, args) => {
			if (!args || !args.itemDetail) {
				throw new Error('Slick.RowDetailView plugin requires the onAsyncResponse() to supply "args.itemDetail" property.');
			}

			// If we just want to load in a view directly we can use detailView property to do so
			if (args.detailView) {
				args.itemDetail._detailContent = args.detailView;
			} else {
				args.itemDetail._detailContent = this._options.postTemplate(args.itemDetail);
			}

			args.itemDetail._detailViewLoaded = true;

			this._dataView.updateItem(args.itemDetail.id!, args.itemDetail);

			// trigger an event once the post template is finished loading
			this.onAsyncEndUpdate.notify({
				grid: this._grid,
				itemDetail: args.itemDetail
			}, e, this);
		});
	}

	public handleAccordionShowHide(item?: ExtendedItem<T>) {
		if (item) {
			if (!item._collapsed) {
				this.collapseItem(item);
			} else {
				this.expandItem(item);
			}
		}
	}

	//////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////
	public getPaddingItem(parent: ExtendedItem<T>, offset: number | string) {
		const item: any = {};

		for (const prop in this._grid.getData()) {
			item[prop] = null;
		}
		item.id = parent.id + '.' + offset;

		//additional hidden padding metadata fields
		item._collapsed = true;
		item._isPadding = true;
		item._parent = parent;

		return item;
	}

	public getErrorItem(parent: ExtendedItem<T>, offset: number | string) {
		const item: ExtendedItem<T> = Object.create(null);
		item.id = parent.id + '.' + offset;
		item._collapsed = true;
		item._isPadding = false;
		item._parent = parent;
		item.name = parent.message ? parent.message : nls.localize('rowDetailView.loadError', "Loading Error...");
		parent._child = item;
		return item;
	}

	//////////////////////////////////////////////////////////////
	//create the detail ctr node. this belongs to the dev & can be custom-styled as per
	//////////////////////////////////////////////////////////////
	public applyTemplateNewLineHeight(item: ExtendedItem<T>, showError = false) {
		// the height seems to be calculated by the template row count (how many line of items does the template have)
		const rowCount = this._options.panelRows;

		//calculate padding requirements based on detail-content..
		//ie. worst-case: create an invisible dom node now &find it's height.
		const lineHeight = 13; //we know cuz we wrote the custom css innit ;)
		item._sizePadding = Math.ceil(((rowCount * 2) * lineHeight) / this._grid.getOptions().rowHeight!);
		item._height = (item._sizePadding * this._grid.getOptions().rowHeight!);

		const idxParent = this._dataView.getIdxById(item.id!);
		for (let idx = 1; idx <= item._sizePadding; idx++) {
			if (showError) {
				this._dataView.insertItem(idxParent + idx, this.getErrorItem(item, 'error'));
			} else {
				this._dataView.insertItem(idxParent + idx, this.getPaddingItem(item, idx));
			}
		}
	}

	public getColumnDefinition(): Slick.Column<T> {
		return {
			id: this._options.columnId,
			name: '',
			toolTip: this._options.toolTip,
			field: 'sel',
			width: this._options.width,
			resizable: false,
			sortable: false,
			cssClass: this._options.cssClass,
			formatter: (row, cell, value, columnDef, dataContext) => this.detailSelectionFormatter(row, cell, value, columnDef, dataContext as ExtendedItem<T>)
		};
	}

	public detailSelectionFormatter(row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: ExtendedItem<T>): string | undefined {

		if (dataContext._collapsed === undefined) {
			dataContext._collapsed = true;
			dataContext._sizePadding = 0;	//the required number of pading rows
			dataContext._height = 0;	//the actual height in pixels of the detail field
			dataContext._isPadding = false;
			dataContext._parent = undefined;
		}

		if (dataContext._isPadding === true) {
			//render nothing
		} else if (dataContext._collapsed) {
			return '<div class=\'detailView-toggle expand\'></div>';
		} else {
			const html: Array<string> = [];
			const rowHeight = this._grid.getOptions().rowHeight!;
			const bottomMargin = 5;

			//V313HAX:
			//putting in an extra closing div after the closing toggle div and ommiting a
			//final closing div for the detail ctr div causes the slickgrid renderer to
			//insert our detail div as a new column ;) ~since it wraps whatever we provide
			//in a generic div column container. so our detail becomes a child directly of
			//the row not the cell. nice =)  ~no need to apply a css change to the parent
			//slick-cell to escape the cell overflow clipping.

			//sneaky extra </div> inserted here-----------------v
			html.push('<div class="detailView-toggle collapse"></div></div>');

			html.push(`<div id='cellDetailView_${dataContext.id}' class='dynamic-cell-detail' `);   //apply custom css to detail
			html.push(`style=\'height:${dataContext._height}px;`); //set total height of padding
			html.push(`top:${rowHeight}px'>`);             //shift detail below 1st row
			html.push(`<div id='detailViewContainer_${dataContext.id}"'  class='detail-container' style='max-height:${(dataContext._height! - rowHeight + bottomMargin)}px'>`); //sub ctr for custom styling
			html.push(`<div id='innerDetailView_${dataContext.id}'>${escape(dataContext._detailContent!)}</div></div>`);
			//&omit a final closing detail container </div> that would come next

			return html.join('');
		}
		return undefined;
	}
}
