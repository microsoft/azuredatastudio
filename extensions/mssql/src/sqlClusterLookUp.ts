/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as constants from './constants';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { AppContext } from './appContext';
import { SqlClusterConnection } from './objectExplorerNodeProvider/connection';
import { ICommandObjectExplorerContext } from './objectExplorerNodeProvider/command';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';


export function findSqlClusterConnection(
	obj: ICommandObjectExplorerContext | sqlops.IConnectionProfile,
	appContext: AppContext) : SqlClusterConnection  {

	if (!obj || !appContext) { return undefined; }

	let sqlConnProfile: sqlops.IConnectionProfile;
	if ('type' in obj && obj.type === constants.ObjectExplorerService
		&& 'explorerContext' in obj && obj.explorerContext && obj.explorerContext.connectionProfile) {
		sqlConnProfile = obj.explorerContext.connectionProfile;
	} else if ('options' in obj) {
		sqlConnProfile = obj;
	}

	let sqlClusterConnection: SqlClusterConnection = undefined;
	if (sqlConnProfile) {
		sqlClusterConnection = findSqlClusterConnectionBySqlConnProfile(sqlConnProfile, appContext);
	}
	return sqlClusterConnection;
}

function findSqlClusterConnectionBySqlConnProfile(sqlConnProfile: sqlops.IConnectionProfile, appContext: AppContext): SqlClusterConnection {
	if (!sqlConnProfile || !appContext) { return undefined; }

	let sqlOeNodeProvider = appContext.getService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService);
	if (!sqlOeNodeProvider) { return undefined; }

	let sqlClusterSession = sqlOeNodeProvider.findSqlClusterSessionBySqlConnProfile(sqlConnProfile);
	if (!sqlClusterSession) { return undefined; }

	return  sqlClusterSession.sqlClusterConnection;
}

export async function getSqlClusterConnection(
	obj: sqlops.IConnectionProfile | sqlops.connection.Connection | ICommandObjectExplorerContext): Promise<ConnectionParam> {

	if (!obj) { return undefined; }

	let sqlClusterConnInfo: ConnectionParam = undefined;
	if ('providerName' in obj) {
		if (obj.providerName === constants.mssqlClusterProviderName) {
			sqlClusterConnInfo = 'id' in obj ? connProfileToConnectionParam(obj) : connToConnectionParam(obj);
		} else {
			sqlClusterConnInfo = await createSqlClusterConnInfo(obj);
		}
	} else {
		sqlClusterConnInfo = await createSqlClusterConnInfo(obj.explorerContext.connectionProfile);
	}

	return sqlClusterConnInfo;
}

async function createSqlClusterConnInfo(sqlConnInfo: sqlops.IConnectionProfile | sqlops.connection.Connection): Promise<ConnectionParam> {
	if (!sqlConnInfo) { return undefined; }

	let connectionId: string = 'id' in sqlConnInfo ? sqlConnInfo.id : sqlConnInfo.connectionId;
	if (!connectionId) { return undefined; }

	let serverInfo = await sqlops.connection.getServerInfo(connectionId);
	if (!serverInfo || !serverInfo.options) { return undefined; }

	let endpoints: IEndpoint[] = serverInfo.options[constants.clusterEndpointsProperty];
	if (!endpoints || endpoints.length === 0) { return undefined; }

	let index = endpoints.findIndex(ep => ep.serviceName === constants.hadoopKnoxEndpointName);
	if (index < 0) { return undefined; }

	let credentials = await sqlops.connection.getCredentials(connectionId);
	if (!credentials) { return undefined; }

	let clusterConnInfo = <ConnectionParam>{
		providerName: constants.mssqlClusterProviderName,
		connectionId: UUID.generateUuid(),
		options: {}
	};

	clusterConnInfo.options[constants.hostPropName] = endpoints[index].ipAddress;
	clusterConnInfo.options[constants.knoxPortPropName] = endpoints[index].port;
	clusterConnInfo.options[constants.userPropName] = 'root'; //should be the same user as sql master
	clusterConnInfo.options[constants.passwordPropName] = credentials.password;
	clusterConnInfo = connToConnectionParam(clusterConnInfo);

	return clusterConnInfo;
}

function connProfileToConnectionParam(connectionProfile: sqlops.IConnectionProfile): ConnectionParam {
	let result = Object.assign(connectionProfile, { connectionId: connectionProfile.id });
	return <ConnectionParam>result;
}

function connToConnectionParam(connection: sqlops.connection.Connection): ConnectionParam {
	let connectionId = connection.connectionId;
	let options = connection.options;
	let result = Object.assign(connection,
		{
			serverName: `${options[constants.hostPropName]},${options[constants.knoxPortPropName]}`,
			userName: options[constants.userPropName],
			password: options[constants.passwordPropName],
			id: connectionId,
		}
	);
	return <ConnectionParam>result;
}

interface IEndpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
}

class ConnectionParam implements sqlops.connection.Connection, sqlops.IConnectionProfile, sqlops.ConnectionInfo
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