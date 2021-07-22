/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../mssql';
import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as contracts from '../contracts';

export class SqlMigrationService implements mssql.ISqlMigrationService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SqlMigrationService {
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
		context.registerService(constants.SqlMigrationService, this);
	}

	async getAssessments(ownerUri: string, databases: string[]): Promise<mssql.AssessmentResult | undefined> {
		let params: contracts.SqlMigrationAssessmentParams = { ownerUri: ownerUri, databases: databases };
		try {
			return this.client.sendRequest(contracts.GetSqlMigrationAssessmentItemsRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.GetSqlMigrationAssessmentItemsRequest.type, e);
		}

		return undefined;
	}
}
