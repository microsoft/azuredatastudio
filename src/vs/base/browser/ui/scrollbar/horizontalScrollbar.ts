/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StandardWheelEvent } from 'vs/base/browser/mouseEvent';
import { AbstractScrollbar, ISimplifiedMouseEvent, ScrollbarHost } from 'vs/base/browser/ui/scrollbar/abstractScrollbar';
import { ScrollableElementResolvedOptions } from 'vs/base/browser/ui/scrollbar/scrollableElementOptions';
import { ARROW_IMG_SIZE } from 'vs/base/browser/ui/scrollbar/scrollbarArrow';
import { ScrollbarState } from 'vs/base/browser/ui/scrollbar/scrollbarState';
import { Codicon, registerCodicon } from 'vs/base/common/codicons';
import { INewScrollPosition, Scrollable, ScrollbarVisibility, ScrollEvent } from 'vs/base/common/scrollable';


const scrollbarButtonLeftIcon = registerCodicon('scrollbar-button-left', Codicon.triangleLeft);
const scrollbarButtonRightIcon = registerCodicon('scrollbar-button-right', Codicon.triangleRight);

export class HorizontalScrollbar extends AbstractScrollbar {

	constructor(scrollable: Scrollable, options: ScrollableElementResolvedOptions, host: ScrollbarHost) {
		const scrollDimensions = scrollable.getScrollDimensions();
		const scrollPosition = scrollable.getCurrentScrollPosition();
		super({
			lazyRender: options.lazyRender,
			host: host,
			scrollbarState: new ScrollbarState(
				(options.horizontalHasArrows ? options.arrowSize : 0),
				(options.horizontal === ScrollbarVisibility.Hidden ? 0 : options.horizontalScrollbarSize),
				(options.vertical === ScrollbarVisibility.Hidden ? 0 : options.verticalScrollbarSize),
				scrollDimensions.width,
				scrollDimensions.scrollWidth,
				scrollPosition.scrollLeft
			),
			visibility: options.horizontal,
			extraScrollbarClassName: 'horizontal',
			scrollable: scrollable,
			scrollByPage: options.scrollByPage
		});

		if (options.horizontalHasArrows) {
			const arrowDelta = (options.arrowSize - ARROW_IMG_SIZE) / 2;
			const scrollbarDelta = (options.horizontalScrollbarSize - ARROW_IMG_SIZE) / 2;

			this._createArrow({
				className: 'scra',
				icon: scrollbarButtonLeftIcon,
				top: scrollbarDelta,
				left: arrowDelta,
				bottom: undefined,
				right: undefined,
				bgWidth: options.arrowSize,
				bgHeight: options.horizontalScrollbarSize,
				onActivate: () => this._host.onMouseWheel(new StandardWheelEvent(null, 1, 0)),
			});

			this._createArrow({
				className: 'scra',
				icon: scrollbarButtonRightIcon,
				top: scrollbarDelta,
				left: undefined,
				bottom: undefined,
				right: arrowDelta,
				bgWidth: options.arrowSize,
				bgHeight: options.horizontalScrollbarSize,
				onActivate: () => this._host.onMouseWheel(new StandardWheelEvent(null, -1, 0)),
			});
		}

		this._createSlider(Math.floor((options.horizontalScrollbarSize - options.horizontalSliderSize) / 2), 0, undefined, options.horizontalSliderSize);
	}

	protected _updateSlider(sliderSize: number, sliderPosition: number): void {
		this.slider.setWidth(sliderSize);
		this.slider.setLeft(sliderPosition);
	}

	protected _renderDomNode(largeSize: number, smallSize: number): void {
		this.domNode.setWidth(largeSize);
		this.domNode.setHeight(smallSize);
		this.domNode.setLeft(0);
		this.domNode.setBottom(0);
	}

	public onDidScroll(e: ScrollEvent): boolean {
		this._shouldRender = this._onElementScrollSize(e.scrollWidth) || this._shouldRender;
		this._shouldRender = this._onElementScrollPosition(e.scrollLeft) || this._shouldRender;
		this._shouldRender = this._onElementSize(e.width) || this._shouldRender;
		return this._shouldRender;
	}

	protected _mouseDownRelativePosition(offsetX: number, offsetY: number): number {
		return offsetX;
	}

	protected _sliderMousePosition(e: ISimplifiedMouseEvent): number {
		return e.posx;
	}

	protected _sliderOrthogonalMousePosition(e: ISimplifiedMouseEvent): number {
		return e.posy;
	}

	protected _updateScrollbarSize(size: number): void {
		this.slider.setHeight(size);
	}

	public writeScrollPosition(target: INewScrollPosition, scrollPosition: number): void {
		target.scrollLeft = scrollPosition;
	}

	public updateOptions(options: ScrollableElementResolvedOptions): void {
		this.updateScrollbarSize(options.horizontal === ScrollbarVisibility.Hidden ? 0 : options.horizontalScrollbarSize);
		this._scrollbarState.setOppositeScrollbarSize(options.vertical === ScrollbarVisibility.Hidden ? 0 : options.verticalScrollbarSize);
		this._visibilityController.setVisibility(options.horizontal);
		this._scrollByPage = options.scrollByPage;
	}
}
