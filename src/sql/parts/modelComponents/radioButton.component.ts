/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./radioButton';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

@Component({
	selector: 'modelview-radioButton',
	template: `
		<div #input class="modelview-radiobutton-container">

		</div>
	`
})
export default class RadioButtonComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: RadioButton;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this._input = new RadioButton(this._inputContainer.nativeElement, {
				label: this.label
			});

			this._register(this._input);
			this._register(this._input.onClicked(e => {
				this.checked = this._input.checked;
				this.fireEvent({
					eventType: ComponentEventType.onDidClick,
					args: e
				});
			}));
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
		this._input.name = this.name;
		this._input.value = this.value;
		this._input.label = this.label;
		this._input.enabled = this.enabled;

		this._input.checked = this.checked;
	}

	// CSS-bound properties

	public get checked(): boolean {
		return this.getPropertyOrDefault<sqlops.RadioButtonProperties, boolean>((props) => props.checked, false);
	}

	public set checked(newValue: boolean) {
		this.setPropertyFromUI<sqlops.RadioButtonProperties, boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<sqlops.RadioButtonProperties, string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<sqlops.RadioButtonProperties, string>((props) => props.value, '');
	}

	public getLabel(): string {
		return this.label;
	}

	public get label(): string {
		return this.getPropertyOrDefault<sqlops.RadioButtonProperties, string>((props) => props.label, '');
	}

	public set label(newValue: string) {
		this.setPropertyFromUI<sqlops.RadioButtonProperties, string>((properties, label) => { properties.label = label; }, newValue);
	}

	public get name(): string {
		return this.getPropertyOrDefault<sqlops.RadioButtonProperties, string>((props) => props.name, '');
	}

	public set name(newValue: string) {
		this.setPropertyFromUI<sqlops.RadioButtonProperties, string>((properties, label) => { properties.name = label; }, newValue);
	}
}
