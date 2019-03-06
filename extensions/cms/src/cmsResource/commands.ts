/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { AppContext } from '../appContext';
import { TreeNode } from './treeNode';
import { CmsResourceTreeProvider } from './tree/treeProvider';
import { CmsResourceEmptyTreeNode } from './tree/cmsResourceEmptyTreeNode';
import { RegisteredServerTreeNode } from './tree/registeredServerTreeNode';
import { ServerGroupTreeNode } from './tree/serverGroupTreeNode';
import { CmsResourceTreeNode } from './tree/cmsResourceTreeNode';
import { ApiWrapper } from '../apiWrapper';

const localize = nls.loadMessageBundle();

export function registerCmsResourceCommands(appContext: AppContext, tree: CmsResourceTreeProvider): void {

	// Create a CMS Server
	appContext.apiWrapper.registerCommand('cms.resource.registerCMSServer', async (node?: TreeNode) => {
		if (!(node instanceof CmsResourceEmptyTreeNode)) {
			return;
		}
		appContext.apiWrapper.connection.then(async (connection) => {
			let registeredCmsServerName = connection.options.registeredCmsServerName;
			let registeredCmsServerDescription = connection.options.registeredCmsServerDescription;
			let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
			appContext.apiWrapper.cacheRegisteredCmsServer(registeredCmsServerName, registeredCmsServerDescription, ownerUri, connection);
			tree.notifyNodeChanged(undefined);
		});
	});

	// Add a registered server
	appContext.apiWrapper.registerCommand('cms.resource.addRegisteredServer', async (node?: TreeNode) => {
		if (!(node instanceof CmsResourceEmptyTreeNode || node instanceof ServerGroupTreeNode)) {
			return;
		}
		appContext.apiWrapper.connection.then(async (connection) => {
			appContext.apiWrapper.addRegisteredServer(connection.options.registeredCmsServerName, connection.options.registeredCmsServerDescription, null, null, null);
		});

	});

	// Delete a registered server
	appContext.apiWrapper.registerCommand('cms.resource.deleteRegisteredServer', async (node?: TreeNode) => {
		if (!(node instanceof RegisteredServerTreeNode)) {
			return;
		}
		appContext.apiWrapper.removeRegisteredServer(node.name, node.relativePath, node.ownerUri).then((result) => {
			if (result) {
				tree.notifyNodeChanged(undefined);
			}
		});
	});

	// Add a registered server group
	appContext.apiWrapper.registerCommand('cms.resource.addRegisteredServerGroup', async (node?: TreeNode) => {
		if (!(node instanceof ServerGroupTreeNode || node instanceof CmsResourceTreeNode)) {
			return;
		}
		// add a dialog for adding a group
		let dialog = azdata.window.createModelViewDialog('Add Server Group', 'cms.addServerGroup');
		azdata.window.openDialog(dialog);
		//appContext.apiWrapper.addServerGroup(groupName, groupDescription, relativePath, ownerUri);
	});

	// Remove a registered server group
	appContext.apiWrapper.registerCommand('cms.resource.deleteServerGroup', async (node?: TreeNode) => {
		if (!(node instanceof ServerGroupTreeNode)) {
			return;
		}
		appContext.apiWrapper.removeServerGroup(node.name, node.relativePath, node.ownerUri).then((result) => {
			if (result) {
				tree.notifyNodeChanged(undefined);
			}
		});
	});
}
