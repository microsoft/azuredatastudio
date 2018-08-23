/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as DOM from 'vs/base/browser/dom';
import { StandardMouseWheelEvent } from 'vs/base/browser/mouseEvent';
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
		this.options = mixin(options, defaultOptions);
	}

	public init(grid: Slick.Grid<any>): void {
		this.canvas = grid.getCanvasNode();
		this.viewport = this.canvas.parentElement;
		let onMouseWheel = (browserEvent: MouseWheelEvent) => {
			let e = new StandardMouseWheelEvent(browserEvent);
			this._onMouseWheel(e);
		};
		this._disposables.push(DOM.addDisposableListener(this.viewport, 'mousewheel', onMouseWheel));
		this._disposables.push(DOM.addDisposableListener(this.viewport, 'DOMMouseScroll', onMouseWheel));
	}

	private _onMouseWheel(event: StandardMouseWheelEvent) {
		const scrollHeight = this.canvas.clientHeight;
		const height = this.viewport.clientHeight;
		const scrollDown = Math.sign(event.deltaY) === -1;
		if (scrollDown) {
			if ((this.viewport.scrollTop - (event.deltaY * this.options.scrollSpeed)) + height > scrollHeight) {
				this.viewport.scrollTop = scrollHeight - height;
				this.viewport.dispatchEvent(new Event('scroll'));
			} else {
				this.viewport.scrollTop = this.viewport.scrollTop - (event.deltaY * this.options.scrollSpeed);
				this.viewport.dispatchEvent(new Event('scroll'));
				event.stopPropagation();
				event.preventDefault();
			}
		} else {
			if ((this.viewport.scrollTop - (event.deltaY * this.options.scrollSpeed)) < 0) {
				this.viewport.scrollTop = 0;
				this.viewport.dispatchEvent(new Event('scroll'));
			} else {
				this.viewport.scrollTop = this.viewport.scrollTop - (event.deltaY * this.options.scrollSpeed);
				this.viewport.dispatchEvent(new Event('scroll'));
				event.stopPropagation();
				event.preventDefault();
			}
		}
	}

	destroy() {
		dispose(this._disposables);
	}
}
