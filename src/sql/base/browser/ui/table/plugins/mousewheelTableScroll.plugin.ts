/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as DOM from 'vs/base/browser/dom';
import * as Platform from 'vs/base/common/platform';
import { StandardWheelEvent, IMouseWheelEvent } from 'vs/base/browser/mouseEvent';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { mixin } from 'vs/base/common/objects';

const SCROLL_WHEEL_SENSITIVITY = 50;

export interface IMouseWheelSupportOptions {
	scrollSpeed?: number;
}

const defaultOptions: IMouseWheelSupportOptions = {
	scrollSpeed: SCROLL_WHEEL_SENSITIVITY
};

export class MouseWheelSupport implements Slick.Plugin<any> {

	private viewport: HTMLElement;
	private canvas: HTMLElement;
	private options: IMouseWheelSupportOptions;

	private _disposables: IDisposable[] = [];

	constructor(options: IMouseWheelSupportOptions = {}) {
		this.options = mixin(options, defaultOptions, false);
	}

	public init(grid: Slick.Grid<any>): void {
		this.canvas = grid.getCanvasNode();
		this.viewport = this.canvas.parentElement;
		let onMouseWheel = (browserEvent: IMouseWheelEvent) => {
			let e = new StandardWheelEvent(browserEvent);
			this._onMouseWheel(e);
		};
		this._disposables.push(DOM.addDisposableListener(this.viewport, 'mousewheel', onMouseWheel));
		this._disposables.push(DOM.addDisposableListener(this.viewport, 'DOMMouseScroll', onMouseWheel));
	}

	private _onMouseWheel(e: StandardWheelEvent) {
		if (e.deltaY || e.deltaX) {
			let deltaY = e.deltaY * this.options.scrollSpeed;
			let deltaX = e.deltaX * this.options.scrollSpeed;
			const scrollHeight = this.canvas.clientHeight;
			const scrollWidth = this.canvas.clientWidth;
			const height = this.viewport.clientHeight;
			const width = this.viewport.clientWidth;

			// Convert vertical scrolling to horizontal if shift is held, this
			// is handled at a higher level on Mac
			const shiftConvert = !Platform.isMacintosh && e.browserEvent && e.browserEvent.shiftKey;
			if (shiftConvert && !deltaX) {
				deltaX = deltaY;
				deltaY = 0;
			}

			// scroll down
			if (deltaY < 0) {
				if ((this.viewport.scrollTop - deltaY) + height > scrollHeight) {
					this.viewport.scrollTop = scrollHeight - height;
					this.viewport.dispatchEvent(new Event('scroll'));
				} else {
					this.viewport.scrollTop = this.viewport.scrollTop - deltaY;
					this.viewport.dispatchEvent(new Event('scroll'));
					event.stopPropagation();
					event.preventDefault();
				}
				// scroll up
			} else {
				if ((this.viewport.scrollTop - deltaY) < 0) {
					this.viewport.scrollTop = 0;
					this.viewport.dispatchEvent(new Event('scroll'));
				} else {
					this.viewport.scrollTop = this.viewport.scrollTop - deltaY;
					this.viewport.dispatchEvent(new Event('scroll'));
					event.stopPropagation();
					event.preventDefault();
				}
			}

			// scroll left
			if (deltaX < 0) {
				if ((this.viewport.scrollLeft - deltaX) + width > scrollWidth) {
					this.viewport.scrollLeft = scrollWidth - width;
					this.viewport.dispatchEvent(new Event('scroll'));
				} else {
					this.viewport.scrollLeft = this.viewport.scrollLeft - deltaX;
					this.viewport.dispatchEvent(new Event('scroll'));
					event.stopPropagation();
					event.preventDefault();
				}
				// scroll left
			} else {
				if ((this.viewport.scrollLeft - deltaX) < 0) {
					this.viewport.scrollLeft = 0;
					this.viewport.dispatchEvent(new Event('scroll'));
				} else {
					this.viewport.scrollLeft = this.viewport.scrollLeft - deltaX;
					this.viewport.dispatchEvent(new Event('scroll'));
					event.stopPropagation();
					event.preventDefault();
				}
			}
		}
	}

	destroy() {
		dispose(this._disposables);
	}
}
