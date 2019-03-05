/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { AppContext } from '../appContext';
import { TreeNode } from './treeNode';
import { CmsResourceTreeProvider } from './tree/treeProvider';
import { CmsResourceEmptyTreeNode } from './tree/cmsResourceEmptyTreeNode';

const localize = nls.loadMessageBundle();

export function registerCmsResourceCommands(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	appContext.apiWrapper.registerCommand('cms.resource.registerCMSServer', async (node?: TreeNode) => {
		if (!(node instanceof CmsResourceEmptyTreeNode)) {
			return;
		}
		appContext.apiWrapper.connection.then(async (connection) => {
			let registeredCmsServerName = connection.options.registeredCmsServerName;
			let registeredCmsServerDescription = connection.options.registeredCmsServerDescription;
			let ownerUri = await sqlops.connection.getUriForConnection(connection.connectionId);
			appContext.apiWrapper.addRegisteredCmsServers(registeredCmsServerName, registeredCmsServerDescription, ownerUri, connection);
			tree.notifyNodeChanged(undefined);
		});
	});
}
