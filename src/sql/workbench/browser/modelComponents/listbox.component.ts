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

import { ListBox } from 'sql/base/browser/ui/listBox/listBox';
import { attachListBoxStyler } from 'sql/platform/theme/common/styler';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';

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
			this._input = new ListBox([], this.contextViewService);
			this._input.onKeyDown(e => {
				if (this._input.selectedOptions.length > 0) {
					const key = e.keyCode;
					const ctrlOrCmd = e.ctrlKey || e.metaKey;

					if (ctrlOrCmd && key === KeyCode.KEY_C) {
						let textToCopy = this._input.selectedOptions[0];
						for (let i = 1; i < this._input.selectedOptions.length; i++) {
							textToCopy = textToCopy + ', ' + this._input.selectedOptions[i];
						}

						// Copy to clipboard
						this.clipboardService.writeText(textToCopy);

						e.stopPropagation();
					}
				}
			});
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
		this._input.setOptions(this.values.map(value => { return { text: value }; }), this.selectedRow);

		this.validate();
	}

	// CSS-bound properties

	private get values(): string[] {
		return this.getPropertyOrDefault<azdata.ListBoxProperties, string[]>((props) => props.values, undefined);
	}

	private set values(newValue: string[]) {
		this.setPropertyFromUI<azdata.ListBoxProperties, string[]>((props, value) => props.values = value, newValue);
	}

	private get selectedRow(): number {
		return this.getPropertyOrDefault<azdata.ListBoxProperties, number>((props) => props.selectedRow, undefined);
	}

	private set selectedRow(newValue: number) {
		this.setPropertyFromUI<azdata.ListBoxProperties, number>((props, value) => props.selectedRow = value, newValue);
	}
}
