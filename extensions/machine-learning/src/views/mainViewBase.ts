/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import { IPageView } from './interfaces';

/**
 * Base class for dialog and wizard
 */
export class MainViewBase {

	protected _pages: IPageView[] = [];

	/**
	 *
	 */
	constructor(protected _apiWrapper: ApiWrapper) {
	}

	protected registerContent(viewPanel: azdata.window.DialogTab | azdata.window.WizardPage, componentView: IPageView) {
		viewPanel.registerContent(async view => {
			if (componentView) {
				let component = componentView.registerComponent(view.modelBuilder);
				await view.initializeModel(component);
				await componentView.refresh();
			}
		});
	}

	protected addPage(page: IPageView, index?: number): void {
		if (index) {
			this._pages[index] = page;
		} else {
			this._pages.push(page);
		}
	}

	public async disposePages(): Promise<void> {
		if (this._pages) {
			await Promise.all(this._pages.map(async (p) => {
				if (p.disposePage) {
					await p.disposePage();
				}
			}));
		}
	}

	public async refresh(): Promise<void> {
		if (this._pages) {
			await Promise.all(this._pages.map(async (p) => await p.refresh()));
		}
	}
}
