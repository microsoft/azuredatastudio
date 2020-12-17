/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import * as yamljs from 'yamljs';
import * as loc from '../localizedConstants';
import { throwUnless } from './utils';
export interface KubeClusterContext {
	name: string;
	isCurrentContext: boolean;
}

/**
 * returns the cluster context defined in the {@see configFile}
 *
 * @param configFile
 */
export function getKubeConfigClusterContexts(configFile: string): Promise<KubeClusterContext[]> {
	const config: any = yamljs.load(configFile);
	const rawContexts = <any[]>config['contexts'];
	throwUnless(rawContexts && rawContexts.length, loc.noContextFound(configFile));
	const currentContext = <string>config['current-context'];
	throwUnless(currentContext, loc.noCurrentContextFound(configFile));
	const contexts: KubeClusterContext[] = [];
	rawContexts.forEach(rawContext => {
		const name = <string>rawContext['name'];
		throwUnless(name, loc.noNameInContext(configFile));
		if (name) {
			contexts.push({
				name: name,
				isCurrentContext: name === currentContext
			});
		}
	});
	return Promise.resolve(contexts);
}

/**
 * searches for {@see previousClusterContext} in the array of {@see clusterContexts}.
 * if {@see previousClusterContext} was truthy and it was found in {@see clusterContexts}
 * 		then it returns {@see previousClusterContext}
 * 		else it returns the current cluster context from {@see clusterContexts} unless throwIfNotFound was set on input in which case an error is thrown instead.
 * else it returns the current cluster context from {@see clusterContexts}
 *
 *
 * @param clusterContexts
 * @param previousClusterContext
 * @param throwIfNotFound
 */
export function getCurrentClusterContext(clusterContexts: KubeClusterContext[], previousClusterContext?: string, throwIfNotFound: boolean = false): string {
	if (previousClusterContext) {
		if (clusterContexts.find(c => c.name === previousClusterContext)) { // if previous cluster context value is found in clusters then return that value
			return previousClusterContext;
		} else {
			if (throwIfNotFound) {
				throw new Error(loc.clusterContextNotFound(previousClusterContext));
			}
		}
	}

	// if not previousClusterContext or throwIfNotFound was false when previousCLusterContext was not found in the clusterContexts
	const currentClusterContext = clusterContexts.find(c => c.isCurrentContext)?.name;
	throwUnless(currentClusterContext !== undefined, loc.noCurrentClusterContext);
	return currentClusterContext;
}

/**
 * returns the default kube config file path
 */
export function getDefaultKubeConfigPath(): string {
	return path.join(os.homedir(), '.kube', 'config');
}

