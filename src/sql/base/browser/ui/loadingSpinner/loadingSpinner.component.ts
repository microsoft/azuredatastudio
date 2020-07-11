/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/loadingComponent';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as nls from 'vs/nls';
import { status } from 'vs/base/browser/ui/aria/aria';

const DefaultLoadingMessage = nls.localize('loadingMessage', "Loading");
const DefaultLoadingCompletedMessage = nls.localize('loadingCompletedMessage', "Loading completed");

@Component({
	selector: 'loading-spinner',
	template: `
		<div class="loading-spinner-container">
			<div class="loading-spinner codicon in-progress" *ngIf="loading" [title]="_loadingMessage" #spinnerElement></div>
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

	get _loadingMessage(): string {
		return this.loadingMessage ? this.loadingMessage : DefaultLoadingMessage;
	}

	get _loadingCompletedMessage(): string {
		return this.loadingCompletedMessage ? this.loadingCompletedMessage : DefaultLoadingCompletedMessage;
	}

	@Input()
	loading: boolean;

	@Input()
	loadingMessage: string;

	@Input()
	loadingCompletedMessage: string;
}
