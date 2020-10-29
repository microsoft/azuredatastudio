/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DeploymentProvider, instanceOfWizardDeploymentProvider, ResourceType } from '../interfaces';
import { Model } from './model';
import { WizardPageBase } from './wizardPageBase';
import { DeployClusterWizardModel } from './deployClusterWizard/deployClusterWizardModel';
import { WizardPageInfo } from './wizardPageInfo';
import { IKubeService } from '../services/kubeService';
import { IAzdataService } from '../services/azdataService';
import { INotebookService } from '../services/notebookService';
import { IToolsService } from '../services/toolsService';
import { IPlatformService } from '../services/platformService';

export class ResourceTypeWizard {
	private customButtons: azdata.window.Button[] = [];
	public pages: ResourceTypePage[] = [];
	public wizardObject: azdata.window.Wizard;
	public toDispose: vscode.Disposable[] = [];
	public model: ResourceTypeModel;
	private _useGenerateScriptButton!: boolean;

	public get useGenerateScriptButton(): boolean {
		return this._useGenerateScriptButton;
	}

	public set useGenerateScriptButton(value: boolean) {
		this._useGenerateScriptButton = value;
	}

	//TODO: eventually only resourceType will be passed. For now, we are passing both the resourceType and provider
	constructor(
		public resourceType: ResourceType,
		public provider: DeploymentProvider,
		public _kubeService: IKubeService,
		public azdataService: IAzdataService,
		public notebookService: INotebookService,
		public toolsService: IToolsService,
		public platformService: IPlatformService) {
		this.wizardObject = azdata.window.createWizard(resourceType.displayName, resourceType.name, 'wide');
		this.model = this.getResourceProviderModel()!;
	}


	public getResourceProviderModel(): ResourceTypeModel | undefined {
		if (instanceOfWizardDeploymentProvider(this.provider)) {
			return new DeployClusterWizardModel(this.provider, this);
		}
		// other types are undefined for now.
		return undefined;
	}

	public async open(): Promise<void> {
		this.model.initialize();
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
			await this.model.onOk();
			this.dispose();
		}));
		this.toDispose.push(this.wizardObject.generateScriptButton.onClick(async () => {
			await this.model.onGenerateScript();
			this.dispose();
			this.wizardObject.close(); // close the wizard. This is already hooked up into doneButton, so it is not needed for that button above.
		}));
		this.toDispose.push(this.wizardObject.cancelButton.onClick(() => {
			this.model.onCancel();
			this.dispose();
		}));

		await this.wizardObject.open();
	}

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	public setPages(pages: ResourceTypePage[]) {
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
		this.toDispose.forEach((disposable: vscode.Disposable) => {
			disposable.dispose();
		});
	}

	public registerDisposable(disposable: vscode.Disposable): void {
		this.toDispose.push(disposable);
	}

}



export abstract class ResourceTypePage extends WizardPageBase<ResourceTypeWizard>{
	abstract initialize(): void;
}

export abstract class ResourceTypeModel extends Model {

	constructor(public provider: DeploymentProvider, public wizard: ResourceTypeWizard) {
		super();
	}

	abstract initialize(): void;
	abstract async onOk(): Promise<void>;
	abstract onCancel(): void;
	async onGenerateScript(): Promise<void> { }

}
