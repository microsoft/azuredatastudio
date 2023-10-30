/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { Checkbox, ICheckboxOptions } from 'sql/base/browser/ui/checkbox/checkbox';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { isNumber } from 'vs/base/common/types';
import { convertSize } from 'sql/base/browser/dom';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { defaultCheckboxStyles } from 'sql/platform/theme/browser/defaultStyles';

@Component({
	selector: 'modelview-checkbox',
	template: `
		<div #input width="100%" [ngStyle]="CSSStyles"></div>
	`
})
export default class CheckBoxComponent extends ComponentBase<azdata.CheckBoxProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: Checkbox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(ILogService) logService: ILogService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			let inputOptions: ICheckboxOptions = {
				...defaultCheckboxStyles,
				label: ''
			};

			this._input = new Checkbox(this._inputContainer.nativeElement, inputOptions);

			this._register(this._input);
			this._register(this._input.onChange(async e => {
				this.checked = this._input.checked;
				await this.validate();
				this.fireEvent({
					eventType: ComponentEventType.onDidChange,
					args: e
				});
			}));
			this._validations.push(() => !this.required || this.checked);
		}
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._input.checked = this.checked;
		this._input.label = this.label;
		if (this.enabled) {
			this._input.enable();
		} else {
			this._input.disable();
		}
		if (this.width || isNumber(this.width)) {
			this._input.setWidth(convertSize(this.width));
		}
		if (this.height || isNumber(this.height)) {
			this._input.setHeight(convertSize(this.height));
		}
		if (this.ariaLabel) {
			this._input.ariaLabel = this.ariaLabel;
		}
		if (this.required) {
			this._input.required = this.required;
		}
		this.validate().catch(onUnexpectedError);
	}

	// CSS-bound properties

	public get checked(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.checked, false);
	}

	public set checked(newValue: boolean) {
		this.setPropertyFromUI<boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	private get label(): string {
		return this.getPropertyOrDefault<string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<string>((properties, label) => { properties.label = label; }, newValue);
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.required = value, newValue);
	}

	public override focus(): void {
		this._input.focus();
	}

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'display': this.display
		});
	}
}
