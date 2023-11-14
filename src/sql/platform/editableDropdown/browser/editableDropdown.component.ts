/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter
} from '@angular/core';

import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { Dropdown, IDropdownOptions } from 'sql/base/browser/ui/editableDropdown/browser/dropdown';
import { defaultEditableDropdownStyles } from 'sql/platform/theme/browser/defaultStyles';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';

@Component({
	selector: 'editable-select-box',
	template: ''
})
export class EditableDropDown extends AngularDisposable implements OnInit, OnChanges {
	private _selectbox!: Dropdown;

	@Input() options!: string[];
	@Input() selectedOption!: string;
	@Input() onlyEmitOnChange = false;

	@Output() onDidSelect = new EventEmitter<string>();

	private _previousVal?: string;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private readonly _el: ElementRef,
		@Inject(IContextViewService) private readonly contextViewService: IContextViewService
	) {
		super();
	}

	ngOnInit(): void {
		let dropdownOptions: IDropdownOptions = {
			values: [],
			strictSelection: false,
			placeholder: '',
			maxHeight: 125,
			ariaLabel: '',
			...defaultEditableDropdownStyles
		};
		this._selectbox = new Dropdown(this._el.nativeElement, this.contextViewService, dropdownOptions);
		this._register(this._selectbox);
		this._selectbox.values = this.options;
		this._selectbox.value = this.selectedOption;
		this._selectbox.fireOnTextChange = true;

		this._register(this._selectbox.onValueChange(e => {
			if (this.onlyEmitOnChange) {
				if (this._previousVal !== e) {
					this.onDidSelect.emit(e);
					this._previousVal = e;
				}
			} else {
				this.onDidSelect.emit(e);
			}
		}));
	}

	ngOnChanges(changes: SimpleChanges): void {
	}

	public get value(): string {
		return this._selectbox.value;
	}
}
