/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Event, { Emitter } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { KeyCode } from 'vs/base/common/keyCodes';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';

export interface ICheckboxOptions {
	label: string;
	enabled?: boolean;
	checked?: boolean;
}

export class Checkbox extends Disposable {
	private _el: HTMLInputElement;
	private _label: HTMLSpanElement;

	private _onChange = new Emitter<boolean>();
	public readonly onChange: Event<boolean> = this._onChange.event;

	constructor(container: HTMLElement, opts: ICheckboxOptions) {
		super();

		this._el = document.createElement('input');
		this._el.type = 'checkbox';

		this._register(DOM.addDisposableListener(this._el, DOM.EventType.CHANGE, e => {
			this._onChange.fire(e);
		}));

		this._register(DOM.addStandardDisposableListener(this._el, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Enter)) {
				this.checked = !this.checked;
				e.stopPropagation();
			}
		}));

		this._label = document.createElement('span');

		this.label = opts.label;
		this.enabled = opts.enabled;
		this.checked = opts.checked;

		container.appendChild(this._el);
		container.appendChild(this._label);
	}

	public set label(val: string) {
		this._label.innerText = val;
	}

	public set enabled(val: boolean) {
		this._el.disabled = !val;
	}

	public get enabled(): boolean {
		return !this._el.disabled;
	}

	public set checked(val: boolean) {
		this._el.checked = val;
	}

	public get checked(): boolean {
		return this._el.checked;
	}
}
