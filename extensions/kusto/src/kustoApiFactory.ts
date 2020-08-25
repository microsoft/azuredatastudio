/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from './appContext';
import { IExtension, KustoObjectExplorerBrowser } from './kusto';
import * as constants from './constants';
import { KustoObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import * as azdata from 'azdata';

export function createKustoApi(context: AppContext): IExtension {
	return {
		getKustoObjectExplorerBrowser(): KustoObjectExplorerBrowser {
			return {
				getNode: (explorerContext: azdata.ObjectExplorerContext) => {
					let oeProvider = context.getService<KustoObjectExplorerNodeProvider>(constants.ObjectExplorerService);
					return <any>oeProvider?.findSqlClusterNodeByContext(explorerContext);
				}
			};
		}
	};
}
