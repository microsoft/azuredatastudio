/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as DOM from 'vs/base/browser/dom';
import { StandardMouseWheelEvent } from 'vs/base/browser/mouseEvent';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';

export class MouseWheelSupport implements Slick.Plugin<any> {

	private canvas: HTMLCanvasElement;
	private grid: Slick.Grid<any>;

	private _disposables: IDisposable[] = [];

	public init(grid: Slick.Grid<any>): void {
		this.canvas = grid.getCanvasNode();
		let onMouseWheel = (browserEvent: MouseWheelEvent) => {
			let e = new StandardMouseWheelEvent(browserEvent);
			this._onMouseWheel(e);
		};
		this._disposables.push(DOM.addDisposableListener(this.canvas, 'mousewheel', onMouseWheel));
		this._disposables.push(DOM.addDisposableListener(this.canvas, 'DOMMouseScroll', onMouseWheel));
	}

	private _onMouseWheel(event: StandardMouseWheelEvent) {
		this.canvas.scrollTop = this.canvas.scrollTop - event.deltaY;
		this.canvas.dispatchEvent(new Event('scroll'));
		event.stopPropagation();
		event.preventDefault();
	}

	destroy() {
		dispose(this._disposables);
	}
}