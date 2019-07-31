/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Color } from 'vs/base/common/color';
import { Event, Emitter } from 'vs/base/common/event';
import { Widget } from 'vs/base/browser/ui/widget';
import * as dom from 'vs/base/browser/dom';

export interface ColorboxOptions {
	class?: string[];
}

export interface ColorboxStyle {
	backgroundColor?: Color;
}

export class Colorbox extends Widget {
	private _el: HTMLDivElement;
	private backgroundColor?: Color;

	private _onChange = new Emitter<boolean>();
	public readonly onChange: Event<boolean> = this._onChange.event;

	constructor(container: HTMLElement, opts: ColorboxOptions) {
		super();

		this._el = document.createElement('div');

		if (opts.class) {
			this._el.classList.add(...opts.class);
		}

		container.appendChild(this._el);

		this._register(dom.addDisposableListener(this._el, dom.EventType.CLICK, (e) => {
			console.log('click');
		}));
	}

	public style(styles: ColorboxStyle): void {
		this.backgroundColor = styles.backgroundColor;
		this.updateStyle();
	}

	private updateStyle(): void {
		this._el.style.background = this.backgroundColor ? this.backgroundColor.toString() : this._el.style.backgroundColor;
	}

	public set checked(val: boolean) {
		//
	}

	public get checked(): boolean {
		return true;
	}

	public focus(): boolean {
		return true;
	}

	public get domNode(): Element {
		return this._el;
	}
}
