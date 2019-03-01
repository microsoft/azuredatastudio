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

import { ListBox } from 'sql/base/browser/ui/listBox/listBox';
import { attachListBoxStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { Emitter } from 'vs/base/common/event';
import * as nls from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';

@Component({
	selector: 'modelview-listBox',
	template: `
		<div #input style="width: 100%"></div>
	`
})
export default class ListBoxComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _input: ListBox;

	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IClipboardService) private clipboardService: IClipboardService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();

	}

	ngAfterViewInit(): void {
		if (this._inputContainer) {
			this._input = new ListBox([], undefined, this.contextViewService, this.clipboardService);
			this._input.render(this._inputContainer.nativeElement);

			this._register(this._input);
			this._register(attachListBoxStyler(this._input, this.themeService));
			this._register(this._input.onDidSelect(e => {
				this.selectedRow = e.index;
				this.fireEvent({
					eventType: ComponentEventType.onSelectedRowChanged,
					args: e
				});
			}));
		}
	}

	public validate(): Thenable<boolean> {
		return super.validate().then(valid => {
			return valid;
		});
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
		this._input.setOptions(this.values, this.selectedRow);

		this.validate();
	}

	// CSS-bound properties

	private get values(): string[] {
		return this.getPropertyOrDefault<sqlops.ListBoxProperties, string[]>((props) => props.values, undefined);
	}

	private set values(newValue: string[]) {
		this.setPropertyFromUI<sqlops.ListBoxProperties, string[]>((props, value) => props.values = value, newValue);
	}

	private get selectedRow(): number {
		return this.getPropertyOrDefault<sqlops.ListBoxProperties, number>((props) => props.selectedRow, undefined);
	}

	private set selectedRow(newValue: number) {
		this.setPropertyFromUI<sqlops.ListBoxProperties, number>((props, value) => props.selectedRow = value, newValue);
	}
}
