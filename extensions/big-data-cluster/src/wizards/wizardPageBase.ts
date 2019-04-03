/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';

export abstract class WizardPageBase<T> {
	private _page: azdata.window.WizardPage;

	public get pageObject(): azdata.window.WizardPage {
		return this._page;
	}

	public get wizard(): T {
		return this._wizard;
	}

	constructor(title: string, description: string, private _wizard: T) {
		this._page = azdata.window.createWizardPage(title);
		this._page.description = description;
		this._page.registerContent((view: azdata.ModelView) => {
			return this.initialize(view);
		});
	}

	protected abstract initialize(view: azdata.ModelView): Thenable<void>;

	public onEnter(): void { }

	public onLeave(): void { }
}
