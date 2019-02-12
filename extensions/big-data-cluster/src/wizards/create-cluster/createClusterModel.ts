/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ClusterInfo } from '../../data/clusterInfo';
import { IKubeConfigParser } from '../../data/kubeConfigParser';
import { TargetClusterType } from '../../data/targetClusterType';

export class CreateClusterModel {

	constructor(private _kubeConfigParser: IKubeConfigParser) {
	}

	public loadClusters(configPath: string): ClusterInfo[] {
		return this._kubeConfigParser.Parse(configPath);
	}

	public targetClusterType: TargetClusterType;

	public selectedCluster: ClusterInfo;

	public adminUserName: string;

	public adminPassword: string;
}
