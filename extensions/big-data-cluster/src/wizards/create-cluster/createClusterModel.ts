/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ClusterInfo, TargetClusterType } from '../../interfaces';
import { getContexts, KubectlContext }  from '../../kubectl/kubectlUtils';
import { Kubectl } from '../../kubectl/kubectl';
export class CreateClusterModel {

	constructor(private _kubectl : Kubectl) {
	}

	public async loadClusters(): Promise<KubectlContext[]> {
		return await getContexts(this._kubectl);
	}

	public targetClusterType: TargetClusterType;

	public selectedCluster: KubectlContext;

	public adminUserName: string;

	public adminPassword: string;
}
