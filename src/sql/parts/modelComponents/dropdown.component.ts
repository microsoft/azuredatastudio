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
import { Dropdown, IDropdownOptions } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { attachEditableDropdownStyler , attachSelectBoxStyler} from 'sql/common/theme/styler';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import Event, { Emitter } from 'vs/base/common/event';
import { attachListStyler } from 'vs/platform/theme/common/styler';

@Component({
	selector: 'dropdown',
	template: `

	<div>
		<div [style.display]="getEditableDisplay()"   #editableDropDown style="width: 100%;"></div>
		<div [style.display]="getNotEditableDisplay()" #dropDown style="width: 100%;"></div>
	</div>
	`
})
export default class DropDownComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _editableDropdown: Dropdown;
	private _selectBox: SelectBox;

	@ViewChild('editableDropDown', { read: ElementRef }) private _editableDropDownContainer: ElementRef;
	@ViewChild('dropDown', { read: ElementRef }) private _dropDownContainer: ElementRef;
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
		if (this._editableDropDownContainer) {
			let dropdownOptions: IDropdownOptions = {
				values: [],
				strictSelection: false,
				placeholder: '',
				maxHeight: 125,
				ariaLabel: ''
			};
			this._editableDropdown = new Dropdown(this._editableDropDownContainer.nativeElement, this.contextViewService, this.themeService,
				dropdownOptions);

			this._register(this._editableDropdown);
			this._register(attachEditableDropdownStyler(this._editableDropdown, this.themeService));
			this._register(this._editableDropdown.onValueChange(e => {
				if (this.editable) {
					this.value = this._editableDropdown.value;
					this._onEventEmitter.fire({
						eventType: ComponentEventType.onDidChange,
						args: e
					});
				}
			}));
		}
		if (this._dropDownContainer) {
			this._selectBox = new SelectBox(this.values || [], this.value, this.contextViewService, this._dropDownContainer.nativeElement);
			this._selectBox.render(this._dropDownContainer.nativeElement);
			this._register(this._selectBox);

			this._register(attachSelectBoxStyler(this._selectBox, this.themeService));
			this._register(this._selectBox.onDidSelect(e => {
				if (!this.editable) {
					this.value = this._selectBox.value;
					this._onEventEmitter.fire({
						eventType: ComponentEventType.onDidChange,
						args: e
					});
				}
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
		if (this.editable) {
			this._editableDropdown.values = this.values ? this.values : [];
			if (this.value) {
				this._editableDropdown.value = this.value;
			}
			this._editableDropdown.enabled = this.enabled;
		} else {
			this._selectBox.setOptions(this.values || []);
			this._selectBox.selectWithOptionName(this.value);
			if (this.enabled) {
				this._selectBox.enable();
			} else {
				this._selectBox.disable();
			}
		}
	}

	// CSS-bound properties

	private get value(): string {
		return this.getPropertyOrDefault<sqlops.DropDownProperties, string>((props) => props.value, '');
	}

	private get editable(): boolean {
		return this.getPropertyOrDefault<sqlops.DropDownProperties, boolean>((props) => props.editable, false);
	}

	public getEditableDisplay() : string {
		return this.editable ? '' : 'none';
	}

	public getNotEditableDisplay() : string {
		return !this.editable ? '' : 'none';
	}

	private set value(newValue: string) {
		this.setPropertyFromUI<sqlops.DropDownProperties, string>(this.setValueProperties, newValue);
	}

	private get values(): string[] {
		return this.getPropertyOrDefault<sqlops.DropDownProperties, string[]>((props) => props.values, undefined);
	}

	private set values(newValue: string[]) {
		this.setPropertyFromUI<sqlops.DropDownProperties, string[]>(this.setValuesProperties, newValue);
	}

	private setValueProperties(properties: sqlops.DropDownProperties, value: string): void {
		properties.value = value;
	}

	private setValuesProperties(properties: sqlops.DropDownProperties, values: string[]): void {
		properties.values = values;
	}
}
