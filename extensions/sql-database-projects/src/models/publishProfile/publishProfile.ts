/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as xmldom from 'xmldom';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as mssql from '../../../../mssql';
import * as vscodeMssql from 'vscode-mssql';
import * as vscode from 'vscode';

import { promises as fs } from 'fs';
import { SqlConnectionDataSource } from '../dataSources/sqlConnectionStringSource';

// only reading db name, connection string, and SQLCMD vars from profile for now
export interface PublishProfile {
	databaseName: string;
	serverName: string;
	connectionId: string;
	connection: string;
	sqlCmdVariables: Record<string, string>;
	options?: mssql.DeploymentOptions | vscodeMssql.DeploymentOptions;
}

export async function readPublishProfile(profileUri: vscode.Uri): Promise<PublishProfile> {
	try {
		const dacFxService = await utils.getDacFxService();
		const profile = await load(profileUri, dacFxService);
		return profile;
	} catch (e) {
		void vscode.window.showErrorMessage(constants.profileReadError(e));
		throw e;
	}
}

/**
 * parses the specified file to load publish settings
 */
export async function load(profileUri: vscode.Uri, dacfxService: utils.IDacFxService): Promise<PublishProfile> {
	const profileText = await fs.readFile(profileUri.fsPath);
	const profileXmlDoc = new xmldom.DOMParser().parseFromString(profileText.toString());

	// read target database name
	let targetDbName: string = '';
	let targetDatabaseNameCount = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName).length;
	if (targetDatabaseNameCount > 0) {
		// if there is more than one TargetDatabaseName nodes, SSDT uses the name in the last one so we'll do the same here
		targetDbName = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName)[targetDatabaseNameCount - 1].textContent;
	}

	const connectionInfo = await readConnectionString(profileXmlDoc);
	const optionsResult = await dacfxService.getOptionsFromProfile(profileUri.fsPath);

	// get all SQLCMD variables to include from the profile
	const sqlCmdVariables = utils.readSqlCmdVariables(profileXmlDoc);

	return {
		databaseName: targetDbName,
		serverName: connectionInfo.server,
		connectionId: connectionInfo.connectionId,
		connection: connectionInfo.connection,
		sqlCmdVariables: sqlCmdVariables,
		options: optionsResult.deploymentOptions
	};
}

async function readConnectionString(xmlDoc: any): Promise<{ connectionId: string, connection: string, server: string }> {
	let targetConnection: string = '';
	let connId: string = '';
	let server: string = '';

	if (xmlDoc.documentElement.getElementsByTagName(constants.targetConnectionString).length > 0) {
		const targetConnectionString = xmlDoc.documentElement.getElementsByTagName(constants.TargetConnectionString)[0].textContent;
		const dataSource = new SqlConnectionDataSource('', targetConnectionString);
		let username: string = '';
		const connectionProfile = dataSource.getConnectionProfile();

		try {
			const azdataApi = utils.getAzdataApi();
			if (dataSource.integratedSecurity) {
				if (azdataApi) {
					const connection = await utils.getAzdataApi()!.connection.connect(connectionProfile, false, false);
					connId = connection.connectionId;
				} else {
					// TODO@chgagnon - hook up VS Code MSSQL
				}
				server = dataSource.server;
				username = constants.defaultUser;
			}
			else {
				if (azdataApi) {
					const connection = await utils.getAzdataApi()!.connection.openConnectionDialog(undefined, connectionProfile);
					connId = connection.connectionId;
					server = connection.options['server'];
					username = connection.options['user'];
				} else {
					// TODO@chgagnon - hook up VS Code MSSQL
				}
			}

			targetConnection = `${server} (${username})`;
		} catch (err) {
			throw new Error(constants.unableToCreatePublishConnection(utils.getErrorMessage(err)));
		}
	}


	return {
		connectionId: connId,
		connection: targetConnection,
		server: server
	};
}
