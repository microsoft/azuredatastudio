/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IKubeConfigParser } from '../../data/kubeConfigParser';
import { ClusterInfo, TargetClusterType } from '../../interfaces';

export class CreateClusterModel {

	constructor(private _kubeConfigParser: IKubeConfigParser) {
	}

	public loadClusters(configPath: string): ClusterInfo[] {
		return this._kubeConfigParser.parse(configPath);
	}

	public targetClusterType: TargetClusterType;

	public selectedCluster: ClusterInfo;

	public adminUserName: string;

	public adminPassword: string;
}
