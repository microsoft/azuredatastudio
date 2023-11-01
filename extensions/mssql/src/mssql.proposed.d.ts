/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'mssql' {
	import * as azdata from 'azdata';

	/**
	 * Covers defining what the mssql extension exports to other extensions.
	 *
	 * This file should only contain definitions which rely on PROPOSED azdata typings
	 * (from azdata.proposed.d.ts). Anything which relies on STABLE typings (from azdata.d.ts)
	 * should go in mssql.d.ts.
	 *
	 * This is to make it easier for extensions that don't need these features to only import the ones
	 * that depend on stable features so they don't have to copy over the proposed typings themselves.
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */

	export interface IExtension {
		readonly sqlAssessment: ISqlAssessmentService;
		readonly queryStore: IQueryStoreService;
	}

	export interface ISqlAssessmentService {
		assessmentInvoke(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult>;
		getAssessmentItems(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult>;
		generateAssessmentScript(items: azdata.SqlAssessmentResultItem[], targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus>;
	}

}
