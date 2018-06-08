/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { Checkbox, ICheckboxOptions } from 'sql/base/browser/ui/checkbox/checkbox';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { attachInputBoxStyler, attachListStyler } from 'vs/platform/theme/common/styler';

@Component({
	selector: 'modelview-checkbox',
	template: `
		<div #input style="width: 100%"></div>
	`
})
export default class CheckBoxComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: Checkbox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
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
				this.value = this._input.checked;
				this._onEventEmitter.fire({
					eventType: ComponentEventType.onDidChange,
					args: e
				});
			}));
		}
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
		return this.getPropertyOrDefault<sqlops.CheckBoxProperties, boolean>((props) => props.value, false);
	}

	public set value(newValue: boolean) {
		this.setPropertyFromUI<sqlops.CheckBoxProperties, boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	private get label(): string {
		return this.getPropertyOrDefault<sqlops.CheckBoxProperties, string>((props) => props.label, '');
	}

	private set label(newValue: string) {
		this.setPropertyFromUI<sqlops.CheckBoxProperties, string>((properties, label) => { properties.label = label; }, newValue);
	}
}
