/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import * as os from 'os';
import * as yamljs from 'yamljs';
import * as fs from 'fs';

export interface KubeClusterContext {
	name: string;
	isCurrentContext: boolean;
}

export interface IKubeService {
	getDefautConfigPath(): string;
	getClusterContexts(configFile: string): Thenable<KubeClusterContext[]>;
}

export class KubeService implements IKubeService {
	getDefautConfigPath(): string {
		return path.join(os.homedir(), '.kube', 'config');
	}

	getClusterContexts(configFile: string): Thenable<KubeClusterContext[]> {
		const promise = new Promise<KubeClusterContext[]>((resolve, reject) => {
			try {
				if (fs.existsSync(configFile)) {
					const config = yamljs.load(configFile);
					const rawContexts = <any[]>config['contexts'];
					const currentContext = <string>config['current-context'];
					if (currentContext && rawContexts && rawContexts.length > 0) {
						const contexts: KubeClusterContext[] = [];
						rawContexts.forEach(rawContext => {
							const name = <string>rawContext['name'];
							if (name) {
								contexts.push({
									name: name,
									isCurrentContext: name === currentContext
								});
							}
						});
						resolve(contexts);
					}
				}
				resolve([]);
			}
			catch (error) {
				reject(error);
			}
		});
		return promise;
	}
}
