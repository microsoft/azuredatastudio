/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {
	Component, Inject, forwardRef, ElementRef, OnInit, Input,
	Output, OnChanges, SimpleChanges, EventEmitter
} from '@angular/core';

import { Checkbox as vsCheckbox } from 'sql/base/browser/ui/checkbox/checkbox';

@Component({
	selector: 'checkbox',
	template: ''
})
export class Checkbox implements OnInit, OnChanges {
	@Input() label: string;
	@Input() enabled = true;
	@Input() checked = true;
	@Input('aria-label') private ariaLabel: string;

	@Output() onChange = new EventEmitter<boolean>();

	private _checkbox: vsCheckbox;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef
	) { }

	ngOnInit(): void {
		this._checkbox = new vsCheckbox(this._el.nativeElement, {
			label: this.label,
			ariaLabel: this.ariaLabel || this.label,
			checked: this.checked,
			enabled: this.enabled
		});
		this._checkbox.onChange(e => { this.onChange.emit(e); });
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (this._checkbox) {
			if (changes['label']) {
				this._checkbox.label = changes['label'].currentValue;
			}

			if (changes['enabled']) {
				this._checkbox.enabled = changes['enabled'].currentValue;
			}

			if (changes['checked']) {
				this._checkbox.checked = changes['checked'].currentValue;
			}
		}
	}
}
