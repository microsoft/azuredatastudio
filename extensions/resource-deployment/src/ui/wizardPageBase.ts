/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Validator } from './modelViewUtils';

export abstract class WizardPageBase<T> {
	private _page: azdata.window.WizardPage;
	private _validators: Validator[] = [];

	constructor(title: string, description: string, private _wizard: T) {
		this._page = azdata.window.createWizardPage(title);
		this._page.description = description;
	}

	public get pageObject(): azdata.window.WizardPage {
		return this._page;
	}

	public get wizard(): T {
		return this._wizard;
	}

	public async onEnter(): Promise<void> { }

	public onLeave(): void { }

	public abstract initialize(): void;

	protected get validators(): Validator[] {
		return this._validators;
	}
}
