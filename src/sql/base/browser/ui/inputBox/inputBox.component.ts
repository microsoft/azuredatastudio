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
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';

@Component({
	selector: 'input',
	template: ''
})
export class InputBox extends AngularDisposable implements OnInit, OnChanges {
	private _inputbox: vsInputBox;

	@Input() min: string;
	@Input() max: string;
	@Input() type: string;
	@Input() placeholder: string;
	@Input() ariaLabel: string;

	@Output() onDidChange = new EventEmitter<string>();

	@Input() themeService: IThemeService;
	@Input() contextViewProvider: IContextViewProvider;

	private themed = false;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
	}

	ngOnInit(): void {
		this._inputbox = new vsInputBox(this._el.nativeElement, this.contextViewProvider, {
			min: this.min,
			max: this.max,
			type: this.type,
			placeholder: this.placeholder,
			ariaLabel: this.ariaLabel
		});
		// unforunately there is no gaurentee the themeService will be here on init
		// eventually this should be fixed by manually injecting the theme service rather
		// than depending on inputs
		if (this.themeService) {
			this.themed = true;
			this._register(attachInputBoxStyler(this._inputbox, this.themeService));
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['themeService'] && changes['themeService'].currentValue && !this.themed) {
			this.themed = true;
			this._register(attachInputBoxStyler(this._inputbox, this.themeService));
		}
	}
}
