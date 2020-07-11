/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/scrollableSplitview';
import { HeightMap, IView as HeightIView, IViewItem as HeightIViewItem } from './heightMap';

import { IDisposable, combinedDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import * as types from 'vs/base/common/types';
import * as dom from 'vs/base/browser/dom';
import { clamp } from 'vs/base/common/numbers';
import { range, firstIndex, pushToStart } from 'vs/base/common/arrays';
import { Sash, Orientation, ISashEvent as IBaseSashEvent } from 'vs/base/browser/ui/sash/sash';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ArrayNavigator } from 'vs/base/common/navigator';
import { mixin } from 'vs/base/common/objects';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { ISplitViewStyles, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { Color } from 'vs/base/common/color';
import { domEvent } from 'vs/base/browser/event';
import { generateUuid } from 'vs/base/common/uuid';
export { Orientation } from 'vs/base/browser/ui/sash/sash';

export interface ISplitViewOptions {
	orientation?: Orientation; // default Orientation.VERTICAL
	styles?: ISplitViewStyles;
	orthogonalStartSash?: Sash;
	orthogonalEndSash?: Sash;
	inverseAltBehavior?: boolean;
	enableResizing?: boolean;
	scrollDebounce?: number;
	verticalScrollbarVisibility?: ScrollbarVisibility;
}

const defaultStyles: ISplitViewStyles = {
	separatorBorder: Color.transparent
};

const defaultOptions: ISplitViewOptions = {
	enableResizing: false
};

export interface IView extends HeightIView {
	readonly element: HTMLElement;
	readonly minimumSize: number;
	readonly maximumSize: number;
	readonly onDidChange: Event<number | undefined>;
	layout(size: number, orientation: Orientation): void;
	onAdd?(): void;
	onRemove?(): void;
}

interface ISashEvent {
	sash: Sash;
	start: number;
	current: number;
	alt: boolean;
}

interface IViewItem extends HeightIViewItem {
	view: IView;
	size: number;
	container: HTMLElement;
	disposable: IDisposable;
	layout(): void;
	onRemove: () => void;
	onAdd: () => void;
}

interface ISashItem {
	sash: Sash;
	disposable: IDisposable;
}

interface ISashDragState {
	index: number;
	start: number;
	current: number;
	sizes: number[];
	minDelta: number;
	maxDelta: number;
	alt: boolean;
	disposable: IDisposable;
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
	private sashContainer: HTMLElement;
	private viewContainer: HTMLElement;
	private scrollable: ScrollableElement;
	private size = 0;
	private contentSize = 0;
	private proportions: undefined | number[] = undefined;
	private viewItems: IViewItem[] = [];
	private sashItems: ISashItem[] = [];
	private sashDragState?: ISashDragState;
	private state: State = State.Idle;
	private inverseAltBehavior: boolean;

	private lastRenderHeight?: number;
	private lastRenderTop?: number;

	private options: ISplitViewOptions;

	private dirtyState = false;

	private _onDidSashChange = new Emitter<number>();
	readonly onDidSashChange = this._onDidSashChange.event;
	private _onDidSashReset = new Emitter<number>();
	readonly onDidSashReset = this._onDidSashReset.event;

	private _onScroll = new Emitter<number>();
	readonly onScroll = this._onScroll.event;

	get length(): number {
		return this.viewItems.length;
	}

	get minimumSize(): number {
		return this.viewItems.reduce((r, item) => r + item.view.minimumSize, 0);
	}

	get maximumSize(): number {
		return this.length === 0 ? Number.POSITIVE_INFINITY : this.viewItems.reduce((r, item) => r + item.view.maximumSize, 0);
	}

	private _orthogonalStartSash: Sash | undefined;
	get orthogonalStartSash(): Sash | undefined { return this._orthogonalStartSash; }
	set orthogonalStartSash(sash: Sash | undefined) {
		for (const sashItem of this.sashItems) {
			sashItem.sash.orthogonalStartSash = sash;
		}

		this._orthogonalStartSash = sash;
	}

	private _orthogonalEndSash: Sash | undefined;
	get orthogonalEndSash(): Sash | undefined { return this._orthogonalEndSash; }
	set orthogonalEndSash(sash: Sash | undefined) {
		for (const sashItem of this.sashItems) {
			sashItem.sash.orthogonalEndSash = sash;
		}

		this._orthogonalEndSash = sash;
	}

	get sashes(): Sash[] {
		return this.sashItems.map(s => s.sash);
	}

	constructor(container: HTMLElement, options: ISplitViewOptions = {}) {
		super();
		this.orientation = types.isUndefined(options.orientation) ? Orientation.VERTICAL : options.orientation;
		this.inverseAltBehavior = !!options.inverseAltBehavior;

		this.options = mixin(options, defaultOptions, false);

		this.el = document.createElement('div');
		this.scrollable = new ScrollableElement(this.el, { vertical: options.verticalScrollbarVisibility });
		Event.debounce(this.scrollable.onScroll, (l, e) => e, types.isNumber(this.options.scrollDebounce) ? this.options.scrollDebounce : 25)(e => {
			this.render(e.scrollTop, e.height);
			this.relayout();
			this._onScroll.fire(e.scrollTop);
		});
		let domNode = this.scrollable.getDomNode();
		dom.addClass(this.el, 'monaco-scroll-split-view');
		dom.addClass(domNode, 'monaco-split-view2');
		dom.addClass(domNode, this.orientation === Orientation.VERTICAL ? 'vertical' : 'horizontal');
		container.appendChild(domNode);

		this.sashContainer = dom.append(this.el, dom.$('.sash-container'));
		this.viewContainer = dom.append(this.el, dom.$('.split-view-container'));

		this.style(options.styles || defaultStyles);
	}

	style(styles: ISplitViewStyles): void {
		if (styles.separatorBorder.isTransparent()) {
			dom.removeClass(this.el, 'separator-border');
			this.el.style.removeProperty('--separator-border');
		} else {
			dom.addClass(this.el, 'separator-border');
			this.el.style.setProperty('--separator-border', styles.separatorBorder.toString());
		}
	}

	addViews(views: IView[], sizes: number[] | Sizing, index = this.viewItems.length): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		let currentIndex = index;
		for (let i = 0; i < views.length; i++) {
			let size: number | Sizing;
			if (Array.isArray(sizes)) {
				size = sizes[i];
			} else {
				size = sizes;
			}
			const view = views[i];
			view.id = view.id || generateUuid();
			// Add view
			const container = dom.$('.split-view-view');

			// removed default adding of the view directly to the container

			const onChangeDisposable = view.onDidChange(size => this.onViewChange(item, size));
			const containerDisposable = toDisposable(() => {
				if (container.parentElement) {
					this.viewContainer.removeChild(container);
				}
				this.onRemoveItems(new ArrayNavigator([item.view.id!]));
			});
			const disposable = combinedDisposable(onChangeDisposable, containerDisposable);

			const onAdd = view.onAdd ? () => view.onAdd!() : () => { };
			const onRemove = view.onRemove ? () => view.onRemove!() : () => { };

			const layoutContainer = this.orientation === Orientation.VERTICAL
				? () => item.container.style.height = `${item.size}px`
				: () => item.container.style.width = `${item.size}px`;

			const layout = () => {
				layoutContainer();
				item.view.layout(item.size, this.orientation);
			};

			let viewSize: number;

			if (typeof size === 'number') {
				viewSize = size;
			} else if (size.type === 'split') {
				viewSize = this.getViewSize(size.index) / 2;
			} else {
				viewSize = view.minimumSize;
			}

			const item: IViewItem = { onAdd, onRemove, view, container, size: viewSize, layout, disposable, height: viewSize, top: 0, width: 0 };
			this.viewItems.splice(currentIndex, 0, item);

			this.onInsertItems(new ArrayNavigator([item]), currentIndex > 0 ? this.viewItems[currentIndex - 1].view.id : undefined);

			// Add sash
			if (this.options.enableResizing && this.viewItems.length > 1) {
				const sash = this.orientation === Orientation.HORIZONTAL
					? new Sash(this.sashContainer, { getHorizontalSashTop: (sash: Sash) => this.getSashPosition(sash) }, {
						orientation: Orientation.HORIZONTAL,
						orthogonalStartSash: this.orthogonalStartSash,
						orthogonalEndSash: this.orthogonalEndSash
					})
					: new Sash(this.sashContainer, { getVerticalSashLeft: (sash: Sash) => this.getSashPosition(sash) }, {
						orientation: Orientation.VERTICAL,
						orthogonalStartSash: this.orthogonalStartSash,
						orthogonalEndSash: this.orthogonalEndSash
					});

				const sashEventMapper = this.orientation === Orientation.VERTICAL
					? (e: IBaseSashEvent) => ({ sash, start: e.startY, current: e.currentY, alt: e.altKey } as ISashEvent)
					: (e: IBaseSashEvent) => ({ sash, start: e.startX, current: e.currentX, alt: e.altKey } as ISashEvent);

				const onStart = Event.map(sash.onDidStart, sashEventMapper);
				const onStartDisposable = onStart(this.onSashStart, this);
				const onChange = Event.map(sash.onDidChange, sashEventMapper);
				const onChangeDisposable = onChange(this.onSashChange, this);
				const onEnd = Event.map(sash.onDidEnd, () => firstIndex(this.sashItems, item => item.sash === sash));
				const onEndDisposable = onEnd(this.onSashEnd, this);
				const onDidResetDisposable = sash.onDidReset(() => this._onDidSashReset.fire(firstIndex(this.sashItems, item => item.sash === sash)));

				const disposable = combinedDisposable(onStartDisposable, onChangeDisposable, onEndDisposable, onDidResetDisposable, sash);
				const sashItem: ISashItem = { sash, disposable };

				this.sashItems.splice(currentIndex - 1, 0, sashItem);
			}

			container.appendChild(view.element);
			currentIndex++;
		}

		let highPriorityIndex: number | undefined;

		if (!types.isArray(sizes) && sizes.type === 'split') {
			highPriorityIndex = sizes.index;
		}

		this.relayout(index, highPriorityIndex);
		this.state = State.Idle;

		if (!types.isArray(sizes) && sizes.type === 'distribute') {
			this.distributeViewSizes();
		}

		// Re-render the views. Set lastRenderTop and lastRenderHeight to undefined since
		// this isn't actually scrolling up or down
		let scrollTop = this.lastRenderTop!;
		let viewHeight = this.lastRenderHeight!;
		this.lastRenderTop = 0;
		this.lastRenderHeight = 0;
		this.render(scrollTop, viewHeight);
	}

	addView(view: IView, size: number | Sizing, index = this.viewItems.length): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		view.id = view.id || generateUuid();
		// Add view
		const container = dom.$('.split-view-view');

		// removed default adding of the view directly to the container

		const onChangeDisposable = view.onDidChange(size => this.onViewChange(item, size));
		const containerDisposable = toDisposable(() => {
			if (container.parentElement) {
				this.viewContainer.removeChild(container);
			}
			this.onRemoveItems(new ArrayNavigator([item.view.id!]));
		});
		const disposable = combinedDisposable(onChangeDisposable, containerDisposable);

		const onAdd = view.onAdd ? () => view.onAdd!() : () => { };
		const onRemove = view.onRemove ? () => view.onRemove!() : () => { };

		const layoutContainer = this.orientation === Orientation.VERTICAL
			? () => item.container.style.height = `${item.size}px`
			: () => item.container.style.width = `${item.size}px`;

		const layout = () => {
			layoutContainer();
			item.view.layout(item.size, this.orientation);
		};

		let viewSize: number;

		if (typeof size === 'number') {
			viewSize = size;
		} else if (size.type === 'split') {
			viewSize = this.getViewSize(size.index) / 2;
		} else {
			viewSize = view.minimumSize;
		}

		const item: IViewItem = { onAdd, onRemove, view, container, size: viewSize, layout, disposable, height: viewSize, top: 0, width: 0 };
		this.viewItems.splice(index, 0, item);

		this.onInsertItems(new ArrayNavigator([item]), index > 0 ? this.viewItems[index - 1].view.id : undefined);

		// Add sash
		if (this.options.enableResizing && this.viewItems.length > 1) {
			const sash = this.orientation === Orientation.HORIZONTAL
				? new Sash(this.sashContainer, { getHorizontalSashTop: (sash: Sash) => this.getSashPosition(sash) }, {
					orientation: Orientation.HORIZONTAL,
					orthogonalStartSash: this.orthogonalStartSash,
					orthogonalEndSash: this.orthogonalEndSash
				})
				: new Sash(this.sashContainer, { getVerticalSashLeft: (sash: Sash) => this.getSashPosition(sash) }, {
					orientation: Orientation.VERTICAL,
					orthogonalStartSash: this.orthogonalStartSash,
					orthogonalEndSash: this.orthogonalEndSash
				});

			const sashEventMapper = this.orientation === Orientation.VERTICAL
				? (e: IBaseSashEvent) => ({ sash, start: e.startY, current: e.currentY, alt: e.altKey } as ISashEvent)
				: (e: IBaseSashEvent) => ({ sash, start: e.startX, current: e.currentX, alt: e.altKey } as ISashEvent);

			const onStart = Event.map(sash.onDidStart, sashEventMapper);
			const onStartDisposable = onStart(this.onSashStart, this);
			const onChange = Event.map(sash.onDidChange, sashEventMapper);
			const onChangeDisposable = onChange(this.onSashChange, this);
			const onEnd = Event.map(sash.onDidEnd, () => firstIndex(this.sashItems, item => item.sash === sash));
			const onEndDisposable = onEnd(this.onSashEnd, this);
			const onDidResetDisposable = sash.onDidReset(() => this._onDidSashReset.fire(firstIndex(this.sashItems, item => item.sash === sash)));

			const disposable = combinedDisposable(onStartDisposable, onChangeDisposable, onEndDisposable, onDidResetDisposable, sash);
			const sashItem: ISashItem = { sash, disposable };

			this.sashItems.splice(index - 1, 0, sashItem);
		}

		container.appendChild(view.element);

		let highPriorityIndex: number | undefined;

		if (typeof size !== 'number' && size.type === 'split') {
			highPriorityIndex = size.index;
		}

		this.relayout(index, highPriorityIndex);
		this.state = State.Idle;

		if (typeof size !== 'number' && size.type === 'distribute') {
			this.distributeViewSizes();
		}
	}

	clear(): void {
		for (let i = this.viewItems.length - 1; i >= 0; i--) {
			this.removeView(i);
		}
	}

	removeView(index: number, sizing?: Sizing): IView {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		this.state = State.Busy;

		if (index < 0 || index >= this.viewItems.length) {
			throw new Error('Index out of bounds');
		}

		// Remove view
		const viewItem = this.viewItems.splice(index, 1)[0];
		viewItem.disposable.dispose();

		// Remove sash
		if (this.options.enableResizing && this.viewItems.length >= 1) {
			const sashIndex = Math.max(index - 1, 0);
			const sashItem = this.sashItems.splice(sashIndex, 1)[0];
			sashItem.disposable.dispose();
		}

		this.relayout();
		this.state = State.Idle;

		if (sizing && sizing.type === 'distribute') {
			this.distributeViewSizes();
		}

		return viewItem.view;
	}

	moveView(from: number, to: number): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		const size = this.getViewSize(from);
		const view = this.removeView(from);
		this.addView(view, size, to);
	}

	swapViews(from: number, to: number): void {
		if (this.state !== State.Idle) {
			throw new Error('Cant modify splitview');
		}

		if (from > to) {
			return this.swapViews(to, from);
		}

		const fromSize = this.getViewSize(from);
		const toSize = this.getViewSize(to);
		const toView = this.removeView(to);
		const fromView = this.removeView(from);

		this.addView(toView, fromSize, from);
		this.addView(fromView, toSize, to);
	}

	private relayout(lowPriorityIndex?: number, highPriorityIndex?: number): void {
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);

		this.resize(this.viewItems.length - 1, this.size - contentSize, undefined, lowPriorityIndex, highPriorityIndex);
		this.distributeEmptySpace();
		this.layoutViews();
		this.saveProportions();
	}

	public setScrollPosition(position: number) {
		this.scrollable.setScrollPosition({ scrollTop: position });
	}

	layout(size: number): void {
		const previousSize = Math.max(this.size, this.contentSize);
		this.size = size;
		this.contentSize = 0;
		this.lastRenderHeight = 0;
		this.lastRenderTop = 0;

		if (!this.proportions) {
			this.resize(this.viewItems.length - 1, size - previousSize);
		} else {
			for (let i = 0; i < this.viewItems.length; i++) {
				const item = this.viewItems[i];
				item.size = clamp(Math.round(this.proportions[i] * size), item.view.minimumSize, item.view.maximumSize);
				this.updateSize(item.view.id!, size);
			}
		}

		this.distributeEmptySpace();
		this.layoutViews();
	}

	private saveProportions(): void {
		if (this.contentSize > 0) {
			this.proportions = this.viewItems.map(i => i.size / this.contentSize);
		}
	}

	private onSashStart({ sash, start, alt }: ISashEvent): void {
		const index = firstIndex(this.sashItems, item => item.sash === sash);

		// This way, we can press Alt while we resize a sash, macOS style!
		const disposable = combinedDisposable(
			domEvent(document.body, 'keydown')(e => resetSashDragState(this.sashDragState!.current, e.altKey)),
			domEvent(document.body, 'keyup')(() => resetSashDragState(this.sashDragState!.current, false))
		);

		const resetSashDragState = (start: number, alt: boolean) => {
			const sizes = this.viewItems.map(i => i.size);
			let minDelta = Number.NEGATIVE_INFINITY;
			let maxDelta = Number.POSITIVE_INFINITY;

			if (this.inverseAltBehavior) {
				alt = !alt;
			}

			if (alt) {
				// When we're using the last sash with Alt, we're resizing
				// the view to the left/up, instead of right/down as usual
				// Thus, we must do the inverse of the usual
				const isLastSash = index === this.sashItems.length - 1;

				if (isLastSash) {
					const viewItem = this.viewItems[index];
					minDelta = (viewItem.view.minimumSize - viewItem.size) / 2;
					maxDelta = (viewItem.view.maximumSize - viewItem.size) / 2;
				} else {
					const viewItem = this.viewItems[index + 1];
					minDelta = (viewItem.size - viewItem.view.maximumSize) / 2;
					maxDelta = (viewItem.size - viewItem.view.minimumSize) / 2;
				}
			}

			this.sashDragState = { start, current: start, index, sizes, minDelta, maxDelta, alt, disposable };
		};

		resetSashDragState(start, alt);
	}

	private onSashChange({ current }: ISashEvent): void {
		const { index, start, sizes, alt, minDelta, maxDelta } = this.sashDragState!;
		this.sashDragState!.current = current;

		const delta = current - start;
		const newDelta = this.resize(index, delta, sizes, undefined, undefined, minDelta, maxDelta);

		if (alt) {
			const isLastSash = index === this.sashItems.length - 1;
			const newSizes = this.viewItems.map(i => i.size);
			const viewItemIndex = isLastSash ? index : index + 1;
			const viewItem = this.viewItems[viewItemIndex];
			const newMinDelta = viewItem.size - viewItem.view.maximumSize;
			const newMaxDelta = viewItem.size - viewItem.view.minimumSize;
			const resizeIndex = isLastSash ? index - 1 : index + 1;

			this.resize(resizeIndex, -newDelta, newSizes, undefined, undefined, newMinDelta, newMaxDelta);
		}

		this.distributeEmptySpace();
		this.layoutViews();
	}

	private onSashEnd(index: number): void {
		this._onDidSashChange.fire(index);
		this.sashDragState!.disposable.dispose();
		this.saveProportions();
	}

	private onViewChange(item: IViewItem, size: number | undefined): void {
		const index = this.viewItems.indexOf(item);

		if (index < 0 || index >= this.viewItems.length) {
			return;
		}

		size = typeof size === 'number' ? size : item.size;
		size = clamp(size, item.view.minimumSize, item.view.maximumSize);

		if (this.inverseAltBehavior && index > 0) {
			// In this case, we want the view to grow or shrink both sides equally
			// so we just resize the "left" side by half and let `resize` do the clamping magic
			this.resize(index - 1, Math.floor((item.size - size) / 2));
			this.distributeEmptySpace();
			this.layoutViews();
		} else {
			item.size = size;
			this.updateSize(item.view.id!, size);
			let top: number = 0;
			for (let i = 0; i < this.viewItems.length; i++) {
				let currentItem: IViewItem = this.viewItems[i];
				this.updateTop(currentItem.view.id!, top);
				top += currentItem.size;
			}
			this.relayout(index);
		}
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

		this.distributeEmptySpace();
		this.layoutViews();
		this.saveProportions();
		this.state = State.Idle;
	}

	distributeViewSizes(): void {
		const size = Math.floor(this.size / this.viewItems.length);

		for (let i = 0; i < this.viewItems.length - 1; i++) {
			this.resizeView(i, size);
		}
	}

	getViewSize(index: number): number {
		if (index < 0 || index >= this.viewItems.length) {
			return -1;
		}

		return this.viewItems[index].size;
	}


	private render(scrollTop: number, viewHeight: number): void {
		let i: number;
		let stop: number;

		let renderTop = scrollTop;
		let renderBottom = scrollTop + viewHeight;
		let thisRenderBottom = this.lastRenderTop! + this.lastRenderHeight!;

		// when view scrolls down, start rendering from the renderBottom
		for (i = this.indexAfter(renderBottom) - 1, stop = this.indexAt(Math.max(thisRenderBottom, renderTop)); i >= stop; i--) {
			if (this.insertItemInDOM(<IViewItem>this.itemAtIndex(i))) {
				this.dirtyState = true;
			}
		}

		// when view scrolls up, start rendering from either this.renderTop or renderBottom
		for (i = Math.min(this.indexAt(this.lastRenderTop!), this.indexAfter(renderBottom)) - 1, stop = this.indexAt(renderTop); i >= stop; i--) {
			if (this.insertItemInDOM(<IViewItem>this.itemAtIndex(i))) {
				this.dirtyState = true;
			}
		}

		// when view scrolls down, start unrendering from renderTop
		for (i = this.indexAt(this.lastRenderTop!), stop = Math.min(this.indexAt(renderTop), this.indexAfter(thisRenderBottom)); i < stop; i++) {
			if (this.removeItemFromDOM(<IViewItem>this.itemAtIndex(i))) {
				this.dirtyState = true;
			}
		}

		// when view scrolls up, start unrendering from either renderBottom this.renderTop
		for (i = Math.max(this.indexAfter(renderBottom), this.indexAt(this.lastRenderTop!)), stop = this.indexAfter(thisRenderBottom); i < stop; i++) {
			if (this.removeItemFromDOM(<IViewItem>this.itemAtIndex(i))) {
				this.dirtyState = true;
			}
		}

		let topItem = this.itemAtIndex(this.indexAt(renderTop));

		if (topItem) {
			this.viewContainer.style.top = (topItem.top - renderTop) + 'px';
		}

		this.lastRenderTop = renderTop;
		this.lastRenderHeight = renderBottom - renderTop;
	}

	// DOM changes

	private insertItemInDOM(item: IViewItem): boolean {
		if (item.container.parentElement) {
			return false;
		}

		let elementAfter: HTMLElement | undefined = undefined;
		let itemAfter = <IViewItem>this.itemAfter(item);

		if (itemAfter && itemAfter.container) {
			elementAfter = itemAfter.container;
		}

		if (elementAfter === undefined) {
			this.viewContainer.appendChild(item.container);
		} else {
			try {
				this.viewContainer.insertBefore(item.container, elementAfter);
			} catch (e) {
				// console.warn('Failed to locate previous tree element');
				this.viewContainer.appendChild(item.container);
			}
		}

		item.layout();

		item.onAdd();
		return true;
	}

	private removeItemFromDOM(item: IViewItem): boolean {
		if (!item || !item.container || !item.container.parentElement) {
			return false;
		}

		this.viewContainer.removeChild(item.container);

		item.onRemove();
		return true;
	}

	private resize(
		index: number,
		delta: number,
		sizes = this.viewItems.map(i => i.size),
		lowPriorityIndex?: number,
		highPriorityIndex?: number,
		overloadMinDelta: number = Number.NEGATIVE_INFINITY,
		overloadMaxDelta: number = Number.POSITIVE_INFINITY
	): number {
		if (index < 0 || index >= this.viewItems.length) {
			return 0;
		}

		const upIndexes = range(index, -1);
		const downIndexes = range(index + 1, this.viewItems.length);

		if (typeof highPriorityIndex === 'number') {
			pushToStart(upIndexes, highPriorityIndex);
			pushToStart(downIndexes, highPriorityIndex);
		}

		if (typeof lowPriorityIndex === 'number') {
			pushToEnd(upIndexes, lowPriorityIndex);
			pushToEnd(downIndexes, lowPriorityIndex);
		}

		const upItems = upIndexes.map(i => this.viewItems[i]);
		const upSizes = upIndexes.map(i => sizes[i]);

		const downItems = downIndexes.map(i => this.viewItems[i]);
		const downSizes = downIndexes.map(i => sizes[i]);

		const minDeltaUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].view.minimumSize - sizes[i]), 0);
		const maxDeltaUp = upIndexes.reduce((r, i) => r + (this.viewItems[i].view.maximumSize - sizes[i]), 0);
		const maxDeltaDown = downIndexes.length === 0 ? Number.POSITIVE_INFINITY : downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].view.minimumSize), 0);
		const minDeltaDown = downIndexes.length === 0 ? Number.NEGATIVE_INFINITY : downIndexes.reduce((r, i) => r + (sizes[i] - this.viewItems[i].view.maximumSize), 0);
		const minDelta = Math.max(minDeltaUp, minDeltaDown, overloadMinDelta);
		const maxDelta = Math.min(maxDeltaDown, maxDeltaUp, overloadMaxDelta);

		delta = clamp(delta, minDelta, maxDelta);

		for (let i = 0, deltaUp = delta; i < upItems.length; i++) {
			const item = upItems[i];
			const size = clamp(upSizes[i] + deltaUp, item.view.minimumSize, item.view.maximumSize);
			const viewDelta = size - upSizes[i];

			deltaUp -= viewDelta;
			item.size = size;
			this.updateSize(item.view.id!, size);
			this.dirtyState = true;
		}

		for (let i = 0, deltaDown = delta; i < downItems.length; i++) {
			const item = downItems[i];
			const size = clamp(downSizes[i] - deltaDown, item.view.minimumSize, item.view.maximumSize);
			const viewDelta = size - downSizes[i];

			deltaDown += viewDelta;
			item.size = size;
			this.updateSize(item.view.id!, size);
			this.dirtyState = true;
		}

		return delta;
	}

	private distributeEmptySpace(): void {
		let contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		let emptyDelta = this.size - contentSize;

		for (let i = this.viewItems.length - 1; emptyDelta !== 0 && i >= 0; i--) {
			const item = this.viewItems[i];
			const size = clamp(item.size + emptyDelta, item.view.minimumSize, item.view.maximumSize);
			const viewDelta = size - item.size;

			emptyDelta -= viewDelta;
			item.size = size;
			this.updateSize(item.view.id!, size);
		}
	}

	private layoutViews(): void {
		// Save new content size
		this.contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);

		if (this.dirtyState) {
			for (let i = this.indexAt(this.lastRenderTop!); i <= this.indexAfter(this.lastRenderTop! + this.lastRenderHeight!) - 1; i++) {
				this.viewItems[i].layout();
				if (this.options.enableResizing) {
					this.sashItems[i].sash.layout();
				}
			}
			this.dirtyState = false;
		}

		this.scrollable.setScrollDimensions({
			scrollHeight: this.contentSize,
			height: this.size
		});
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
