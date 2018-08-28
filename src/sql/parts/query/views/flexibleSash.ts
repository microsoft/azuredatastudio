/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Dimension } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { IHorizontalSashLayoutProvider, IVerticalSashLayoutProvider,
	ISashEvent, Orientation, Sash } from 'vs/base/browser/ui/sash/sash';
// There is no need to import the sash CSS - 'vs/base/browser/ui/sash/sash' already includes it

/**
 * Interface describing a sash that could be horizontal or vertical. This interface allows classes
 * using the sash to have UI logic that is agnostic of the orientation of the sash.
 */
export interface IFlexibleSash {

	// Get the value of the CSS property denoted by getMajorPosition()
	getSplitPoint(): number;

	// Sets the Dimension containing the height and width of the editor this sash will separate
	setDimenesion(dimension: Dimension);

	// Re-calculates the width and height of the sash
	layout(): void;

	// Hides the sash
	hide(): void;

	// Shows/unhides the sash
	show(): void;

	// Sets the top or left property of this sash
	setEdge(edge: number);

	// Fired when the position of this sash changes
	onPositionChange: Event<number>;
}

/**
 * A simple Vertical Sash that computes the position of the sash when it is moved between the given dimension.
 * Triggers onPositionChange event when the position is changed. Implements IFlexibleSash to enable classes to be
 * agnostic of the fact that this sash is vertical.
 */


export class VerticalFlexibleSash extends Disposable implements IVerticalSashLayoutProvider, IFlexibleSash {

	private sash: Sash;
	private ratio: number;
	private startPosition: number;
	private position: number;
	private dimension: Dimension;
	private top: number;

	private _onPositionChange: Emitter<number> = new Emitter<number>();
	public get onPositionChange(): Event<number> { return this._onPositionChange.event; }

	constructor(container: HTMLElement, private minWidth: number) {
		super();
		this.ratio = 0.5;
		this.top = 0;
		this.sash = new Sash(container, this);

		this._register(this.sash.onDidStart(() => this.onSashDragStart()));
		this._register(this.sash.onDidChange((e: ISashEvent) => this.onSashDrag(e)));
		this._register(this.sash.onDidEnd(() => this.onSashDragEnd()));
		this._register(this.sash.onDidReset(() => this.onSashReset()));
	}

	public getSplitPoint(): number {
		return this.getVerticalSashLeft();
	}

	public layout(): void {
		this.sash.layout();
	}

	public show(): void {
		this.sash.show();
	}

	public hide(): void {
		this.sash.hide();
	}

	public getVerticalSashTop(): number {
		return this.top;
	}

	public getVerticalSashLeft(): number {
		return this.position;
	}

	public getVerticalSashHeight(): number {
		return this.dimension.height;
	}

	public setDimenesion(dimension: Dimension) {
		this.dimension = dimension;
		this.compute(this.ratio);
	}

	public setEdge(edge: number) {
		this.top = edge;
	}

	private onSashDragStart(): void {
		this.startPosition = this.position;
	}

	private onSashDrag(e: ISashEvent): void {
		this.compute((this.startPosition + (e.currentX - e.startX)) / this.dimension.width);
	}

	private compute(ratio: number) {
		this.computeSashPosition(ratio);
		this.ratio = this.position / this.dimension.width;
		this._onPositionChange.fire(this.position);
	}

	private onSashDragEnd(): void {
		this.sash.layout();
	}

	private onSashReset(): void {
		this.ratio = 0.5;
		this._onPositionChange.fire(this.position);
		this.sash.layout();
	}

	private computeSashPosition(sashRatio: number = this.ratio) {
		let contentWidth = this.dimension.width;
		let sashPosition = Math.floor((sashRatio || 0.5) * contentWidth);
		let midPoint = Math.floor(0.5 * contentWidth);

		if (contentWidth > this.minWidth * 2) {
			if (sashPosition < this.minWidth) {
				sashPosition = this.minWidth;
			}
			if (sashPosition > contentWidth - this.minWidth) {
				sashPosition = contentWidth - this.minWidth;
			}
		} else {
			sashPosition = midPoint;
		}
		if (this.position !== sashPosition) {
			this.position = sashPosition;
			this.sash.layout();
		}
	}

}

/**
 * A simple Horizontal Sash that computes the position of the sash when it is moved between the given dimension.
 * Triggers onPositionChange event when the position is changed. Implements IFlexibleSash to enable classes to be
 * agnostic of the fact that this sash is horizontal. Based off the VSash class.
 */
export class HorizontalFlexibleSash extends Disposable implements IHorizontalSashLayoutProvider, IFlexibleSash {

	private sash: Sash;
	private ratio: number;
	private startPosition: number;
	private position: number;
	private dimension: Dimension;
	private left: number;

	private _onPositionChange: Emitter<number> = new Emitter<number>();
	public get onPositionChange(): Event<number> { return this._onPositionChange.event; }

	constructor(container: HTMLElement, private minHeight: number) {
		super();
		this.ratio = 0.5;
		this.left = 0;
		this.sash = new Sash(container, this, { orientation: Orientation.HORIZONTAL });

		this._register(this.sash.onDidStart(() => this.onSashDragStart()));
		this._register(this.sash.onDidChange((e: ISashEvent) => this.onSashDrag(e)));
		this._register(this.sash.onDidEnd(() => this.onSashDragEnd()));
		this._register(this.sash.onDidReset(() => this.onSashReset()));
	}

	public getSplitPoint(): number {
		return this.getHorizontalSashTop();
	}

	public getHorizontalSashLeft(): number {
		return this.left;
	}

	public getHorizontalSashTop(): number {
		return this.position;
	}

	public layout(): void {
		this.sash.layout();
	}

	public show(): void {
		this.sash.show();
	}

	public hide(): void {
		this.sash.hide();
	}

	public getHorizontalSashWidth?(): number {
		return this.dimension.width;
	}

	public setDimenesion(dimension: Dimension) {
		this.dimension = dimension;
		this.compute(this.ratio);
	}

	public setEdge(edge: number) {
		this.left = edge;
	}

	private onSashDragStart(): void {
		this.startPosition = this.position;
	}

	private onSashDrag(e: ISashEvent): void {
		this.compute((this.startPosition + (e.currentY - e.startY)) / this.dimension.height);
	}

	private compute(ratio: number) {
		this.computeSashPosition(ratio);
		this.ratio = this.position / this.dimension.height;
		this._onPositionChange.fire(this.position);
	}

	private onSashDragEnd(): void {
		this.sash.layout();
	}

	private onSashReset(): void {
		this.ratio = 0.5;
		this._onPositionChange.fire(this.position);
		this.sash.layout();
	}

	/**
	 * Computes where the sash should be located and re-renders the sash.
	 */
	private computeSashPosition(sashRatio: number = this.ratio) {
		let contentHeight = this.dimension.height;
		let sashPosition = Math.floor((sashRatio || 0.5) * contentHeight);
		let midPoint = Math.floor(0.5 * contentHeight);

		if (contentHeight > this.minHeight * 2) {
			if (sashPosition < this.minHeight) {
				sashPosition = this.minHeight;
			}
			if (sashPosition > contentHeight - this.minHeight) {
				sashPosition = contentHeight - this.minHeight;
			}
		} else {
			sashPosition = midPoint;
		}
		if (this.position !== sashPosition) {
			this.position = sashPosition;
			this.sash.layout();
		}
	}
}