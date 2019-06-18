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
import { Delayer, CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { isWindows } from 'vs/base/common/platform';
import * as browser from 'vs/base/browser/browser';
import { Range, IRange } from 'vs/base/common/range';
import { getOrDefault } from 'vs/base/common/objects';

import { CellCache, ICell } from 'sql/base/browser/ui/table/highPerf/cellCache';
import { IColumnRenderer, ITableDataSource, ITableMouseEvent } from 'sql/base/browser/ui/table/highPerf/table';
import { memoize } from 'vs/base/common/decorators';
import { Sash, Orientation, ISashEvent as IBaseSashEvent } from 'vs/base/browser/ui/sash/sash';
import { firstIndex } from 'vs/base/common/arrays';

export interface IAriaSetProvider<T> {
	getSetSize(element: T, index: number, listLength: number): number;
	getPosInSet(element: T, index: number): number;
}

export interface ITableViewOptions<T> {
	rowHeight?: number;
	mouseSupport?: boolean;
}

const DefaultOptions = {
	rowHeight: 22,
	columnWidth: 120
};

export interface IColumn<T, TTemplateData> {
	renderer: IColumnRenderer<T, TTemplateData>;
	width?: number;
	id: string;
	name: string;
}

interface IInternalColumn<T, TTemplateData> extends IColumn<T, TTemplateData> {
	domNode?: HTMLElement;
}

interface ISashItem {
	sash: Sash;
	disposable: IDisposable;
}

interface ISashDragState {
	current: number;
	index: number;
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
	element: T;
	row: HTMLElement | null;
	cells: ICell[] | null;
	size: number;
	datapromise: CancelablePromise<void> | null;
}

export class AsyncTableView<T> implements IDisposable {
	private static InstanceCount = 0;
	readonly domId = `table_id_${++AsyncTableView.InstanceCount}`;

	readonly domNode = document.createElement('div');

	private visibleRows: IAsyncRowItem<T>[] = [];
	private cache: CellCache<T>;
	private renderers = new Map<string, IColumnRenderer<T /* TODO@joao */, any>>();
	private lastRenderTop = 0;
	private lastRenderHeight = 0;
	private renderWidth = 0;
	private readonly rowsContainer = document.createElement('div');
	private scrollableElement: ScrollableElement;
	private _scrollHeight: number;
	private scrollableElementUpdateDisposable: IDisposable | null = null;
	private scrollableElementWidthDelayer = new Delayer<void>(50);
	private ariaSetProvider: IAriaSetProvider<T>;
	private scrollWidth: number | undefined;
	private canUseTranslate3d: boolean | undefined = undefined;
	private rowHeight: number;
	private _length: number = 0;

	private columns: IInternalColumn<T, any>[];
	private columnSashs: ISashItem[] = [];
	private sashDragState: ISashDragState;
	private headerContainer: HTMLElement;

	private headerHeight = 22;

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
		columns: IColumn<T, any>[],
		private readonly dataSource: ITableDataSource<T>,
		options: ITableViewOptions<T> = DefaultOptions as ITableViewOptions<T>,
	) {
		for (const column of columns) {
			this.renderers.set(column.id, column.renderer);
		}

		this.cache = new CellCache(this.renderers);
		this.columns = columns.slice();

		this.domNode.className = 'monaco-perftable';

		DOM.addClass(this.domNode, this.domId);
		this.domNode.tabIndex = 0;

		DOM.toggleClass(this.domNode, 'mouse-support', typeof options.mouseSupport === 'boolean' ? options.mouseSupport : true);

		this.ariaSetProvider = { getSetSize: (e, i, length) => length, getPosInSet: (_, index) => index + 1 };

		this.rowHeight = getOrDefault(options, o => o.rowHeight, DefaultOptions.rowHeight);
		this.columns = this.columns.map(c => {
			c.width = c.width || DefaultOptions.columnWidth;
			return c;
		});

		this.rowsContainer.className = 'monaco-perftable-rows';

		this.scrollableElement = new ScrollableElement(this.rowsContainer, {
			alwaysConsumeMouseWheel: true,
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

		this.layout();
	}

	private renderHeader(container: HTMLElement): void {
		this.headerContainer = DOM.append(container, DOM.$('.monaco-perftable-header'));
		const sashContainer = DOM.append(this.headerContainer, DOM.$('.sash-container'));
		this.headerContainer.style.height = this.headerHeight + 'px';
		const element = this.columns.reduce((p, c) => {
			p[c.id] = c.name;
			return p;
		}, Object.create(null));

		for (const column of this.columns) {
			this.createHeaderSash(sashContainer, column);
			column.domNode = DOM.append(this.headerContainer, DOM.$('.monaco-perftable-header-cell'));
			column.domNode.style.width = column.width + 'px';
			column.renderer.renderHeader(column.domNode, element, column.width);
		}
	}

	private createHeaderSash(sashContainer: HTMLElement, column: IColumn<T, any>): void {
		const layoutProvider = {
			getVerticalSashLeft: (sash: Sash) => {
				let left = 0;
				for (const c of this.columns) {
					left += c.width;
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

		const disposable = combinedDisposable([onStartDisposable, onChangeDisposable, /*onEndDisposable, onDidResetDisposable, */sash]);
		const sashItem: ISashItem = { sash, disposable };
		this.columnSashs.push(sashItem);
	}

	private onSashStart({ sash, start }: ISashEvent<T>): void {
		const index = firstIndex(this.columnSashs, item => item.sash === sash);
		this.sashDragState = { current: start, index };
	}

	private onSashChange({ column, current }: ISashEvent<T>): void {
		const { index } = this.sashDragState;
		const previous = this.sashDragState.current;
		this.sashDragState.current = current;
		const delta = current - previous;
		column.width = column.width + delta;
		column.domNode.style.width = column.width + 'px';
		for (const row of this.visibleRows) {
			row.cells[index].domNode.style.width = column.width + 'px';
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

	private eventuallyUpdateScrollWidth(): void {
		this.scrollableElementWidthDelayer.trigger(() => this.updateScrollWidth());
	}

	private updateScrollWidth(): void {
		this.scrollWidth = this.columns.reduce((p, c) => p + c.width!, 0);
		this.rowsContainer.style.width = `${this.scrollWidth}px`;
		this.scrollableElement.setScrollDimensions({ scrollWidth: this.scrollWidth + 10 });
	}

	private onScroll(e: ScrollEvent): void {
		try {
			this.render(e.scrollTop, e.height, e.scrollLeft, e.scrollWidth);
		} catch (err) {
			console.error('Got bad scroll event:', e);
			throw err;
		}
	}

	private getRenderRange(renderTop: number, renderHeight: number): IRange {
		const start = Math.floor(renderTop / this.rowHeight);
		const end = Math.min(Math.ceil((renderTop + renderHeight) / this.rowHeight), this.length);
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
			const transform = `translate3d(-${renderLeft}px, -${renderTop}px, 0px)`;
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
			this.rowsContainer.style.top = `-${renderTop}px`;

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
		scrollDimensions.height = scrollDimensions.height - this.headerHeight;
		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = null;
			scrollDimensions.scrollHeight = this.scrollHeight;
		}

		this.scrollableElement.setScrollDimensions(scrollDimensions);

		if (typeof width !== 'undefined') {
			this.renderWidth = width;

			this.scrollableElement.setScrollDimensions({
				width: typeof width === 'number' ? width : DOM.getContentWidth(this.domNode)
			});
		}

		this.columnSashs.forEach(s => s.sash.layout());
	}

	getScrollTop(): number {
		const scrollPosition = this.scrollableElement.getScrollPosition();
		return scrollPosition.scrollTop;
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

	private insertRowInDOM(index: number, beforeElement: HTMLElement | null): void {
		let row = this.visibleRows[index];

		if (!row) {
			row = {
				id: String(index),
				element: null,
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
			this.allocRow(row);
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
		} else {
			this.renderRow(row, index);
		}
	}

	private allocRow(row: IAsyncRowItem<T>): void {
		row.cells = new Array<ICell>();
		row.row = DOM.$('.monaco-perftable-row');
		for (const [index, column] of this.columns.entries()) {
			row.cells[index] = this.cache.alloc(column.id);
			row.row.appendChild(row.cells[index].domNode);
		}
	}

	private renderRow(row: IAsyncRowItem<T>, index: number): void {
		for (const [i, column] of this.columns.entries()) {
			const cell = row.cells[i];
			column.renderer.renderElement(row.element, index, cell.templateData, column.width);
		}
	}

	private updateRowInDOM(row: IAsyncRowItem<T>, index: number): void {
		row.row!.style.top = `${this.elementTop(index)}px`;
		row.row!.style.height = `${row.size}px`;

		for (const [index, column] of this.columns.entries()) {
			row.cells[index].domNode.style.width = `${column.width}px`;
		}

		row.row!.setAttribute('data-index', `${index}`);
		row.row!.setAttribute('data-last-element', index === this.length - 1 ? 'true' : 'false');
		row.row!.setAttribute('aria-setsize', String(this.ariaSetProvider.getSetSize(row.element, index, this.length)));
		row.row!.setAttribute('aria-posinset', String(this.ariaSetProvider.getPosInSet(row.element, index)));
		row.row!.setAttribute('id', this.getElementDomId(index));
	}

	private removeRowFromDOM(index: number): void {
		const item = this.visibleRows[index];

		if (!item) {
			return;
		}

		if (item.datapromise) {
			item.datapromise.cancel();
		}

		for (const [i, column] of this.columns.entries()) {
			const renderer = column.renderer;
			const cell = item.cells[i];
			if (renderer && renderer.disposeElement) {
				renderer.disposeElement(item.element, index, cell.templateData, column.width);
			}

			this.cache.release(cell!);
		}

		removeFromParent(item.row);

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

	private toMouseEvent(browserEvent: MouseEvent): ITableMouseEvent<T> {
		const index = this.getItemIndexFromEventTarget(browserEvent.target || null);
		const item = typeof index === 'undefined' ? undefined : this.visibleRows[index];
		const element = item && item.element;
		return { browserEvent, index, element };
	}

	private getItemIndexFromEventTarget(target: EventTarget | null): number | undefined {
		let element: HTMLElement | null = target as (HTMLElement | null);

		while (element instanceof HTMLElement && element !== this.rowsContainer) {
			const rawIndex = element.getAttribute('data-index');

			if (rawIndex) {
				const index = Number(rawIndex);

				if (!isNaN(index)) {
					return index;
				}
			}

			element = element.parentElement;
		}

		return undefined;
	}

	elementTop(index: number): number {
		return Math.floor(index * this.rowHeight);
	}

	getElementDomId(index: number): string {
		return `${this.domId}_${index}`;
	}

	get length(): number {
		return this._length;
	}

	set length(length: number) {
		this._length = length;
		this.eventuallyUpdateScrollDimensions();
	}

	dispose(): void {
		dispose(this.disposables);
	}
}
