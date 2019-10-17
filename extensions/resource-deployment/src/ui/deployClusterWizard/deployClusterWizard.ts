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
import { IAzdataService, BdcEndpoint } from '../../services/azdataService';
import { DeploymentProfilePage } from './pages/deploymentProfilePage';
import { INotebookService } from '../../services/notebookService';
import { getErrorMessage, getDateTimeString } from '../../utils';
import { DeployClusterWizardModel, AuthenticationMode } from './deployClusterWizardModel';
import * as VariableNames from './constants';
import * as os from 'os';
import { join } from 'path';
import * as fs from 'fs';
const localize = nls.loadMessageBundle();

export class DeployClusterWizard extends WizardBase<DeployClusterWizard, DeployClusterWizardModel> {
	private _saveConfigButton: azdata.window.Button;
	private _scriptToNotebookButton: azdata.window.Button;

	public get kubeService(): IKubeService {
		return this._kubeService;
	}

	public get azdataService(): IAzdataService {
		return this._azdataService;
	}

	public get notebookService(): INotebookService {
		return this._notebookService;
	}

	public get saveConfigButton(): azdata.window.Button {
		return this._saveConfigButton;
	}

	public get scriptToNotebookButton(): azdata.window.Button {
		return this._scriptToNotebookButton;
	}

	constructor(private wizardInfo: WizardInfo, private _kubeService: IKubeService, private _azdataService: IAzdataService, private _notebookService: INotebookService) {
		super(DeployClusterWizard.getTitle(wizardInfo.type), new DeployClusterWizardModel(wizardInfo.type));
		this._saveConfigButton = azdata.window.createButton(localize('deployCluster.SaveConfigFiles', "Save config files"), 'left');
		this._saveConfigButton.hidden = true;
		this._scriptToNotebookButton = azdata.window.createButton(localize('deployCluster.ScriptToNotebook', 'Script to Notebook'), 'left');
		this._scriptToNotebookButton.hidden = true;
		this.addButton(this._saveConfigButton);
		this.addButton(this._scriptToNotebookButton);
		this.registerDisposable(this._saveConfigButton.onClick(() => this.saveConfigFiles()));
		this.registerDisposable(this._scriptToNotebookButton.onClick(() => this.scriptToNotebook()));
	}

	public get deploymentType(): BdcDeploymentType {
		return this.wizardInfo.type;
	}

	protected initialize(): void {
		this.setPages(this.getPages());
		this.wizardObject.generateScriptButton.hidden = true;
		this.wizardObject.doneButton.label = localize('deployCluster.Deploy', "Deploy");
	}

	protected onCancel(): void {
	}

	protected onOk(): void {
		const taskName = localize('resourceDeployment.DeployBDCTask', "Deploy SQL Server Big Data Cluster \"{0}\"", this.model.getStringValue(VariableNames.ClusterName_VariableName));
		azdata.tasks.startBackgroundOperation({
			displayName: taskName,
			description: taskName,
			isCancelable: false,
			operation: async op => {
				op.updateStatus(azdata.TaskStatus.InProgress);
				const env: NodeJS.ProcessEnv = {};
				this.setEnvironmentVariables(env);
				const notebook = await this.notebookService.getNotebook(this.wizardInfo.azdata_notebook);
				notebook.cells.splice(3, 0, {
					cell_type: 'code',
					source: this.model.getCodeCellContentForNotebook(),
					metadata: {},
					execution_count: 0,
					outputs: []
				});
				const result = await this.notebookService.executeNotebook(notebook, env);
				if (result.succeeded) {
					op.updateStatus(azdata.TaskStatus.Succeeded);
					const connectToMasterSql = localize('resourceDeployment.ConnectToMasterSQLServer', "Connect to Master SQL Server");
					const selectedOption = await vscode.window.showInformationMessage(localize('resourceDeployment.DeploymentSucceeded', "Successfully deployed SQL Server Big Data Cluster: {0}",
						this.model.getStringValue(VariableNames.ClusterName_VariableName)),
						connectToMasterSql);
					if (selectedOption === connectToMasterSql) {
						let endpoints: BdcEndpoint[];
						try {
							endpoints = await this.azdataService.getEndpoints(this.model.getStringValue(VariableNames.ClusterName_VariableName)!,
								this.model.getStringValue(VariableNames.AdminUserName_VariableName)!,
								this.model.getStringValue(VariableNames.AdminPassword_VariableName)!);
						} catch (error) {
							vscode.window.showErrorMessage(localize('resourceDeployment.ErroRetrievingEndpoints', "Failed to retrieve the endpoint list. {0}{1}", os.EOL, getErrorMessage(error)));
							return;
						}
						const sqlEndpoint = endpoints.find(endpoint => endpoint.name === 'sql-server-master');
						if (sqlEndpoint) {
							vscode.commands.executeCommand('azdata.connect', {
								serverName: sqlEndpoint.endpoint,
								providerName: 'MSSQL',
								authenticationType: 'SqlLogin',
								userName: this.model.getStringValue(VariableNames.AdminUserName_VariableName)!,
								password: this.model.getStringValue(VariableNames.AdminPassword_VariableName)!
							});
						} else {
							vscode.window.showErrorMessage(localize('resourceDeployment.NoSQLEndpointFound', "Master SQL Server endpoint is not found."));
						}
					}
				} else {
					op.updateStatus(azdata.TaskStatus.Failed, result.errorMessage);
					if (result.outputNotebook) {
						const viewErrorDetail = localize('resourceDeployment.ViewErrorDetail', "View error detail");
						const selectedOption = await vscode.window.showErrorMessage(localize('resourceDeployment.DeployFailed', "Failed to deploy SQL Server Big Data Cluster \"{0}\".",
							this.model.getStringValue(VariableNames.ClusterName_VariableName)),
							viewErrorDetail);
						if (selectedOption === viewErrorDetail) {
							try {
								this.notebookService.launchNotebookWithContent(`deploy-${getDateTimeString()}`, result.outputNotebook);
							} catch (error) {
								vscode.window.showErrorMessage(localize('resourceDeployment.FailedToOpenNotebook', "An error occured launching the output notebook. {1}{2}.", os.EOL, getErrorMessage(error)));
							}
						}
					} else {
						vscode.window.showErrorMessage(localize('resourceDeployment.DeployFailedNoOutputNotebook', "Failed to deploy SQL Server Big Data Cluster and no output notebook was generated."));
					}
				}
			}
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

	private scriptToNotebook(): void {
		this.setEnvironmentVariables(process.env);
		this.notebookService.launchNotebook(this.wizardInfo.notebook).then((notebook: azdata.nb.NotebookEditor) => {
			notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
				// 5 is the position after the 'Set variables' cell in the deployment notebooks
				editBuilder.insertCell({
					cell_type: 'code',
					source: this.model.getCodeCellContentForNotebook()
				}, 5);
			});
		}, (error) => {
			vscode.window.showErrorMessage(error);
		});
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
			default:
				throw new Error(`Unknown deployment type: ${type}`);
		}
	}
}
