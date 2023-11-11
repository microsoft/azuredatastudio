/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as vscode from 'vscode';
import { IFireWallRuleError, AuthenticationType } from 'vscode-mssql';
import { ISqlConnectionProperties } from 'sqldbproj';

/**
 * Includes methods to open connections and interact with connection views
 */
export class ConnectionService {

	constructor(private _outputChannel: vscode.OutputChannel) {
	}

	private defaultSqlRetryTimeoutInSec: number = 10;
	private defaultSqlNumberOfRetries: number = 3;

	/**
	 * Connects to a database
	 * @param profile connection profile
	 * @param saveConnectionAndPassword if true, connection will be saved in the connection view
	 * @param database database name
	 * @returns
	 */
	private async connectToDatabase(profile: ISqlConnectionProperties, saveConnectionAndPassword: boolean, database: string): Promise<azdataType.ConnectionResult | string | undefined> {
		const azdataApi = utils.getAzdataApi();
		const vscodeMssqlApi = azdataApi ? undefined : await utils.getVscodeMssqlApi();
		if (azdataApi) {
			// TODO receive encrypt/trustservercertificate from profile.
			const connectionProfile = {
				password: profile.password,
				serverName: `${profile.serverName},${profile.port}`,
				database: database,
				savePassword: saveConnectionAndPassword,
				userName: profile.userName,
				providerName: 'MSSQL',
				saveProfile: false,
				id: '',
				connectionName: profile.profileName,
				options: {
					'encrypt': true,
					'trustServerCertificate': true
				},
				authenticationType: azdataApi.connection.AuthenticationType.SqlLogin
			};
			return await azdataApi.connection.connect(connectionProfile, saveConnectionAndPassword, false);
		} else if (vscodeMssqlApi) {
			const connectionProfile = {
				password: profile.password,
				server: `${profile.serverName}`,
				port: profile.port,
				database: database,
				savePassword: saveConnectionAndPassword,
				user: profile.userName,
				authenticationType: AuthenticationType.SqlLogin,
				encrypt: false,
				connectTimeout: 30,
				applicationName: 'SQL Database Project',
				accountId: profile.accountId,
				azureAccountToken: undefined,
				applicationIntent: undefined,
				attachDbFilename: undefined,
				connectRetryCount: undefined,
				connectRetryInterval: undefined,
				connectionString: undefined,
				currentLanguage: undefined,
				email: undefined,
				failoverPartner: undefined,
				loadBalanceTimeout: undefined,
				maxPoolSize: undefined,
				minPoolSize: undefined,
				multiSubnetFailover: undefined,
				multipleActiveResultSets: undefined,
				packetSize: undefined,
				persistSecurityInfo: undefined,
				hostNameInCertificate: undefined,
				pooling: undefined,
				replication: undefined,
				trustServerCertificate: undefined,
				typeSystemVersion: undefined,
				workstationId: undefined,
				profileName: profile.profileName,
				expiresOn: undefined,
				tenantId: profile.tenantId,
				commandTimeout: undefined
			};
			let connectionUrl = '';
			try {
				connectionUrl = await vscodeMssqlApi.connect(connectionProfile, saveConnectionAndPassword);
			} catch (err) {
				const firewallRuleError = <IFireWallRuleError>err;
				if (firewallRuleError?.connectionUri) {
					await vscodeMssqlApi.promptForFirewallRule(err.connectionUri, connectionProfile);
				} else {
					throw err;
				}
			}

			// If connected successfully and saved the connection in the view, open the connection view
			if (saveConnectionAndPassword && connectionUrl) {
				await vscode.commands.executeCommand('objectExplorer.focus');
			}
			return connectionUrl;
		} else {
			return undefined;
		}
	}

	/**
	 * Validates the connection result. If using azdata API, verifies connection was successful and connection id is returns
	 * If using vscode API, verifies the connection url is returns
	 * @param connection connection result or connection Id
	 * @returns validation result
	 */
	private async validateConnection(connection: azdataType.ConnectionResult | string | undefined): Promise<utils.ValidationResult> {
		const azdataApi = utils.getAzdataApi();
		if (!connection) {
			return { validated: false, errorMessage: constants.connectionFailedError('No result returned') };
		} else if (azdataApi) {
			const connectionResult = <azdataType.ConnectionResult>connection;
			if (connectionResult) {
				const connected = connectionResult !== undefined && connectionResult.connected && connectionResult.connectionId !== undefined;
				return { validated: connected, errorMessage: connected ? '' : constants.connectionFailedError(connectionResult?.errorMessage!) };
			} else {
				return { validated: false, errorMessage: constants.connectionFailedError('') };
			}
		} else {
			return { validated: connection !== undefined, errorMessage: constants.connectionFailedError('') };
		}
	}

	/**
	 * Formats connection result to string to be able to add to log
	 * @param connection connection result or connection Id
	 * @returns formatted connection result
	 */
	private async formatConnectionResult(connection: azdataType.ConnectionResult | string | undefined): Promise<string> {
		const azdataApi = utils.getAzdataApi();
		const connectionResult = connection !== undefined && azdataApi ? <azdataType.ConnectionResult>connection : undefined;
		return connectionResult?.connected ? connectionResult.connectionId! : <string>connection;
	}

	/**
	 * Opens a connections and returns the connection id
	 * @param profile connection profile
	 * @param saveConnectionAndPassword is set to true the connection will be saved in the connection view
	 * @param database database name
	 * @returns connection id
	 */
	public async getConnection(profile: ISqlConnectionProperties, saveConnectionAndPassword: boolean, database: string): Promise<string | undefined> {
		const azdataApi = utils.getAzdataApi();
		let connection = await utils.retry(
			constants.connectingToSqlServerMessage,
			async () => {
				return await this.connectToDatabase(profile, saveConnectionAndPassword, database);
			},
			this.validateConnection,
			this.formatConnectionResult,
			this._outputChannel,
			this.defaultSqlNumberOfRetries, profile.connectionRetryTimeout || this.defaultSqlRetryTimeoutInSec);

		if (connection) {
			const connectionResult = <azdataType.ConnectionResult>connection;
			if (azdataApi) {
				utils.throwIfNotConnected(connectionResult);
				return azdataApi.connection.getUriForConnection(connectionResult.connectionId!);
			} else {
				return <string>connection;
			}
		}

		return undefined;
	}
}
