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
import { attachEditableDropdownStyler } from 'sql/common/theme/styler';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import Event, { Emitter } from 'vs/base/common/event';
import { attachListStyler } from 'vs/platform/theme/common/styler';

@Component({
	selector: 'dropdown',
	template: `
		<div #input style="width: 100%"></div>
	`
})
export default class DropDownComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _dropdown: Dropdown;

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
			let dropdownOptions: IDropdownOptions = {
				values: [],
				strictSelection: false,
				placeholder: '',
				maxHeight: 125,
				ariaLabel: ''
			};

			this._dropdown = new Dropdown(this._inputContainer.nativeElement, this.contextViewService, this.themeService,
				dropdownOptions);

			this._register(this._dropdown);
			this._register(attachEditableDropdownStyler(this._dropdown, this.themeService));
			this._register(this._dropdown.onValueChange(e => {
				this.value = this._dropdown.value;
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
		this._dropdown.values = this.values ? this.values : [];
		if (this.value) {
			this._dropdown.value = this.value;
		}
		this._dropdown.enabled = this.enabled;
	}

	// CSS-bound properties

	private get value(): string {
		return this.getPropertyOrDefault<sqlops.DropDownProperties, string>((props) => props.value, '');
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
