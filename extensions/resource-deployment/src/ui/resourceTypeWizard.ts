/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DeploymentProvider, instanceOfAzureSQLDBDeploymentProvider, instanceOfAzureSQLVMDeploymentProvider, instanceOfNotebookWizardDeploymentProvider, instanceOfWizardDeploymentProvider, ResourceType, ResourceTypeOptionValue } from '../interfaces';
import { DeployClusterWizardModel } from './deployClusterWizard/deployClusterWizardModel';
import { DeployAzureSQLVMWizardModel } from './deployAzureSQLVMWizard/deployAzureSQLVMWizardModel';
import { WizardPageInfo } from './wizardPageInfo';
import { IKubeService } from '../services/kubeService';
import { IAzdataService } from '../services/azdataService';
import { INotebookService } from '../services/notebookService';
import { IToolsService } from '../services/toolsService';
import { IPlatformService } from '../services/platformService';
import { ResourceTypeModel } from './resourceTypeModel';
import { ResourceTypePage } from './resourceTypePage';
import { NotebookWizardModel } from './notebookWizard/notebookWizardModel';
import { DeployAzureSQLDBWizardModel } from './deployAzureSQLDBWizard/deployAzureSQLDBWizardModel';
import { ToolsAndEulaPage } from './toolsAndEulaSettingsPage';
import { ResourceTypeService } from '../services/resourceTypeService';
import { PageLessDeploymentModel } from './pageLessDeploymentModel';

export class ResourceTypeWizard {
	private customButtons: azdata.window.Button[] = [];
	public pages: ResourceTypePage[] = [];
	public wizardObject!: azdata.window.Wizard;
	public toDispose: vscode.Disposable[] = [];
	private _model!: ResourceTypeModel;
	private _useGenerateScriptButton!: boolean;
	public toolsEulaPagePresets!: ResourceTypeOptionValue[];
	public provider!: DeploymentProvider;

	public get useGenerateScriptButton(): boolean {
		return this._useGenerateScriptButton;
	}

	public set useGenerateScriptButton(value: boolean) {
		this._useGenerateScriptButton = value;
	}

	constructor(
		public resourceType: ResourceType,
		public _kubeService: IKubeService,
		public azdataService: IAzdataService,
		public notebookService: INotebookService,
		public toolsService: IToolsService,
		public platformService: IPlatformService,
		public resourceTypeService: ResourceTypeService) {

		if (resourceType.options) {
			this.provider = this.resourceType.getProvider(resourceType.options.map(option => { return { option: option.name, value: option.values[0].name }; }))!;
		} else {
			this.provider = this.resourceType.providers[0];
		}
	}


	private createNewWizard() {
		// closing the current wizard and disposing off any listners from the closed wizard
		if (this.wizardObject) {
			this.close();
		}
		this.wizardObject = azdata.window.createWizard(this.resourceType.displayName, this.resourceType.name, 'wide');
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
			await this._model.onOk();
			this.dispose();
		}));
		this.toDispose.push(this.wizardObject.generateScriptButton.onClick(async () => {
			await this._model.onGenerateScript();
			this.dispose();
			this.wizardObject.close(); // close the wizard. This is already hooked up into doneButton, so it is not needed for that button above.
		}));
		this.toDispose.push(this.wizardObject.cancelButton.onClick(() => {
			this._model.onCancel();
			this.dispose();
		}));
	}


	private getResourceProviderModel(): ResourceTypeModel {
		if (instanceOfWizardDeploymentProvider(this.provider)) {
			return new DeployClusterWizardModel(this.provider, this);
		} else if (instanceOfAzureSQLVMDeploymentProvider(this.provider)) {
			return new DeployAzureSQLVMWizardModel(this.provider, this);
		} else if (instanceOfNotebookWizardDeploymentProvider(this.provider)) {
			return new NotebookWizardModel(this.provider, this);
		} else if (instanceOfAzureSQLDBDeploymentProvider(this.provider)) {
			return new DeployAzureSQLDBWizardModel(this.provider, this);
		} else {
			return new PageLessDeploymentModel(this.provider, this);
		}
	}

	public async open(): Promise<void> {
		/**
		 * Currently changing wizard titles and pages does not work without closing and reopening the wizard. (it makes the changes to objects but visually everything remains the same).
		 * Also, the done button listener gets broken when we close and reopen the same dialog
		 * For these reasons, I am creating a new wizard every time user changes the options.
		 */
		this.createNewWizard();
		this.updateModelFromProvider();
		await this.wizardObject.open();
	}

	private updateModelFromProvider() {
		this._model = this.getResourceProviderModel();
		this._model.initialize();
	}

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	public setPages(pages: ResourceTypePage[]) {
		pages.unshift(new ToolsAndEulaPage(this));
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
		this.toDispose = [];
	}

	public registerDisposable(disposable: vscode.Disposable): void {
		this.toDispose.push(disposable);
	}

	public showErrorMessage(message: string) {
		this.wizardObject.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}

	private async close() {
		this.dispose();
		this.wizardObject.close();
	}

}
