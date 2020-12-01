/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./table';

import { IDisposable, dispose, combinedDisposable } from 'vs/base/common/lifecycle';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { Event } from 'vs/base/common/event';
import { ScrollEvent, ScrollbarVisibility, INewScrollDimensions } from 'vs/base/common/scrollable';
import * as DOM from 'vs/base/browser/dom';
import { domEvent } from 'vs/base/browser/event';
import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { isWindows } from 'vs/base/common/platform';
import * as browser from 'vs/base/browser/browser';
import { Range, IRange } from 'vs/base/common/range';
import { getOrDefault } from 'vs/base/common/objects';
import { memoize } from 'vs/base/common/decorators';
import { Sash, Orientation, ISashEvent as IBaseSashEvent } from 'vs/base/browser/ui/sash/sash';

import { CellCache, ICell } from 'sql/base/browser/ui/table/highPerf/cellCache';
import { ITableRenderer, ITableDataSource, ITableMouseEvent, IStaticTableRenderer, ITableColumn } from 'sql/base/browser/ui/table/highPerf/table';
import { GridPosition } from 'sql/base/common/gridPosition';

export interface IAriaSetProvider<T> {
	getSetSize(element: T, index: number, listLength: number): number;
	getPosInSet(element: T, index: number): number;
}

export interface ITableViewOptions<T> {
	rowHeight?: number;
	mouseSupport?: boolean;
	initialLength?: number;
	rowCountColumn?: boolean;
	headerHeight?: number;
}

const DefaultOptions = {
	rowHeight: 22,
	columnWidth: 120,
	minWidth: 20,
	resizeable: true,
	headerHeight: 22
};

interface IInternalColumn<T, TTemplateData> extends ITableColumn<T, TTemplateData> {
	domNode?: HTMLElement;
	left?: number;
}

interface IInternalStaticColumn<T, TTemplateData> extends IInternalColumn<T, TTemplateData> {
	renderer: IStaticTableRenderer<T, TTemplateData>;
}

interface ISashItem {
	sash: Sash;
	disposable: IDisposable;
}

interface ISashDragState {
	current: number;
	index: number;
	start: number;
	sizes: Array<number>;
	lefts: Array<number>;
}

interface ISashEvent<T> {
	sash: Sash;
	column: IInternalColumn<T, any>;
	start: number;
	current: number;
}

function removeFromParent(element: HTMLElement): void {
	try {
		if (element.parentElement) {
			element.parentElement.removeChild(element);
		}
	} catch (e) {
		// this will throw if this happens due to a blur event, nasty business
	}
}

interface IAsyncRowItem<T> {
	readonly id: string;
	element: T | undefined;
	row: HTMLElement | null;
	cells: ICell[] | null;
	size: number;
	datapromise: CancelablePromise<void> | null;
}

export class TableView<T> implements IDisposable {
	private static InstanceCount = 0;
	readonly domId = `table_id_${++TableView.InstanceCount}`;

	readonly domNode = DOM.$('.monaco-perftable');

	private visibleRows: IAsyncRowItem<T>[] = [];
	private cache: CellCache<T>;
	private renderers = new Map<string, ITableRenderer<T /* TODO@joao */, any>>();
	private lastRenderTop = 0;
	private lastRenderHeight = 0;
	private readonly rowsContainer = DOM.$('.monaco-perftable-rows');
	private scrollableElement: ScrollableElement;
	private _scrollHeight: number = 0;
	private _scrollWidth: number = 0;
	private scrollableElementUpdateDisposable: IDisposable | null = null;
	// private ariaSetProvider: IAriaSetProvider<T>;
	private canUseTranslate3d: boolean | undefined = undefined;
	public readonly rowHeight: number;
	private _length: number = 0;

	private columns: IInternalColumn<T, any>[];
	private staticColumns: IInternalStaticColumn<T, any>[];
	private columnSashs: ISashItem[] = [];
	private sashDragState?: ISashDragState;
	private headerContainer!: HTMLElement;

	private scheduledRender?: IDisposable;
	private bigNumberDelta = 0;

	private headerHeight: number;

	private disposables: IDisposable[];

	get contentHeight(): number { return this.length * this.rowHeight; }

	get onDidScroll(): Event<ScrollEvent> { return this.scrollableElement.onScroll; }

	private _orthogonalStartSash: Sash | undefined;
	get orthogonalStartSash(): Sash | undefined { return this._orthogonalStartSash; }
	set orthogonalStartSash(sash: Sash | undefined) {
		for (const sashItem of this.columnSashs) {
			sashItem.sash.orthogonalStartSash = sash;
		}

		this._orthogonalStartSash = sash;
	}

	private _orthogonalEndSash: Sash | undefined;
	get orthogonalEndSash(): Sash | undefined { return this._orthogonalEndSash; }
	set orthogonalEndSash(sash: Sash | undefined) {
		for (const sashItem of this.columnSashs) {
			sashItem.sash.orthogonalEndSash = sash;
		}

		this._orthogonalEndSash = sash;
	}

	get sashes(): Sash[] {
		return this.columnSashs.map(s => s.sash);
	}

	constructor(
		container: HTMLElement,
		columns: ITableColumn<T, any>[],
		private readonly dataSource: ITableDataSource<T>,
		options: ITableViewOptions<T> = DefaultOptions as ITableViewOptions<T>,
	) {
		for (const column of columns) {
			this.renderers.set(column.id, column.renderer);
		}

		this.columns = columns.slice();
		this.staticColumns = this.columns.filter(c => c.static);

		this.cache = new CellCache(this.renderers);

		this.domNode.setAttribute('role', 'grid');
		this.domNode.setAttribute('aria-rowcount', '0');
		this.domNode.setAttribute('aria-readonly', 'true');

		this.domNode.classList.add(this.domId);
		this.domNode.tabIndex = 0;

		DOM.toggleClass(this.domNode, 'mouse-support', typeof options.mouseSupport === 'boolean' ? options.mouseSupport : true);

		// this.ariaSetProvider = { getSetSize: (e, i, length) => length, getPosInSet: (_, index) => index + 1 };

		this.rowHeight = getOrDefault(options, o => o.rowHeight, DefaultOptions.rowHeight);
		this.headerHeight = getOrDefault(options, o => o.headerHeight, DefaultOptions.headerHeight);

		let left = 0;
		this.columns = this.columns.map(c => {
			c.width = getOrDefault(c, o => o.width, DefaultOptions.columnWidth);
			c.minWidth = getOrDefault(c, o => o.minWidth, DefaultOptions.minWidth);
			c.resizeable = getOrDefault(c, c => c.resizeable, DefaultOptions.resizeable);
			c.left = left;
			left += c.width;
			return c;
		});

		this.rowsContainer.setAttribute('role', 'rowgroup');

		this.scrollableElement = new ScrollableElement(this.rowsContainer, {
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Auto,
			useShadows: true
		});

		this.renderHeader(this.domNode);

		this.domNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this.domNode);

		this.disposables = [/*this.gesture,*/ this.scrollableElement, this.cache];

		this.scrollableElement.onScroll(this.onScroll, this, this.disposables);

		// Prevent the monaco-scrollable-element from scrolling
		// https://github.com/Microsoft/vscode/issues/44181
		domEvent(this.scrollableElement.getDomNode(), 'scroll')
			(e => (e.target as HTMLElement).scrollTop = 0, null, this.disposables);

		this.updateScrollWidth();
		this.layout();
	}

	private renderHeader(container: HTMLElement): void {
		this.headerContainer = DOM.append(container, DOM.$('.monaco-perftable-header'));
		const sashContainer = DOM.append(this.headerContainer, DOM.$('.sash-container'));
		this.headerContainer.style.height = this.headerHeight + 'px';
		this.headerContainer.style.lineHeight = this.headerHeight + 'px';
		this.headerContainer.setAttribute('role', 'rowgroup');
		const headerCellContainer = DOM.append(this.headerContainer, DOM.$('.monaco-perftable-header-cell-container'));
		headerCellContainer.setAttribute('role', 'row');

		for (const column of this.columns) {
			this.createHeaderSash(sashContainer, column);
			const domNode = DOM.append(headerCellContainer, DOM.$('.monaco-perftable-header-cell'));
			domNode.setAttribute('role', 'columnheader');
			domNode.style.width = column.width + 'px';
			domNode.style.left = column.left + 'px';
			domNode.innerText = column.name;
			column.domNode = domNode;
		}
	}

	private createHeaderSash(sashContainer: HTMLElement, column: ITableColumn<T, any>): void {
		const layoutProvider = {
			getVerticalSashLeft: (sash: Sash) => {
				let left = 0;
				for (const c of this.columns) {
					left += c.width!;
					if (column === c) {
						break;
					}
				}
				return left;
			}
		};
		const sash = new Sash(sashContainer, layoutProvider, {
			orientation: Orientation.VERTICAL,
			orthogonalStartSash: this.orthogonalStartSash,
			orthogonalEndSash: this.orthogonalEndSash
		});

		const sashEventMapper = (e: IBaseSashEvent) => ({ sash, column, start: e.startX, current: e.currentX });

		const onStart = Event.map(sash.onDidStart, sashEventMapper);
		const onStartDisposable = onStart(this.onSashStart, this);
		const onChange = Event.map(sash.onDidChange, sashEventMapper);
		const onChangeDisposable = onChange(this.onSashChange, this);
		// const onEnd = Event.map(sash.onDidEnd, () => firstIndex(this.columnSashs, item => item.sash === sash));
		// const onEndDisposable = onEnd(this.onSashEnd, this);
		// const onDidReset = Event.map(sash.onDidEnd, () => firstIndex(this.columnSashs, item => item.sash === sash));
		// const onDidResetDisposable = onDidReset(this.onDidSashReset, this);

		const disposable = combinedDisposable(onStartDisposable, onChangeDisposable, /*onEndDisposable, onDidResetDisposable, */sash);
		const sashItem: ISashItem = { sash, disposable };
		this.columnSashs.push(sashItem);
		if (!column.resizeable) {
			sash.hide();
		}
	}

	private onSashStart({ sash, start }: ISashEvent<T>): void {
		const index = this.columnSashs.findIndex(item => item.sash === sash);
		const sizes = this.columns.map(i => i.width!);
		const lefts = this.columns.map(i => i.left!);
		this.sashDragState = { start, current: start, index, sizes, lefts };
	}

	private onSashChange({ column, current }: ISashEvent<T>): void {
		const { index, start, sizes, lefts } = this.sashDragState!;
		this.sashDragState!.current = current;

		const delta = current - start;
		const adjustedDelta = sizes[index] + delta < column.minWidth! ? column.minWidth! - sizes[index] : delta;

		column.width = sizes[index] + adjustedDelta;
		column.domNode!.style.width = column.width + 'px';
		for (let i = index + 1; i < this.columns.length; i++) {
			const resizeColumn = this.columns[i];
			resizeColumn.left = lefts[i] + adjustedDelta;
			resizeColumn.domNode!.style.left = resizeColumn.left + 'px';
		}
		for (const [index, row] of this.visibleRows.entries()) {
			if (row) {
				this.updateRowInDOM(row, index);
			}
		}
		this.updateScrollWidth();
		this.layout();
	}

	private eventuallyUpdateScrollDimensions(): void {
		this._scrollHeight = this.contentHeight;
		this.rowsContainer.style.height = `${this._scrollHeight}px`;

		if (!this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable = DOM.scheduleAtNextAnimationFrame(() => {
				this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
				this.updateScrollWidth();
				this.scrollableElementUpdateDisposable = null;
			});
		}
	}

	private updateScrollWidth(): void {
		this._scrollWidth = this.columns.reduce((p, c) => p += c.width!, 0);
		this.rowsContainer.style.width = `${this.scrollWidth}px`;
		this.headerContainer.style.width = `${this.scrollWidth}px`;
		this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth });
	}

	private onScroll(e: ScrollEvent): void {
		if (this.scheduledRender) {
			this.scheduledRender.dispose();
		}
		this.scheduledRender = DOM.runAtThisOrScheduleAtNextAnimationFrame(() => {
			this.render(e.scrollTop, e.height, e.scrollLeft, e.scrollWidth);
		});
	}

	private getRenderRange(renderTop: number, renderHeight: number): IRange {
		const start = Math.floor(renderTop / this.rowHeight);
		const end = Math.ceil((renderTop + renderHeight) / this.rowHeight);
		return {
			start,
			end
		};
	}

	private getNextToLastElement(ranges: IRange[]): HTMLElement | null {
		const lastRange = ranges[ranges.length - 1];

		if (!lastRange) {
			return null;
		}

		const nextToLastItem = this.visibleRows[lastRange.end];

		if (!nextToLastItem) {
			return null;
		}

		if (!nextToLastItem.row) {
			return null;
		}

		return nextToLastItem.row;
	}

	private render(renderTop: number, renderHeight: number, renderLeft: number, scrollWidth: number): void {
		const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		const renderRange = this.getRenderRange(renderTop, renderHeight);
		renderRange.end = renderRange.end > this.length ? this.length : renderRange.end;

		// IE (all versions) cannot handle units above about 1,533,908 px, so every 500k pixels bring numbers down
		const STEP_SIZE = 500000;
		this.bigNumberDelta = 0;
		if (renderTop >= STEP_SIZE) {
			// Compute a delta that guarantees that lines are positioned at `lineHeight` increments
			this.bigNumberDelta = Math.floor(renderTop / STEP_SIZE) * STEP_SIZE;
			this.bigNumberDelta = Math.floor(this.bigNumberDelta / this.rowHeight) * this.rowHeight;
			const rangesToUpdate = Range.intersect(previousRenderRange, renderRange);
			for (let i = rangesToUpdate.start; i < rangesToUpdate.end; i++) {
				this.updateRowInDOM(this.visibleRows[i], i);
			}
		}

		const rangesToInsert = Range.relativeComplement(renderRange, previousRenderRange);
		const rangesToRemove = Range.relativeComplement(previousRenderRange, renderRange);
		const beforeElement = this.getNextToLastElement(rangesToInsert);

		for (const range of rangesToInsert) {
			for (let i = range.start; i < range.end; i++) {
				this.insertRowInDOM(i, beforeElement);
			}
		}

		for (const range of rangesToRemove) {
			for (let i = range.start; i < range.end; i++) {
				this.removeRowFromDOM(i);
			}
		}

		const canUseTranslate3d = !isWindows && !browser.isFirefox && browser.getZoomLevel() === 0;

		if (canUseTranslate3d) {
			const transform = `translate3d(-${renderLeft}px, -${renderTop - this.bigNumberDelta}px, 0px)`;
			this.rowsContainer.style.transform = transform;
			this.rowsContainer.style.webkitTransform = transform;
			this.headerContainer.style.transform = `translate3d(-${renderLeft}px, 0px, 0px)`;
			this.headerContainer.style.webkitTransform = `translate3d(-${renderLeft}px, 0px, 0px)`;

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.left = '0';
				this.headerContainer.style.left = '0';
				this.rowsContainer.style.top = '0';
			}
		} else {
			this.rowsContainer.style.left = `-${renderLeft}px`;
			this.headerContainer.style.left = `-${renderLeft}px`;
			this.rowsContainer.style.top = `-${renderTop - this.bigNumberDelta}px`;

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.transform = '';
				this.rowsContainer.style.webkitTransform = '';
			}
		}

		this.canUseTranslate3d = canUseTranslate3d;

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderHeight;
	}

	public layout(height?: number, width?: number): void {
		const scrollDimensions: INewScrollDimensions = {
			height: typeof height === 'number' ? height : DOM.getContentHeight(this.domNode)
		};
		scrollDimensions.height = scrollDimensions.height! - this.headerHeight;
		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = null;
			scrollDimensions.scrollHeight = this.scrollHeight;
		}

		this.scrollableElement.setScrollDimensions(scrollDimensions);

		this.scrollableElement.setScrollDimensions({
			width: typeof width === 'number' ? width : DOM.getContentWidth(this.domNode)
		});

		this.columnSashs.forEach(s => s.sash.layout());
	}

	getScrollTop(): number {
		const scrollPosition = this.scrollableElement.getScrollPosition();
		return scrollPosition.scrollTop;
	}

	getScrollLeft(): number {
		const scrollPosition = this.scrollableElement.getScrollPosition();
		return scrollPosition.scrollLeft;
	}

	setScrollTop(scrollTop: number): void {
		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = null;
			this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
		}

		this.scrollableElement.setScrollPosition({ scrollTop });
	}

	get scrollTop(): number {
		return this.getScrollTop();
	}

	set scrollTop(scrollTop: number) {
		this.setScrollTop(scrollTop);
	}

	get scrollHeight(): number {
		return this._scrollHeight + 10;
	}

	get scrollWidth(): number {
		return this._scrollWidth + 10;
	}

	get scrollLeft(): number {
		return this.getScrollLeft();
	}

	domElement(index: number, column: number): HTMLElement | null {
		const row = this.visibleRows[index];
		const cell = row && row.cells && row.cells[column];
		return cell && cell.domNode;
	}

	element(index: number): T | undefined {
		return this.visibleRows[index].element;
	}

	column(index: number): ITableColumn<T, any> | undefined {
		return this.columns[index];
	}

	indexOfColumn(columnId: string): number | undefined {
		return this.columns.findIndex(v => v.id === columnId);
	}

	get renderHeight(): number {
		const scrollDimensions = this.scrollableElement.getScrollDimensions();
		return scrollDimensions.height;
	}

	private insertRowInDOM(index: number, beforeElement: HTMLElement | null): void {
		let row = this.visibleRows[index];

		if (!row) {
			row = {
				id: String(index),
				element: undefined,
				row: null,
				size: this.rowHeight,
				cells: null,
				datapromise: null
			};
			row.datapromise = createCancelablePromise(token => {
				return this.dataSource.getRow(index).then(d => {
					row.element = d;
				});
			});
			row.datapromise.finally(() => row.datapromise = null);
			this.visibleRows[index] = row;
		}

		if (!row.row) {
			this.allocRow(row, index);
			row.row!.setAttribute('role', 'treeitem');
		}

		if (!row.row!.parentElement) {
			if (beforeElement) {
				this.rowsContainer.insertBefore(row.row!, beforeElement);
			} else {
				this.rowsContainer.appendChild(row.row!);
			}
		}

		this.updateRowInDOM(row, index);

		if (row.datapromise) {
			row.datapromise.then(() => this.renderRow(row, index));
			// in this case we can special case the row count column
			for (const [i, column] of this.staticColumns.entries()) {
				const cell = row.cells![i];
				column.renderer.renderCell(undefined, index, i, column.id, cell.templateData, column.width);
			}
		} else {
			this.renderRow(row, index);
		}
	}

	private allocRow(row: IAsyncRowItem<T>, index: number): void {
		row.cells = new Array<ICell>();
		row.row = DOM.$('.monaco-perftable-row');
		for (const [index, column] of this.columns.entries()) {
			const cell = this.cache.alloc(column.id);
			row.cells[index] = cell;
			if (column.cellClass) {
				cell.domNode!.classList.add(column.cellClass);
			}
			row.row.appendChild(cell.domNode!);
		}
	}

	private renderRow(row: IAsyncRowItem<T>, index: number): void {
		for (const [i, column] of this.columns.entries()) {
			const cell = row.cells![i];
			column.renderer.renderCell(row.element!, index, i, column.id, cell.templateData, column.width);
		}
	}

	private updateRowInDOM(row: IAsyncRowItem<T>, index: number): void {
		row.row!.style.top = `${this.elementTop(index)}px`;
		row.row!.style.height = `${row.size}px`;

		for (const [columnIndex, column] of this.columns.entries()) {
			const cell = row.cells![columnIndex].domNode;
			cell!.style.width = `${column.width}px`;
			cell!.style.left = `${column.left}px`;
			cell!.style.height = `${row.size}px`;
			cell!.style.lineHeight = `${row.size}px`;
			cell!.setAttribute('data-column-id', `${columnIndex}`);
			cell!.setAttribute('role', 'gridcell');
			row.row!.setAttribute('id', this.getElementDomId(index, columnIndex));
		}

		row.row!.setAttribute('data-index', `${index}`);
		row.row!.setAttribute('data-last-element', index === this.length - 1 ? 'true' : 'false');
		row.row!.setAttribute('role', 'row');
		// row.row!.setAttribute('aria-setsize', String(this.ariaSetProvider.getSetSize(row.element, index, this.length)));
		// row.row!.setAttribute('aria-posinset', String(this.ariaSetProvider.getPosInSet(row.element, index)));
		row.row!.setAttribute('id', this.getElementDomId(index));
	}

	private removeRowFromDOM(index: number): void {
		const item = this.visibleRows[index];

		if (!item) {
			return;
		}

		let canceled = false;
		if (item.datapromise) {
			item.datapromise.cancel();
			canceled = true;
		}

		for (const [i, column] of this.columns.entries()) {
			const cell = item.cells![i];

			if (!canceled) {
				const renderer = column.renderer;
				if (renderer && renderer.disposeCell) {
					renderer.disposeCell(item.element!, index, i, column.id, cell.templateData, column.width);
				}
			}

			this.cache.release(cell!);
		}

		removeFromParent(item.row!);

		delete this.visibleRows[index];
	}

	@memoize get onMouseClick(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'click'), e => this.toMouseEvent(e)); }
	@memoize get onMouseDblClick(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'dblclick'), e => this.toMouseEvent(e)); }
	@memoize get onMouseMiddleClick(): Event<ITableMouseEvent<T>> { return Event.filter(Event.map(domEvent(this.domNode, 'auxclick'), e => this.toMouseEvent(e as MouseEvent)), e => e.browserEvent.button === 1); }
	@memoize get onMouseUp(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'mouseup'), e => this.toMouseEvent(e)); }
	@memoize get onMouseDown(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'mousedown'), e => this.toMouseEvent(e)); }
	@memoize get onMouseOver(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'mouseover'), e => this.toMouseEvent(e)); }
	@memoize get onMouseMove(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'mousemove'), e => this.toMouseEvent(e)); }
	@memoize get onMouseOut(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'mouseout'), e => this.toMouseEvent(e)); }
	@memoize get onContextMenu(): Event<ITableMouseEvent<T>> { return Event.map(domEvent(this.domNode, 'contextmenu'), e => this.toMouseEvent(e)); }

	public toMouseEvent(browserEvent: MouseEvent): ITableMouseEvent<T> {
		const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
		const item = typeof index === 'undefined' ? undefined : this.visibleRows[index.row];
		const element = item && item.element;
		const buttons = browserEvent.buttons;
		return { browserEvent, buttons, index, element };
	}

	public getItemIndexFromEventTarget(target: EventTarget | null): GridPosition | undefined {
		let element: HTMLElement | null = target as (HTMLElement | null);

		while (element instanceof HTMLElement && element !== this.rowsContainer) {
			const rawColumn = element.getAttribute('data-column-id');

			if (rawColumn) {
				const column = Number(rawColumn);

				if (!isNaN(column)) {
					while (element instanceof HTMLElement && element !== this.rowsContainer) {
						const rawIndex = element.getAttribute('data-index');

						if (rawIndex) {
							const row = Number(rawIndex);

							if (!isNaN(row)) {
								return new GridPosition(row, column);
							}
						}

						element = element.parentElement;
					}
				}
			}

			element = element!.parentElement;
		}

		return undefined;
	}

	elementTop(index: number): number {
		return Math.floor(index * this.rowHeight) - this.bigNumberDelta;
	}

	getElementDomId(index: number, column?: number): string {
		if (column) {
			return `${this.domId}_${index}_${column}`;
		} else {
			return `${this.domId}_${index}`;
		}
	}

	get length(): number {
		return this._length;
	}

	set length(length: number) {
		this.domNode.setAttribute('aria-rowcount', `${length}`);
		const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		const potentialRerenderRange = { start: this.length, end: length };
		const rerenderRange = Range.intersect(potentialRerenderRange, previousRenderRange);
		this._length = length;
		for (let i = rerenderRange.start; i < rerenderRange.end; i++) {
			if (this.visibleRows[i]) {
				this.removeRowFromDOM(i);
			}
			this.insertRowInDOM(i, null);
		}
		this.eventuallyUpdateScrollDimensions();
	}

	get columnLength(): number {
		return this.columns.length;
	}

	dispose(): void {
		dispose(this.disposables);
	}
}
