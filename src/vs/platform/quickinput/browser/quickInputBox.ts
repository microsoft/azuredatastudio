/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { StandardMouseEvent } from 'vs/base/browser/mouseEvent';
import { FindInput } from 'vs/base/browser/ui/findinput/findInput';
import { IInputBoxStyles, IRange, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IToggleStyles, Toggle } from 'vs/base/browser/ui/toggle/toggle';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import Severity from 'vs/base/common/severity';
import 'vs/css!./media/quickInput';

const $ = dom.$;

export class QuickInputBox extends Disposable {

	private container: HTMLElement;
	private findInput: FindInput;

	constructor(
		private parent: HTMLElement,
		inputBoxStyles: IInputBoxStyles,
		toggleStyles: IToggleStyles
	) {
		super();
		this.container = dom.append(this.parent, $('.quick-input-box'));
		this.findInput = this._register(new FindInput(this.container, undefined, { label: '', inputBoxStyles, toggleStyles }));
		const input = this.findInput.inputBox.inputElement;
		input.role = 'combobox';
		input.ariaHasPopup = 'menu';
		input.ariaAutoComplete = 'list';
		input.ariaExpanded = 'true';
	}

	onKeyDown = (handler: (event: StandardKeyboardEvent) => void): IDisposable => {
		return dom.addDisposableListener(this.findInput.inputBox.inputElement, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
			handler(new StandardKeyboardEvent(e));
		});
	};

	onMouseDown = (handler: (event: StandardMouseEvent) => void): IDisposable => {
		return dom.addDisposableListener(this.findInput.inputBox.inputElement, dom.EventType.MOUSE_DOWN, (e: MouseEvent) => {
			handler(new StandardMouseEvent(e));
		});
	};

	onDidChange = (handler: (event: string) => void): IDisposable => {
		return this.findInput.onDidChange(handler);
	};

	get value() {
		return this.findInput.getValue();
	}

	set value(value: string) {
		this.findInput.setValue(value);
	}

	select(range: IRange | null = null): void {
		this.findInput.inputBox.select(range);
	}

	isSelectionAtEnd(): boolean {
		return this.findInput.inputBox.isSelectionAtEnd();
	}

	setPlaceholder(placeholder: string): void {
		this.findInput.inputBox.setPlaceHolder(placeholder);
	}

	get placeholder() {
		return this.findInput.inputBox.inputElement.getAttribute('placeholder') || '';
	}

	set placeholder(placeholder: string) {
		this.findInput.inputBox.setPlaceHolder(placeholder);
	}

	get password() {
		return this.findInput.inputBox.inputElement.type === 'password';
	}

	set password(password: boolean) {
		this.findInput.inputBox.inputElement.type = password ? 'password' : 'text';
	}

	set enabled(enabled: boolean) {
		// We can't disable the input box because it is still used for
		// navigating the list. Instead, we disable the list and the OK
		// so that nothing can be selected.
		// TODO: should this be what we do for all find inputs? Or maybe some _other_ API
		// on findInput to change it to readonly?
		this.findInput.inputBox.inputElement.toggleAttribute('readonly', !enabled);
		// TODO: styles of the quick pick need to be moved to the CSS instead of being in line
		// so things like this can be done in CSS
		// this.findInput.inputBox.inputElement.classList.toggle('disabled', !enabled);
	}

	set toggles(toggles: Toggle[] | undefined) {
		this.findInput.setAdditionalToggles(toggles);
	}

	hasFocus(): boolean {
		return this.findInput.inputBox.hasFocus();
	}

	setAttribute(name: string, value: string): void {
		this.findInput.inputBox.inputElement.setAttribute(name, value);
	}

	removeAttribute(name: string): void {
		this.findInput.inputBox.inputElement.removeAttribute(name);
	}

	showDecoration(decoration: Severity): void {
		if (decoration === Severity.Ignore) {
			this.findInput.clearMessage();
		} else {
			this.findInput.showMessage({ type: decoration === Severity.Info ? MessageType.INFO : decoration === Severity.Warning ? MessageType.WARNING : MessageType.ERROR, content: '' });
		}
	}

	stylesForType(decoration: Severity) {
		return this.findInput.inputBox.stylesForType(decoration === Severity.Info ? MessageType.INFO : decoration === Severity.Warning ? MessageType.WARNING : MessageType.ERROR);
	}

	setFocus(): void {
		this.findInput.focus();
	}

	layout(): void {
		this.findInput.inputBox.layout();
	}
}
