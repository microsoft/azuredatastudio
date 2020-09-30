/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as bdc from 'bdc';
import * as vscode from 'vscode';
import * as constants from './constants';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { AppContext } from './appContext';
import { SqlClusterConnection } from './objectExplorerNodeProvider/connection';
import { ICommandObjectExplorerContext } from './objectExplorerNodeProvider/command';
import { getClusterEndpoints, getHostAndPortFromEndpoint } from './utils';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import CodeAdapter from './prompts/adapter';
import { IQuestion, QuestionTypes } from './prompts/question';
import * as nls from 'vscode-nls';
import { AuthType } from './util/auth';
const localize = nls.loadMessageBundle();

export async function findSqlClusterConnection(
	obj: ICommandObjectExplorerContext | azdata.IConnectionProfile,
	appContext: AppContext): Promise<SqlClusterConnection> {

	if (!obj || !appContext) { return undefined; }

	let sqlConnProfile: azdata.IConnectionProfile;
	if ('type' in obj && obj.type === constants.ObjectExplorerService
		&& 'explorerContext' in obj && obj.explorerContext && obj.explorerContext.connectionProfile) {
		sqlConnProfile = obj.explorerContext.connectionProfile;
	} else if ('options' in obj) {
		sqlConnProfile = obj;
	}

	let sqlClusterConnection: SqlClusterConnection = undefined;
	if (sqlConnProfile) {
		sqlClusterConnection = await findSqlClusterConnectionBySqlConnProfile(sqlConnProfile, appContext);
	}
	return sqlClusterConnection;
}

async function findSqlClusterConnectionBySqlConnProfile(sqlConnProfile: azdata.IConnectionProfile, appContext: AppContext): Promise<SqlClusterConnection> {
	if (!sqlConnProfile || !appContext) { return undefined; }

	let sqlOeNodeProvider = appContext.getService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService);
	if (!sqlOeNodeProvider) { return undefined; }

	let sqlClusterSession = sqlOeNodeProvider.findSqlClusterSessionBySqlConnProfile(sqlConnProfile);
	if (!sqlClusterSession) { return undefined; }

	return sqlClusterSession.getSqlClusterConnection();
}

export async function getSqlClusterConnectionParams(
	obj: azdata.IConnectionProfile | azdata.connection.Connection | ICommandObjectExplorerContext,
	appContext: AppContext): Promise<ConnectionParam> {

	if (!obj) { return undefined; }

	let sqlClusterConnInfo: ConnectionParam = undefined;
	if ('providerName' in obj) {
		if (obj.providerName === constants.mssqlClusterProviderName) {
			sqlClusterConnInfo = 'id' in obj ? connProfileToConnectionParam(obj) : connToConnectionParam(obj);
		} else {
			sqlClusterConnInfo = await createSqlClusterConnInfo(obj, appContext);
		}
	} else {
		sqlClusterConnInfo = await createSqlClusterConnInfo(obj.explorerContext.connectionProfile, appContext);
	}

	return sqlClusterConnInfo;
}

async function createSqlClusterConnInfo(sqlConnInfo: azdata.IConnectionProfile | azdata.connection.Connection, appContext: AppContext): Promise<ConnectionParam> {
	if (!sqlConnInfo) { return undefined; }

	let connectionId: string = 'id' in sqlConnInfo ? sqlConnInfo.id : sqlConnInfo.connectionId;
	if (!connectionId) { return undefined; }

	let serverInfo = await azdata.connection.getServerInfo(connectionId);
	if (!serverInfo || !serverInfo.options) { return undefined; }

	let endpoints: bdc.IEndpointModel[] = getClusterEndpoints(serverInfo);
	if (!endpoints || endpoints.length === 0) { return undefined; }

	let credentials = await azdata.connection.getCredentials(connectionId);
	if (!credentials) { return undefined; }

	let clusterConnInfo = <ConnectionParam>{
		providerName: constants.mssqlClusterProviderName,
		connectionId: UUID.generateUuid(),
		options: {}
	};

	let clusterController: bdc.IClusterController | undefined = undefined;
	let authType = clusterConnInfo.options[constants.authenticationTypePropName] = sqlConnInfo.options[constants.authenticationTypePropName];
	const controllerEndpoint = endpoints.find(ep => ep.name.toLowerCase() === 'controller');
	if (authType && authType.toLowerCase() !== constants.integratedAuth) {
		const usernameKey = `bdc.username::${connectionId}`;
		const savedUsername = appContext.extensionContext.globalState.get(usernameKey);
		const credentialProvider = await azdata.credentials.getProvider('mssql.bdc.password');
		const savedPassword = (await credentialProvider.readCredential(connectionId)).password;
		// If we don't have a previously saved username/password then use the SQL connection credentials as a best guess,
		// if those don't work then we'll prompt the user for the info
		clusterConnInfo.options[constants.userPropName] = savedUsername ?? sqlConnInfo.options[constants.userPropName];
		clusterConnInfo.options[constants.passwordPropName] = savedPassword ?? credentials.password;
		try {
			clusterController = await getClusterController(controllerEndpoint.endpoint, clusterConnInfo);
			// We've successfully connected so now store the username/password for future connections
			appContext.extensionContext.globalState.update(usernameKey, clusterConnInfo.options[constants.userPropName]);
			credentialProvider.saveCredential(connectionId, clusterConnInfo.options[constants.passwordPropName]);
			clusterConnInfo.options[constants.userPropName] = await clusterController.getKnoxUsername(clusterConnInfo.options[constants.userPropName]);
		} catch (err) {
			console.log(`Unexpected error getting Knox username for SQL Cluster connection: ${err}`);
			throw err;
		}
	} else {
		clusterController = await getClusterController(controllerEndpoint.endpoint, clusterConnInfo);
	}

	let hadoopEndpointIndex = endpoints.findIndex(ep => ep.name.toLowerCase() === constants.hadoopEndpointNameGateway.toLowerCase());
	if (hadoopEndpointIndex < 0) {
		endpoints = (await clusterController.getEndPoints()).endPoints;
		hadoopEndpointIndex = endpoints.findIndex(ep => ep.name.toLowerCase() === constants.hadoopEndpointNameGateway.toLowerCase());
	}
	const hostAndIp = getHostAndPortFromEndpoint(endpoints[hadoopEndpointIndex].endpoint);
	clusterConnInfo.options[constants.hostPropName] = hostAndIp.host;
	// TODO should we default the port? Or just ignore later?
	clusterConnInfo.options[constants.knoxPortPropName] = hostAndIp.port || constants.defaultKnoxPort;
	clusterConnInfo = connToConnectionParam(clusterConnInfo);

	return clusterConnInfo;
}

async function getClusterController(controllerEndpoint: string, connInfo: ConnectionParam): Promise<bdc.IClusterController | undefined> {
	const bdcApi = <bdc.IExtension>await vscode.extensions.getExtension(bdc.constants.extensionName).activate();
	let authType: bdc.AuthType = connInfo.options[constants.authenticationTypePropName] === AuthType.Integrated ? 'integrated' : 'basic';
	const controller = bdcApi.getClusterController(
		controllerEndpoint,
		authType,
		connInfo.options[constants.userPropName],
		connInfo.options[constants.passwordPropName]);
	try {
		await controller.getClusterConfig();
		return controller;
	} catch (err) {
		// Initial username/password failed so prompt user for username password until either user
		// cancels out or we successfully connect
		console.log(`Error connecting to cluster controller: ${err}`);
		let errorMessage = '';
		while (true) {
			const prompter = new CodeAdapter();
			let username = await prompter.promptSingle<string>(<IQuestion>{
				type: QuestionTypes.input,
				name: 'inputPrompt',
				message: localize('promptBDCUsername', "{0}Please provide the username to connect to the BDC Controller:", errorMessage),
				default: connInfo.options[constants.userPropName]
			});
			if (!username) {
				console.log(`User cancelled out of username prompt for BDC Controller`);
				break;
			}
			const password = await prompter.promptSingle<string>(<IQuestion>{
				type: QuestionTypes.password,
				name: 'passwordPrompt',
				message: localize('promptBDCPassword', "Please provide the password to connect to the BDC Controller"),
				default: ''
			});
			if (!password) {
				console.log(`User cancelled out of password prompt for BDC Controller`);
				break;
			}
			const controller = bdcApi.getClusterController(controllerEndpoint, authType, username, password);
			try {
				await controller.getClusterConfig();
				// Update our connection with the new info
				connInfo.options[constants.userPropName] = username;
				connInfo.options[constants.passwordPropName] = password;
				return controller;
			} catch (err) {
				errorMessage = localize('bdcConnectError', "Error: {0}. ", err.message ?? err);
			}
		}
		throw new Error(localize('usernameAndPasswordRequired', "Username and password are required"));
	}

}
function connProfileToConnectionParam(connectionProfile: azdata.IConnectionProfile): ConnectionParam {
	let result = Object.assign(connectionProfile, { connectionId: connectionProfile.id });
	return <ConnectionParam>result;
}

function connToConnectionParam(connection: azdata.connection.Connection): ConnectionParam {
	let connectionId = connection.connectionId;
	let options = connection.options;
	let result = Object.assign(connection,
		{
			serverName: `${options[constants.hostPropName]},${options[constants.knoxPortPropName]}`,
			userName: options[constants.userPropName],
			password: options[constants.passwordPropName],
			id: connectionId,
			authenticationType: options[constants.authenticationTypePropName]
		}
	);
	return <ConnectionParam>result;
}

class ConnectionParam implements azdata.connection.Connection, azdata.IConnectionProfile, azdata.ConnectionInfo {
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
	public azureAccount?: string;

	public providerName: string;
	public connectionId: string;

	public options: { [name: string]: any; };
}
