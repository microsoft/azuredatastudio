/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBox as vsInputBox, IInputOptions as vsIInputBoxOptions, IInputBoxStyles as vsIInputBoxStyles, IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
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

export interface IInputOptions extends vsIInputBoxOptions {
	/**
	 * Whether calls to validate require the force parameter to be set to true
	 * to run the base VS Input Box validation logic. See validate() override
	 * for more info.
	 */
	requireForceValidations?: boolean;
	required?: boolean;
}

export class InputBox extends vsInputBox {
	private enabledInputBackground?: Color;
	private enabledInputForeground?: Color;
	private enabledInputBorder?: Color;
	private disabledInputBackground?: Color;
	private disabledInputForeground?: Color;
	private disabledInputBorder?: Color;

	private _lastLoseFocusValue: string;

	private _onLoseFocus = this._register(new Emitter<OnLoseFocusParams>());
	public onLoseFocus: Event<OnLoseFocusParams> = this._onLoseFocus.event;

	private _isTextAreaInput = false;
	private _hideErrors = false;

	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, private _sqlOptions?: IInputOptions) {
		super(container, contextViewProvider, _sqlOptions);
		this.enabledInputBackground = this.inputBackground;
		this.enabledInputForeground = this.inputForeground;
		this.enabledInputBorder = this.inputBorder;
		this.disabledInputBackground = Color.transparent;

		this._lastLoseFocusValue = this.value;
		let self = this;
		this.onblur(this.inputElement, () => {
			self._onLoseFocus.fire({ value: self.value, hasChanged: self._lastLoseFocusValue !== self.value });
			self._lastLoseFocusValue = self.value;
		});

		if (_sqlOptions && _sqlOptions.type === 'textarea') {
			this._isTextAreaInput = true;
		}
		this.required = !!this._sqlOptions?.required;
	}

	public override style(styles: IInputBoxStyles): void {
		super.style(styles);
		this.enabledInputBackground = this.inputBackground;
		this.enabledInputForeground = this.inputForeground;
		this.enabledInputBorder = this.inputBorder;
		this.disabledInputBackground = styles.disabledInputBackground;
		this.disabledInputForeground = styles.disabledInputForeground;
		this.updateInputEnabledDisabledColors();
		this.applyStyles();
	}

	public override enable(): void {
		super.enable();
		this.updateInputEnabledDisabledColors();
		this.applyStyles();
	}

	public set rows(value: number) {
		this.inputElement.setAttribute('rows', value.toString());
	}

	public set columns(value: number) {
		this.inputElement.setAttribute('cols', value.toString());
	}

	public override layout(): void {
		if (!this._isTextAreaInput) {
			super.layout();
		}
	}

	public override disable(): void {
		super.disable();
		this.updateInputEnabledDisabledColors();
		this.applyStyles();
	}

	public setHeight(value: string) {
		if (this._isTextAreaInput) {
			this.inputElement.style.height = value;
			this.inputElement.style.whiteSpace = 'normal';
		}
	}

	public setMaxLength(value: number | undefined) {
		if (value === undefined) {
			this.inputElement.removeAttribute('maxLength');
		}
		else {
			this.inputElement.maxLength = value;
		}
	}

	public set ariaLive(value: string) {
		this.element.setAttribute('aria-live', value);
	}

	public isEnabled(): boolean {
		return !this.inputElement.hasAttribute('disabled');
	}

	public get required(): boolean {
		return this.inputElement.required;
	}

	public set required(v: boolean) {
		this.inputElement.required = v;
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

	public override showMessage(message: IMessage, force?: boolean): void {
		if (!this.hideErrors) {
			super.showMessage(message, force);
		}
	}

	private updateInputEnabledDisabledColors(): void {
		let enabled = this.isEnabled();
		this.inputBackground = enabled ? this.enabledInputBackground : this.disabledInputBackground;
		this.inputForeground = enabled ? this.enabledInputForeground : this.disabledInputForeground;
		this.inputBorder = enabled ? this.enabledInputBorder : this.disabledInputBorder;
	}

	public override validate(force?: boolean): MessageType | undefined {
		// We override the validate call here because in some situations we could end up with an "invalid" alert
		// being announced incorrectly. For example the InputBox component has its own async validation - and so
		// if a change was made to the text then the base VS InputBox would call validate immediately - before
		// the async validation was able to trigger and complete and so the state could still be invalid at that
		// point
		// So instead we allow users of the input box to control whether to let the base input box do its validation
		// as normal or whether to require manually calling validate with force === true in order to run the validation
		// logic.
		if (force || this._sqlOptions?.requireForceValidations !== true) {
			return super.validate();
		}
		return undefined;
	}

	public override set width(width: number) {
		super.width = width;
		this.element.style.width = 'fit-content';
	}

	public override get value() {
		return super.value;
	}

	public override set value(newValue: string) {
		this._lastLoseFocusValue = newValue;
		super.value = newValue;
	}
}
