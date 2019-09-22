/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Model } from '../model';
import * as VariableNames from './constants';
import { BigDataClusterDeploymentProfile, DataResource, SqlServerMasterResource, HdfsResource } from '../../services/bigDataClusterDeploymentProfile';
import { BdcDeploymentType } from '../../interfaces';
import { EOL } from 'os';

export class DeployClusterWizardModel extends Model {
	constructor(public deploymentTarget: BdcDeploymentType) {
		super();
	}
	public adAuthSupported: boolean = false;

	public get hadrEnabled(): boolean {
		return this.getBooleanValue(VariableNames.EnableHADR_VariableName);
	}

	public set hadrEnabled(value: boolean) {
		this.setPropertyValue(VariableNames.EnableHADR_VariableName, value);
	}

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
			this.getStorageSettingValue(VariableNames.SQLServerDNSName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName)!,
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
		targetDeploymentProfile.hadrEnabled = this.getBooleanValue(VariableNames.EnableHADR_VariableName);

		// port settings
		targetDeploymentProfile.gatewayPort = this.getIntegerValue(VariableNames.GateWayPort_VariableName);
		targetDeploymentProfile.sqlServerPort = this.getIntegerValue(VariableNames.SQLServerPort_VariableName);
		targetDeploymentProfile.controllerPort = this.getIntegerValue(VariableNames.ControllerPort_VariableName);
		targetDeploymentProfile.sqlServerReadableSecondaryPort = this.getIntegerValue(VariableNames.ReadableSecondaryPort_VariableName);

		return targetDeploymentProfile;
	}

	public getCodeCellContentForNotebook(): string {
		const profile = this.createTargetProfile();
		const statements: string[] = [];
		if (this.deploymentTarget === BdcDeploymentType.NewAKS) {
			statements.push(`azure_subscription_id = '${this.getStringValue(VariableNames.SubscriptionId_VariableName, '')}'`);
			statements.push(`azure_region = '${this.getStringValue(VariableNames.Region_VariableName)}'`);
			statements.push(`azure_resource_group = '${this.getStringValue(VariableNames.ResourceGroup_VariableName)}'`);
			statements.push(`azure_vm_size = '${this.getStringValue(VariableNames.VMSize_VariableName)}'`);
			statements.push(`azure_vm_count = '${this.getStringValue(VariableNames.VMCount_VariableName)}'`);
			statements.push(`aks_cluster_name = '${this.getStringValue(VariableNames.AksName_VariableName)}'`);
		} else if (this.deploymentTarget === BdcDeploymentType.ExistingAKS || this.deploymentTarget === BdcDeploymentType.ExistingKubeAdm) {
			statements.push(`mssql_kube_config_path = '${this.getStringValue(VariableNames.KubeConfigPath_VariableName)}'`);
			statements.push(`mssql_cluster_context = '${this.getStringValue(VariableNames.ClusterContext_VariableName)}'`);
			statements.push('os.environ["KUBECONFIG"] = mssql_kube_config_path');
		}
		statements.push(`mssql_cluster_name = '${this.getStringValue(VariableNames.ClusterName_VariableName)}'`);
		statements.push(`mssql_controller_username = '${this.getStringValue(VariableNames.AdminUserName_VariableName)}'`);
		statements.push(`bdc_json = '${profile.getBdcJson(false)}'`);
		statements.push(`control_json = '${profile.getControlJson(false)}'`);
		statements.push(`print('Variables have been set successfully.')`);
		return statements.join(EOL);
	}
}

export enum AuthenticationMode {
	ActiveDirectory = 'ad',
	Basic = 'basic'
}
