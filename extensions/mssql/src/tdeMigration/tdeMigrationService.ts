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
	private _reportUpdate: (dbName: string, succeeded: boolean, error: string) => void = undefined;

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends TdeMigrationService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
				this.client.onNotification(contracts.TdeMigrateProgressEvent.type, e => {
					if (this._reportUpdate === undefined) {
						return;
					}
					this._reportUpdate(e.name, e.success, e.error);
				});
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.TdeMigrationService, this);
	}

	// sleep = async (waitTime: number) => new Promise(resolve => setTimeout(resolve, waitTime));

	// async migrateCertificate(tdeEnabledDatabases: string[], sourceSqlConnectionString: string, targetSubscriptionId: string, targetResourceGroupName: string, targetManagedInstanceName: string, networkSharePath: string, networkShareDomain: string, networkShareUserName: string, networkSharePassword: string): Promise<mssql.TdeMigrationResult> {
	// 	let number = 2;
	// 	try {

	// 		while (true) {
	// 			number += 2;
	// 			await this.sleep(2000);
	// 			if (this._reportUpdate !== undefined && number === 6) {
	// 				this._reportUpdate(tdeEnabledDatabases[0], true, '');
	// 			}
	// 		}

	// 	}
	// 	catch (e) {
	// 		this.client.logFailedRequest(contracts.TdeMigrateRequest.type, e);
	// 	}

	// 	return undefined;
	// }

	async migrateCertificate(
		tdeEnabledDatabases: string[],
		sourceSqlConnectionString: string,
		targetSubscriptionId: string,
		targetResourceGroupName: string,
		targetManagedInstanceName: string,
		networkSharePath: string,
		networkShareDomain: string,
		networkShareUserName: string,
		networkSharePassword: string,
		accessToken: string,
		reportUpdate: (dbName: string, succeeded: boolean, error: string) => void): Promise<mssql.TdeMigrationResult> {

		this._reportUpdate = reportUpdate;
		let params: contracts.TdeMigrationParams = {
			encryptedDatabases: tdeEnabledDatabases,
			sourceSqlConnectionString: sourceSqlConnectionString,
			targetSubscriptionId: targetSubscriptionId,
			targetResourceGroupName: targetResourceGroupName,
			targetManagedInstanceName: targetManagedInstanceName,
			networkSharePath: networkSharePath,
			networkShareDomain: networkShareDomain,
			networkShareUserName: networkShareUserName,
			networkSharePassword: networkSharePassword,
			accessToken: accessToken
		};

		try {
			// This call needs to be awaited so, the updates are sent during the execution of the task.
			// If the task is not await, the finally block will execute and no update will be sent.
			const result = await this.client.sendRequest(contracts.TdeMigrateRequest.type, params);
			return result;
		}
		catch (e) {
			this.client.logFailedRequest(contracts.TdeMigrateRequest.type, e);
		} finally {
			this._reportUpdate = undefined;
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
