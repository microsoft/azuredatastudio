/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { WizardBase } from './wizardBase';

export abstract class WizardPageBase<T> {
	private _page: sqlops.window.modelviewdialog.WizardPage;

	public get page(): sqlops.window.modelviewdialog.WizardPage {
		return this._page;
	}

	public get wizard(): WizardBase<T> {
		return this._wizard;
	}

	constructor(title: string, description: string, protected model: T, private _wizard: WizardBase<T>) {
		this._page = sqlops.window.modelviewdialog.createWizardPage(title);
		this._page.description = description;
		this._page.registerContent((view: sqlops.ModelView) => {
			return this.initialize(view);
		});
	}

	protected abstract initialize(view: sqlops.ModelView): Thenable<void>;
}
