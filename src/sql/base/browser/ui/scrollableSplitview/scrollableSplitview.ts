/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./scrollableSplitview';
import { IDisposable, combinedDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { mapEvent, Emitter, Event } from 'vs/base/common/event';
import * as types from 'vs/base/common/types';
import * as dom from 'vs/base/browser/dom';
import { clamp } from 'vs/base/common/numbers';
import { range, firstIndex } from 'vs/base/common/arrays';
import { Sash, Orientation, ISashEvent as IBaseSashEvent } from 'vs/base/browser/ui/sash/sash';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { HeightMap, IView as HeightIView, IViewItem as HeightIViewItem } from './heightMap';
import { ArrayIterator } from 'vs/base/common/iterator';
export { Orientation } from 'vs/base/browser/ui/sash/sash';

export interface ISplitViewOptions {
	orientation?: Orientation; // default Orientation.VERTICAL
}

export interface IView extends HeightIView {
	readonly minimumSize: number;
	readonly maximumSize: number;
	readonly onDidChange: Event<number | undefined>;
	render(container: HTMLElement, orientation: Orientation): void;
	layout(size: number, orientation: Orientation): void;
}

interface ISashEvent {
	sash: Sash;
	start: number;
	current: number;
}

interface IViewItem extends HeightIViewItem {
	view: IView;
	size: number;
	container: HTMLElement;
	disposable: IDisposable;
	layout(): void;
}

interface ISashItem {
	sash: Sash;
	disposable: IDisposable;
}

interface ISashDragState {
	index: number;
	start: number;
	sizes: number[];
}

enum State {
	Idle,
	Busy
}

function pushToEnd<T>(arr: T[], value: T): T[] {
	let didFindValue = false;

	const result = arr.filter(v => {
		if (v === value) {
			didFindValue = true;
			return false;
		}

		return true;
	});

	if (didFindValue) {
		result.push(value);
	}

	return result;
}

export class ScrollableSplitView extends HeightMap implements IDisposable {

	private orientation: Orientation;
	private el: HTMLElement;
	private size = 0;
	private contentSize = 0;
	private viewItems: IViewItem[] = [];
	private sashItems: ISashItem[] = [];
	private sashDragState: ISashDragState;
	private state: State = State.Idle;
	private scrollable: ScrollableElement;

	private lastRenderTop: number;
	private lastRenderHeight: number;

	private _onDidSashChange = new Emitter<void>();
	readonly onDidSashChange = this._onDidSashChange.event;
	private _onDidSashReset = new Emitter<void>();
	readonly onDidSashReset = this._onDidSashReset.event;

	get length(): number {
		return this.viewItems.length;
	}

	constructor(container: HTMLElement, options: ISplitViewOptions = {}) {
		super();
		this.orientation = types.isUndefined(options.orientation) ? Orientation.VERTICAL : options.orientation;

		this.el = document.createElement('div');
		this.scrollable = new ScrollableElement(this.el, {});
		this.scrollable.onScroll(e => {
			this.render(e.scrollTop, e.height);
		});
		let domNode = this.scrollable.getDomNode();
		dom.addClass(this.el, 'monaco-scroll-split-view');
		dom.addClass(domNode, 'monaco-split-view2');
		dom.addClass(domNode, this.orientation === Orientation.VERTICAL ? 'vertical' : 'horizontal');
		container.appendChild(domNode);
	}

	addView(view: IView, size: number, index = this.viewItems.length): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		// Add view
		const container = dom.$('.split-view-view');

		const onChangeDisposable = view.onDidChange(size => this.onViewChange(item, size));
		const containerDisposable = toDisposable(() => {
			if (container.parentElement) {
				this.el.removeChild(container);
			}
			this.onRemoveItems(new ArrayIterator([item.view.id]));
		});
		const disposable = combinedDisposable([onChangeDisposable, containerDisposable]);

		const layoutContainer = this.orientation === Orientation.VERTICAL
			? size => item.container.style.height = `${item.size}px`
			: size => item.container.style.width = `${item.size}px`;

		const layout = () => {
			layoutContainer(item.size);
			item.view.layout(item.size, this.orientation);
		};

		size = Math.round(size);
		const item: IViewItem = { view, container, size, layout, disposable, height: size, top: 0, width: 0 };
		this.viewItems.splice(index, 0, item);

		this.onInsertItems(new ArrayIterator([item]), index > 0 ? this.viewItems[index - 1].view.id : undefined);

		// Add sash
		if (this.viewItems.length > 1) {
			const orientation = this.orientation === Orientation.VERTICAL ? Orientation.HORIZONTAL : Orientation.VERTICAL;
			const layoutProvider = this.orientation === Orientation.VERTICAL ? { getHorizontalSashTop: sash => this.getSashPosition(sash) } : { getVerticalSashLeft: sash => this.getSashPosition(sash) };
			const sash = new Sash(this.el, layoutProvider, { orientation });
			const sashEventMapper = this.orientation === Orientation.VERTICAL
				? (e: IBaseSashEvent) => ({ sash, start: e.startY, current: e.currentY })
				: (e: IBaseSashEvent) => ({ sash, start: e.startX, current: e.currentX });

			const onStart = mapEvent(sash.onDidStart, sashEventMapper);
			const onStartDisposable = onStart(this.onSashStart, this);
			const onChange = mapEvent(sash.onDidChange, sashEventMapper);
			const onSashChangeDisposable = onChange(this.onSashChange, this);
			const onEnd = mapEvent<void, void>(sash.onDidEnd, () => null);
			const onEndDisposable = onEnd(() => this._onDidSashChange.fire());
			const onDidReset = mapEvent<void, void>(sash.onDidReset, () => null);
			const onDidResetDisposable = onDidReset(() => this._onDidSashReset.fire());

			const disposable = combinedDisposable([onStartDisposable, onSashChangeDisposable, onEndDisposable, onDidResetDisposable, sash]);
			const sashItem: ISashItem = { sash, disposable };

			this.sashItems.splice(index - 1, 0, sashItem);
		}

		view.render(container, this.orientation);
		this.relayout(index);
		this.render(this.scrollable.getScrollPosition().scrollLeft, this.scrollable.getScrollDimensions().height);
		this.state = State.Idle;
	}

	removeView(index: number): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		if (index < 0 || index >= this.viewItems.length) {
			return;
		}

		// Remove view
		const viewItem = this.viewItems.splice(index, 1)[0];
		viewItem.disposable.dispose();

		// Remove sash
		if (this.viewItems.length >= 1) {
			const sashIndex = Math.max(index - 1, 0);
			const sashItem = this.sashItems.splice(sashIndex, 1)[0];
			sashItem.disposable.dispose();
		}

		this.relayout();
		this.state = State.Idle;
	}

	moveView(from: number, to: number): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		if (from < 0 || from >= this.viewItems.length) {
			return;
		}

		if (to < 0 || to >= this.viewItems.length) {
			return;
		}

		if (from === to) {
			return;
		}

		const viewItem = this.viewItems.splice(from, 1)[0];
		this.viewItems.splice(to, 0, viewItem);

		if (to + 1 < this.viewItems.length) {
			this.el.insertBefore(viewItem.container, this.viewItems[to + 1].container);
		} else {
			this.el.appendChild(viewItem.container);
		}

		this.layoutViews();
		this.state = State.Idle;
	}

	private relayout(lowPriorityIndex?: number): void {
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		this.resize(this.viewItems.length - 1, this.size - contentSize, undefined, lowPriorityIndex);
	}

	layout(size: number): void {
		const previousSize = Math.max(this.size, this.contentSize);
		this.size = size;
		this.resize(this.viewItems.length - 1, size - previousSize);
	}

	private render(scrollTop: number, viewHeight: number): void {
		let i: number;
		let stop: number;

		let renderTop = scrollTop;
		let renderBottom = scrollTop + viewHeight;
		let thisRenderBottom = this.lastRenderTop + this.lastRenderHeight;

		// when view scrolls down, start rendering from the renderBottom
		for (i = this.indexAfter(renderBottom) - 1, stop = this.indexAt(Math.max(thisRenderBottom, renderTop)); i >= stop; i--) {
			this.insertItemInDOM(<IViewItem>this.itemAtIndex(i));
		}

		// when view scrolls up, start rendering from either this.renderTop or renderBottom
		for (i = Math.min(this.indexAt(this.lastRenderTop), this.indexAfter(renderBottom)) - 1, stop = this.indexAt(renderTop); i >= stop; i--) {
			this.insertItemInDOM(<IViewItem>this.itemAtIndex(i));
		}

		// when view scrolls down, start unrendering from renderTop
		for (i = this.indexAt(this.lastRenderTop), stop = Math.min(this.indexAt(renderTop), this.indexAfter(thisRenderBottom)); i < stop; i++) {
			this.removeItemFromDOM(<IViewItem>this.itemAtIndex(i));
		}

		// when view scrolls up, start unrendering from either renderBottom this.renderTop
		for (i = Math.max(this.indexAfter(renderBottom), this.indexAt(this.lastRenderTop)), stop = this.indexAfter(thisRenderBottom); i < stop; i++) {
			this.removeItemFromDOM(<IViewItem>this.itemAtIndex(i));
		}

		let topItem = this.itemAtIndex(this.indexAt(renderTop));

		if (topItem) {
			this.el.style.top = (topItem.top - renderTop) + 'px';
		}

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderBottom - renderTop;
	}

	private onSashStart({ sash, start }: ISashEvent): void {
		const index = firstIndex(this.sashItems, item => item.sash === sash);
		const sizes = this.viewItems.map(i => i.size);

		const upIndexes = range(index, -1);
		const collapseUp = upIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].view.minimumSize), 0);
		const expandUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].view.maximumSize - sizes[i]), 0);

		const downIndexes = range(index + 1, this.viewItems.length);
		const collapseDown = downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].view.minimumSize), 0);
		const expandDown = downIndexes.reduce((r, i) => r + (this.viewItems[i].view.maximumSize - sizes[i]), 0);

		// const minDelta = -Math.min(collapseUp, expandDown);
		// const maxDelta = Math.min(collapseDown, expandUp);

		this.sashDragState = { start, index, sizes };
	}

	private onSashChange({ sash, current }: ISashEvent): void {
		const { index, start, sizes } = this.sashDragState;
		const delta = current - start;

		this.resize(index, delta, sizes);
	}

	private onViewChange(item: IViewItem, size: number | undefined): void {
		const index = this.viewItems.indexOf(item);

		if (index < 0 || index >= this.viewItems.length) {
			return;
		}

		size = typeof size === 'number' ? size : item.size;
		size = clamp(size, item.view.minimumSize, item.view.maximumSize);
		item.size = size;
		this.relayout(index);
	}

	resizeView(index: number, size: number): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		if (index < 0 || index >= this.viewItems.length) {
			return;
		}

		const item = this.viewItems[index];
		size = Math.round(size);
		size = clamp(size, item.view.minimumSize, item.view.maximumSize);
		let delta = size - item.size;

		if (delta !== 0 && index < this.viewItems.length - 1) {
			const downIndexes = range(index + 1, this.viewItems.length);
			const collapseDown = downIndexes.reduce((r, i) => r + (this.viewItems[i].size - this.viewItems[i].view.minimumSize), 0);
			const expandDown = downIndexes.reduce((r, i) => r + (this.viewItems[i].view.maximumSize - this.viewItems[i].size), 0);
			const deltaDown = clamp(delta, -expandDown, collapseDown);

			this.resize(index, deltaDown);
			delta -= deltaDown;
		}

		if (delta !== 0 && index > 0) {
			const upIndexes = range(index - 1, -1);
			const collapseUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].size - this.viewItems[i].view.minimumSize), 0);
			const expandUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].view.maximumSize - this.viewItems[i].size), 0);
			const deltaUp = clamp(-delta, -collapseUp, expandUp);

			this.resize(index - 1, deltaUp);
		}

		this.state = State.Idle;
	}

	// DOM changes

	private insertItemInDOM(item: IViewItem): void {
		if (item.container.parentElement) {
			return;
		}

		let elementAfter: HTMLElement = null;
		let itemAfter = <IViewItem>this.itemAfter(item);

		if (itemAfter && itemAfter.container) {
			elementAfter = itemAfter.container;
		}

		if (elementAfter === null) {
			this.el.appendChild(item.container);
		} else {
			try {
				this.el.insertBefore(item.container, elementAfter);
			} catch (e) {
				// console.warn('Failed to locate previous tree element');
				this.el.appendChild(item.container);
			}
		}

		item.layout();
	}

	private removeItemFromDOM(item: IViewItem): void {
		if (!item || !item.container || !item.container.parentElement) {
			return;
		}

		this.el.removeChild(item.container);
	}

	getViewSize(index: number): number {
		if (index < 0 || index >= this.viewItems.length) {
			return -1;
		}

		return this.viewItems[index].size;
	}

	private resize(index: number, delta: number, sizes = this.viewItems.map(i => i.size), lowPriorityIndex?: number): void {
		if (index < 0 || index >= this.viewItems.length) {
			return;
		}

		if (delta !== 0) {
			let upIndexes = range(index, -1);
			let downIndexes = range(index + 1, this.viewItems.length);

			if (typeof lowPriorityIndex === 'number') {
				upIndexes = pushToEnd(upIndexes, lowPriorityIndex);
				downIndexes = pushToEnd(downIndexes, lowPriorityIndex);
			}

			const upItems = upIndexes.map(i => this.viewItems[i]);
			const upSizes = upIndexes.map(i => sizes[i]);

			const downItems = downIndexes.map(i => this.viewItems[i]);
			const downSizes = downIndexes.map(i => sizes[i]);

			for (let i = 0, deltaUp = delta; deltaUp !== 0 && i < upItems.length; i++) {
				const item = upItems[i];
				const size = clamp(upSizes[i] + deltaUp, item.view.minimumSize, item.view.maximumSize);
				const viewDelta = size - upSizes[i];

				deltaUp -= viewDelta;
				item.size = size;
			}

			for (let i = 0, deltaDown = delta; deltaDown !== 0 && i < downItems.length; i++) {
				const item = downItems[i];
				const size = clamp(downSizes[i] - deltaDown, item.view.minimumSize, item.view.maximumSize);
				const viewDelta = size - downSizes[i];

				deltaDown += viewDelta;
				item.size = size;
			}
		}

		let contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		let emptyDelta = this.size - contentSize;

		for (let i = this.viewItems.length - 1; emptyDelta > 0 && i >= 0; i--) {
			const item = this.viewItems[i];
			const size = clamp(item.size + emptyDelta, item.view.minimumSize, item.view.maximumSize);
			const viewDelta = size - item.size;

			emptyDelta -= viewDelta;
			item.size = size;
		}

		this.contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);

		this.scrollable.setScrollDimensions({
			scrollHeight: this.contentSize,
			height: this.size
		});

		this.layoutViews();
	}

	private layoutViews(): void {
		this.viewItems.forEach(item => item.layout());
		this.sashItems.forEach(item => item.sash.layout());

		// Update sashes enablement
		let previous = false;
		const collapsesDown = this.viewItems.map(i => previous = (i.size - i.view.minimumSize > 0) || previous);

		previous = false;
		const expandsDown = this.viewItems.map(i => previous = (i.view.maximumSize - i.size > 0) || previous);

		const reverseViews = [...this.viewItems].reverse();
		previous = false;
		const collapsesUp = reverseViews.map(i => previous = (i.size - i.view.minimumSize > 0) || previous).reverse();

		previous = false;
		const expandsUp = reverseViews.map(i => previous = (i.view.maximumSize - i.size > 0) || previous).reverse();

		// this.sashItems.forEach((s, i) => {
		// 	if ((collapsesDown[i] && expandsUp[i + 1]) || (expandsDown[i] && collapsesUp[i + 1])) {
		// 		s.sash.enable();
		// 	} else {
		// 		s.sash.disable();
		// 	}
		// });
	}

	private getSashPosition(sash: Sash): number {
		let position = 0;

		for (let i = 0; i < this.sashItems.length; i++) {
			position += this.viewItems[i].size;

			if (this.sashItems[i].sash === sash) {
				return position;
			}
		}

		return 0;
	}

	dispose(): void {
		this.viewItems.forEach(i => i.disposable.dispose());
		this.viewItems = [];

		this.sashItems.forEach(i => i.disposable.dispose());
		this.sashItems = [];
	}
}
