/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { InputBox as vsInputBox, IInputOptions, IInputBoxStyles as vsIInputBoxStyles, IMessage } from 'vs/base/browser/ui/inputbox/inputBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { Color } from 'vs/base/common/color';
import { Event, Emitter } from 'vs/base/common/event';

export interface OnLoseFocusParams {
	value: string;
	hasChanged: boolean;
}

export interface IInputBoxStyles extends vsIInputBoxStyles {
	disabledInputBackground?: Color;
	disabledInputForeground?: Color;
}

export class InputBox extends vsInputBox {
	private enabledInputBackground: Color;
	private enabledInputForeground: Color;
	private enabledInputBorder: Color;
	private disabledInputBackground: Color;
	private disabledInputForeground: Color;
	private disabledInputBorder: Color;

	private _lastLoseFocusValue: string;

	private _onLoseFocus = this._register(new Emitter<OnLoseFocusParams>());
	public onLoseFocus: Event<OnLoseFocusParams> = this._onLoseFocus.event;

	private _isTextAreaInput: boolean;
	private _hideErrors = false;

	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, options?: IInputOptions) {
		super(container, contextViewProvider, options);
		this.enabledInputBackground = this.inputBackground;
		this.enabledInputForeground = this.inputForeground;
		this.enabledInputBorder = this.inputBorder;
		this.disabledInputBackground = Color.transparent;
		this.disabledInputForeground = null;
		this.disabledInputBorder = null;

		this._lastLoseFocusValue = this.value;
		let self = this;
		this.onblur(this.inputElement, () => {
			self._onLoseFocus.fire({ value: self.value, hasChanged: self._lastLoseFocusValue !== self.value });
			self._lastLoseFocusValue = self.value;
		});

		if (options && options.type === 'textarea') {
			this._isTextAreaInput = true;
		}
	}

	public style(styles: IInputBoxStyles): void {
		super.style(styles);
		this.enabledInputBackground = this.inputBackground;
		this.enabledInputForeground = this.inputForeground;
		this.enabledInputBorder = this.inputBorder;
		this.disabledInputBackground = styles.disabledInputBackground;
		this.disabledInputForeground = styles.disabledInputForeground;
	}

	public enable(): void {
		super.enable();
		this.inputBackground = this.enabledInputBackground;
		this.inputForeground = this.enabledInputForeground;
		this.inputBorder = this.enabledInputBorder;
		this.applyStyles();
	}

	public set rows(value: number) {
		this.inputElement.setAttribute('rows', value.toString());
	}

	public set columns(value: number) {
		this.inputElement.setAttribute('cols', value.toString());
	}

	public layout(): void {
		if (!this._isTextAreaInput) {
			super.layout();
		}
	}

	public disable(): void {
		super.disable();
		this.inputBackground = this.disabledInputBackground;
		this.inputForeground = this.disabledInputForeground;
		this.inputBorder = this.disabledInputBorder;
		this.applyStyles();
	}

	public setHeight(value: string) {
		if (this._isTextAreaInput) {
			this.inputElement.style.height = value;
		}
	}

	public isEnabled(): boolean {
		return !this.inputElement.hasAttribute('disabled');
	}

	public get hideErrors(): boolean {
		return this._hideErrors;
	}

	public set hideErrors(hideErrors: boolean) {
		this._hideErrors = hideErrors;
		if (hideErrors) {
			this.hideMessage();
		}
	}

	public showMessage(message: IMessage, force?: boolean): void {
		if (!this.hideErrors) {
			super.showMessage(message, force);
		}
	}
}