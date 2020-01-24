/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter
} from '@angular/core';

import { SelectBox as vsSelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

@Component({
	selector: 'select-box',
	template: ''
})
export class SelectBox extends AngularDisposable implements OnInit, OnChanges {
	private _selectbox!: vsSelectBox;

	@Input() options!: string[];
	@Input() selectedOption!: string;
	@Input() onlyEmitOnChange = false;
	@Input('aria-label') ariaLabel?: string;

	@Output() onDidSelect = new EventEmitter<ISelectData>();

	private _previousVal?: string;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super();
	}

	ngOnInit(): void {
		this._selectbox = new vsSelectBox(this.options, this.selectedOption, this.contextViewService, undefined, { ariaLabel: this.ariaLabel });
		this._selectbox.render(this._el.nativeElement);
		this._selectbox.onDidSelect(e => {
			if (this.onlyEmitOnChange) {
				if (this._previousVal !== e.selected) {
					this.onDidSelect.emit(e);
					this._previousVal = e.selected;
				}
			} else {
				this.onDidSelect.emit(e);
			}
		});
		this._register(attachSelectBoxStyler(this._selectbox, this.themeService));
	}

	ngOnChanges(changes: SimpleChanges): void {
	}

	public get value(): string {
		return this._selectbox.value;
	}
}
