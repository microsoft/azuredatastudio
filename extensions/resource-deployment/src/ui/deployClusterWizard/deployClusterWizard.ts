/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SummaryPage } from './pages/summaryPage';
import { WizardBase } from '../wizardBase';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { WizardInfo, BdcDeploymentType } from '../../interfaces';
import { WizardPageBase } from '../wizardPageBase';
import { ToolsPage } from './pages/toolsPage';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { ClusterSettingsPage } from './pages/clusterSettingsPage';
import { ServiceSettingsPage } from './pages/serviceSettingsPage';
import { TargetClusterContextPage } from './pages/targetClusterPage';
const localize = nls.loadMessageBundle();

export class DeployClusterWizard extends WizardBase<DeployClusterWizard> {
	constructor(private wizardInfo: WizardInfo) {
		super(localize('deployCluster.WizardTitle', "Deploy a SQL Server big data cluster"));
	}

	public get deploymentType(): BdcDeploymentType {
		return this.wizardInfo.type;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.label = localize('deployCluster.openNotebook ', 'Open Notebook');
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('deployCluster.deploy', 'Deploy');

		this.registerDisposable(this.wizardObject.generateScriptButton.onClick(async () => {
			this.wizardObject.generateScriptButton.enabled = false;
			//TODO: replace with open notebook implementation
			vscode.window.showInformationMessage('Open Notebook called');
		}));
	}

	protected onCancel(): void {
	}

	protected onOk(): void {
	}

	private getPages(): WizardPageBase<DeployClusterWizard>[] {
		const pages: WizardPageBase<DeployClusterWizard>[] = [];
		switch (this.deploymentType) {
			case BdcDeploymentType.NewAKS:
				pages.push(new ToolsPage(this),
					new AzureSettingsPage(this),
					new ClusterSettingsPage(this),
					new ServiceSettingsPage(this),
					new SummaryPage(this));
				break;
			case BdcDeploymentType.ExistingAKS:
				pages.push(new ToolsPage(this),
					new TargetClusterContextPage(this),
					new ClusterSettingsPage(this),
					new ServiceSettingsPage(this),
					new SummaryPage(this));
				break;
			case BdcDeploymentType.ExistingKubeAdm:
				pages.push(new ToolsPage(this),
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
