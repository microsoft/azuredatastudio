/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IKubeConfigParser } from '../../data/kubeConfigParser';
import { ClusterInfo, TargetClusterType, ClusterPorts, ContainerRegistryInfo, TargetClusterTypeInfo } from '../../interfaces';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class CreateClusterModel {

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

	public getTargetClusterTypeInfo(): Thenable<TargetClusterTypeInfo[]> {
		let promise = new Promise<TargetClusterTypeInfo[]>(resolve => {
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
				isInstalled: false
			};
			let aksCluster: TargetClusterTypeInfo = {
				type: TargetClusterType.NewAksCluster,
				name: localize('bdc-create.AKSClusterCardText', 'New AKS Cluster'),
				iconPath: {
					dark: 'images/cluster_inverse.svg',
					light: 'images/cluster.svg'
				},
				requiredTools: [
					kubeCtl,
					mssqlCtl,
					azureCli
				]
			};

			let existingCluster: TargetClusterTypeInfo = {
				type: TargetClusterType.ExistingKubernetesCluster,
				name: localize('bdc-create.ExistingCardText', 'Existing Cluster'),
				iconPath: {
					dark: 'images/cluster_inverse.svg',
					light: 'images/cluster.svg'
				},
				requiredTools: [
					kubeCtl,
					mssqlCtl
				]
			};
			resolve([aksCluster, existingCluster]);
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
