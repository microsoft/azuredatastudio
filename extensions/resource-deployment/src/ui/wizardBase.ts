/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeploymentProvider, DeploymentProviderBase, instanceOfAzureSQLDBDeploymentProvider, instanceOfAzureSQLVMDeploymentProvider, instanceOfNotebookWizardDeploymentProvider, instanceOfWizardDeploymentProvider, NotebookWizardInfo, ResourceType } from '../interfaces';
import { IResourceTypeService } from '../services/resourceTypeService';
import { IToolsService } from '../services/toolsService';
import { DeployClusterWizardModel } from './deployClusterWizard/deployClusterWizardModel';
import { Model } from './model';
import { WizardPageBase } from './wizardPageBase';
import { WizardPageInfo } from './wizardPageInfo';
const localize = nls.loadMessageBundle();
import * as loc from '../localizedConstants';

export abstract class WizardBase<P extends WizardPageBase<WizardBase<P, M>, M>, M extends Model> {
	private customButtons: azdata.window.Button[] = [];
	public pages: P[] = [];
	private _resourceProvider!: DeploymentProviderBase;
	protected _wizardInfo!: NotebookWizardInfo;


	public wizardObject: azdata.window.Wizard;
	public toDispose: vscode.Disposable[] = [];
	public get model(): M {
		return this._model;
	}

	protected get useGenerateScriptButton(): boolean {
		return this._useGenerateScriptButton;
	}

	public set resourceProvider(provider: DeploymentProviderBase) {
		this._resourceProvider = provider;
		if (instanceOfAzureSQLDBDeploymentProvider(this.resourceProvider)) {
			this._wizardInfo = this.resourceProvider.azureSQLDBWizard;
		} else if (instanceOfAzureSQLVMDeploymentProvider(this.resourceProvider)) {
			this._wizardInfo = this.resourceProvider.azureSQLVMWizard;
		} else if (instanceOfNotebookWizardDeploymentProvider(this.resourceProvider)) {
			this._wizardInfo = this.resourceProvider.notebookWizard;
			if (this._wizardInfo?.codeCellInsertionPosition === undefined) {
				this._wizardInfo!.codeCellInsertionPosition = 0;
			}
			this.wizardObject.doneButton.label = this._wizardInfo!.doneAction?.label || loc.deployNotebook;
			this.wizardObject.generateScriptButton.label = this._wizardInfo!.scriptAction?.label || loc.scriptToNotebook;
		} else if (instanceOfWizardDeploymentProvider(this.resourceProvider)) {
			this._wizardInfo = this.resourceProvider.bdcWizard;
			if (this._model instanceof DeployClusterWizardModel) {
				this._model.deploymentTarget = this.resourceProvider.bdcWizard.type;
			}
		} else {
			this._wizardInfo = undefined!;
		}
	}

	public get resourceProvider(): DeploymentProviderBase {
		return this._resourceProvider;
	}

	constructor(
		private title: string,
		name: string,
		protected _model: M,
		public toolsService: IToolsService,
		private _useGenerateScriptButton: boolean = false,
		protected _resourceType: ResourceType,
		private _resourceTypeService?: IResourceTypeService) {

		this.wizardObject = azdata.window.createWizard(title || _resourceType?.displayName!, name || '');
		if (this._resourceType) {
			this.resourceProvider = this._resourceType.providers[0];
		}
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
	protected async onOk(): Promise<void> {
		this._resourceTypeService?.startDeploymentFromWizard(<DeploymentProvider>this.resourceProvider, this._resourceType);
		return;
	}
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

	// All custom wizard types have to implement this method to supply pages to the wizardbase.
	protected getPages(): P[] {
		throw new Error('Method not implemented');
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



	public async refreshPages() {
		const pageCount = this.wizardObject.pages.length;
		// Removing all pages except the tools and Eula one (first page)
		for (let i = 1; i < pageCount; i++) {
			this.wizardObject.removePage(this.wizardObject.pages.length - 1);
			this.wizardObject.pages.pop();
		}
		// If the wizard has no pages then just removing pages is enough.
		if (!this._wizardInfo) {
			return;
		}

		const newPages = this.getPages();
		newPages[0] = this.pages[0];

		this.pages = newPages;

		for (let i = 1; i < newPages.length; i++) {
			newPages[i].pageObject.onValidityChanged((isValid: boolean) => {
				// generateScriptButton is enabled only when the page is valid.
				this.wizardObject.generateScriptButton.enabled = isValid;
			});
			newPages[i].initialize();
			this.wizardObject.addPage(newPages[i].pageObject);
		}
	}
}
