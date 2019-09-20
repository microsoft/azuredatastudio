/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { SummaryPage } from './pages/summaryPage';
import { WizardBase } from '../wizardBase';
import * as nls from 'vscode-nls';
import { WizardInfo, BdcDeploymentType } from '../../interfaces';
import { WizardPageBase } from '../wizardPageBase';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { ClusterSettingsPage } from './pages/clusterSettingsPage';
import { ServiceSettingsPage } from './pages/serviceSettingsPage';
import { TargetClusterContextPage } from './pages/targetClusterPage';
import { IKubeService } from '../../services/kubeService';
import { IAzdataService } from '../../services/azdataService';
import { DeploymentProfilePage } from './pages/deploymentProfilePage';
import { INotebookService } from '../../services/notebookService';
import { DeployClusterWizardModel } from './deployClusterWizardModel';
const localize = nls.loadMessageBundle();

export class DeployClusterWizard extends WizardBase<DeployClusterWizard, DeployClusterWizardModel> {

	public get kubeService(): IKubeService {
		return this._kubeService;
	}

	public get azdataService(): IAzdataService {
		return this._azdataService;
	}

	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	constructor(private wizardInfo: WizardInfo, private _kubeService: IKubeService, private _azdataService: IAzdataService, private _notebookService: INotebookService) {
		super(localize('deployCluster.WizardTitle', "Deploy a SQL Server Big Data Cluster"), new DeployClusterWizardModel());
	}

	public get deploymentType(): BdcDeploymentType {
		return this.wizardInfo.type;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('deployCluster.deploy', 'Deploy');
	}

	protected onCancel(): void {
	}

	protected onOk(): void {
		this.model.setEnvironmentVariables();
		this.notebookService.launchNotebook(this.wizardInfo.notebook).then((notebook: azdata.nb.NotebookEditor) => {
			notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
				editBuilder.insertCell({
					cell_type: 'code',
					source: 'gagagaga'
				}, 0);
			});
		}, (error) => {
			vscode.window.showErrorMessage(error);
		});
	}

	private getPages(): WizardPageBase<DeployClusterWizard>[] {
		const pages: WizardPageBase<DeployClusterWizard>[] = [];
		switch (this.deploymentType) {
			case BdcDeploymentType.NewAKS:
				pages.push(
					new DeploymentProfilePage(this),
					new AzureSettingsPage(this),
					new ClusterSettingsPage(this),
					new ServiceSettingsPage(this),
					new SummaryPage(this));
				break;
			case BdcDeploymentType.ExistingAKS:
				pages.push(
					new DeploymentProfilePage(this),
					new TargetClusterContextPage(this),
					new ClusterSettingsPage(this),
					new ServiceSettingsPage(this),
					new SummaryPage(this));
				break;
			case BdcDeploymentType.ExistingKubeAdm:
				pages.push(
					new DeploymentProfilePage(this),
					new TargetClusterContextPage(this),
					new ClusterSettingsPage(this),
					new ServiceSettingsPage(this),
					new SummaryPage(this));
				break;
			default:
				break;
		}
		return pages;
	}
}
