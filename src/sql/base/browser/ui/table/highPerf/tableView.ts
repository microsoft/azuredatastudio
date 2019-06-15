/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RowCache, IRow } from 'sql/base/browser/ui/table/highPerf/rowCache';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { RangeMap, shift } from 'vs/base/browser/ui/list/rangeMap';
import { Event } from 'vs/base/common/event';
import { ScrollEvent, ScrollbarVisibility, INewScrollDimensions } from 'vs/base/common/scrollable';
import * as DOM from 'vs/base/browser/dom';
import { domEvent } from 'vs/base/browser/event';
import { Delayer } from 'vs/base/common/async';
import { isWindows } from 'vs/base/common/platform';
import * as browser from 'vs/base/browser/browser';
import { Range, IRange } from 'vs/base/common/range';
import { ISpliceable } from 'vs/base/common/sequence';

interface IRowItem<T> {
	readonly id: string;
	readonly element: T;
	readonly templateId: string;
	row: IRow | null;
	size: number;
	width: number | undefined;
	hasDynamicHeight: boolean;
	lastDynamicHeightWidth: number | undefined;
	uri: string | undefined;
	dropTarget: boolean;
	dragStartDisposable: IDisposable;
}

export class TableView<T> implements ISpliceable<T>, IDisposable {
	private static InstanceCount = 0;
	readonly domId = `list_id_${++TableView.InstanceCount}`;

	readonly domNode = document.createElement('div');

	private rows: IRowItem<T>[];
	private rangeMap = new RangeMap();
	private readonly cache = new RowCache();
	private lastRenderTop = 0;
	private lastRenderHeight = 0;
	private renderWidth = 0;
	private readonly rowsContainer = document.createElement('div');
	private scrollableElement: ScrollableElement;
	private _scrollHeight: number;
	private scrollableElementUpdateDisposable: IDisposable | null = null;
	private scrollableElementWidthDelayer = new Delayer<void>(50);
	private splicing = false;
	private scrollWidth: number | undefined;
	private canUseTranslate3d: boolean | undefined = undefined;

	private disposables: IDisposable[];

	get contentHeight(): number { return this.rangeMap.size; }

	get onDidScroll(): Event<ScrollEvent> { return this.scrollableElement.onScroll; }

	constructor(
		container: HTMLElement
	) {
		this.domNode.className = 'monaco-list';

		DOM.addClass(this.domNode, this.domId);
		this.domNode.tabIndex = 0;

		this.rowsContainer.className = 'monaco-list-rows';

		this.scrollableElement = new ScrollableElement(this.rowsContainer, {
			alwaysConsumeMouseWheel: true,
			horizontal: ScrollbarVisibility.Auto,
			vertical: ScrollbarVisibility.Auto,
			useShadows: true
		});

		this.domNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this.domNode);

		this.disposables = [this.rangeMap, /*this.gesture,*/ this.scrollableElement, this.cache];

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

		const inserted = elements.map<IRowItem<T>>(element => ({
			id: String(this.rowId++),
			element,
			templateId: this.virtualDelegate.getTemplateId(element),
			size: this.virtualDelegate.getHeight(element),
			width: undefined,
			row: null,
		}));

		let deleted: IRowItem<T>[];

		// TODO@joao: improve this optimization to catch even more cases
		if (start === 0 && deleteCount >= this.rows.length) {
			this.rangeMap = new RangeMap();
			this.rangeMap.splice(0, 0, inserted);
			this.rows = inserted;
			deleted = [];
		} else {
			this.rangeMap.splice(start, deleteCount, inserted);
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

		let scrollWidth = 0;

		for (const item of this.rows) {
			if (typeof item.width !== 'undefined') {
				scrollWidth = Math.max(scrollWidth, item.width);
			}
		}

		this.scrollWidth = scrollWidth;
		this.scrollableElement.setScrollDimensions({ scrollWidth: scrollWidth + 10 });
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
			start: this.rangeMap.indexAt(renderTop),
			end: this.rangeMap.indexAfter(renderTop + renderHeight - 1)
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

		return nextToLastItem.row.domNode;
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
			row.row = this.cache.alloc(row.templateId);
			row.row!.domNode!.setAttribute('role', 'treeitem');
		}

		if (!row.row.domNode!.parentElement) {
			if (beforeElement) {
				this.rowsContainer.insertBefore(row.row.domNode!, beforeElement);
			} else {
				this.rowsContainer.appendChild(row.row.domNode!);
			}
		}

		this.updateRowInDOM(row, index);

		if (!renderer) {
			throw new Error(`No renderer found for template id ${row.templateId}`);
		}

		if (renderer) {
			renderer.renderElement(row.element, index, row.row.templateData, row.size);
		}

		this.measureItemWidth(item);
		this.eventuallyUpdateScrollWidth();
	}

	private updateRowInDOM(row: IRowItem<T>, index: number): void {
		row.row!.domNode!.style.top = `${this.elementTop(index)}px`;
		row.row!.domNode!.style.height = `${row.size}px`;

		row.row!.domNode!.setAttribute('data-index', `${index}`);
		row.row!.domNode!.setAttribute('data-last-element', index === this.length - 1 ? 'true' : 'false');
		row.row!.domNode!.setAttribute('aria-setsize', String(this.ariaSetProvider.getSetSize(row.element, index, this.length)));
		row.row!.domNode!.setAttribute('aria-posinset', String(this.ariaSetProvider.getPosInSet(row.element, index)));
		row.row!.domNode!.setAttribute('id', this.getElementDomId(index));
	}

	private removeRowFromDOM(index: number): void {
		const item = this.rows[index];
		item.dragStartDisposable.dispose();

		const renderer = this.renderers.get(item.templateId);
		if (renderer && renderer.disposeElement) {
			renderer.disposeElement(item.element, index, item.row!.templateData, item.size);
		}

		this.cache.release(item.row!);
		item.row = null;

		this.eventuallyUpdateScrollWidth();
	}


	dispose(): void {
		dispose(this.disposables);
	}
}
