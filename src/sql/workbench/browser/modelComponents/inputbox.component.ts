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
import { IInputOptions, InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';

import { MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as nls from 'vs/nls';
import { inputBackground, inputBorder } from 'vs/platform/theme/common/colorRegistry';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import * as DOM from 'vs/base/browser/dom';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { isNumber } from 'vs/base/common/types';
import { convertSize, convertSizeToNumber } from 'sql/base/browser/dom';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-inputBox',
	template: `
			<div #input [ngStyle]="inputBoxCSSStyles"></div>
			<div #textarea [ngStyle]="textAreaCSSStyles"></div>
	`
})
export default class InputBoxComponent extends ComponentBase<azdata.InputBoxProperties> implements IComponent, OnDestroy, AfterViewInit {
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
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
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
							content: this.inputElement.inputElement.validationMessage || this.validationErrorMessage || nls.localize('invalidValueError', "Invalid value"),
							type: MessageType.ERROR
						};
					}
				}
			},
			useDefaultValidation: true
		};
		if (this._inputContainer) {
			inputOptions.requireForceValidations = true; // Non-text area input boxes handle our own validations when the text changes so don't run the base ones
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
			let textAreaInputOptions = Object.assign({}, inputOptions, { flexibleHeight: true, type: 'textarea' });
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
		this.baseInit();
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
					input.hideErrors = false;
					await this.validate();
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

	public override async validate(): Promise<boolean> {
		await super.validate();
		// Let the input validate handle showing/hiding the error message
		const valid = this.inputElement.validate(true) === undefined;

		// set aria label based on validity of input
		if (valid) {
			this.inputElement.setAriaLabel(this.ariaLabel);
		} else {
			if (this.ariaLabel) {
				this.inputElement.setAriaLabel(nls.localize('period', "{0}. {1}", this.ariaLabel, this.inputElement.inputElement.validationMessage));
			} else {
				this.inputElement.setAriaLabel(this.inputElement.inputElement.validationMessage);
			}
		}
		return valid;
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public override layout(): void {
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

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this.setInputProperties(this.inputElement);
		this.validate().catch(onUnexpectedError);
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
		input.setMaxLength(this.maxLength);
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

		// only update title if there's a value, otherwise title gets set to placeholder above
		if (this.title) {
			input.inputElement.title = this.title;
		}
	}

	// CSS-bound properties

	public get value(): string {
		return this.getPropertyOrDefault<string>((props) => props.value, '');
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<string>((props, value) => props.value = value, newValue);
	}

	public get ariaLive() {
		return this.getPropertyOrDefault<string>((props) => props.ariaLive, '');
	}

	public get placeHolder(): string {
		return this.getPropertyOrDefault<string>((props) => props.placeHolder, '');
	}

	public set placeHolder(newValue: string) {
		this.setPropertyFromUI<string>((props, value) => props.placeHolder = value, newValue);
	}

	public get title(): string {
		return this.getPropertyOrDefault<string>((props) => props.title, '');
	}

	public set title(newValue: string) {
		this.setPropertyFromUI<string>((props, value) => props.title = value, newValue);
	}

	public set columns(newValue: number) {
		this.setPropertyFromUI<number>((props, value) => props.columns = value, newValue);
	}

	public get rows(): number {
		return this.getPropertyOrDefault<number>((props) => props.rows, undefined);
	}

	public get columns(): number {
		return this.getPropertyOrDefault<number>((props) => props.columns, undefined);
	}

	public set rows(newValue: number) {
		this.setPropertyFromUI<number>((props, value) => props.rows = value, newValue);
	}

	public get min(): number {
		return this.getPropertyOrDefault<number>((props) => props.min, undefined);
	}

	public set min(newValue: number) {
		this.setPropertyFromUI<number>((props, value) => props.min = value, newValue);
	}

	public get max(): number {
		return this.getPropertyOrDefault<number>((props) => props.max, undefined);
	}

	public set max(newValue: number) {
		this.setPropertyFromUI<number>((props, value) => props.max = value, newValue);
	}

	public get inputType(): string {
		return this.getPropertyOrDefault<string>((props) => props.inputType, 'text');
	}

	public set inputType(newValue: string) {
		this.setPropertyFromUI<string>((props, value) => props.inputType = value, newValue);
	}

	public get multiline(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.multiline, false);
	}

	public set multiline(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.multiline = value, newValue);
	}

	public get readOnly(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.readOnly, false);
	}

	public set readOnly(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.readOnly = value, newValue);
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.required = value, newValue);
	}

	public get stopEnterPropagation(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.stopEnterPropagation, false);
	}

	public set stopEnterPropagation(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.stopEnterPropagation = value, newValue);
	}

	public get maxLength(): number | undefined {
		return this.getPropertyOrDefault<number | undefined>((props) => props.maxLength, undefined);
	}

	public override focus(): void {
		this.inputElement.focus();
	}

	public get validationErrorMessage(): string {
		return this.getPropertyOrDefault<string>((props) => props.validationErrorMessage, '');
	}

	public set validationErrorMessage(newValue: string) {
		this.setPropertyFromUI<string>((props, value) => props.validationErrorMessage = value, newValue);
	}

	public get inputBoxCSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth(),
			'display': this.getInputBoxDisplay()
		});
	}

	public get textAreaCSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth(),
			'display': this.getTextAreaDisplay()
		});
	}
}
