/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import { INotebookService } from '../../services/notebookService';
import { WizardBase } from '../wizardBase';
import { WizardPageBase } from '../wizardPageBase';
import { ArcDeploymentType, BdcDeploymentType, NotebookWizardInfo } from './../../interfaces';
import { IPlatformService } from './../../services/platformService';
import { NotebookWizardModel } from './notebookWizardModel';
import { NotebookWizardPage } from './notebookWizardPage';
import { NotebookWizardSummaryPage } from './notebookWizardSummaryPage';

const localize = nls.loadMessageBundle();

export class NotebookWizard extends WizardBase<NotebookWizard, NotebookWizardModel> {

	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	public get platformService(): IPlatformService {
		return this._platformService;
	}

	public get wizardInfo(): NotebookWizardInfo {
		return this._wizardInfo;
	}

	constructor(private _wizardInfo: NotebookWizardInfo, private _notebookService: INotebookService, private _platformService: IPlatformService) {
		super(_wizardInfo.title, new NotebookWizardModel(_wizardInfo.type));
		this.wizardObject.doneButton.label = _wizardInfo.actionText || this.wizardObject.doneButton.label;
	}

	public get deploymentType(): ArcDeploymentType | BdcDeploymentType {
		return this._wizardInfo.type;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('deployCluster.ScriptToNotebook', "Script to Notebook");
	}

	protected onCancel(): void {
	}

	protected onOk(): void {
		this.model.setEnvironmentVariables();
		if (this.wizardInfo.runNotebook) {
			this.platformService.backgroundExecuteNotebook(this.wizardInfo.taskName, this.wizardInfo.notebook, this.notebookService, 'deploy');
		} else {
			this.notebookService.launchNotebook(this.wizardInfo.notebook).then(() => { }, (error) => {
				vscode.window.showErrorMessage(error);
			});
		}
	}

	private getPages(): WizardPageBase<NotebookWizard>[] {
		const pages: WizardPageBase<NotebookWizard>[] = [];
		for (let pageIndex: number = 0; pageIndex < this.wizardInfo.pages.length; pageIndex++) {
			pages.push(new NotebookWizardPage(this, pageIndex));
		}
		pages.push(new NotebookWizardSummaryPage(this));
		return pages;
	}
}
