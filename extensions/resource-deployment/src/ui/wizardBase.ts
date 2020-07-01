/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { WizardPageBase } from './wizardPageBase';
import { Model } from './model';
const localize = nls.loadMessageBundle();

export abstract class WizardBase<T, P extends WizardPageBase<T>, M extends Model> {
	private customButtons: azdata.window.Button[] = [];
	public pages: P[] = [];

	public wizardObject: azdata.window.Wizard;
	public toDispose: vscode.Disposable[] = [];
	public get model(): M {
		return this._model;
	}

	constructor(private title: string, private _model: M) {
		this.wizardObject = azdata.window.createWizard(title);
	}

	public async open(): Promise<void> {
		this.initialize();
		this.wizardObject.customButtons = this.customButtons;
		this.toDispose.push(this.wizardObject.onPageChanged(async (e) => {
			let previousPage = this.pages[e.lastPage];
			let newPage = this.pages[e.newPage];
			previousPage.onLeave();
			await newPage.onEnter();
		}));

		this.toDispose.push(this.wizardObject.doneButton.onClick(async () => {
			await this.onOk();
			this.dispose();
		}));
		this.toDispose.push(this.wizardObject.cancelButton.onClick(() => {
			this.onCancel();
			this.dispose();
		}));

		await this.wizardObject.open();
		if (this.pages && this.pages.length > 0) {
			await this.pages[0].onEnter();
		}
	}

	protected abstract initialize(): void;
	protected abstract async onOk(): Promise<void>;
	protected abstract onCancel(): void;

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	protected setPages(pages: P[]) {
		this.wizardObject!.pages = pages.map(p => p.pageObject);
		this.pages = pages;
		this.pages.forEach((page) => {
			page.initialize();
		});
	}

	private dispose() {
		let errorOccurred = false;
		this.toDispose.forEach((disposable: vscode.Disposable) => {
			try {
				disposable.dispose();
			}
			catch (error) {
				errorOccurred = true;
				console.error(error);
			}
		});

		if (errorOccurred) {
			vscode.window.showErrorMessage(localize('resourceDeployment.DisposableError', "Error occurred while closing the wizard: {0}, open 'Debugger Console' for more information."), this.title);
		}
	}

	public registerDisposable(disposable: vscode.Disposable): void {
		this.toDispose.push(disposable);
	}
}
