/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/loadingSpinner.plugin';

import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';

/**
 * Plugin that will hide the viewport and display a loading spinner when set to loading
 */

const loadingText = localize('loadingSpinner.loading', "Loading");

export class LoadingSpinnerPlugin<T extends Slick.SlickData> implements Slick.Plugin<T> {

	private _container!: HTMLElement;
	private _viewport!: HTMLElement;
	private _loadingContainer!: HTMLElement;
	private _loading = false;

	public init(grid: Slick.Grid<T>): void {
		this._loadingContainer = DOM.$('div.loading-spinner-plugin-container');
		this._container = grid.getContainerNode();
		this._viewport = this._container.getElementsByClassName('slick-viewport')[0] as HTMLElement;
		this._viewport.parentElement.insertBefore(this._loadingContainer, this._viewport);
	}

	public destroy(): void { }

	public set loading(isLoading: boolean) {
		if (isLoading) {
			if (!this._loading) {
				DOM.hide(this._viewport);
				const spinner = DOM.$('div.loading-spinner.codicon.in-progress', { title: loadingText });
				this._loadingContainer.appendChild(spinner);
				this._container.setAttribute('aria-busy', 'true');
			}
		} else {
			DOM.show(this._viewport);
			DOM.clearNode(this._loadingContainer);
			this._container.removeAttribute('aria-busy');
		}
		this._loading = isLoading;
	}
}
