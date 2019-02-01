/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as constants from './constants';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

export class SqlClusterLookUp {
	public static async lookUpSqlClusterInfo(conn: sqlops.IConnectionProfile | sqlops.connection.Connection): Promise<ConnectionParam> {
		if ('connectionId' in conn) {
			return await this.lookUpSqlClusterInfoByConn(conn);
		} else {
			return await this.lookUpSqlClusterInfoByProfile(conn);
		}
	}

	private static async lookUpSqlClusterInfoByProfile(connectionProfile: sqlops.IConnectionProfile): Promise<ConnectionParam> {
		if (!connectionProfile) { return undefined; }

		let clusterConnectionParam: ConnectionParam = undefined;
		if (connectionProfile.providerName === constants.mssqlClusterProviderName) {
			clusterConnectionParam = this.connProfileToConnectionParam(connectionProfile);
		} else {
			clusterConnectionParam = await this.createSqlClusterConnectionParam(connectionProfile);
		}

		return clusterConnectionParam;
	}

	private static async lookUpSqlClusterInfoByConn(connection: sqlops.connection.Connection): Promise<ConnectionParam> {
		if (!connection) { return undefined; }

		let clusterConnectionParam: ConnectionParam = undefined;
		let connectionParam = this.connectionToConnectionParam(connection);
		if (connection.providerName === constants.mssqlClusterProviderName) {
			clusterConnectionParam = connectionParam;
		} else {
			clusterConnectionParam = await this.createSqlClusterConnectionParam(connectionParam);
		}
		return clusterConnectionParam;
	}

	private static async createSqlClusterConnectionParam<T>(sqlMasterConnectionProfile: sqlops.IConnectionProfile): Promise<ConnectionParam> {
		if (!sqlMasterConnectionProfile || !sqlMasterConnectionProfile.id || !sqlMasterConnectionProfile.userName) { return undefined; }

		let serverInfo = await sqlops.connection.getServerInfo(sqlMasterConnectionProfile.id);
		if (!serverInfo || !serverInfo.options) { return undefined; }

		let endpoints: IEndpoint[] = serverInfo.options[constants.clusterEndpointsProperty];
		if (!endpoints || endpoints.length === 0) { return undefined; }

		let index = endpoints.findIndex(ep => ep.serviceName === constants.hadoopKnoxEndpointName);
		if (index < 0) { return undefined; }

		let credentials = await sqlops.connection.getCredentials(sqlMasterConnectionProfile.id);
		if (!credentials) { return undefined; }

		let connection = <sqlops.connection.Connection> {
			options: {
				'groupId': sqlMasterConnectionProfile.options.groupId,
				'host': endpoints[index].ipAddress,
				'knoxport': endpoints[index].port,
				'user': 'root', //connectionProfile.options.userName cluster setup has to have the same user for master and big data cluster
				'password': credentials.password,
			},
			providerName: constants.mssqlClusterProviderName,
			connectionId: UUID.generateUuid()
		};

		let connectionParam = this.connectionToConnectionParam(connection);
		return connectionParam;
	}

	private static connProfileToConnectionParam(connectionProfile: sqlops.IConnectionProfile): ConnectionParam {
		let result = Object.assign(connectionProfile, { connectionId: connectionProfile.id || '' });
		return <ConnectionParam>result;
	}

	private static connectionToConnectionParam(connection: sqlops.connection.Connection): ConnectionParam {
		let providerName = connection.providerName;
		let connectionId = connection.connectionId;

		let options = new Map<string, object>();
		if (connection.options)
		{
			let fields = [ 'applicationName', 'authenticationType', 'connectionName', 'database',
				'databaseDisplayName', 'groupId', 'server', 'user', 'password', 'host', 'knoxport' ];
			fields.forEach(f => options.set(f, connection.options[f]));
		}

		let result = Object.assign(connection, {
			connectionName: options['connectionName'] || '',
			serverName: options['server'] ||
				(options['host'] ? `${options['host']},${options['knoxport']}` : ''),
			databaseName: options['database'] || options['databaseDisplayName'],
			userName: options['user'] || '',
			password: options['password'] || '',
			authenticationType: options['authenticationType'] || '',
			savePassword: false,
			groupFullName: '',
			groupId: options['groupId'] || '',
			providerName: providerName,
			saveProfile: false,
			id: connectionId,
		});

		return <ConnectionParam>result;
	}
}

interface IEndpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
}

export class ConnectionParam implements sqlops.connection.Connection, sqlops.IConnectionProfile, sqlops.ConnectionInfo
{
	public connectionName: string;
	public serverName: string;
	public databaseName: string;
	public userName: string;
	public password: string;
	public authenticationType: string;
	public savePassword: boolean;
	public groupFullName: string;
	public groupId: string;
	public saveProfile: boolean;
	public id: string;
	public azureTenantId?: string;

	public providerName: string;
	public connectionId: string;

	public options: { [name: string]: any; };
}