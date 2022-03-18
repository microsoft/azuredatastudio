/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/loadingSpinner';
import * as nls from 'vs/nls';
import { status } from 'vs/base/browser/ui/aria/aria';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { mixin } from 'vs/base/common/objects';

const DefaultLoadingMessage = nls.localize('loadingMessage', "Loading");
const DefaultLoadingCompletedMessage = nls.localize('loadingCompletedMessage', "Loading completed");

export interface LoadingSpinnerOptions {
	/**
	 * Whether to show the messages. The default value is false.
	 */
	showText?: boolean;
	/**
	 * Whether the loading spinner should take up all the avaliable spaces. The default value is false.
	 */
	fullSize?: boolean;
}

const defaultLoadingSpinnerOptions: LoadingSpinnerOptions = {
	showText: false,
	fullSize: false
};

export class LoadingSpinner extends Disposable {
	private _loading: boolean = false;
	private _loadingMessage?: string;
	private _loadingCompletedMessage?: string;
	private _loadingSpinner: HTMLElement;
	private _loadingSpinnerText: HTMLElement;
	private _options: LoadingSpinnerOptions;

	constructor(private _container: HTMLElement, options?: LoadingSpinnerOptions) {
		super();
		this._options = mixin(options || {}, defaultLoadingSpinnerOptions, false);
		this._loadingSpinner = DOM.$(`.loading-spinner-component-container${this._options.fullSize ? '.full-size' : ''}`);
		this._loadingSpinner.appendChild(DOM.$('.loading-spinner.codicon.in-progress'));
		if (this._options.showText) {
			this._loadingSpinnerText = this._loadingSpinner.appendChild(DOM.$(''));
		}
	}

	get loadingMessage(): string {
		return this._loadingMessage ?? DefaultLoadingMessage;
	}

	set loadingMessage(v: string) {
		this._loadingMessage = v;
	}

	get loadingCompletedMessage(): string {
		return this._loadingCompletedMessage ?? DefaultLoadingCompletedMessage;
	}

	set loadingCompletedMessage(v: string) {
		this._loadingCompletedMessage = v;
	}

	get loading(): boolean {
		return this._loading;
	}

	set loading(v: boolean) {
		if (v !== this._loading) {
			this._loading = v;
			const message = this._loading ? this.loadingMessage : this.loadingCompletedMessage;
			status(message);
			if (this._loading) {
				this._container.appendChild(this._loadingSpinner);
			} else {
				this._container.removeChild(this._loadingSpinner);
			}
			if (this._options.showText) {
				this._loadingSpinnerText.innerText = message;
			}
		}
	}
}
