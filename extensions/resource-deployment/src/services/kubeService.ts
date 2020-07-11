/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import * as yamljs from 'yamljs';
import * as fs from 'fs';

export interface KubeClusterContext {
	name: string;
	isCurrentContext: boolean;
}

export interface IKubeService {
	getDefaultConfigPath(): string;
	getClusterContexts(configFile: string): Promise<KubeClusterContext[]>;
}

export class KubeService implements IKubeService {
	getDefaultConfigPath(): string {
		return getDefaultKubeConfigPath();
	}

	getClusterContexts(configFile: string): Promise<KubeClusterContext[]> {
		return getKubeConfigClusterContexts(configFile);
	}
}

export function getKubeConfigClusterContexts(configFile: string): Promise<KubeClusterContext[]> {
	return fs.promises.access(configFile).catch((error) => {
		if (error && error.code === 'ENOENT') {
			return [];
		}
		else {
			throw error;
		}
	}).then(() => {
		const config = yamljs.load(configFile);
		const rawContexts = <any[]>config['contexts'];
		const currentContext = <string>config['current-context'];
		const contexts: KubeClusterContext[] = [];
		if (currentContext && rawContexts && rawContexts.length > 0) {
			rawContexts.forEach(rawContext => {
				const name = <string>rawContext['name'];
				if (name) {
					contexts.push({
						name: name,
						isCurrentContext: name === currentContext
					});
				}
			});
		}
		return contexts;
	});
}

export function getDefaultKubeConfigPath(): string {
	return path.join(os.homedir(), '.kube', 'config');
}

