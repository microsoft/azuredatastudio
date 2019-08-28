/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface DeploymentProfile {
	name: string;
	defaultDataSize: number;
	defaultLogSize: number;
	sqlReplicas: number;
	computeReplicas: number;
}

export interface IAzdataService {
	getDeploymentProfiles(): DeploymentProfile[];
}

export class AzdataService implements IAzdataService {
	getDeploymentProfiles(): DeploymentProfile[] {
		return [
			{
				name: 'aks-dev-test',
				defaultDataSize: 15,
				defaultLogSize: 10,
				sqlReplicas: 1,
				computeReplicas: 2
			}, {
				name: 'kubeadm-dev-test',
				defaultDataSize: 15,
				defaultLogSize: 10,
				sqlReplicas: 3,
				computeReplicas: 2
			}, {
				name: 'kubeadm-prod',
				defaultDataSize: 15,
				defaultLogSize: 10,
				sqlReplicas: 5,
				computeReplicas: 2
			}
		];
	}
}
