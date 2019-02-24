/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {
	Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter
} from '@angular/core';

import { Dropdown, IDropdownOptions } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { AngularDisposable } from 'sql/base/node/lifecycle';

import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { attachEditableDropdownStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

@Component({
	selector: 'editable-select-box',
	template: ''
})
export class EditableDropDown extends AngularDisposable implements OnInit, OnChanges {
	private _selectbox: Dropdown;

	@Input() options: string[];
	@Input() selectedOption: string;
	@Input() onlyEmitOnChange = false;

	@Output() onDidSelect = new EventEmitter<string>();

	private _previousVal: string;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService
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
			actionLabel: ''
		};
		this._selectbox = new Dropdown(this._el.nativeElement, this.contextViewService, this.themeService, dropdownOptions);
		this._selectbox.values = this.options;
		this._selectbox.value = this.selectedOption;

		this._selectbox.onValueChange(e => {
			if (this.onlyEmitOnChange) {
				if (this._previousVal !== e) {
					this.onDidSelect.emit(e);
					this._previousVal = e;
				}
			} else {
				this.onDidSelect.emit(e);
			}
		});
		this._register(attachEditableDropdownStyler(this._selectbox, this.themeService));
	}

	ngOnChanges(changes: SimpleChanges): void {
	}

	public get value(): string {
		return this._selectbox.value;
	}
}
