/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import CmsResourceController from './controllers/cmsResourceController';
import { AppContext } from './appContext';
import ControllerBase from './controllers/controllerBase';
import { CmsUtils } from './cmsUtils';
import { ICmsResourceNodeInfo } from './cmsResource/tree/baseTreeNodes';

let controllers: ControllerBase[] = [];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(extensionContext: vscode.ExtensionContext): Promise<void> {
	const cmsUtils = new CmsUtils(extensionContext.globalState);
	const appContext = new AppContext(extensionContext, cmsUtils);
	const activations: Thenable<boolean>[] = [];

	await portSavedConfigServers(appContext);

	const cmsResourceController = new CmsResourceController(appContext);
	controllers.push(cmsResourceController);
	extensionContext.subscriptions.push(cmsResourceController);
	activations.push(cmsResourceController.activate());
}

// this method is called when your extension is deactivated
export function deactivate(): void {
	for (let controller of controllers) {
		controller.deactivate();
	}
}

/**
 * Helper method to port over servers that were previously saved in the configuration (in versions <= 0.3.0 of the extension)
 * @param appContext The context to use to store the new saved servers
 */
async function portSavedConfigServers(appContext: AppContext): Promise<void> {
	const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('centralManagementServers');
	if (config) {
		const oldServers = config.get<ICmsResourceNodeInfo[]>('servers');
		if (oldServers) {
			oldServers.forEach(s => appContext.cmsUtils.cacheRegisteredCmsServer(s.name, s.description, s.ownerUri, s.connection));
			// Now delete the config value since we don't need it anymore
			await config.update('servers', undefined, true);
		}

	}
}
