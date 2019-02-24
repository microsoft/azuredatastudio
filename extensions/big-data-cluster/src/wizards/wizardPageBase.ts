/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

export abstract class WizardPageBase<T> {
	private _page: sqlops.window.WizardPage;

	public get pageObject(): sqlops.window.WizardPage {
		return this._page;
	}

	public get wizard(): T {
		return this._wizard;
	}

	constructor(title: string, description: string, private _wizard: T) {
		this._page = sqlops.window.createWizardPage(title);
		this._page.description = description;
		this._page.registerContent((view: sqlops.ModelView) => {
			return this.initialize(view);
		});
	}

	protected abstract initialize(view: sqlops.ModelView): Thenable<void>;

	public onEnter(): void { }

	public onLeave(): void { }
}
