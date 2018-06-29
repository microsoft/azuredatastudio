/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IInputOptions, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { attachInputBoxStyler, attachListStyler } from 'vs/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as nls from 'vs/nls';
import { inputBackground, inputBorder } from 'vs/platform/theme/common/colorRegistry';

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
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super(changeRef);
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
							content: this.inputElement.inputElement.validationMessage || nls.localize('invalidValueError', 'Invalid value'),
							type: MessageType.ERROR
						};
					}
				}
			},
			useDefaultValidation: true
		};
		if (this._inputContainer) {
			this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
			this.registerInput(this._input, () => !this.multiline);
		}
		if (this._textareaContainer) {
			let textAreaInputOptions = Object.assign({}, inputOptions, { flexibleHeight: true, type: 'textarea' });
			this._textAreaInput = new InputBox(this._textareaContainer.nativeElement, this.contextViewService, textAreaInputOptions);
			this.registerInput(this._textAreaInput, () => this.multiline);
		}
		this.inputElement.hideErrors = true;
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
					this._onEventEmitter.fire({
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
			this.inputElement.validate();
			return valid;
		});
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
		this.layoutInputBox();
	}

	private layoutInputBox(): void {
		if (this.width) {
			this.inputElement.width = this.convertSizeToNumber(this.width);
		}
		if (this.height) {
			this.inputElement.setHeight(this.convertSize(this.height));
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
				if (this.min) {
					input.inputElement.min = this.min.toString();
				}
				if (this.max) {
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
			if (this.rows) {
				this.inputElement.rows = this.rows;
			}
			if (this.columns) {
				this.inputElement.columns = this.columns;
			}
		}


		input.inputElement.required = this.required;
	}

	// CSS-bound properties

	public get value(): string {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, string>((props) => props.value, '');
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, string>((props, value) => props.value = value, newValue);
	}

	public get ariaLabel(): string {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, string>((props) => props.ariaLabel, '');
	}

	public set ariaLabel(newValue: string) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, string>((props, value) => props.ariaLabel = value, newValue);
	}

	public get placeHolder(): string {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, string>((props) => props.placeHolder, '');
	}

	public set placeHolder(newValue: string) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, string>((props, value) => props.placeHolder = value, newValue);
	}

	public set columns(newValue: number) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, number>((props, value) => props.columns = value, newValue);
	}

	public get rows(): number {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, number>((props) => props.rows, undefined);
	}

	public get columns(): number {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, number>((props) => props.columns, undefined);
	}

	public set rows(newValue: number) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, number>((props, value) => props.rows = value, newValue);
	}

	public get min(): number {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, number>((props) => props.min, undefined);
	}

	public set min(newValue: number) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, number>((props, value) => props.min = value, newValue);
	}

	public get max(): number {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, number>((props) => props.max, undefined);
	}

	public set max(newValue: number) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, number>((props, value) => props.max = value, newValue);
	}

	public get inputType(): string {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, string>((props) => props.inputType, 'text');
	}

	public set inputType(newValue: string) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, string>((props, value) => props.inputType = value, newValue);
	}

	public get multiline(): boolean {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, boolean>((props) => props.multiline, false);
	}

	public set multiline(newValue: boolean) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, boolean>((props, value) => props.multiline = value, newValue);
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, boolean>((props, value) => props.required = value, newValue);
	}
}
