/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';

import { IInputOptions, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as nls from 'vs/nls';
import { inputBackground, inputBorder } from 'vs/platform/theme/common/colorRegistry';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { assign } from 'vs/base/common/objects';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { isNumber } from 'vs/base/common/types';
import { convertSize, convertSizeToNumber } from 'sql/base/browser/dom';

@Component({
	selector: 'modelview-inputBox',
	template: `
			<div [style.display]="getInputBoxDisplay()" #input style="width: 100%"></div>
			<div [style.display]="getTextAreaDisplay()" #textarea style="width: 100%"></div>
	`
})
export default class InputBoxComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: InputBox;
	private _textAreaInput: InputBox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	@ViewChild('textarea', { read: ElementRef }) private _textareaContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		let inputOptions: IInputOptions = {
			placeholder: '',
			ariaLabel: '',
			validationOptions: {
				validation: () => {
					if (this.valid) {
						return undefined;
					} else {
						return {
							content: this.inputElement.inputElement.validationMessage || nls.localize('invalidValueError', "Invalid value"),
							type: MessageType.ERROR
						};
					}
				}
			},
			useDefaultValidation: true
		};
		if (this._inputContainer) {
			this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
			this.onkeydown(this._input.inputElement, (e: StandardKeyboardEvent) => {
				if (e.keyCode === KeyCode.Enter) {
					this.fireEvent({
						eventType: ComponentEventType.onEnterKeyPressed,
						args: this._input.value
					});
					if (this.stopEnterPropagation) {
						DOM.EventHelper.stop(e, true);
					}
				}
			});
			this.registerInput(this._input, () => !this.multiline);
		}
		if (this._textareaContainer) {
			let textAreaInputOptions = assign({}, inputOptions, { flexibleHeight: true, type: 'textarea' });
			this._textAreaInput = new InputBox(this._textareaContainer.nativeElement, this.contextViewService, textAreaInputOptions);
			this.onkeydown(this._textAreaInput.inputElement, (e: StandardKeyboardEvent) => {
				if (this.tryHandleKeyEvent(e)) {
					DOM.EventHelper.stop(e, true);
				}
				if (e.keyCode === KeyCode.Enter) {
					this.fireEvent({
						eventType: ComponentEventType.onEnterKeyPressed,
						args: this._textAreaInput.value
					});
					if (this.stopEnterPropagation) {
						DOM.EventHelper.stop(e, true);
					}
				}
				// Else assume that keybinding service handles routing this to a command
			});

			this.registerInput(this._textAreaInput, () => this.multiline);
		}
		this.inputElement.hideErrors = true;
	}

	private tryHandleKeyEvent(e: StandardKeyboardEvent): boolean {
		let handled: boolean = false;

		if (this.multiline && e.keyCode === KeyCode.Enter) {
			handled = true;
		}
		return handled;
	}

	private get inputElement(): InputBox {
		return this.multiline ? this._textAreaInput : this._input;
	}

	private registerInput(input: InputBox, checkOption: () => boolean): void {
		if (input) {
			this._validations.push(() => !input.inputElement.validationMessage);

			this._register(input);
			this._register(attachInputBoxStyler(input, this.themeService, {
				inputValidationInfoBackground: inputBackground,
				inputValidationInfoBorder: inputBorder,
			}));
			this._register(input.onDidChange(async e => {
				if (checkOption()) {
					this.value = input.value;
					await this.validate();
					if (input.hideErrors) {
						input.hideErrors = false;
					}
					this.fireEvent({
						eventType: ComponentEventType.onDidChange,
						args: e
					});
				}
			}));
		}
	}

	public getInputBoxDisplay(): string {
		return !this.multiline ? '' : 'none';
	}

	public getTextAreaDisplay(): string {
		return this.multiline ? '' : 'none';
	}

	public validate(): Thenable<boolean> {
		return super.validate().then(valid => {
			const otherErrorMsg = valid || this.inputElement.value === '' ? undefined : this.validationErrorMessage;
			valid = valid && this.inputElement.validate();

			// set aria label based on validity of input
			if (valid) {
				this.inputElement.setAriaLabel(this.ariaLabel);
			} else {
				if (otherErrorMsg) {
					this.inputElement.showMessage({ type: MessageType.ERROR, content: otherErrorMsg }, true);
				}
				if (this.ariaLabel) {
					this.inputElement.setAriaLabel(nls.localize('period', "{0}. {1}", this.ariaLabel, this.inputElement.inputElement.validationMessage));
				} else {
					this.inputElement.setAriaLabel(this.inputElement.inputElement.validationMessage);
				}
			}

			return valid;
		});
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		super.layout();
		this.layoutInputBox();
	}

	private layoutInputBox(): void {
		if (isNumber(this.width) || this.width) {
			this.inputElement.width = convertSizeToNumber(this.width);
		}
		if (isNumber(this.height) || this.height) {
			this.inputElement.setHeight(convertSize(this.height));
		}
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.setInputProperties(this.inputElement);
		this.validate();
	}

	private setInputProperties(input: InputBox): void {
		if (!this.multiline) {
			input.inputElement.type = this.inputType;
			if (this.inputType === 'number') {
				input.inputElement.step = 'any';
				if (isNumber(this.min)) {
					input.inputElement.min = this.min.toString();
				}
				if (isNumber(this.max)) {
					input.inputElement.max = this.max.toString();
				}
			}
		}
		input.value = this.value;
		input.setAriaLabel(this.ariaLabel);
		input.setPlaceHolder(this.placeHolder);
		input.setEnabled(this.enabled);
		this.layoutInputBox();
		if (this.multiline) {
			if (isNumber(this.rows)) {
				this.inputElement.rows = this.rows;
			}
			if (isNumber(this.columns)) {
				this.inputElement.columns = this.columns;
			}
		}

		if (this.ariaLive) {
			input.ariaLive = this.ariaLive;
		}

		input.inputElement.required = this.required;
		input.inputElement.readOnly = this.readOnly;
	}

	// CSS-bound properties

	public get value(): string {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, string>((props) => props.value, '');
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<azdata.InputBoxProperties, string>((props, value) => props.value = value, newValue);
	}

	public get ariaLive() {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, string>((props) => props.ariaLive, '');
	}

	public get placeHolder(): string {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, string>((props) => props.placeHolder, '');
	}

	public set placeHolder(newValue: string) {
		this.setPropertyFromUI<azdata.InputBoxProperties, string>((props, value) => props.placeHolder = value, newValue);
	}

	public set columns(newValue: number) {
		this.setPropertyFromUI<azdata.InputBoxProperties, number>((props, value) => props.columns = value, newValue);
	}

	public get rows(): number {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, number>((props) => props.rows, undefined);
	}

	public get columns(): number {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, number>((props) => props.columns, undefined);
	}

	public set rows(newValue: number) {
		this.setPropertyFromUI<azdata.InputBoxProperties, number>((props, value) => props.rows = value, newValue);
	}

	public get min(): number {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, number>((props) => props.min, undefined);
	}

	public set min(newValue: number) {
		this.setPropertyFromUI<azdata.InputBoxProperties, number>((props, value) => props.min = value, newValue);
	}

	public get max(): number {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, number>((props) => props.max, undefined);
	}

	public set max(newValue: number) {
		this.setPropertyFromUI<azdata.InputBoxProperties, number>((props, value) => props.max = value, newValue);
	}

	public get inputType(): string {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, string>((props) => props.inputType, 'text');
	}

	public set inputType(newValue: string) {
		this.setPropertyFromUI<azdata.InputBoxProperties, string>((props, value) => props.inputType = value, newValue);
	}

	public get multiline(): boolean {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, boolean>((props) => props.multiline, false);
	}

	public set multiline(newValue: boolean) {
		this.setPropertyFromUI<azdata.InputBoxProperties, boolean>((props, value) => props.multiline = value, newValue);
	}

	public get readOnly(): boolean {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, boolean>((props) => props.readOnly, false);
	}

	public set readOnly(newValue: boolean) {
		this.setPropertyFromUI<azdata.InputBoxProperties, boolean>((props, value) => props.readOnly = value, newValue);
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<azdata.InputBoxProperties, boolean>((props, value) => props.required = value, newValue);
	}

	public get stopEnterPropagation(): boolean {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, boolean>((props) => props.stopEnterPropagation, false);
	}

	public set stopEnterPropagation(newValue: boolean) {
		this.setPropertyFromUI<azdata.InputBoxProperties, boolean>((props, value) => props.stopEnterPropagation = value, newValue);
	}

	public focus(): void {
		this.inputElement.focus();
	}

	public get validationErrorMessage(): string {
		return this.getPropertyOrDefault<azdata.InputBoxProperties, string>((props) => props.validationErrorMessage, '');
	}

	public set validationErrorMessage(newValue: string) {
		this.setPropertyFromUI<azdata.InputBoxProperties, string>((props, value) => props.validationErrorMessage = value, newValue);
	}
}
