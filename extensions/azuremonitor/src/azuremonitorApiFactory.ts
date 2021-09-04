/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from './appContext';
import { IExtension, AzureMonitorObjectExplorerBrowser } from './azuremonitor';
import * as constants from './constants';
import { AzureMonitorObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import * as azdata from 'azdata';

export function createAzureMonitorApi(context: AppContext): IExtension {
	return {
		getAzureMonitorObjectExplorerBrowser(): AzureMonitorObjectExplorerBrowser {
			return {
				getNode: (explorerContext: azdata.ObjectExplorerContext) => {
					let oeProvider = context.getService<AzureMonitorObjectExplorerNodeProvider>(constants.ObjectExplorerService);
					return <any>oeProvider?.findSqlClusterNodeByContext(explorerContext);
				}
			};
		}
	};
}
