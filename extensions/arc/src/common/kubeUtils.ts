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
	namespace?: string;
	isCurrentContext: boolean;
}

/**
 * returns the cluster context defined in the {@see configFile}
 *
 * @param configFile
 */
export function getKubeConfigClusterContexts(configFile: string): KubeClusterContext[] {
	const config: any = yamljs.load(configFile);
	const rawContexts = <any[]>config['contexts'];
	throwUnless(rawContexts && rawContexts.length, loc.noContextFound(configFile));
	const currentContext = <string>config['current-context'];
	throwUnless(currentContext, loc.noCurrentContextFound(configFile));
	const contexts: KubeClusterContext[] = [];
	rawContexts.forEach(rawContext => {
		const name = rawContext.name as string;
		const namespace = rawContext.context.namespace as string;
		throwUnless(name, loc.noNameInContext(configFile));
		contexts.push({
			name: name,
			namespace: namespace,
			isCurrentContext: name === currentContext
		});
	});
	return contexts;
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
 * @param previousClusterContextName
 * @param throwIfNotFound
 */
export function getCurrentClusterContext(clusterContexts: KubeClusterContext[], previousClusterContextName?: string, throwIfNotFound: boolean = false): KubeClusterContext {
	if (previousClusterContextName) {
		const previousClusterContext = clusterContexts.find(c => c.name === previousClusterContextName);
		if (previousClusterContext) { // if previous cluster context value is found in clusters then return that value
			return previousClusterContext;
		} else {
			if (throwIfNotFound) {
				throw new Error(loc.clusterContextNotFound(previousClusterContextName));
			}
		}
	}

	// if not previousClusterContext or throwIfNotFound was false when previousCLusterContext was not found in the clusterContexts
	const currentClusterContext = clusterContexts.find(c => c.isCurrentContext);
	throwUnless(currentClusterContext !== undefined, loc.noCurrentClusterContext);
	return currentClusterContext;
}

/**
 * returns the default kube config file path
 */
export function getDefaultKubeConfigPath(): string {
	return path.join(os.homedir(), '.kube', 'config');
}

