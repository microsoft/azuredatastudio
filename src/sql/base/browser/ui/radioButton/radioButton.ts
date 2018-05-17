/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as DOM from 'vs/base/browser/dom';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { Color } from 'vs/base/common/color';
import Event, { Emitter } from 'vs/base/common/event';

export class RadioButton {

	private _radioButtonInput: HTMLElement;
	private _onClicked = new Emitter<void>();
	public readonly onClicked: Event<void> = this._onClicked.event;

	constructor(container: HTMLElement) {
		this._radioButtonInput = DOM.append(container, DOM.$('input.option-input'));
		this._radioButtonInput.setAttribute('type', 'radio');

		jQuery(this._radioButtonInput).on('click', () => {
			this._onClicked.fire();
		});
	}

	public set name(value: string) {
		this._radioButtonInput.setAttribute('name', value);
	}

	public get name(): string {
		return this._radioButtonInput.getAttribute('name');
	}

	public set value(value: string) {
		this._radioButtonInput.setAttribute('value', value);
	}

	public get value(): string {
		return this._radioButtonInput.getAttribute('value');
	}

	public enable(): void {
		this._radioButtonInput.removeAttribute('disabled');
	}

	public disable(): void {
		this._radioButtonInput.setAttribute('disabled', 'true');
	}

	public isEnabled(): boolean {
		return !this._radioButtonInput.hasAttribute('disabled');
	}
}