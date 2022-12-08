/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities } from 'vscode-languageclient';
import * as constants from '../constants';
import * as contracts from '../contracts';

export class TdeMigrationService implements mssql.ITdeMigrationService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends TdeMigrationService {
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
		context.registerService(constants.TdeMigrationService, this);
	}

	async migrateCertificate(tdeEnabledDatabases: string[], sourceSqlConnectionString: string, targetSubscriptionId: string, targetResourceGroupName: string, targetManagedInstanceName: string): Promise<mssql.TdeMigrationResult> {
		let params: contracts.TdeMigrationParams = {
			encryptedDatabases: tdeEnabledDatabases,
			sourceSqlConnectionString: sourceSqlConnectionString,
			targetSubscriptionId: targetSubscriptionId,
			targetResourceGroupName: targetResourceGroupName,
			targetManagedInstanceName: targetManagedInstanceName
		};

		try {
			return this.client.sendRequest(contracts.TdeMigrateRequest.type, params);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.TdeMigrateRequest.type, e);
		}

		return undefined;
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
