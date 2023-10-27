/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/radioButton';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { RadioButton } from 'sql/base/browser/ui/radioButton/radioButton';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-radioButton',
	template: `
		<div #input [ngStyle]="CSSStyles" class="modelview-radiobutton-container">

		</div>
	`
})
export default class RadioButtonComponent extends ComponentBase<azdata.RadioButtonProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: RadioButton;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
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

			this._register(this._input.onDidChangeCheckedState(e => {
				this.checked = e;
				this.fireEvent({
					eventType: ComponentEventType.onDidChange,
					args: e
				});
			}));
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
		this._input.name = this.name;
		this._input.value = this.value;
		this._input.label = this.label;
		this._input.enabled = this.enabled;
		this._input.checked = this.checked;
	}

	// CSS-bound properties

	public get checked(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.checked, false);
	}

	public set checked(newValue: boolean) {
		this.setPropertyFromUI<boolean>((properties, value) => { properties.checked = value; }, newValue);
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<string>((props) => props.value, '');
	}

	public getLabel(): string {
		return this.label;
	}

	public get label(): string {
		return this.getPropertyOrDefault<string>((props) => props.label, '');
	}

	public set label(newValue: string) {
		this.setPropertyFromUI<string>((properties, label) => { properties.label = label; }, newValue);
	}

	public get name(): string {
		return this.getPropertyOrDefault<string>((props) => props.name, '');
	}

	public set name(newValue: string) {
		this.setPropertyFromUI<string>((properties, label) => { properties.name = label; }, newValue);
	}

	public override focus(): void {
		this._input.focus();
	}

}
