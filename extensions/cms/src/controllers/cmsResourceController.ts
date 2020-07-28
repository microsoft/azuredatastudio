/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import ControllerBase from './controllerBase';
import { CmsResourceTreeProvider } from '../cmsResource/tree/treeProvider';
import { registerCmsResourceCommands } from '../cmsResource/commands';

export default class CmsResourceController extends ControllerBase {
	public activate(): Promise<boolean> {

		const cmsResourceTree = new CmsResourceTreeProvider(this.appContext);
		this.extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider('cmsResourceExplorer', cmsResourceTree));
		registerCmsResourceCommands(this.appContext, cmsResourceTree);

		return Promise.resolve(true);
	}

	public deactivate(): void {
	}
}
