/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as os from 'os';
import * as yamljs from 'yamljs';
import * as util from 'util';
import * as loc from '../localizedConstants';
import { throwUnless } from './utils';

export interface KubeClusterContext {
	name: string;
	isCurrentContext: boolean;
}

export async function getKubeConfigClusterContexts(configFile: string): Promise<KubeClusterContext[]> {
	const config: any = await util.promisify(yamljs.load)(configFile);
	const rawContexts = <any[]>config['contexts'];
	throwUnless(rawContexts && rawContexts.length, loc.noContextFound(configFile));
	const currentContext = <string>config['current-context'];
	throwUnless(currentContext, loc.noCurrentContextFound(configFile));
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
	return contexts;
}

export function getDefaultKubeConfigPath(): string {
	return path.join(os.homedir(), '.kube', 'config');
}

