/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { Disposable } from 'vscode';
import { WizardPageBase } from './wizardPageBase';
import { WizardModel } from './deployClusterWizard/model';

export abstract class WizardBase<T> {
	private customButtons: azdata.window.Button[] = [];
	private pages: WizardPageBase<T>[] = [];
	private _model: WizardModel = {};

	public wizardObject: azdata.window.Wizard;
	public toDispose: Disposable[] = [];
	public get model(): WizardModel {
		return this._model;
	}

	constructor(title: string) {
		this.wizardObject = azdata.window.createWizard(title);
	}

	public open(): Thenable<void> {
		const self = this;
		this.initialize();
		this.wizardObject.customButtons = this.customButtons;
		this.toDispose.push(this.wizardObject.onPageChanged((e) => {
			let previousPage = this.pages[e.lastPage];
			let newPage = this.pages[e.newPage];
			previousPage.onLeave();
			newPage.onEnter();
		}));

		this.toDispose.push(this.wizardObject.doneButton.onClick(() => {
			Object.keys(self.model).forEach(key => {
				process.env[key] = <string>self.model[key];
			});
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

	protected setPages(pages: WizardPageBase<T>[]) {
		this.wizardObject!.pages = pages.map(p => p.pageObject);
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
