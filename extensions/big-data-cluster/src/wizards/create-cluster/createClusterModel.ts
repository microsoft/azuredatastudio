/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IKubeConfigParser } from '../../data/kubeConfigParser';
import { ClusterInfo, TargetClusterType, ClusterPorts, ContainerRegistryInfo, TargetClusterTypeInfo, ToolInfo } from '../../interfaces';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class CreateClusterModel {

	private _tmp_tools_installed: boolean = false;

	constructor(private _kubeConfigParser: IKubeConfigParser) {
	}

	public loadClusters(configPath: string): ClusterInfo[] {
		return this._kubeConfigParser.parse(configPath);
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
				registry: 'http://repo.corp.microsoft.com/',
				repository: 'aris-p-master-dsmain-standard',
				imageTag: 'latest'
			});
		});
		return promise;
	}

	public getAllTargetClusterTypeInfo(): Thenable<TargetClusterTypeInfo[]> {
		let promise = new Promise<TargetClusterTypeInfo[]>(resolve => {
			let aksCluster: TargetClusterTypeInfo = {
				type: TargetClusterType.NewAksCluster,
				name: localize('bdc-create.AKSClusterCardText', 'New AKS Cluster'),
				iconPath: {
					dark: 'images/cluster_inverse.svg',
					light: 'images/cluster.svg'
				}
			};

			let existingCluster: TargetClusterTypeInfo = {
				type: TargetClusterType.ExistingKubernetesCluster,
				name: localize('bdc-create.ExistingCardText', 'Existing Cluster'),
				iconPath: {
					dark: 'images/cluster_inverse.svg',
					light: 'images/cluster.svg'
				}
			};
			resolve([aksCluster, existingCluster]);
		});
		return promise;
	}

	public getRequiredToolStatus(): Thenable<ToolInfo[]> {
		let kubeCtl = {
			name: 'KUBECTL',
			description: 'KUBECTL',
			isInstalled: true
		};
		let mssqlCtl = {
			name: 'MSSQLCTL',
			description: 'MSSQLCTL',
			isInstalled: true
		};
		let azureCli = {
			name: 'AzureCLI',
			description: 'AzureCLI',
			isInstalled: this._tmp_tools_installed
		};
		let promise = new Promise<ToolInfo[]>(resolve => {
			setTimeout(() => {
				let tools = this.targetClusterType === TargetClusterType.ExistingKubernetesCluster ? [kubeCtl, mssqlCtl] : [kubeCtl, mssqlCtl, azureCli];
				resolve(tools);
			}, 3000);
		});
		return promise;
	}

	public installTools(): Thenable<void> {
		let promise = new Promise<void>(resolve => {
			setTimeout(() => {
				this._tmp_tools_installed = true;
				resolve();
			}, 10000)
		});
		return promise;
	}

	public targetClusterType: TargetClusterType;

	public selectedCluster: ClusterInfo;

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
}
