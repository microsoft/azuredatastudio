/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Checkbox, ICheckboxOptions } from 'sql/base/browser/ui/checkbox/checkbox';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { attachCheckboxStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

@Component({
	selector: 'modelview-checkbox',
	template: `
		<div #input [style.width]="getWidth()"></div>
	`
})
export default class CheckBoxComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: Checkbox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef, ) {
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
			this._register(this._input.onChange(e => {
				this.checked = this._input.checked;
				this.fireEvent({
					eventType: ComponentEventType.onDidChange,
					args: e
				});
			}));
			this._register(attachCheckboxStyler(this._input, this.themeService));
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
	}

	// CSS-bound properties

	public get checked(): boolean {
		return this.getPropertyOrDefault<sqlops.CheckBoxProperties, boolean>((props) => props.checked, false);
	}

	public set checked(newValue: boolean) {
		this.setPropertyFromUI<sqlops.CheckBoxProperties, boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	private get label(): string {
		return this.getPropertyOrDefault<sqlops.CheckBoxProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<sqlops.CheckBoxProperties, string>((properties, label) => { properties.label = label; }, newValue);
	}
}
