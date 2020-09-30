/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as xmldom from 'xmldom';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import * as mssql from '../../../../mssql';

import { promises as fs } from 'fs';
import { Uri } from 'vscode';
import { SqlConnectionDataSource } from '../dataSources/sqlConnectionStringSource';

// only reading db name, connection string, and SQLCMD vars from profile for now
export interface PublishProfile {
	databaseName: string;
	connectionId: string;
	connection: string;
	sqlCmdVariables: Record<string, string>;
	options?: mssql.DeploymentOptions;
}

/**
 * parses the specified file to load publish settings
 */
export async function load(profileUri: Uri, dacfxService: mssql.IDacFxService): Promise<PublishProfile> {
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
		connectionId: connectionInfo.connectionId,
		connection: connectionInfo.connection,
		sqlCmdVariables: sqlCmdVariables,
		options: optionsResult.deploymentOptions
	};
}

async function readConnectionString(xmlDoc: any): Promise<{ connectionId: string, connection: string }> {
	let targetConnection: string = '';
	let connId: string = '';

	if (xmlDoc.documentElement.getElementsByTagName(constants.targetConnectionString).length > 0) {
		const targetConnectionString = xmlDoc.documentElement.getElementsByTagName(constants.TargetConnectionString)[0].textContent;
		const dataSource = new SqlConnectionDataSource('', targetConnectionString);
		let server: string = '';
		let username: string = '';
		const connectionProfile = dataSource.getConnectionProfile();

		try {
			if (dataSource.integratedSecurity) {
				const connection = await azdata.connection.connect(connectionProfile, false, false);
				connId = connection.connectionId;
				server = dataSource.server;
				username = constants.defaultUser;
			}
			else {
				const connection = await azdata.connection.openConnectionDialog(undefined, connectionProfile);
				connId = connection.connectionId;
				server = connection.options['server'];
				username = connection.options['user'];
			}

			targetConnection = `${server} (${username})`;
		} catch (err) {
			throw new Error(constants.unableToCreatePublishConnection(utils.getErrorMessage(err)));
		}
	}


	return {
		connectionId: connId,
		connection: targetConnection
	};
}
