/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../mssql';
import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as azdata from 'azdata';
import * as contracts from '../contracts';


export class SqlAssessmentService implements mssql.ISqlAssessmentService {
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

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.SqlAssessmentService, this);
	}
	async assessmentInvoke(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult | undefined> {
		let params: contracts.SqlAssessmentParams = { ownerUri: ownerUri, targetType: targetType };
		try {
			return this.client.sendRequest(contracts.SqlAssessmentInvokeRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.SqlAssessmentInvokeRequest.type, e);
		}

		return undefined;
	}
	async getAssessmentItems(ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult | undefined> {
		let params: contracts.SqlAssessmentParams = { ownerUri: ownerUri, targetType: targetType };
		try {
			return this.client.sendRequest(contracts.GetSqlAssessmentItemsRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.GetSqlAssessmentItemsRequest.type, e);
		}

		return undefined;
	}
	async generateAssessmentScript(items: azdata.SqlAssessmentResultItem[], targetServerName: string, targetDatabaseName: string, taskExecutionMode: azdata.TaskExecutionMode): Promise<azdata.ResultStatus | undefined> {
		let params: contracts.GenerateSqlAssessmentScriptParams = { items: items, targetServerName: targetServerName, targetDatabaseName: targetDatabaseName, taskExecutionMode: taskExecutionMode };
		try {
			return this.client.sendRequest(contracts.GenerateSqlAssessmentScriptRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.GenerateSqlAssessmentScriptRequest.type, e);
		}

		return undefined;
	}

}
