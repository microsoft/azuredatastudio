/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from './appContext';
import { IExtension, ICmsService, IDacFxService, ISchemaCompareService, MssqlObjectExplorerBrowser } from './mssql';
import * as constants from './constants';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import * as azdata from 'azdata';

export function createMssqlApi(context: AppContext): IExtension {
	return {
		get cmsService() {
			return context.getService<ICmsService>(constants.CmsService);
		},
		get dacFx() {
			return context.getService<IDacFxService>(constants.DacFxService);
		},
		get schemaCompare() {
			return context.getService<ISchemaCompareService>(constants.SchemaCompareService);
		},
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
