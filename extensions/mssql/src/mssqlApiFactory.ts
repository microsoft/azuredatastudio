/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from './appContext';
import { IExtension, ICmsService, IDacFxService, ISchemaCompareService, ILanguageExtensionService, ISqlAssessmentService, IAzureBlobService } from 'mssql';
import * as constants from './constants';
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
		get sqlAssessment() {
			return context.getService<ISqlAssessmentService>(constants.SqlAssessmentService);
		},
		get azureBlob() {
			return context.getService<IAzureBlobService>(constants.AzureBlobService);
		}
	};
}
