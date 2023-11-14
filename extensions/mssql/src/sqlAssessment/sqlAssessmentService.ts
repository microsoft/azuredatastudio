/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as azdata from 'azdata';
import * as contracts from '../contracts';
import * as constants from '../constants';

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature, BaseService } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';

export class SqlAssessmentService extends BaseService implements mssql.ISqlAssessmentService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SqlAssessmentService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.SqlAssessmentService, this);
	}
	async assessmentInvoke(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult> {
		let params: contracts.SqlAssessmentParams = { ownerUri: ownerUri, targetType: targetType };
		return this.runWithErrorHandling(contracts.SqlAssessmentInvokeRequest.type, params);
	}
	async getAssessmentItems(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult> {
		let params: contracts.SqlAssessmentParams = { ownerUri: ownerUri, targetType: targetType };
		return this.runWithErrorHandling(contracts.GetSqlAssessmentItemsRequest.type, params);
	}
	async generateAssessmentScript(items: azdata.SqlAssessmentResultItem[], targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus> {
		let params: contracts.GenerateSqlAssessmentScriptParams = { items: items, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
		return this.runWithErrorHandling(contracts.GenerateSqlAssessmentScriptRequest.type, params);
	}
}
