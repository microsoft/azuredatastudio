/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter } from '@angular/core';

import { SelectBox as vsSelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { AngularDisposable } from 'sql/base/common/lifecycle';

import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

@Component({
	selector: 'select',
	template: ''
})
export class SelectBox extends AngularDisposable implements OnInit, OnChanges {
	private _selectbox: vsSelectBox;

	@Input() options: string[];
	@Input() selectedOption: string;
	@Input() contextViewProvider: IContextViewProvider;
	@Input() themeService: IThemeService;

	@Output() onDidSelect = new EventEmitter<ISelectData>();

	private themed = false;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) {
		super();
	}

	ngOnInit(): void {
		this._selectbox = new vsSelectBox(this.options, this.selectedOption, this.contextViewProvider);
		this._selectbox.render(this._el.nativeElement);
		this._selectbox.onDidSelect(e => { this.onDidSelect.emit(e); });
		// unforunately there is no gaurentee the themeService will be here on init
		// eventually this should be fixed by manually injecting the theme service rather
		// than depending on inputs
		if (this.themeService) {
			this.themed = true;
			this._register(attachSelectBoxStyler(this._selectbox, this.themeService));
		}
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['themeService'] && changes['themeService'].currentValue && !this.themed) {
			this.themed = true;
			this._register(attachSelectBoxStyler(this._selectbox, this.themeService));
		}
	}

	public get value(): string {
		return this._selectbox.value;
	}
}
