/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from './appContext';
import { IExtension, ICmsService, IDacFxService, ISchemaCompareService, MssqlObjectExplorerBrowser, ILanguageExtensionService, ISqlAssessmentService, ISqlMigrationService } from './mssql';
import * as constants from './constants';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import * as azdata from 'azdata';
import { SqlToolsServer } from './sqlToolsServer';

export function createMssqlApi(context: AppContext, sqlToolsServer: SqlToolsServer): IExtension {
	return {
		get sqlToolsServicePath() {
			return sqlToolsServer.installDirectory;
		},
		get cmsService() {
			return context.getService<ICmsService>(constants.CmsService);
		},
		get dacFx() {
			return context.getService<IDacFxService>(constants.DacFxService);
		},
		get schemaCompare() {
			return context.getService<ISchemaCompareService>(constants.SchemaCompareService);
		},
		get languageExtension() {
			return context.getService<ILanguageExtensionService>(constants.LanguageExtensionService);
		},
		getMssqlObjectExplorerBrowser(): MssqlObjectExplorerBrowser {
			return {
				getNode: (explorerContext: azdata.ObjectExplorerContext) => {
					let oeProvider = context.getService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService);
					return <any>oeProvider.findSqlClusterNodeByContext(explorerContext);
				}
			};
		},
		get sqlAssessment() {
			return context.getService<ISqlAssessmentService>(constants.SqlAssessmentService);
		},
		get sqlMigration() {
			return context.getService<ISqlMigrationService>(constants.SqlMigrationService);
		}
	};
}
