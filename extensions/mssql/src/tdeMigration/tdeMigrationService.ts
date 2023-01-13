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
					this._reportUpdate(e.name, e.success, e.message);
				});
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.TdeMigrationService, this);
	}

	async migrateCertificate(
		tdeEnabledDatabases: string[],
		sourceSqlConnectionString: string,
		targetSubscriptionId: string,
		targetResourceGroupName: string,
		targetManagedInstanceName: string,
		networkSharePath: string,
		accessToken: string,
		reportUpdate: (dbName: string, succeeded: boolean, message: string) => void): Promise<mssql.TdeMigrationResult> {

		this._reportUpdate = reportUpdate;
		let params: contracts.TdeMigrationParams = {
			encryptedDatabases: tdeEnabledDatabases,
			sourceSqlConnectionString: sourceSqlConnectionString,
			targetSubscriptionId: targetSubscriptionId,
			targetResourceGroupName: targetResourceGroupName,
			targetManagedInstanceName: targetManagedInstanceName,
			networkSharePath: networkSharePath,
			networkShareDomain: 'a', // Will remove this on the next STS version
			networkShareUserName: 'b',
			networkSharePassword: 'c',
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
}
