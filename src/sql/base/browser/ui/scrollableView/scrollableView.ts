/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./scrollableView';

import { RangeMap } from 'vs/base/browser/ui/list/rangeMap';
import { SmoothScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { Scrollable, ScrollbarVisibility, INewScrollDimensions, ScrollEvent } from 'vs/base/common/scrollable';
import { getOrDefault } from 'vs/base/common/objects';
import * as DOM from 'vs/base/browser/dom';
import { Disposable, IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { Range, IRange } from 'vs/base/common/range';
import { clamp } from 'vs/base/common/numbers';
import { DomEmitter } from 'vs/base/browser/event';

export interface IScrollableViewOptions {
	useShadows?: boolean;
	smoothScrolling?: boolean;
	verticalScrollMode?: ScrollbarVisibility;
	additionalScrollHeight?: number;
	scrollDebouce?: number;
}

const DefaultOptions: IScrollableViewOptions = {
	useShadows: true,
	verticalScrollMode: ScrollbarVisibility.Auto,
	scrollDebouce: 25
};

export interface IView {
	layout(height: number, width: number): void;
	readonly onDidChange: Event<number>;
	readonly element: HTMLElement;
	readonly minimumSize: number;
	readonly maximumSize: number;
	onDidInsert?(): Promise<void>;
	onDidRemove?(): void;
}

interface IItem {
	readonly view: IView;
	size: number;
	domNode?: HTMLElement;
	onDidInsertDisposable?: IDisposable; // I don't trust the children
	onDidRemoveDisposable?: IDisposable; // I don't trust the children
	disposables: IDisposable[];
}

export class ScrollableView extends Disposable {
	private readonly rangeMap = new RangeMap();
	private readonly scrollableElement: SmoothScrollableElement;
	private readonly scrollable: Scrollable;
	private readonly viewContainer = DOM.$('div.scrollable-view-container');
	private readonly domNode = DOM.$('div.scrollable-view');

	private scrollableElementUpdateDisposable?: IDisposable;
	private additionalScrollHeight: number;
	private _scrollHeight = 0;
	private renderHeight = 0;
	private lastRenderTop = 0;
	private lastRenderHeight = 0;
	private readonly items: IItem[] = [];

	private width: number = 0;

	get contentHeight(): number { return this.rangeMap.size; }
	get onDidScroll(): Event<ScrollEvent> { return this.scrollableElement.onScroll; }
	get length(): number { return this.items.length; }

	constructor(container: HTMLElement, options: IScrollableViewOptions = DefaultOptions) {
		super();

		this.additionalScrollHeight = typeof options.additionalScrollHeight === 'undefined' ? 0 : options.additionalScrollHeight;

		this.scrollable = new Scrollable(getOrDefault(options, o => o.smoothScrolling, false) ? 125 : 0, cb => DOM.scheduleAtNextAnimationFrame(cb));
		this.scrollableElement = this._register(new SmoothScrollableElement(this.viewContainer, {
			alwaysConsumeMouseWheel: true,
			horizontal: ScrollbarVisibility.Hidden,
			vertical: getOrDefault(options, o => o.verticalScrollMode, DefaultOptions.verticalScrollMode),
			useShadows: getOrDefault(options, o => o.useShadows, DefaultOptions.useShadows),
		}, this.scrollable));
		this.domNode.appendChild(this.scrollableElement.getDomNode());
		container.appendChild(this.domNode);

		this._register(Event.debounce(this.scrollableElement.onScroll, (l, e) => e, getOrDefault(options, o => o.scrollDebouce, DefaultOptions.scrollDebouce))(this.onScroll, this));

		// Prevent the monaco-scrollable-element from scrolling
		// https://github.com/Microsoft/vscode/issues/44181
		this._register(new DomEmitter(this.scrollableElement.getDomNode(), 'scroll')).event
			(e => (e.target as HTMLElement).scrollTop = 0);
	}

	elementTop(index: number): number {
		return this.rangeMap.positionAt(index);
	}

	layout(height?: number, width?: number): void {
		let scrollDimensions: INewScrollDimensions = {
			height: typeof height === 'number' ? height : DOM.getContentHeight(this.domNode)
		};

		this.renderHeight = scrollDimensions.height!;

		this.width = width ?? DOM.getContentWidth(this.domNode);

		this.calculateItemHeights();

		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = undefined;
			scrollDimensions.scrollHeight = this.scrollHeight;
		}

		this.scrollableElement.setScrollDimensions(scrollDimensions);
		this.rerender(this.getRenderRange(this.lastRenderTop, this.lastRenderHeight));
	}

	setScrollTop(scrollTop: number): void {
		if (this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable.dispose();
			this.scrollableElementUpdateDisposable = undefined;
			this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
		}

		this.scrollableElement.setScrollPosition({ scrollTop });
	}

	private rerender(lastRenderRange: IRange) {
		this.calculateItemHeights();
		this.render(lastRenderRange, this.lastRenderTop, this.lastRenderHeight, true);

		this.eventuallyUpdateScrollDimensions();
	}

	public addViews(views: IView[]): void { // @todo anthonydresser add ability to splice into the middle of the list and remove a particular index
		const lastRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		const items: IItem[] = views.map(view => ({ size: view.minimumSize, view, disposables: [], index: 0 }));

		items.map(i => i.disposables.push(i.view.onDidChange(() => this.rerender(this.getRenderRange(this.lastRenderTop, this.lastRenderHeight)))));

		// calculate heights
		this.splice(this.items.length, 0, items);
		this.rerender(lastRenderRange);
	}

	private splice(index: number, deleteCount: number, items: IItem[] = []): IItem[] {
		this.rangeMap.splice(index, deleteCount, items);
		const ret = this.items.splice(index, deleteCount, ...items);
		return ret;
	}

	public addView(view: IView): void {
		this.addViews([view]);
	}

	/**
	 * Removes all views
	 */
	public clear(): void {
		const lastRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		for (const item of this.items) {
			if (item.domNode) {
				DOM.clearNode(item.domNode);
				item.domNode.remove();
				item.domNode = undefined;
			}
			dispose(item.disposables);
		}
		this.splice(0, this.items.length);
		this.rerender(lastRenderRange);
	}

	private calculateItemHeights() {
		let currentMin = 0;
		for (const item of this.items) {
			currentMin += item.view.minimumSize;
			if (currentMin > this.renderHeight) {
				break;
			}
		}
		if (currentMin > this.renderHeight) { // the items will fill the render height, so just use min heights
			this.items.forEach((item, index) => {
				if (item.size !== item.view.minimumSize) {
					item.size = item.view.minimumSize;
					this.rangeMap.splice(index, 1, [item]);
				}
			});
		} else {
			// try to even distribute
			let renderHeightRemaining = this.renderHeight;
			this.items.forEach((item, index) => {
				const desiredheight = Math.floor(renderHeightRemaining / (this.items.length - index));
				const newSize = clamp(desiredheight, item.view.minimumSize, item.view.maximumSize);
				if (item.size !== newSize) {
					item.size = newSize;
					this.rangeMap.splice(index, 1, [item]);
				}
				renderHeightRemaining -= item.size;
			});
		}
	}

	get scrollHeight(): number {
		return this._scrollHeight + this.additionalScrollHeight;
	}

	private onScroll(e: ScrollEvent): void {
		const previousRenderRange = this.getRenderRange(this.lastRenderTop, this.lastRenderHeight);
		this.render(previousRenderRange, e.scrollTop, e.height);
	}

	private getRenderRange(renderTop: number, renderHeight: number): IRange {
		return {
			start: this.rangeMap.indexAt(renderTop),
			end: this.rangeMap.indexAfter(renderTop + renderHeight - 1)
		};
	}


	// Render

	private render(previousRenderRange: IRange, renderTop: number, renderHeight: number, updateItemsInDOM: boolean = false): void {
		const renderRange = this.getRenderRange(renderTop, renderHeight);

		const rangesToInsert = Range.relativeComplement(renderRange, previousRenderRange);
		const rangesToRemove = Range.relativeComplement(previousRenderRange, renderRange);
		const beforeElement = this.getNextToLastElement(rangesToInsert);

		if (updateItemsInDOM) {
			const rangesToUpdate = Range.intersect(previousRenderRange, renderRange);

			for (let i = rangesToUpdate.start; i < rangesToUpdate.end; i++) {
				this.updateItemInDOM(this.items[i], i);
			}
		}

		for (const range of rangesToInsert) {
			for (let i = range.start; i < range.end; i++) {
				this.insertItemInDOM(i, beforeElement);
			}
		}

		for (const range of rangesToRemove) {
			for (let i = range.start; i < range.end; i++) {
				this.removeItemFromDOM(i);
			}
		}

		this.viewContainer.style.top = `-${renderTop}px`;

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderHeight;
	}

	// DOM operations

	private insertItemInDOM(index: number, beforeElement: HTMLElement | undefined): void {
		const item = this.items[index];

		if (!item.domNode) {
			item.domNode = DOM.$('div.scrollable-view-child');
			item.domNode.appendChild(item.view.element);
		}

		if (!item.domNode!.parentElement) {
			if (beforeElement) {
				this.viewContainer.insertBefore(item.domNode!, beforeElement);
			} else {
				this.viewContainer.appendChild(item.domNode!);
			}
		}

		this.updateItemInDOM(item, index, false);

		item.onDidRemoveDisposable?.dispose();
		item.onDidInsertDisposable = DOM.scheduleAtNextAnimationFrame(async () => {
			// we don't trust the items to be performant so don't interrupt our operations
			if (item.view.onDidInsert) {
				await item.view.onDidInsert();
			}
			item.view.layout(item.size, this.width);
		});
	}

	private updateItemInDOM(item: IItem, index: number, layout: boolean = true): void {
		item.domNode!.style.top = `${this.elementTop(index)}px`;
		item.domNode!.style.width = `${this.width}px`;
		item.domNode!.style.height = `${item.size}px`;
		if (layout) {
			DOM.scheduleAtNextAnimationFrame(() => {
				item.view.layout(item.size, this.width);
			});
		}
	}

	private removeItemFromDOM(index: number): void {
		const item = this.items[index];

		if (item && item.domNode) {
			item.domNode.remove();
			item.onDidInsertDisposable?.dispose();
			if (item.view.onDidRemove) {
				item.onDidRemoveDisposable = DOM.scheduleAtNextAnimationFrame(() => {
					// we don't trust the items to be performant so don't interrupt our operations
					item.view.onDidRemove!();
				});
			}
		}
	}

	private getNextToLastElement(ranges: IRange[]): HTMLElement | undefined {
		const lastRange = ranges[ranges.length - 1];

		if (!lastRange) {
			return undefined;
		}

		const nextToLastItem = this.items[lastRange.end];

		if (!nextToLastItem) {
			return undefined;
		}

		return nextToLastItem.domNode;
	}

	private eventuallyUpdateScrollDimensions(): void {
		this._scrollHeight = this.contentHeight;
		this.viewContainer.style.height = `${this._scrollHeight}px`;

		if (!this.scrollableElementUpdateDisposable) {
			this.scrollableElementUpdateDisposable = DOM.scheduleAtNextAnimationFrame(() => {
				this.scrollableElement.setScrollDimensions({ scrollHeight: this.scrollHeight });
				this.scrollableElementUpdateDisposable = undefined;
			});
		}
	}
}
