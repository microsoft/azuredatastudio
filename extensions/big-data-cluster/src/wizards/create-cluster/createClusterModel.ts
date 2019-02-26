/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TargetClusterType, ClusterPorts, ContainerRegistryInfo, TargetClusterTypeInfo, ToolInfo, ToolInstallationStatus } from '../../interfaces';
import { getContexts, KubectlContext } from '../../kubectl/kubectlUtils';
import { Kubectl } from '../../kubectl/kubectl';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export class CreateClusterModel {

	private _tmp_tools_installed: boolean = false;

	constructor(private _kubectl: Kubectl) {
	}

	public async loadClusters(): Promise<KubectlContext[]> {
		return await getContexts(this._kubectl);
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
			name: 'kubectl',
			description: 'Tool used for managing the Kubernetes cluster',
			status: ToolInstallationStatus.Installed
		};
		let mssqlCtl = {
			name: 'mssqlctl',
			description: 'Command-line tool for installing and managing the SQL Server big data cluster',
			status: ToolInstallationStatus.Installed
		};
		let azureCli = {
			name: 'Azure CLI',
			description: 'Tool used for managing Azure services',
			status: this._tmp_tools_installed ? ToolInstallationStatus.Installed : ToolInstallationStatus.NotInstalled
		};
		let promise = new Promise<ToolInfo[]>(resolve => {
			setTimeout(() => {
				let tools = this.targetClusterType === TargetClusterType.ExistingKubernetesCluster ? [kubeCtl, mssqlCtl] : [kubeCtl, mssqlCtl, azureCli];
				resolve(tools);
			}, 2000);
		});
		return promise;
	}

	public installTools(): Thenable<void> {
		let promise = new Promise<void>(resolve => {
			setTimeout(() => {
				this._tmp_tools_installed = true;
				resolve();
			}, 2000);
		});
		return promise;
	}

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
}
