/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { IToolsService } from '../services/toolsService';
import { Model } from './model';
import { WizardPageBase } from './wizardPageBase';
import { WizardPageInfo } from './wizardPageInfo';
const localize = nls.loadMessageBundle();

export abstract class WizardBase<T, P extends WizardPageBase<T>, M extends Model> {
	private customButtons: azdata.window.Button[] = [];
	public pages: P[] = [];

	public wizardObject: azdata.window.Wizard;
	public toDispose: vscode.Disposable[] = [];
	public get model(): M {
		return this._model;
	}

	protected get useGenerateScriptButton(): boolean {
		return this._useGenerateScriptButton;
	}

	constructor(private title: string, name: string, private _model: M, public toolsService: IToolsService, private _useGenerateScriptButton: boolean = false) {
		this.wizardObject = azdata.window.createWizard(title, name);
	}

	public async open(): Promise<void> {
		this.initialize();
		this.wizardObject.generateScriptButton.hidden = true; // by default generateScriptButton stays hidden.
		this.wizardObject.customButtons = this.customButtons;
		this.toDispose.push(this.wizardObject.onPageChanged(async (e) => {
			let previousPage = this.pages[e.lastPage];
			let newPage = this.pages[e.newPage];
			//if we are changing to the first page from no page before, essentially when we load the wizard for the first time, e.lastPage is -1 and previousPage is undefined.
			await previousPage?.onLeave(new WizardPageInfo(e.lastPage, this.pages.length));
			if (this.useGenerateScriptButton) {
				if (newPage === this.pages.slice(-1)[0]) {
					// if newPage is the last page
					this.wizardObject.generateScriptButton.hidden = false; //un-hide generateScriptButton on last page
				} else {
					// if newPage is not the last page
					this.wizardObject.generateScriptButton.hidden = true; //hide generateScriptButton if it is not the last page
				}
			}
			await newPage.onEnter(new WizardPageInfo(e.newPage, this.pages.length));
		}));

		this.toDispose.push(this.wizardObject.doneButton.onClick(async () => {
			await this.onOk();
			this.dispose();
		}));
		this.toDispose.push(this.wizardObject.generateScriptButton.onClick(async () => {
			await this.onGenerateScript();
			this.dispose();
			this.wizardObject.close(); // close the wizard. This is already hooked up into doneButton, so it is not needed for that button above.
		}));
		this.toDispose.push(this.wizardObject.cancelButton.onClick(() => {
			this.onCancel();
			this.dispose();
		}));

		await this.wizardObject.open();
	}

	protected abstract initialize(): void;
	protected abstract async onOk(): Promise<void>;
	protected async onGenerateScript(): Promise<void> { }
	protected abstract onCancel(): void;

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	protected setPages(pages: P[]) {
		this.wizardObject!.pages = pages.map(p => p.pageObject);
		this.pages = pages;
		this.pages.forEach((page) => {
			page.pageObject.onValidityChanged((isValid: boolean) => {
				// generateScriptButton is enabled only when the page is valid.
				this.wizardObject.generateScriptButton.enabled = isValid;
			});
			page.initialize();
		});
	}

	protected dispose() {
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
