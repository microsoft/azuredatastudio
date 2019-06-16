/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./table';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { RangeMap, shift } from 'vs/base/browser/ui/list/rangeMap';
import { Event } from 'vs/base/common/event';
import { ScrollEvent, ScrollbarVisibility, INewScrollDimensions } from 'vs/base/common/scrollable';
import * as DOM from 'vs/base/browser/dom';
import { domEvent } from 'vs/base/browser/event';
import { Delayer, CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { isWindows } from 'vs/base/common/platform';
import * as browser from 'vs/base/browser/browser';
import { Range, IRange } from 'vs/base/common/range';
import { ISpliceable } from 'vs/base/common/sequence';
import { getOrDefault } from 'vs/base/common/objects';
import { CellCache, ICell } from 'sql/base/browser/ui/table/highPerf/cellCache';
import { IColumnRenderer, ITableDataSource } from 'sql/base/browser/ui/table/highPerf/table';

interface IRowItem<T> {
	readonly id: string;
	readonly element: T;
	row: HTMLElement | null;
	cells: ICell[] | null;
	size: number;
}

export interface IAriaSetProvider<T> {
	getSetSize(element: T, index: number, listLength: number): number;
	getPosInSet(element: T, index: number): number;
}

export interface ITableViewOptions<T> {
	rowHeight?: number;
}

const DefaultOptions = {
	rowHeight: 22,
	columnWidth: 120
};

export interface IColumn<T, TTemplateData> {
	renderer: IColumnRenderer<T, TTemplateData>;
	width?: number;
	id: string;
}

export class SplicableTableView<T> implements ISpliceable<T>, IDisposable {
	private static InstanceCount = 0;
	readonly domId = `table_id_${++SplicableTableView.InstanceCount}`;

	readonly domNode = document.createElement('div');

	private rows: IRowItem<T>[] = [];
	private rowRangeMap = new RangeMap();
	private cache: CellCache<T>;
	private renderers = new Map<string, IColumnRenderer<any /* TODO@joao */, any>>();
	private lastRenderTop = 0;
	private lastRenderHeight = 0;
	private renderWidth = 0;
	private readonly rowsContainer = document.createElement('div');
	private scrollableElement: ScrollableElement;
	private _scrollHeight: number;
	private scrollableElementUpdateDisposable: IDisposable | null = null;
	private scrollableElementWidthDelayer = new Delayer<void>(50);
	private splicing = false;
	private ariaSetProvider: IAriaSetProvider<T>;
	private scrollWidth: number | undefined;
	private canUseTranslate3d: boolean | undefined = undefined;
	private rowHeight: number;

	private disposables: IDisposable[];

	get contentHeight(): number { return this.rowRangeMap.size; }

	get onDidScroll(): Event<ScrollEvent> { return this.scrollableElement.onScroll; }

	constructor(
		container: HTMLElement,
		private columns: IColumn<T, any>[],
		options: ITableViewOptions<T> = DefaultOptions as ITableViewOptions<T>,
	) {
		for (const column of columns) {
			this.renderers.set(column.id, column.renderer);
		}

		this.cache = new CellCache(this.renderers);

		this.domNode.className = 'monaco-perftable';

		DOM.addClass(this.domNode, this.domId);
		this.domNode.tabIndex = 0;

		this.ariaSetProvider = { getSetSize: (e, i, length) => length, getPosInSet: (_, index) => index + 1 };

		this.rowHeight = getOrDefault(options, (o) => options.rowHeight, DefaultOptions.rowHeight);
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

		this.domNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this.domNode);

		this.disposables = [this.rowRangeMap, /*this.gesture,*/ this.scrollableElement, this.cache];

		this.scrollableElement.onScroll(this.onScroll, this, this.disposables);

		// Prevent the monaco-scrollable-element from scrolling
		// https://github.com/Microsoft/vscode/issues/44181
		domEvent(this.scrollableElement.getDomNode(), 'scroll')
			(e => (e.target as HTMLElement).scrollTop = 0, null, this.disposables);

		this.layout();
	}

	splice(start: number, deleteCount: number, elements: T[] = []): T[] {
		if (this.splicing) {
			throw new Error('Can\'t run recursive splices.');
		}

		this.splicing = true;

		try {
			return this._splice(start, deleteCount, elements);
		} finally {
			this.splicing = false;
		}
	}

	private _splice(start: number, deleteCount: number, elements: T[] = []): T[] {
		const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		const deleteRange = { start, end: start + deleteCount };
		const removeRange = Range.intersect(previousRenderRange, deleteRange);

		for (let i = removeRange.start; i < removeRange.end; i++) {
			this.removeRowFromDOM(i);
		}

		const previousRestRange: IRange = { start: start + deleteCount, end: this.rows.length };
		const previousRenderedRestRange = Range.intersect(previousRestRange, previousRenderRange);
		const previousUnrenderedRestRanges = Range.relativeComplement(previousRestRange, previousRenderRange);

		const inserted = elements.map<IRowItem<T>>((element, i) => ({
			id: String(start + i),
			element,
			row: null,
			size: this.rowHeight,
			cells: null
		}));

		let deleted: IRowItem<T>[];

		// TODO@joao: improve this optimization to catch even more cases
		if (start === 0 && deleteCount >= this.rows.length) {
			this.rowRangeMap = new RangeMap();
			this.rowRangeMap.splice(0, 0, inserted);
			this.rows = inserted;
			deleted = [];
		} else {
			this.rowRangeMap.splice(start, deleteCount, inserted);
			deleted = this.rows.splice(start, deleteCount, ...inserted);
		}

		const delta = elements.length - deleteCount;
		const renderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		const renderedRestRange = shift(previousRenderedRestRange, delta);
		const updateRange = Range.intersect(renderRange, renderedRestRange);

		for (let i = updateRange.start; i < updateRange.end; i++) {
			this.updateRowInDOM(this.rows[i], i);
		}

		const removeRanges = Range.relativeComplement(renderedRestRange, renderRange);

		for (const range of removeRanges) {
			for (let i = range.start; i < range.end; i++) {
				this.removeRowFromDOM(i);
			}
		}

		const unrenderedRestRanges = previousUnrenderedRestRanges.map(r => shift(r, delta));
		const elementsRange = { start, end: start + elements.length };
		const insertRanges = [elementsRange, ...unrenderedRestRanges].map(r => Range.intersect(renderRange, r));
		const beforeElement = this.getNextToLastElement(insertRanges);

		for (const range of insertRanges) {
			for (let i = range.start; i < range.end; i++) {
				this.insertRowInDOM(i, beforeElement);
			}
		}

		this.eventuallyUpdateScrollDimensions();

		return deleted.map(i => i.element);
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
		if (this.rows.length === 0) {
			this.scrollableElement.setScrollDimensions({ scrollWidth: 0 });
		}

		this.scrollWidth = this.columns.reduce((p, c) => p + c.width!, 0);
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
		return {
			start: this.rowRangeMap.indexAt(renderTop),
			end: this.rowRangeMap.indexAfter(renderTop + renderHeight - 1)
		};
	}

	private getNextToLastElement(ranges: IRange[]): HTMLElement | null {
		const lastRange = ranges[ranges.length - 1];

		if (!lastRange) {
			return null;
		}

		const nextToLastItem = this.rows[lastRange.end];

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

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.left = '0';
				this.rowsContainer.style.top = '0';
			}
		} else {
			this.rowsContainer.style.left = `-${renderLeft}px`;
			this.rowsContainer.style.top = `-${renderTop}px`;

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.transform = '';
				this.rowsContainer.style.webkitTransform = '';
			}
		}

		this.rowsContainer.style.width = `${Math.max(scrollWidth, this.renderWidth)}px`;

		this.canUseTranslate3d = canUseTranslate3d;

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderHeight;
	}

	public layout(height?: number, width?: number): void {
		const scrollDimensions: INewScrollDimensions = {
			height: typeof height === 'number' ? height : DOM.getContentHeight(this.domNode)
		};

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
		const row = this.rows[index];

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

		this.renderRow(row, index);
	}

	private allocRow(row: IRowItem<T>): void {
		row.cells = new Array<ICell>();
		row.row = DOM.$('.monaco-perftable-row');
		for (const [index, column] of this.columns.entries()) {
			row.cells[index] = this.cache.alloc(column.id);
			row.row.appendChild(row.cells[index].domNode);
		}
	}

	private renderRow(row: IRowItem<T>, index: number): void {
		for (const [i, column] of this.columns.entries()) {
			const cell = row.cells[i];
			column.renderer.renderElement(row.element, index, cell.templateData, column.width);
		}
	}

	private updateRowInDOM(row: IRowItem<T>, index: number): void {
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
		const item = this.rows[index];

		for (const [i, column] of this.columns.entries()) {
			const renderer = column.renderer;
			const cell = item.cells[i];
			if (renderer && renderer.disposeElement) {
				renderer.disposeElement(item.element, index, cell.templateData, column.width);
			}

			this.cache.release(cell!);
		}

		removeFromParent(item.row);

		item.cells = null;
		item.row = null;
	}

	elementTop(index: number): number {
		return this.rowRangeMap.positionAt(index);
	}

	getElementDomId(index: number): string {
		return `${this.domId}_${index}`;
	}

	get length(): number {
		return this.rows.length;
	}

	dispose(): void {
		dispose(this.disposables);
	}
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
	private renderers = new Map<string, IColumnRenderer<any /* TODO@joao */, any>>();
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

	private disposables: IDisposable[];

	get contentHeight(): number { return this.length * this.rowHeight; }

	get onDidScroll(): Event<ScrollEvent> { return this.scrollableElement.onScroll; }

	constructor(
		container: HTMLElement,
		private columns: IColumn<T, any>[],
		private dataSource: ITableDataSource<T>,
		options: ITableViewOptions<T> = DefaultOptions as ITableViewOptions<T>,
	) {
		for (const column of columns) {
			this.renderers.set(column.id, column.renderer);
		}

		this.cache = new CellCache(this.renderers);

		this.domNode.className = 'monaco-perftable';

		DOM.addClass(this.domNode, this.domId);
		this.domNode.tabIndex = 0;

		this.ariaSetProvider = { getSetSize: (e, i, length) => length, getPosInSet: (_, index) => index + 1 };

		this.rowHeight = getOrDefault(options, (o) => options.rowHeight, DefaultOptions.rowHeight);
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
		return {
			start: Math.floor(renderTop / this.rowHeight),
			end: Math.ceil((renderTop + renderHeight - 1) / this.rowHeight)
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

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.left = '0';
				this.rowsContainer.style.top = '0';
			}
		} else {
			this.rowsContainer.style.left = `-${renderLeft}px`;
			this.rowsContainer.style.top = `-${renderTop}px`;

			if (canUseTranslate3d !== this.canUseTranslate3d) {
				this.rowsContainer.style.transform = '';
				this.rowsContainer.style.webkitTransform = '';
			}
		}

		this.rowsContainer.style.width = `${Math.max(scrollWidth, this.renderWidth)}px`;

		this.canUseTranslate3d = canUseTranslate3d;

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderHeight;
	}

	public layout(height?: number, width?: number): void {
		const scrollDimensions: INewScrollDimensions = {
			height: typeof height === 'number' ? height : DOM.getContentHeight(this.domNode)
		};

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
		// need to check if row doesn't exist

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
					if (!token.isCancellationRequested) {
						row.element = d;
						row.datapromise = null;
					}
				});
			});
			row.datapromise.catch(() => {
				/* its fine to ignore a canceled Promise*/
			});
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

	elementTop(index: number): number {
		return Math.floor((index - 1) * this.rowHeight);
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
