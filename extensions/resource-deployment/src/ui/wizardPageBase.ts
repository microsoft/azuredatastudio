/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Model } from './model';
import { Validator } from './modelViewUtils';
import { WizardBase } from './wizardBase';
import { WizardPageInfo } from './wizardPageInfo';

export abstract class WizardPageBase<W extends WizardBase<WizardPageBase<W, M>, M>, M extends Model> {

	private _page: azdata.window.WizardPage;
	private _validators: Validator[] = [];

	constructor(title: string, description: string, private _wizard: W) {
		this._page = azdata.window.createWizardPage(title);
		this._page.description = description;
	}

	public get pageObject(): azdata.window.WizardPage {
		return this._page;
	}

	public get wizard(): W {
		return this._wizard;
	}

	public async onEnter(_pageInfo?: WizardPageInfo): Promise<void> { }

	public async onLeave(_pageInfo?: WizardPageInfo): Promise<void> { }

	public abstract initialize(): void;

	protected get validators(): Validator[] {
		return this._validators;
	}
}
