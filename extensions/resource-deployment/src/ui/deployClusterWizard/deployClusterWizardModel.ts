/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { delimiter, join } from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BdcDeploymentType, BdcWizardDeploymentProvider, ITool } from '../../interfaces';
import { BigDataClusterDeploymentProfile, DataResource, HdfsResource, SqlServerMasterResource } from '../../services/bigDataClusterDeploymentProfile';
import { KubeCtlToolName } from '../../services/tools/kubeCtlTool';
import { getErrorMessage, getRuntimeBinaryPathEnvironmentVariableName, setEnvironmentVariablesForInstallPaths } from '../../common/utils';
import { ToolsInstallPath } from '../../constants';
import * as VariableNames from './constants';
import { ResourceTypeWizard } from '../resourceTypeWizard';
import * as nls from 'vscode-nls';
import { InputComponents } from '../modelViewUtils';
import { INotebookService } from '../../services/notebookService';
import { IAzdataService } from '../../services/azdataService';
import { IKubeService } from '../../services/kubeService';
import { DeploymentProfilePage } from './pages/deploymentProfilePage';
import { AzureSettingsPage } from './pages/azureSettingsPage';
import { ClusterSettingsPage } from './pages/clusterSettingsPage';
import { ServiceSettingsPage } from './pages/serviceSettingsPage';
import { SummaryPage } from './pages/summaryPage';
import { TargetClusterContextPage } from './pages/targetClusterPage';
import { IToolsService } from '../../services/toolsService';
import { ResourceTypeModel } from '../resourceTypeModel';
import { ResourceTypePage } from '../resourceTypePage';
const localize = nls.loadMessageBundle();

export class DeployClusterWizardModel extends ResourceTypeModel {
	private _inputComponents: InputComponents = {};
	private _kubeService: IKubeService;
	private _azdataService: IAzdataService;
	private _notebookService: INotebookService;
	private toolsService: IToolsService;

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


	public get deploymentType(): BdcDeploymentType {
		return this.bdcProvider.bdcWizard.type;
	}

	initialize(): void {
		this.wizard.setPages(this.getPages());
		this.wizard.wizardObject.generateScriptButton.hidden = true;
		this.wizard.wizardObject.doneButton.label = localize('deployCluster.ScriptToNotebook', "Script to Notebook");
	}

	async onOk(): Promise<void> {
		await this.scriptToNotebook();
	}

	constructor(public bdcProvider: BdcWizardDeploymentProvider, wizard: ResourceTypeWizard) {
		super(bdcProvider, wizard);
		this._kubeService = this.wizard._kubeService;
		this._azdataService = this.wizard.azdataService;
		this._notebookService = this.wizard.notebookService;
		this.toolsService = this.wizard.toolsService;
		this.wizard.wizardObject.title = this.getTitle(this.deploymentType);
		this._saveConfigButton = azdata.window.createButton(localize('deployCluster.SaveConfigFiles', "Save config files"), 'left');
		this._saveConfigButton.hidden = true;
		this.wizard.addButton(this._saveConfigButton);
		this.wizard.registerDisposable(this._saveConfigButton.onClick(() => this.saveConfigFiles()));
	}
	public adAuthSupported: boolean = false;

	public get authenticationMode(): string | undefined {
		return this.getStringValue(VariableNames.AuthenticationMode_VariableName);
	}

	public set authenticationMode(value: string | undefined) {
		this.setPropertyValue(VariableNames.AuthenticationMode_VariableName, value);
	}

	public getStorageSettingValue(propertyName: string, defaultValuePropertyName: string): string | undefined {
		const value = this.getStringValue(propertyName);
		return (value === undefined || value === '') ? this.getStringValue(defaultValuePropertyName) : value;
	}

	private setStorageSettingValue(propertyName: string, defaultValuePropertyName: string): void {
		const value = this.getStringValue(propertyName);
		if (value === undefined || value === '') {
			this.setPropertyValue(propertyName, this.getStringValue(defaultValuePropertyName));
		}
	}

	private setStorageSettingValues(): void {
		this.setStorageSettingValue(VariableNames.DataPoolDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.DataPoolDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName);
		this.setStorageSettingValue(VariableNames.DataPoolLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.DataPoolLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName);

		this.setStorageSettingValue(VariableNames.HDFSDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.HDFSDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName);
		this.setStorageSettingValue(VariableNames.HDFSLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.HDFSLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName);

		this.setStorageSettingValue(VariableNames.SQLServerDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.SQLServerDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName);
		this.setStorageSettingValue(VariableNames.SQLServerLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.SQLServerLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName);
	}

	public setEnvironmentVariables(): void {
		this.setStorageSettingValues();
	}

	public selectedProfile: BigDataClusterDeploymentProfile | undefined;

	public createTargetProfile(): BigDataClusterDeploymentProfile {
		// create a copy of the source files to avoid changing the source profile values
		const sourceBdcJson = Object.assign({}, this.selectedProfile!.bdcConfig);
		const sourceControlJson = Object.assign({}, this.selectedProfile!.controlConfig);
		const targetDeploymentProfile = new BigDataClusterDeploymentProfile('', sourceBdcJson, sourceControlJson);
		// docker settings
		targetDeploymentProfile.controlConfig.spec.docker = {
			registry: this.getStringValue(VariableNames.DockerRegistry_VariableName),
			repository: this.getStringValue(VariableNames.DockerRepository_VariableName),
			imageTag: this.getStringValue(VariableNames.DockerImageTag_VariableName),
			imagePullPolicy: 'Always'
		};
		// cluster name
		targetDeploymentProfile.clusterName = this.getStringValue(VariableNames.ClusterName_VariableName)!;
		// storage settings
		targetDeploymentProfile.controllerDataStorageClass = this.getStringValue(VariableNames.ControllerDataStorageClassName_VariableName)!;
		targetDeploymentProfile.controllerDataStorageSize = this.getIntegerValue(VariableNames.ControllerDataStorageSize_VariableName)!;
		targetDeploymentProfile.controllerLogsStorageClass = this.getStringValue(VariableNames.ControllerLogsStorageClassName_VariableName)!;
		targetDeploymentProfile.controllerLogsStorageSize = this.getIntegerValue(VariableNames.ControllerLogsStorageSize_VariableName)!;
		targetDeploymentProfile.setResourceStorage(DataResource,
			this.getStorageSettingValue(VariableNames.DataPoolDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName)!,
			Number.parseInt(this.getStorageSettingValue(VariableNames.DataPoolDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName)!),
			this.getStorageSettingValue(VariableNames.DataPoolLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName)!,
			Number.parseInt(this.getStorageSettingValue(VariableNames.DataPoolLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName)!)
		);
		targetDeploymentProfile.setResourceStorage(SqlServerMasterResource,
			this.getStorageSettingValue(VariableNames.SQLServerDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName)!,
			Number.parseInt(this.getStorageSettingValue(VariableNames.SQLServerDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName)!),
			this.getStorageSettingValue(VariableNames.SQLServerLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName)!,
			Number.parseInt(this.getStorageSettingValue(VariableNames.SQLServerLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName)!)
		);
		targetDeploymentProfile.setResourceStorage(HdfsResource,
			this.getStorageSettingValue(VariableNames.HDFSDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName)!,
			Number.parseInt(this.getStorageSettingValue(VariableNames.HDFSDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName)!),
			this.getStorageSettingValue(VariableNames.HDFSLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName)!,
			Number.parseInt(this.getStorageSettingValue(VariableNames.HDFSLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName)!)
		);

		// scale settings
		targetDeploymentProfile.dataReplicas = this.getIntegerValue(VariableNames.DataPoolScale_VariableName);
		targetDeploymentProfile.computeReplicas = this.getIntegerValue(VariableNames.ComputePoolScale_VariableName);
		targetDeploymentProfile.hdfsReplicas = this.getIntegerValue(VariableNames.HDFSPoolScale_VariableName);
		targetDeploymentProfile.sqlServerReplicas = this.getIntegerValue(VariableNames.SQLServerScale_VariableName);
		targetDeploymentProfile.hdfsNameNodeReplicas = this.getIntegerValue(VariableNames.HDFSNameNodeScale_VariableName);
		targetDeploymentProfile.sparkHeadReplicas = this.getIntegerValue(VariableNames.SparkHeadScale_VariableName);
		targetDeploymentProfile.zooKeeperReplicas = this.getIntegerValue(VariableNames.ZooKeeperScale_VariableName);
		const sparkScale = this.getIntegerValue(VariableNames.SparkPoolScale_VariableName);
		if (sparkScale > 0) {
			targetDeploymentProfile.addSparkResource(sparkScale);
		}

		targetDeploymentProfile.includeSpark = this.getBooleanValue(VariableNames.IncludeSpark_VariableName);

		// endpoint settings
		targetDeploymentProfile.setGatewayEndpoint(this.getIntegerValue(VariableNames.GateWayPort_VariableName), this.getStringValue(VariableNames.GatewayDNSName_VariableName));
		targetDeploymentProfile.setSqlServerEndpoint(this.getIntegerValue(VariableNames.SQLServerPort_VariableName), this.getStringValue(VariableNames.SQLServerDNSName_VariableName));
		targetDeploymentProfile.setControllerEndpoint(this.getIntegerValue(VariableNames.ControllerPort_VariableName), this.getStringValue(VariableNames.ControllerDNSName_VariableName));
		targetDeploymentProfile.setSqlServerReadableSecondaryEndpoint(this.getIntegerValue(VariableNames.ReadableSecondaryPort_VariableName), this.getStringValue(VariableNames.ReadableSecondaryDNSName_VariableName));
		targetDeploymentProfile.setServiceProxyEndpoint(this.getIntegerValue(VariableNames.ServiceProxyPort_VariableName), this.getStringValue(VariableNames.ServiceProxyDNSName_VariableName));
		targetDeploymentProfile.setAppServiceProxyEndpoint(this.getIntegerValue(VariableNames.AppServiceProxyPort_VariableName), this.getStringValue(VariableNames.AppServiceProxyDNSName_VariableName));

		targetDeploymentProfile.setAuthenticationMode(this.authenticationMode!);
		if (this.authenticationMode === AuthenticationMode.ActiveDirectory) {
			targetDeploymentProfile.setActiveDirectorySettings({
				organizationalUnit: this.getStringValue(VariableNames.OrganizationalUnitDistinguishedName_VariableName)!,
				domainControllerFQDNs: this.getStringValue(VariableNames.DomainControllerFQDNs_VariableName)!,
				domainDNSName: this.getStringValue(VariableNames.DomainDNSName_VariableName)!,
				realm: this.getStringValue(VariableNames.Realm_VariableName),
				dnsIPAddresses: this.getStringValue(VariableNames.DomainDNSIPAddresses_VariableName)!,
				clusterAdmins: this.getStringValue(VariableNames.ClusterAdmins_VariableName)!,
				clusterUsers: this.getStringValue(VariableNames.ClusterUsers_VariableName)!,
				appOwners: this.getStringValue(VariableNames.AppOwners_VariableName),
				appReaders: this.getStringValue(VariableNames.AppReaders_VariableName),
				subdomain: this.getStringValue(VariableNames.Subdomain_VariableName),
				accountPrefix: this.getStringValue(VariableNames.AccountPrefix_VariableName)
			});
		}
		return targetDeploymentProfile;
	}

	public getCodeCellContentForNotebook(tools: ITool[]): string[] {
		const profile = this.createTargetProfile();
		const statements: string[] = [];
		if (this.deploymentType === BdcDeploymentType.NewAKS) {
			statements.push(`azure_subscription_id = '${this.getStringValue(VariableNames.SubscriptionId_VariableName, '')}'`);
			statements.push(`azure_region = '${this.getStringValue(VariableNames.Location_VariableName)}'`);
			statements.push(`azure_resource_group = '${this.getStringValue(VariableNames.ResourceGroup_VariableName)}'`);
			statements.push(`azure_vm_size = '${this.getStringValue(VariableNames.VMSize_VariableName)}'`);
			statements.push(`azure_vm_count = '${this.getStringValue(VariableNames.VMCount_VariableName)}'`);
			statements.push(`aks_cluster_name = '${this.getStringValue(VariableNames.AksName_VariableName)}'`);
		} else if (this.deploymentType === BdcDeploymentType.ExistingAKS
			|| this.deploymentType === BdcDeploymentType.ExistingKubeAdm
			|| this.deploymentType === BdcDeploymentType.ExistingARO
			|| this.deploymentType === BdcDeploymentType.ExistingOpenShift) {
			statements.push(`mssql_kube_config_path = '${this.escapeForNotebookCodeCell(this.getStringValue(VariableNames.KubeConfigPath_VariableName)!)}'`);
			statements.push(`mssql_cluster_context = '${this.getStringValue(VariableNames.ClusterContext_VariableName)}'`);
			statements.push('os.environ["KUBECONFIG"] = mssql_kube_config_path');
		}
		if (this.authenticationMode === AuthenticationMode.ActiveDirectory) {
			statements.push(`mssql_domain_service_account_username = '${this.escapeForNotebookCodeCell(this.getStringValue(VariableNames.DomainServiceAccountUserName_VariableName)!)}'`);
		}
		statements.push(`mssql_cluster_name = '${this.getStringValue(VariableNames.ClusterName_VariableName)}'`);
		statements.push(`mssql_username = '${this.getStringValue(VariableNames.AdminUserName_VariableName)}'`);
		statements.push(`mssql_auth_mode = '${this.authenticationMode}'`);
		statements.push(`bdc_json = '${profile.getBdcJson(false)}'`);
		statements.push(`control_json = '${profile.getControlJson(false)}'`);
		if (this.getStringValue(VariableNames.DockerUsername_VariableName) && this.getStringValue(VariableNames.DockerPassword_VariableName)) {
			statements.push(`os.environ["DOCKER_USERNAME"] = '${this.getStringValue(VariableNames.DockerUsername_VariableName)}'`);
			statements.push(`os.environ["DOCKER_PASSWORD"] = os.environ["${VariableNames.DockerPassword_VariableName}"]`);
		}
		const kubeCtlEnvVarName: string = getRuntimeBinaryPathEnvironmentVariableName(KubeCtlToolName);
		const env: NodeJS.ProcessEnv = {};
		setEnvironmentVariablesForInstallPaths(tools, env);
		statements.push(`os.environ["${kubeCtlEnvVarName}"] = "${this.escapeForNotebookCodeCell(env[kubeCtlEnvVarName]!)}"`);
		statements.push(`os.environ["PATH"] = os.environ["PATH"] + "${delimiter}" + "${this.escapeForNotebookCodeCell(env[ToolsInstallPath]!)}"`);
		statements.push(`print('Variables have been set successfully.')`);
		return statements.map(line => line + os.EOL);
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
				const profile = this.createTargetProfile();
				await fs.promises.writeFile(join(targetFolder, 'bdc.json'), profile.getBdcJson());
				await fs.promises.writeFile(join(targetFolder, 'control.json'), profile.getControlJson());
				this.wizard.wizardObject.message = {
					text: localize('deployCluster.SaveConfigFileSucceeded', "Config files saved to {0}", targetFolder),
					level: azdata.window.MessageLevel.Information
				};
			}
			catch (error) {
				this.wizard.wizardObject.message = {
					text: error.message,
					level: azdata.window.MessageLevel.Error
				};
			}
		}
	}

	private getPages(): ResourceTypePage[] {
		const pages: ResourceTypePage[] = [];
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

	private async scriptToNotebook(): Promise<void> {
		this.setNotebookEnvironmentVariables(process.env);
		const variableValueStatements = this.getCodeCellContentForNotebook(this.toolsService.toolsForCurrentProvider);
		const insertionPosition = 5; // Cell number 5 is the position where the python variable setting statements need to be inserted in this.wizardInfo.notebook.
		try {
			await this.notebookService.openNotebookWithEdits(this.bdcProvider.bdcWizard.notebook, variableValueStatements, insertionPosition);
		} catch (error) {
			vscode.window.showErrorMessage(getErrorMessage(error));
		}
	}


	private setNotebookEnvironmentVariables(env: NodeJS.ProcessEnv): void {
		env[VariableNames.AdminPassword_VariableName] = this.getStringValue(VariableNames.AdminPassword_VariableName);
		env[VariableNames.DockerPassword_VariableName] = this.getStringValue(VariableNames.DockerPassword_VariableName);
		if (this.authenticationMode === AuthenticationMode.ActiveDirectory) {
			env[VariableNames.DomainServiceAccountPassword_VariableName] = this.getStringValue(VariableNames.DomainServiceAccountPassword_VariableName);
		}
	}

	private getTitle(type: BdcDeploymentType): string {
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

export enum AuthenticationMode {
	ActiveDirectory = 'ad',
	Basic = 'basic'
}
