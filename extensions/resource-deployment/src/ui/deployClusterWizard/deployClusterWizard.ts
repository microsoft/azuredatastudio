/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { BdcDeploymentType, BdcWizardInfo } from '../../interfaces';
import { IAzdataService } from '../../services/azdataService';
import { IKubeService } from '../../services/kubeService';
import { INotebookService } from '../../services/notebookService';
import { IToolsService } from '../../services/toolsService';
import { getErrorMessage } from '../../utils';
import { InputComponents } from '../modelViewUtils';
import { WizardBase } from '../wizardBase';
import { WizardPageBase } from '../wizardPageBase';
import * as VariableNames from './constants';
import { AuthenticationMode, DeployClusterWizardModel } from './deployClusterWizardModel';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { ClusterSettingsPage } from './pages/clusterSettingsPage';
import { DeploymentProfilePage } from './pages/deploymentProfilePage';
import { ServiceSettingsPage } from './pages/serviceSettingsPage';
import { SummaryPage } from './pages/summaryPage';
import { TargetClusterContextPage } from './pages/targetClusterPage';
const localize = nls.loadMessageBundle();

export class DeployClusterWizard extends WizardBase<DeployClusterWizard, WizardPageBase<DeployClusterWizard>, DeployClusterWizardModel> {
	private _inputComponents: InputComponents = {};

	private _saveConfigButton: azdata.window.Button;

	public get kubeService(): IKubeService {
		return this._kubeService;
	}

	public get azdataService(): IAzdataService {
		return this._azdataService;
	}

	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	public get inputComponents(): InputComponents {
		return this._inputComponents;
	}

	public showCustomButtons(): void {
		this._saveConfigButton.hidden = false;
	}

	public hideCustomButtons(): void {
		this._saveConfigButton.hidden = true;
	}

	constructor(private wizardInfo: BdcWizardInfo, private _kubeService: IKubeService, private _azdataService: IAzdataService, private _notebookService: INotebookService, private _toolsService: IToolsService) {
		super(DeployClusterWizard.getTitle(wizardInfo.type), new DeployClusterWizardModel(wizardInfo.type));
		this._saveConfigButton = azdata.window.createButton(localize('deployCluster.SaveConfigFiles', "Save config files"), 'left');
		this._saveConfigButton.hidden = true;
		this.addButton(this._saveConfigButton);
		this.registerDisposable(this._saveConfigButton.onClick(() => this.saveConfigFiles()));
	}

	public get deploymentType(): BdcDeploymentType {
		return this.wizardInfo.type;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('deployCluster.ScriptToNotebook', "Script to Notebook");
	}

	protected onCancel(): void {
	}

	protected async onOk(): Promise<void> {
		await this.scriptToNotebook();
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
			case BdcDeploymentType.ExistingKubeAdm:
			case BdcDeploymentType.ExistingARO:
			case BdcDeploymentType.ExistingOpenShift:
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

	private async saveConfigFiles(): Promise<void> {
		const options: vscode.OpenDialogOptions = {
			defaultUri: vscode.Uri.file(os.homedir()),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: localize('deployCluster.SelectConfigFileFolder', "Save config files")
		};
		const pathArray = await vscode.window.showOpenDialog(options);
		if (pathArray && pathArray[0]) {
			const targetFolder = pathArray[0].fsPath;
			try {
				const profile = this.model.createTargetProfile();
				await fs.promises.writeFile(join(targetFolder, 'bdc.json'), profile.getBdcJson());
				await fs.promises.writeFile(join(targetFolder, 'control.json'), profile.getControlJson());
				this.wizardObject.message = {
					text: localize('deployCluster.SaveConfigFileSucceeded', "Config files saved to {0}", targetFolder),
					level: azdata.window.MessageLevel.Information
				};
			}
			catch (error) {
				this.wizardObject.message = {
					text: error.message,
					level: azdata.window.MessageLevel.Error
				};
			}
		}
	}

	private async scriptToNotebook(): Promise<void> {
		this.setEnvironmentVariables(process.env);
		const variableValueStatements = this.model.getCodeCellContentForNotebook(this._toolsService.toolsForCurrentProvider);
		const insertionPosition = 5; // Cell number 5 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.launchNotebookWithEdits(this.wizardInfo.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(getErrorMessage(error));
		}
	}

	private setEnvironmentVariables(env: NodeJS.ProcessEnv): void {
		env[VariableNames.AdminPassword_VariableName] = this.model.getStringValue(VariableNames.AdminPassword_VariableName);
		env[VariableNames.DockerPassword_VariableName] = this.model.getStringValue(VariableNames.DockerPassword_VariableName);
		if (this.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			env[VariableNames.DomainServiceAccountPassword_VariableName] = this.model.getStringValue(VariableNames.DomainServiceAccountPassword_VariableName);
		}
	}

	static getTitle(type: BdcDeploymentType): string {
		switch (type) {
			case BdcDeploymentType.NewAKS:
				return localize('deployCluster.NewAKSWizardTitle', "Deploy SQL Server 2019 Big Data Cluster on a new AKS cluster");
			case BdcDeploymentType.ExistingAKS:
				return localize('deployCluster.ExistingAKSWizardTitle', "Deploy SQL Server 2019 Big Data Cluster on an existing AKS cluster");
			case BdcDeploymentType.ExistingKubeAdm:
				return localize('deployCluster.ExistingKubeAdm', "Deploy SQL Server 2019 Big Data Cluster on an existing kubeadm cluster");
			case BdcDeploymentType.ExistingARO:
				return localize('deployCluster.ExistingARO', "Deploy SQL Server 2019 Big Data Cluster on an existing Azure Red Hat OpenShift cluster");
			case BdcDeploymentType.ExistingOpenShift:
				return localize('deployCluster.ExistingOpenShift', "Deploy SQL Server 2019 Big Data Cluster on an existing OpenShift cluster");

			default:
				throw new Error(`Unknown deployment type: ${type}`);
		}
	}
}
