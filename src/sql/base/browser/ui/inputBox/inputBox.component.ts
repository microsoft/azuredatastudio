/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {
	Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter
} from '@angular/core';

import { InputBox as vsInputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { AngularDisposable } from 'sql/base/node/lifecycle';

import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';

@Component({
	selector: 'input-box',
	template: ''
})
export class InputBox extends AngularDisposable implements OnInit, OnChanges {
	private _inputbox: vsInputBox;

	@Input() min: string;
	@Input() max: string;
	@Input() type: string;
	@Input() placeholder: string;
	@Input('aria-label') ariaLabel: string;
	@Input() value: string;

	@Output() onDidChange = new EventEmitter<string | number>();

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super();
	}

	ngOnInit(): void {
		this._inputbox = new vsInputBox(this._el.nativeElement, this.contextViewService, {
			min: this.min,
			max: this.max,
			type: this.type,
			placeholder: this.placeholder,
			ariaLabel: this.ariaLabel
		});
		if (this.value) {
			this._inputbox.value = this.value;
		}
		this._inputbox.onDidChange(e => {
			switch (this.type) {
				case 'number':
					if (e) {
						this.onDidChange.emit(Number(e));
						break;
					}
				default:
					this.onDidChange.emit(e);
			}
		});
		this._register(attachInputBoxStyler(this._inputbox, this.themeService));
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (this._inputbox) {
			if (changes['min']) {
				this._inputbox.inputElement.min = this.min;
			}
			if (changes['max']) {
				this._inputbox.inputElement.max = this.max;
			}
			if (changes['type']) {
				this._inputbox.inputElement.type = this.type;
			}
			if (changes['placeholder']) {
				this._inputbox.inputElement.placeholder = this.placeholder;
			}
		}
	}
}
