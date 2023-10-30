/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter
} from '@angular/core';

import { SelectBox as sqlSelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { AngularDisposable } from 'sql/base/browser/lifecycle';

import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ISelectData } from 'vs/base/browser/ui/selectBox/selectBox';
import { defaultSelectBoxStyles } from 'sql/platform/theme/browser/defaultStyles';

@Component({
	selector: 'select-box',
	template: ''
})
export class SelectBox extends AngularDisposable implements OnInit, OnChanges {
	private _selectbox!: sqlSelectBox;

	@Input() options!: string[];
	@Input() selectedOption!: string;
	@Input() onlyEmitOnChange = false;
	@Input('aria-label') ariaLabel?: string;

	@Output() onDidSelect = new EventEmitter<ISelectData>();

	private _previousVal?: string;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super();
	}

	ngOnInit(): void {
		this._selectbox = this._register(new sqlSelectBox(this.options, this.selectedOption, defaultSelectBoxStyles, this.contextViewService, undefined, { ariaLabel: this.ariaLabel }));
		this._selectbox.render(this._el.nativeElement);
		this._register(this._selectbox.onDidSelect(e => {
			if (this.onlyEmitOnChange) {
				if (this._previousVal !== e.selected) {
					this.onDidSelect.emit(e);
					this._previousVal = e.selected;
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
