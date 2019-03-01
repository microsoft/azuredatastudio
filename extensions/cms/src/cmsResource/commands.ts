/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { AppContext } from '../appContext';
import * as nls from 'vscode-nls';
import { TreeNode } from './treeNode';
import { CmsResourceTreeProvider } from './tree/treeProvider';
import { CmsResourceEmptyTreeNode } from './tree/cmsResourceEmptyTreeNode';

const localize = nls.loadMessageBundle();

export function registerCmsResourceCommands(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	appContext.apiWrapper.registerCommand('cms.resource.registerCMSServer', async (node?: TreeNode) => {
		if (!(node instanceof CmsResourceEmptyTreeNode)) {
			return;
		}
		appContext.apiWrapper.connection.then((connection) => {
			let registeredCmsServerName = connection.options.registeredCmsServerName;
			let registeredCmsServerDescription = connection.options.registeredCmsServerDescription;
			appContext.apiWrapper.createCmsServer(registeredCmsServerName, registeredCmsServerDescription).then((result) => {
				appContext.apiWrapper.addRegisteredCmsServers(registeredCmsServerName, registeredCmsServerDescription, result);
				tree.notifyNodeChanged(undefined);
			});
		});
	});
}
