/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBox as vsInputBox, IInputOptions as vsIInputBoxOptions, IMessage, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { Event, Emitter } from 'vs/base/common/event';
import { AdsWidget } from 'sql/base/browser/ui/adsWidget';

export interface OnLoseFocusParams {
	value: string;
	hasChanged: boolean;
}

export interface IInputOptions extends vsIInputBoxOptions {
	/**
	 * Whether calls to validate require the force parameter to be set to true
	 * to run the base VS Input Box validation logic. See validate() override
	 * for more info.
	 */
	requireForceValidations?: boolean;
	required?: boolean;
	ariaDescription?: string;
}

export class InputBox extends vsInputBox implements AdsWidget {
	private _lastLoseFocusValue: string;

	private _onLoseFocus = this._register(new Emitter<OnLoseFocusParams>());
	public onLoseFocus: Event<OnLoseFocusParams> = this._onLoseFocus.event;

	private _onInputFocus = this._register(new Emitter<void>());
	public onInputFocus: Event<void> = this._onInputFocus.event;

	private _isTextAreaInput = false;
	private _hideErrors = false;

	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, private _sqlOptions?: IInputOptions, id?: string) {
		super(container, contextViewProvider, _sqlOptions);

		this._lastLoseFocusValue = this.value;
		let self = this;
		this.onblur(this.inputElement, () => {
			self._onLoseFocus.fire({ value: self.value, hasChanged: self._lastLoseFocusValue !== self.value });
			self._lastLoseFocusValue = self.value;
		});

		this.onfocus(this.inputElement, () => {
			self._onInputFocus.fire();
		});

		if (_sqlOptions && _sqlOptions.type === 'textarea') {
			this._isTextAreaInput = true;
		}
		this.required = !!this._sqlOptions?.required;

		if (this._sqlOptions.ariaDescription) {
			this.inputElement.setAttribute('aria-description', this._sqlOptions.ariaDescription);
		}

		if (id !== undefined) {
			this.inputElement.id = id;
		}
		this.updateInputEnabledDisabledColors();
	}

	public override enable(): void {
		super.enable();
		this.updateInputEnabledDisabledColors();
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
		const enabled = this.isEnabled();
		const background = enabled ? this._sqlOptions.inputBoxStyles.inputBackground : this._sqlOptions.inputBoxStyles.disabledInputBackground
		const foreground = enabled ? this._sqlOptions.inputBoxStyles.inputForeground : this._sqlOptions.inputBoxStyles.disabledInputForeground;
		const border = enabled ? this._sqlOptions.inputBoxStyles.inputBorder : this._sqlOptions.inputBoxStyles.disabledInputBorder;
		this.element.style.backgroundColor = background;
		this.element.style.color = foreground;
		this.input.style.color = foreground;
		this.element.style.border = `1px solid ${border}`;
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

	public get id(): string {
		return this.input.id;
	}
}
