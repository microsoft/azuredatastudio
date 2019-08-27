/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import * as os from 'os';

export interface KubeClusterContext {
	name: string;
	user: string;
	cluster: string;
	isCurrent: boolean;
}

export interface IKubeService {
	getDefautConfigPath(): string;
	getContexts(configFile: string): Thenable<KubeClusterContext[]>;
}

export class KubeService implements IKubeService {
	getDefautConfigPath(): string {
		return path.join(os.homedir(), '.kube', 'config');
	}

	getContexts(configFile: string): Thenable<KubeClusterContext[]> {
		const promise = new Promise<KubeClusterContext[]>(resolve => {
			resolve([
				{
					user: 'alan',
					name: 'current-cluster',
					cluster: 'kubernetes',
					isCurrent: false
				}
			]);
		});
		return promise;
	}
}
