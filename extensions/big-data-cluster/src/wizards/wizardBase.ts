/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { ExtensionContext, Disposable } from 'vscode';
import { WizardPageBase } from './wizardPageBase';

export abstract class WizardBase<T, W> {

	public wizardObject: azdata.window.Wizard;
	private customButtons: azdata.window.Button[];
	private pages: WizardPageBase<W>[];

	private toDispose: Disposable[] = [];

	constructor(public model: T, public context: ExtensionContext, private title: string) {
		this.customButtons = [];
	}

	public open(): Thenable<void> {
		this.wizardObject = azdata.window.createWizard(this.title);
		this.initialize();
		this.wizardObject.customButtons = this.customButtons;
		this.toDispose.push(this.wizardObject.onPageChanged((e) => {
			let previousPage = this.pages[e.lastPage];
			let newPage = this.pages[e.newPage];
			previousPage.onLeave();
			newPage.onEnter();
		}));

		this.toDispose.push(this.wizardObject.doneButton.onClick(() => {
			this.onOk();
			this.dispose();
		}));
		this.toDispose.push(this.wizardObject.cancelButton.onClick(() => {
			this.onCancel();
			this.dispose();
		}));

		return this.wizardObject.open().then(() => {
			if (this.pages && this.pages.length > 0) {
				this.pages[0].onEnter();
			}
		});

	}

	protected abstract initialize(): void;
	protected abstract onOk(): void;
	protected abstract onCancel(): void;

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	protected setPages(pages: WizardPageBase<W>[]) {
		this.wizardObject.pages = pages.map(p => p.pageObject);
		this.pages = pages;
	}

	private dispose() {
		this.toDispose.forEach((disposable: Disposable) => {
			try {
				disposable.dispose();
			}
			catch{ }
		});
	}

	public registerDisposable(disposable: Disposable): void {
		this.toDispose.push(disposable);
	}
}
