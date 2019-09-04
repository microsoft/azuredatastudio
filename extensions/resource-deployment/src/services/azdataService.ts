/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface DeploymentProfile {
	name: string;
	defaultDataSize: number;
	defaultLogSize: number;
	master: number;
	data: number;
	compute: number;
	hdfs: number;
	nameNode: number;
	spark: number;
}

export interface IAzdataService {
	getDeploymentProfiles(): Thenable<DeploymentProfile[]>;
}

export class AzdataService implements IAzdataService {
	getDeploymentProfiles(): Thenable<DeploymentProfile[]> {
		const promise = new Promise<DeploymentProfile[]>((resolve, reject) => {
			resolve([
				{
					name: 'aks-dev-test',
					defaultDataSize: 15,
					defaultLogSize: 10,
					master: 1,
					data: 1,
					compute: 1,
					hdfs: 2,
					nameNode: 1,
					spark: 1
				}, {
					name: 'kubeadm-prod',
					defaultDataSize: 300,
					defaultLogSize: 100,
					master: 1,
					data: 1,
					compute: 1,
					hdfs: 2,
					nameNode: 1,
					spark: 1
				}, {
					name: 'kubeadm-dev-test',
					defaultDataSize: 100,
					defaultLogSize: 50,
					master: 1,
					data: 1,
					compute: 1,
					hdfs: 2,
					nameNode: 1,
					spark: 1
				}
			]);
		});
		return promise;
	}
}
