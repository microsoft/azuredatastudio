/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { ExtensionContext } from 'vscode';
import { WizardPageBase } from './wizardPageBase';

export abstract class WizardBase<T,W> {

	public wizardObject: azdata.window.Wizard;
	private customButtons: azdata.window.Button[];
	private pages: WizardPageBase<W>[];

	constructor(public model: T, public context: ExtensionContext, private title: string) {
		this.customButtons = [];
	}

	public open(): Thenable<void> {
		this.wizardObject = azdata.window.createWizard(this.title);
		this.initialize();
		this.wizardObject.customButtons = this.customButtons;
		this.wizardObject.onPageChanged((e) => {
			let previousPage = this.pages[e.lastPage];
			let newPage = this.pages[e.newPage];
			previousPage.onLeave();
			newPage.onEnter();
		});
		return this.wizardObject.open();

	}

	protected abstract initialize(): void;

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	protected setPages(pages: WizardPageBase<W>[]) {
		this.wizardObject.pages = pages.map(p => p.pageObject);
		this.pages = pages;
	}
}
