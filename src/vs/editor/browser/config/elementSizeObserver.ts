/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { IDimension } from 'vs/editor/common/core/dimension';
import { Emitter, Event } from 'vs/base/common/event';

export class ElementSizeObserver extends Disposable {

	private _onDidChange = this._register(new Emitter<void>());
	public readonly onDidChange: Event<void> = this._onDidChange.event;

	private readonly _referenceDomElement: HTMLElement | null;
	private _width: number;
	private _height: number;
	private _resizeObserver: ResizeObserver | null;

	constructor(referenceDomElement: HTMLElement | null, dimension: IDimension | undefined) {
		super();
		this._referenceDomElement = referenceDomElement;
		this._width = -1;
		this._height = -1;
		this._resizeObserver = null;
		this.measureReferenceDomElement(false, dimension);
	}

	public override dispose(): void {
		this.stopObserving();
		super.dispose();
	}

	public getWidth(): number {
		return this._width;
	}

	public getHeight(): number {
		return this._height;
	}

	public startObserving(): void {
		if (!this._resizeObserver && this._referenceDomElement) {
			this._resizeObserver = new ResizeObserver((entries) => {
				if (entries && entries[0] && entries[0].contentRect) {
					this.observe({ width: entries[0].contentRect.width, height: entries[0].contentRect.height });
				} else {
					this.observe();
				}
			});
			this._resizeObserver.observe(this._referenceDomElement);
		}
	}

	public stopObserving(): void {
		if (this._resizeObserver) {
			this._resizeObserver.disconnect();
			this._resizeObserver = null;
		}
	}

	public observe(dimension?: IDimension): void {
		this.measureReferenceDomElement(true, dimension);
	}

	private measureReferenceDomElement(emitEvent: boolean, dimension?: IDimension): void {
		let observedWidth = 0;
		let observedHeight = 0;
		if (dimension) {
			observedWidth = dimension.width;
			observedHeight = dimension.height;
		} else if (this._referenceDomElement) {
			observedWidth = this._referenceDomElement.clientWidth;
			observedHeight = this._referenceDomElement.clientHeight;
		}
		observedWidth = Math.max(5, observedWidth);
		observedHeight = Math.max(5, observedHeight);
		if (this._width !== observedWidth || this._height !== observedHeight) {
			this._width = observedWidth;
			this._height = observedHeight;
			if (emitEvent) {
				this._onDidChange.fire();
			}
		}
	}
}
