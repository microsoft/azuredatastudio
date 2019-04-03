/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TargetClusterType, ClusterPorts, ClusterType, ContainerRegistryInfo, TargetClusterTypeInfo, ToolInfo, ToolInstallationStatus, ClusterProfile, PoolConfiguration, SQLServerMasterConfiguration, ClusterPoolType, ClusterResourceSummary } from '../../interfaces';
import { getContexts, KubectlContext, setContext, inferCurrentClusterType } from '../../kubectl/kubectlUtils';
import { Kubectl } from '../../kubectl/kubectl';
import { Scriptable, ScriptingDictionary } from '../../scripting/scripting';
import * as nls from 'vscode-nls';
import * as os from 'os';
import * as path from 'path';

const localize = nls.loadMessageBundle();

export class CreateClusterModel implements Scriptable {

	private _tmp_tools_installed: boolean = false;
	private scriptingProperties: ScriptingDictionary<string> = {};
	constructor(private _kubectl: Kubectl) {
	}

	public async loadClusters(): Promise<KubectlContext[]> {
		return await getContexts(this._kubectl);
	}

	public async changeKubernetesContext(targetContext: string): Promise<void> {
		await setContext(this._kubectl, targetContext);
	}

	public getDefaultPorts(): Thenable<ClusterPorts> {
		let promise = new Promise<ClusterPorts>(resolve => {
			resolve({
				sql: '31433',
				knox: '30443',
				controller: '30888',
				proxy: '30909',
				grafana: '30119',
				kibana: '30999'
			});
		});
		return promise;
	}

	public getDefaultContainerRegistryInfo(): Thenable<ContainerRegistryInfo> {
		let promise = new Promise<ContainerRegistryInfo>(resolve => {
			resolve({
				registry: 'private-repo.microsoft.com',
				repository: 'mssql-private-preview',
				imageTag: 'latest'
			});
		});
		return promise;
	}

	public getAllTargetClusterTypeInfo(): Thenable<TargetClusterTypeInfo[]> {
		let promise = new Promise<TargetClusterTypeInfo[]>(resolve => {
			let aksCluster: TargetClusterTypeInfo = {
				enabled: false,
				type: TargetClusterType.NewAksCluster,
				name: localize('bdc-create.AKSClusterCardText', 'New AKS Cluster'),
				fullName: localize('bdc-create.AKSClusterFullName', 'New Azure Kubernetes Service cluster'),
				description: localize('bdc-create.AKSClusterDescription',
					'This option configures new Azure Kubernetes Service (AKS) for SQL Server big data cluster deployments. AKS makes it simple to create, configure and manage a cluster of virutal machines that are preconfigured with a Kubernetes cluster to run containerized applications.'),
				iconPath: {
					dark: 'images/aks.svg',
					light: 'images/aks.svg'
				}
			};

			let existingCluster: TargetClusterTypeInfo = {
				enabled: true,
				type: TargetClusterType.ExistingKubernetesCluster,
				name: localize('bdc-create.ExistingClusterCardText', 'Existing Cluster'),
				fullName: localize('bdc-create.ExistingClusterFullName', 'Existing Kubernetes cluster'),
				description: localize('bdc-create.ExistingClusterDescription', 'This option assumes you already have a Kubernetes cluster installed, Once a prerequisite check is done, ensure the correct cluster context is selected.'),
				iconPath: {
					dark: 'images/kubernetes.svg',
					light: 'images/kubernetes.svg'
				}
			};
			resolve([aksCluster, existingCluster]);
		});
		return promise;
	}

	public getRequiredToolStatus(): Thenable<ToolInfo[]> {
		let kubeCtl = {
			name: 'kubectl',
			description: 'Tool used for managing the Kubernetes cluster',
			version: '',
			status: ToolInstallationStatus.Installed
		};
		let mssqlCtl = {
			name: 'mssqlctl',
			description: 'Command-line tool for installing and managing the SQL Server big data cluster',
			version: '',
			status: ToolInstallationStatus.Installed
		};
		let azureCli = {
			name: 'Azure CLI',
			description: 'Tool used for managing Azure services',
			version: '',
			status: this._tmp_tools_installed ? ToolInstallationStatus.Installed : ToolInstallationStatus.NotInstalled
		};
		let promise = new Promise<ToolInfo[]>(resolve => {
			setTimeout(() => {
				let tools = this.targetClusterType === TargetClusterType.ExistingKubernetesCluster ? [kubeCtl, mssqlCtl] : [kubeCtl, mssqlCtl, azureCli];
				resolve(tools);
			}, 1000);
		});
		return promise;
	}

	public installTool(tool: ToolInfo): Thenable<void> {
		let promise = new Promise<void>(resolve => {
			setTimeout(() => {
				tool.status = ToolInstallationStatus.Installed;
				this._tmp_tools_installed = true;
				resolve();
			}, 1000);
		});
		return promise;
	}

	public getDefaultKubeConfigPath(): string {
		return path.join(os.homedir(), '.kube', 'config');
	}

	public clusterName: string;

	public targetClusterType: TargetClusterType;

	public selectedCluster: KubectlContext;

	public adminUserName: string;

	public adminPassword: string;

	public sqlPort: string;

	public knoxPort: string;

	public controllerPort: string;

	public proxyPort: string;

	public grafanaPort: string;

	public kibanaPort: string;

	public containerRegistry: string;

	public containerRepository: string;

	public containerImageTag: string;

	public containerRegistryUserName: string;

	public containerRegistryPassword: string;

	public profile: ClusterProfile;

	public async getTargetClusterPlatform(targetContextName: string): Promise<string> {
		await setContext(this._kubectl, targetContextName);
		let clusterType = await inferCurrentClusterType(this._kubectl);

		switch (clusterType) {
			case ClusterType.AKS:
				return 'aks';
			case ClusterType.Minikube:
				return 'minikube';
			case ClusterType.Other:
			default:
				return 'kubernetes';
		}
	}

	public async getScriptProperties(): Promise<ScriptingDictionary<string>> {

		// Cluster settings
		this.scriptingProperties['CLUSTER_NAME'] = this.selectedCluster.clusterName;
		this.scriptingProperties['CLUSTER_PLATFORM'] = await this.getTargetClusterPlatform(this.selectedCluster.contextName);

		// Default pool count for now. TODO: Update from user input
		this.scriptingProperties['CLUSTER_DATA_POOL_REPLICAS'] = '1';
		this.scriptingProperties['CLUSTER_COMPUTE_POOL_REPLICAS'] = '2';
		this.scriptingProperties['CLUSTER_STORAGE_POOL_REPLICAS'] = '3';

		// SQL Server settings
		this.scriptingProperties['CONTROLLER_USERNAME'] = this.adminUserName;
		this.scriptingProperties['CONTROLLER_PASSWORD'] = this.adminPassword;
		this.scriptingProperties['KNOX_PASSWORD'] = this.adminPassword;
		this.scriptingProperties['MSSQL_SA_PASSWORD'] = this.adminPassword;

		// docker settings
		this.scriptingProperties['DOCKER_REPOSITORY'] = this.containerRepository;
		this.scriptingProperties['DOCKER_REGISTRY'] = this.containerRegistry;
		this.scriptingProperties['DOCKER_PASSWORD'] = this.containerRegistryPassword;
		this.scriptingProperties['DOCKER_USERNAME'] = this.containerRegistryUserName;
		this.scriptingProperties['DOCKER_IMAGE_TAG'] = this.containerImageTag;

		// port settings
		this.scriptingProperties['MASTER_SQL_PORT'] = this.sqlPort;
		this.scriptingProperties['KNOX_PORT'] = this.knoxPort;
		this.scriptingProperties['GRAFANA_PORT'] = this.grafanaPort;
		this.scriptingProperties['KIBANA_PORT'] = this.kibanaPort;

		return this.scriptingProperties;
	}

	public getTargetKubectlContext(): KubectlContext {
		return this.selectedCluster;
	}

	public getClusterResource(): Thenable<ClusterResourceSummary> {
		let promise = new Promise<ClusterResourceSummary>(resolve => {
			setTimeout(() => {
				let resoureSummary: ClusterResourceSummary = {
					hardwareLabels: [
						{
							name: '<Default>',
							totalNodes: 10,
							totalCores: 22,
							totalDisks: 128,
							totalMemoryInGB: 77
						},
						{
							name: '#data',
							totalNodes: 4,
							totalCores: 22,
							totalDisks: 200,
							totalMemoryInGB: 100
						},
						{
							name: '#compute',
							totalNodes: 12,
							totalCores: 124,
							totalDisks: 24,
							totalMemoryInGB: 100
						},
						{
							name: '#premium',
							totalNodes: 10,
							totalCores: 100,
							totalDisks: 200,
							totalMemoryInGB: 770
						}
					]
				};
				resolve(resoureSummary);
			}, 1000);
		});
		return promise;
	}

	public getProfiles(): Thenable<ClusterProfile[]> {
		let promise = new Promise<ClusterProfile[]>(resolve => {
			setTimeout(() => {
				let profiles: ClusterProfile[] = [];
				profiles.push({
					name: 'Basic',
					sqlServerMasterConfiguration: this.createSQLPoolConfiguration(1, 1),
					computePoolConfiguration: this.createComputePoolConfiguration(2),
					dataPoolConfiguration: this.createDataPoolConfiguration(2),
					storagePoolConfiguration: this.createStoragePoolConfiguration(2),
					sparkPoolConfiguration: this.createSparkPoolConfiguration(2)
				});
				profiles.push({
					name: 'Standard',
					sqlServerMasterConfiguration: this.createSQLPoolConfiguration(3, 9),
					computePoolConfiguration: this.createComputePoolConfiguration(5),
					dataPoolConfiguration: this.createDataPoolConfiguration(5),
					storagePoolConfiguration: this.createStoragePoolConfiguration(5),
					sparkPoolConfiguration: this.createSparkPoolConfiguration(5)
				});
				profiles.push({
					name: 'Premium',
					sqlServerMasterConfiguration: this.createSQLPoolConfiguration(5, 9),
					computePoolConfiguration: this.createComputePoolConfiguration(7),
					dataPoolConfiguration: this.createDataPoolConfiguration(7),
					storagePoolConfiguration: this.createStoragePoolConfiguration(7),
					sparkPoolConfiguration: this.createSparkPoolConfiguration(7)
				});
				resolve(profiles);
			}, 1000);
		});
		return promise;
	}

	private createSQLPoolConfiguration(scale: number, maxScale: number): SQLServerMasterConfiguration {
		return <SQLServerMasterConfiguration>{
			type: ClusterPoolType.SQL,
			engineOnly: false,
			scale: scale,
			maxScale: maxScale
		};
	}

	private createComputePoolConfiguration(scale: number): PoolConfiguration {
		return {
			type: ClusterPoolType.Compute,
			scale: scale
		};
	}

	private createDataPoolConfiguration(scale: number): PoolConfiguration {
		return {
			type: ClusterPoolType.Data,
			scale: scale
		};
	}

	private createStoragePoolConfiguration(scale: number): PoolConfiguration {
		return {
			type: ClusterPoolType.Storage,
			scale: scale
		};
	}

	private createSparkPoolConfiguration(scale: number): PoolConfiguration {
		return {
			type: ClusterPoolType.Spark,
			scale: scale
		};
	}
}
