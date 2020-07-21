/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import { delimiter } from 'path';
import { BdcDeploymentType, ITool } from '../../interfaces';
import { BigDataClusterDeploymentProfile, DataResource, HdfsResource, SqlServerMasterResource } from '../../services/bigDataClusterDeploymentProfile';
import { KubeCtlToolName } from '../../services/tools/kubeCtlTool';
import { getRuntimeBinaryPathEnvironmentVariableName, setEnvironmentVariablesForInstallPaths } from '../../utils';
import { Model } from '../model';
import { ToolsInstallPath } from './../../constants';
import * as VariableNames from './constants';

export class DeployClusterWizardModel extends Model {
	constructor(public deploymentTarget: BdcDeploymentType) {
		super();
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
		if (this.deploymentTarget === BdcDeploymentType.NewAKS) {
			statements.push(`azure_subscription_id = '${this.getStringValue(VariableNames.SubscriptionId_VariableName, '')}'`);
			statements.push(`azure_region = '${this.getStringValue(VariableNames.Location_VariableName)}'`);
			statements.push(`azure_resource_group = '${this.getStringValue(VariableNames.ResourceGroup_VariableName)}'`);
			statements.push(`azure_vm_size = '${this.getStringValue(VariableNames.VMSize_VariableName)}'`);
			statements.push(`azure_vm_count = '${this.getStringValue(VariableNames.VMCount_VariableName)}'`);
			statements.push(`aks_cluster_name = '${this.getStringValue(VariableNames.AksName_VariableName)}'`);
		} else if (this.deploymentTarget === BdcDeploymentType.ExistingAKS
			|| this.deploymentTarget === BdcDeploymentType.ExistingKubeAdm
			|| this.deploymentTarget === BdcDeploymentType.ExistingARO
			|| this.deploymentTarget === BdcDeploymentType.ExistingOpenShift) {
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
		return statements.map(line => line + EOL);
	}
}

export enum AuthenticationMode {
	ActiveDirectory = 'ad',
	Basic = 'basic'
}
