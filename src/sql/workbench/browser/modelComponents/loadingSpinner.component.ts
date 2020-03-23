/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/loadingComponent';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as nls from 'vs/nls';
import { status } from 'vs/base/browser/ui/aria/aria';

@Component({
	selector: 'loading-spinner',
	template: `
		<div class="modelview-loadingComponent-container" *ngIf="loading">
			<div class="modelview-loadingComponent-spinner" *ngIf="loading" [title]="_loadingMessage" #spinnerElement></div>
		</div>
	`
})
export default class LoadingSpinner implements OnChanges {

	ngOnChanges(changes: SimpleChanges): void {
		if (changes.loading !== undefined) {
			const message = this.loading ? this._loadingMessage : this._loadingCompletedMessage;
			status(message);
		}
	}

	public readonly _defaultLoadingMessage = nls.localize('loadingMessage', "Loading");
	public readonly _defaultLoadingCompletedMessage = nls.localize('loadingCompletedMessage', "Loading completed");

	get _loadingMessage(): string {
		return this.loadingMessage ? this.loadingMessage : this._defaultLoadingMessage;
	}

	get _loadingCompletedMessage(): string {
		return this.loadingCompletedMessage ? this.loadingCompletedMessage : this._defaultLoadingCompletedMessage;
	}

	@Input()
	loading: boolean;

	@Input()
	loadingMessage: string;

	@Input()
	loadingCompletedMessage: string;
}
