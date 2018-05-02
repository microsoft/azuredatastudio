/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Directive, Inject, forwardRef, ElementRef, Input } from '@angular/core';

import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { getContentHeight, addDisposableListener, EventType } from 'vs/base/browser/dom';
import { AngularDisposable } from 'sql/base/common/lifecycle';

@Directive({
	selector: '[scrollable]'
})
export class ScrollableDirective extends AngularDisposable {
	private scrollableElement: ScrollableElement;
	private parent: HTMLElement;
	private scrolled: HTMLElement;
	@Input() horizontalScroll: ScrollbarVisibility;
	@Input() verticalScroll: ScrollbarVisibility;
	@Input() useShadow = false;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
	}

	ngOnInit() {
		this.scrolled = this._el.nativeElement as HTMLElement;
		this.parent = this.scrolled.parentElement;
		const next = this.scrolled.nextSibling;
		this.parent.removeChild(this.scrolled);

		this.scrolled.style.position = 'relative';

		this.scrollableElement = new ScrollableElement(this.scrolled, {
			horizontal: this.horizontalScroll,
			vertical: this.verticalScroll,
			useShadows: this.useShadow
		});

		this.scrollableElement.onScroll(e => {
			this.scrolled.style.bottom = e.scrollTop + 'px';
		});

		this.parent.insertBefore(this.scrollableElement.getDomNode(), next);
		const initialHeight = getContentHeight(this.scrolled);
		this.resetScrollDimensions();

		this._register(addDisposableListener(window, EventType.RESIZE, () => {
			this.resetScrollDimensions();
		}));

		// unforunately because of angular rendering behavior we need to do a double check to make sure nothing changed after this point
		setTimeout(() => {
			let currentheight = getContentHeight(this.scrolled);
			if (initialHeight !== currentheight) {
				this.scrollableElement.setScrollDimensions({
					scrollHeight: currentheight,
					height: getContentHeight(this.parent)
				});
			}
		}, 200);
	}

	private resetScrollDimensions() {
		this.scrollableElement.setScrollDimensions({
			scrollHeight: getContentHeight(this.scrolled),
			height: getContentHeight(this.parent)
		});
	}

	public layout() {

	}
}
