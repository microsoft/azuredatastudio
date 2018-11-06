/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./loadingComponent';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef
} from '@angular/core';

import * as nls from 'vs/nls';

@Component({
	selector: 'loading-spinner',
	template: `
		<div class="modelview-loadingComponent-container" *ngIf="loading">
			<div class="modelview-loadingComponent-spinner" *ngIf="loading" [title]=_loadingTitle #spinnerElement></div>
		</div>
	`
})
export default class LoadingSpinner {
	private readonly _loadingTitle = nls.localize('loadingMessage', 'Loading');

	@Input() loading: boolean;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef) {
	}
}
