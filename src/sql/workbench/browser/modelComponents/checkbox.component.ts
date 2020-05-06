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
import { Checkbox, ICheckboxOptions } from 'sql/base/browser/ui/checkbox/checkbox';
import { attachCheckboxStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { isNumber } from 'vs/base/common/types';
import { convertSize } from 'sql/base/browser/dom';

@Component({
	selector: 'modelview-checkbox',
	template: `
		<div #input width="100%" [style.display]="display"></div>
	`
})
export default class CheckBoxComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: Checkbox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			let inputOptions: ICheckboxOptions = {
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
			this._register(attachCheckboxStyler(this._input, this.themeService));
			this._validations.push(() => !this.required || this.checked);
		}
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
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
		this.validate();
	}

	// CSS-bound properties

	public get checked(): boolean {
		return this.getPropertyOrDefault<azdata.CheckBoxProperties, boolean>((props) => props.checked, false);
	}

	public set checked(newValue: boolean) {
		this.setPropertyFromUI<azdata.CheckBoxProperties, boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	private get label(): string {
		return this.getPropertyOrDefault<azdata.CheckBoxProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<azdata.CheckBoxProperties, string>((properties, label) => { properties.label = label; }, newValue);
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<azdata.CheckBoxProperties, boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<azdata.CheckBoxProperties, boolean>((props, value) => props.required = value, newValue);
	}

	public focus(): void {
		this._input.focus();
	}
}
