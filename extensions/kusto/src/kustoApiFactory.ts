/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from './appContext';
import { IExtension, MssqlObjectExplorerBrowser } from './kusto';
import * as constants from './constants';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import * as azdata from 'azdata';

export function createMssqlApi(context: AppContext): IExtension {
	return {
		getMssqlObjectExplorerBrowser(): MssqlObjectExplorerBrowser {
			return {
				getNode: (explorerContext: azdata.ObjectExplorerContext) => {
					let oeProvider = context.getService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService);
					return <any>oeProvider.findSqlClusterNodeByContext(explorerContext);
				}
			};
		}
	};
}
