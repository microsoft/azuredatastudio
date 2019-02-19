/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import ControllerBase from './controllerBase';
import { AzureResourceTreeProvider } from '../azureResource/tree/treeProvider';

export default class AzureResourceController extends ControllerBase {
	public activate(): Promise<boolean> {

		const azureResourceTree = new AzureResourceTreeProvider(this.appContext);
		this.extensionContext.subscriptions.push(this.apiWrapper.registerTreeDataProvider('cmsResourceExplorer', azureResourceTree));

		return Promise.resolve(true);
	}

	public deactivate(): void {
	}
}
