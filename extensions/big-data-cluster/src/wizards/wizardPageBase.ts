/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

export abstract class WizardPageBase<T> {
	private _page: sqlops.window.modelviewdialog.WizardPage;

	public get Page(): sqlops.window.modelviewdialog.WizardPage {
		return this._page;
	}

	constructor(title: string, description: string, protected model: T) {
		this._page = sqlops.window.modelviewdialog.createWizardPage(title);
		this._page.description = description;
		this._page.registerContent((view: sqlops.ModelView) => {
			return this.initialize(view);
		});
	}

	protected abstract async initialize(view: sqlops.ModelView);
}
