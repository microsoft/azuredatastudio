/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as _ from './table';
import * as Lifecycle from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import * as Browser from 'vs/base/browser/browser';
import * as Touch from 'vs/base/browser/touch';
import * as Keyboard from 'vs/base/browser/keyboardEvent';
import * as Mouse from 'vs/base/browser/mouseEvent';
import * as Platform from 'vs/base/common/platform';
import * as Model from './tableModel';
import Event, { Emitter } from 'vs/base/common/event';
import { HeightMap, IViewRow } from './tableViewModel';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { KeyCode } from 'vs/base/common/keyCodes';

export interface IRow {
}

export class RowCache implements Lifecycle.IDisposable {
	private _cache: { [templateId: string]: IRow[]; };

	constructor(private context: _.ITableContext) {
		this._cache = { '': [] };
	}

	public dispose(): void {
	}
}

export interface IViewContext extends _.ITableContext {
	cache: RowCache;
}

export class ViewRow implements IViewRow {
	public model: Model.Row;
	public top: number;
	public height: number;
}

interface IThrottledGestureEvent {
	translationX: number;
	translationY: number;
}

export class TableView extends HeightMap {

	private context: IViewContext;
	private model: Model.TableModel;

	private viewListeners: Lifecycle.IDisposable[];
	private domNode: HTMLElement;
	private wrapper: HTMLElement;
	private scrollableElement: ScrollableElement;
	private msGesture: MSGesture;
	private lastPointerType: string;
	private lastClickTimeStamp: number = 0;

	private didJustPressContextMenuKey: boolean;

	private _onDOMFocus: Emitter<void> = new Emitter<void>();
	get onDOMFocus(): Event<void> { return this._onDOMFocus.event; }

	private _onDOMBlur: Emitter<void> = new Emitter<void>();
	get onDOMBlur(): Event<void> { return this._onDOMBlur.event; }

	constructor(context: _.ITableContext, container: HTMLElement) {
		super();

		this.context = {
			dataSource: context.dataSource,
			renderer: context.renderer,
			controller: context.controller,
			// filter: context.filter,
			// sorter: context.sorter,
			table: context.table,
			// accessibilityProvider: context.accessibilityProvider,
			options: context.options,
			cache: new RowCache(context)
		};

		this.viewListeners = [];

		var focusTracker = DOM.trackFocus(this.domNode);
		this.viewListeners.push(focusTracker.onDidFocus(() => this.onFocus()));
		this.viewListeners.push(focusTracker.onDidBlur(() => this.onBlur()));
		this.viewListeners.push(focusTracker);

		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'keydown', (e) => this.onKeyDown(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'keyup', (e) => this.onKeyUp(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'mousedown', (e) => this.onMouseDown(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'mouseup', (e) => this.onMouseUp(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.wrapper, 'click', (e) => this.onClick(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.wrapper, 'auxclick', (e) => this.onClick(e))); // >= Chrome 56
		this.viewListeners.push(DOM.addDisposableListener(this.domNode, 'contextmenu', (e) => this.onContextMenu(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.wrapper, Touch.EventType.Tap, (e) => this.onTap(e)));
		this.viewListeners.push(DOM.addDisposableListener(this.wrapper, Touch.EventType.Change, (e) => this.onTouchChange(e)));

		if (Browser.isIE) {
			this.viewListeners.push(DOM.addDisposableListener(this.wrapper, 'MSPointerDown', (e) => this.onMsPointerDown(e)));
			this.viewListeners.push(DOM.addDisposableListener(this.wrapper, 'MSGestureTap', (e) => this.onMsGestureTap(e)));

			// these events come too fast, we throttle them
			this.viewListeners.push(DOM.addDisposableThrottledListener<IThrottledGestureEvent>(this.wrapper, 'MSGestureChange', (e) => this.onThrottledMsGestureChange(e), (lastEvent: IThrottledGestureEvent, event: MSGestureEvent): IThrottledGestureEvent => {
				event.stopPropagation();
				event.preventDefault();

				var result = { translationY: event.translationY, translationX: event.translationX };

				if (lastEvent) {
					result.translationY += lastEvent.translationY;
					result.translationX += lastEvent.translationX;
				}

				return result;
			}));
		}

	}

	private getCellAround(element: HTMLElement): ViewCell {
		return undefined;
	}

	public get scrollTop(): number {
		const scrollPosition = this.scrollableElement.getScrollPosition();
		return scrollPosition.scrollTop;
	}

	public set scrollTop(scrollTop: number) {
		this.scrollableElement.setScrollDimensions({
			scrollHeight: this.getTotalHeight()
		});
		this.scrollableElement.setScrollPosition({
			scrollTop: scrollTop
		});
	}

	public getScrollPosition(): number {
		const height = this.getTotalHeight() - this.viewHeight;
		return height <= 0 ? 1 : this.scrollTop / height;
	}

	public setScrollPosition(pos: number): void {
		const height = this.getTotalHeight() - this.viewHeight;
		this.scrollTop = height * pos;
	}

	public get viewHeight() {
		const scrollDimensions = this.scrollableElement.getScrollDimensions();
		return scrollDimensions.height;
	}

	public set viewHeight(viewHeight: number) {
		this.scrollableElement.setScrollDimensions({
			height: viewHeight,
			scrollHeight: this.getTotalHeight()
		});
	}

	private setupMSGesture(): void {
		if ((<any>window).MSGesture) {
			this.msGesture = new MSGesture();
			setTimeout(() => this.msGesture.target = this.wrapper, 100); // TODO@joh, TODO@IETeam
		}
	}

	private onFocus(): void {
		// if (!this.context.options.alwaysFocused) {
			DOM.addClass(this.domNode, 'focused');
		// }

		this._onDOMFocus.fire();
	}

	private onBlur(): void {
		// if (!this.context.options.alwaysFocused) {
			DOM.removeClass(this.domNode, 'focused');
		// }

		// this.domNode.removeAttribute('aria-activedescendant'); // ARIA

		this._onDOMBlur.fire();
	}

	private onKeyDown(e: KeyboardEvent): void {
		var event = new Keyboard.StandardKeyboardEvent(e);

		this.didJustPressContextMenuKey = event.keyCode === KeyCode.ContextMenu || (event.shiftKey && event.keyCode === KeyCode.F10);

		if (this.didJustPressContextMenuKey) {
			event.preventDefault();
			event.stopPropagation();
		}

		if (event.target && event.target.tagName && event.target.tagName.toLowerCase() === 'input') {
			return; // Ignore event if target is a form input field (avoids browser specific issues)
		}

		this.context.controller.onKeyDown(this.context.table, event);
	}

	private onKeyUp(e: KeyboardEvent): void {
		if (this.didJustPressContextMenuKey) {
			this.onContextMenu(e);
		}

		this.didJustPressContextMenuKey = false;
		this.context.controller.onKeyUp(this.context.table, new Keyboard.StandardKeyboardEvent(e));
	}

	private onMouseDown(e: MouseEvent): void {
		this.didJustPressContextMenuKey = false;

		if (!this.context.controller.onMouseDown) {
			return;
		}

		if (this.lastPointerType && this.lastPointerType !== 'mouse') {
			return;
		}

		var event = new Mouse.StandardMouseEvent(e);

		if (event.ctrlKey && Platform.isNative && Platform.isMacintosh) {
			return;
		}

		var item = this.getItemAround(event.target);

		if (!item) {
			return;
		}

		this.context.controller.onMouseDown(this.context.table, item.model.getElement(), event);
	}

	private onMouseUp(e: MouseEvent): void {
		if (!this.context.controller.onMouseUp) {
			return;
		}

		if (this.lastPointerType && this.lastPointerType !== 'mouse') {
			return;
		}

		var event = new Mouse.StandardMouseEvent(e);

		if (event.ctrlKey && Platform.isNative && Platform.isMacintosh) {
			return;
		}

		var item = this.getItemAround(event.target);

		if (!item) {
			return;
		}

		this.context.controller.onMouseUp(this.context.table, item.model.getElement(), event);
	}

	private onClick(e: MouseEvent): void {
		if (this.lastPointerType && this.lastPointerType !== 'mouse') {
			return;
		}

		var event = new Mouse.StandardMouseEvent(e);
		var item = this.getItemAround(event.target);

		if (!item) {
			return;
		}

		if (Browser.isIE && Date.now() - this.lastClickTimeStamp < 300) {
			// IE10+ doesn't set the detail property correctly. While IE10 simply
			// counts the number of clicks, IE11 reports always 1. To align with
			// other browser, we set the value to 2 if clicks events come in a 300ms
			// sequence.
			event.detail = 2;
		}
		this.lastClickTimeStamp = Date.now();

		this.context.controller.onClick(this.context.table, item.model.getElement(), event);
	}

	private onContextMenu(keyboardEvent: KeyboardEvent): void;
	private onContextMenu(mouseEvent: MouseEvent): void;
	private onContextMenu(event: KeyboardEvent | MouseEvent): void {
		var resultEvent: _.ContextMenuEvent;
		var element: any;

		if (event instanceof KeyboardEvent || this.didJustPressContextMenuKey) {
			this.didJustPressContextMenuKey = false;

			var keyboardEvent = new Keyboard.StandardKeyboardEvent(<KeyboardEvent>event);
			element = this.model.getFocus();

			var position: DOM.IDomNodePagePosition;

			// if (!element) {
			// 	element = this.model.getInput();
			// 	position = DOM.getDomNodePagePosition(this.inputItem.element);
			// } else {
			// 	var id = this.context.dataSource.getId(this.context.table, element);
			// 	var viewItem = this.items[id];
			// 	position = DOM.getDomNodePagePosition(viewItem.element);
			// }

			resultEvent = new _.KeyboardContextMenuEvent(position.left + position.width, position.top, keyboardEvent);

		} else {
			var mouseEvent = new Mouse.StandardMouseEvent(<MouseEvent>event);
			var item = this.getItemAround(mouseEvent.target);

			if (!item) {
				return;
			}

			element = item.model.getElement();
			resultEvent = new _.MouseContextMenuEvent(mouseEvent);
		}

		this.context.controller.onContextMenu(this.context.table, element, resultEvent);
	}

	private onTap(e: Touch.GestureEvent): void {
		var item = this.getItemAround(<HTMLElement>e.initialTarget);

		if (!item) {
			return;
		}

		this.context.controller.onTap(this.context.table, item.model.getElement(), e);
	}

	private onTouchChange(event: Touch.GestureEvent): void {
		event.preventDefault();
		event.stopPropagation();

		this.scrollTop -= event.translationY;
	}

	private onMsPointerDown(event: MSPointerEvent): void {
		if (!this.msGesture) {
			return;
		}

		// Circumvent IE11 breaking change in e.pointerType & TypeScript's stale definitions
		var pointerType = event.pointerType;
		if (pointerType === ((<any>event).MSPOINTER_TYPE_MOUSE || 'mouse')) {
			this.lastPointerType = 'mouse';
			return;
		} else if (pointerType === ((<any>event).MSPOINTER_TYPE_TOUCH || 'touch')) {
			this.lastPointerType = 'touch';
		} else {
			return;
		}

		event.stopPropagation();
		event.preventDefault();

		this.msGesture.addPointer(event.pointerId);
	}

	private onMsGestureTap(event: MSGestureEvent): void {
		(<any>event).initialTarget = document.elementFromPoint(event.clientX, event.clientY);
		this.onTap(<any>event);
	}

	private onThrottledMsGestureChange(event: IThrottledGestureEvent): void {
		this.scrollTop -= event.translationY;
	}
}
