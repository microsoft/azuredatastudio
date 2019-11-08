/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/radioButton';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/workbench/browser/modelComponents/interfaces';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';

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
		this.focused ? this._input.focus() : this._input.blur();
	}

	// CSS-bound properties

	public get checked(): boolean {
		return this.getPropertyOrDefault<azdata.RadioButtonProperties, boolean>((props) => props.checked, false);
	}

	public set checked(newValue: boolean) {
		this.setPropertyFromUI<azdata.RadioButtonProperties, boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<azdata.RadioButtonProperties, string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<azdata.RadioButtonProperties, string>((props) => props.value, '');
	}

	public getLabel(): string {
		return this.label;
	}

	public get label(): string {
		return this.getPropertyOrDefault<azdata.RadioButtonProperties, string>((props) => props.label, '');
	}

	public set label(newValue: string) {
		this.setPropertyFromUI<azdata.RadioButtonProperties, string>((properties, label) => { properties.label = label; }, newValue);
	}

	public get name(): string {
		return this.getPropertyOrDefault<azdata.RadioButtonProperties, string>((props) => props.name, '');
	}

	public set name(newValue: string) {
		this.setPropertyFromUI<azdata.RadioButtonProperties, string>((properties, label) => { properties.name = label; }, newValue);
	}

	public get focused(): boolean {
		return this.getPropertyOrDefault<azdata.RadioButtonProperties, boolean>((props) => props.focused, false);
	}

	public set focused(newValue: boolean) {
		this.setPropertyFromUI<azdata.RadioButtonProperties, boolean>((properties, value) => { properties.focused = value; }, newValue);
	}
}
