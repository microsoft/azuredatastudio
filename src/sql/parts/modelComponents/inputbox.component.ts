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

import { InputBox, IInputOptions, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { attachInputBoxStyler, attachListStyler } from 'vs/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import Event, { Emitter } from 'vs/base/common/event';
import * as nls from 'vs/nls';

@Component({
	selector: 'modelview-inputBox',
	template: `
		<div #input style="width: 100%"></div>
	`
})
export default class InputBoxComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: InputBox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
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
		if (this._inputContainer) {
			let inputOptions: IInputOptions = {
				placeholder: '',
				ariaLabel: '',
				validationOptions: {
					validation: () => {
						if (this.valid) {
							return undefined;
						} else {
							return {
								content: this._input.inputElement.validationMessage || nls.localize('invalidValueError', 'Invalid value'),
								type: MessageType.ERROR
							};
						}
					}
				},
				useDefaultValidation: true
			};

			this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
			this._validations.push(() => !this._input.inputElement.validationMessage);

			this._register(this._input);
			this._register(attachInputBoxStyler(this._input, this.themeService));
			this._register(this._input.onDidChange(e => {
				this.value = this._input.value;
				this._onEventEmitter.fire({
					eventType: ComponentEventType.onDidChange,
					args: e
				});
			}));
		}
	}

	public validate(): Thenable<boolean> {
		return super.validate().then(valid => {
			this._input.validate();
			return valid;
		});
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._input.inputElement.type = this.inputType;
		if (this.inputType === 'number') {
			this._input.inputElement.step = 'any';
		}
		this._input.value = this.value;
		this._input.setAriaLabel(this.ariaLabel);
		this._input.setPlaceHolder(this.placeHolder);
		this._input.setEnabled(this.enabled);
		if (this.width) {
			this._input.width = this.width;
		}
		this._input.inputElement.required = this.required;
		this.validate();
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

	public get height(): number {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, number>((props) => props.height, undefined);
	}

	public set height(newValue: number) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, number>((props, value) => props.height = value, newValue);
	}

	public get width(): number {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, number>((props) => props.width, undefined);
	}

	public set width(newValue: number) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, number>((props, value) => props.width = value, newValue);
	}

	public get inputType(): string {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, string>((props) => props.inputType, 'text');
	}

	public set inputType(newValue: string) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, string>((props, value) => props.inputType = value, newValue);
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<sqlops.InputBoxProperties, boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<sqlops.InputBoxProperties, boolean>((props, value) => props.required = value, newValue);
	}
}
