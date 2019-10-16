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
import * as VariableNames from './constants';
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
		super(DeployClusterWizard.getTitle(wizardInfo.type), new DeployClusterWizardModel(wizardInfo.type));
	}

	public get deploymentType(): BdcDeploymentType {
		return this.wizardInfo.type;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('deployCluster.ScriptToNotebook', 'Script to Notebook');
	}

	protected onCancel(): void {
	}

	protected onOk(): void {
		process.env[VariableNames.AdminPassword_VariableName] = this.model.getStringValue(VariableNames.AdminPassword_VariableName);
		this.notebookService.launchNotebook(this.wizardInfo.notebook).then((notebook: azdata.nb.NotebookEditor) => {
			notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
				editBuilder.insertCell({
					cell_type: 'code',
					source: this.model.getCodeCellContentForNotebook()
				}, 7);
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
				throw new Error(`Unknown deployment type: ${this.deploymentType}`);
		}
		return pages;
	}

	static getTitle(type: BdcDeploymentType): string {
		switch (type) {
			case BdcDeploymentType.NewAKS:
				return localize('deployCluster.NewAKSWizardTitle', "Deploy SQL Server 2019 Big Data Cluster on a new AKS cluster");
			case BdcDeploymentType.ExistingAKS:
				return localize('deployCluster.ExistingAKSWizardTitle', "Deploy SQL Server 2019 Big Data Cluster on an existing AKS cluster");
			case BdcDeploymentType.ExistingKubeAdm:
				return localize('deployCluster.ExistingKubeAdm', "Deploy SQL Server 2019 Big Data Cluster on an existing kubeadm cluster");
			default:
				throw new Error(`Unknown deployment type: ${type}`);
		}
	}
}
