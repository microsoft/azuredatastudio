/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ClusterInfo } from './clusterInfo';

export interface IKubeConfigParser {
	Parse(configPath: string): ClusterInfo[];
}

export class TestKubeConfigParser implements IKubeConfigParser {
	Parse(configPath: string): ClusterInfo[] {
		let clusters = [];
		for (let i = 0; i < 18; i++) {
			let name;
			if (i % 2 === 0) {
				name = `kubernetes cluster ${i}`;
			}
			else {
				name = 'cluster dev ' + i;
			}
			clusters.push(
				{
					displayName: name,
					name: `kub-dev-xxxx-cluster-${i}`,
					user: 'root'
				}
			);
		}
		return clusters;
	}
}

