/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as xmldom from 'xmldom';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';

import { promises as fs } from 'fs';
import { Uri } from 'vscode';
import { SqlConnectionDataSource } from '../dataSources/sqlConnectionStringSource';
import { ApiWrapper } from '../../common/apiWrapper';


// only reading db name, connection string, and SQLCMD vars from profile for now
export interface PublishProfile {
	databaseName: string;
	connectionId: string;
	connectionString: string;
	sqlCmdVariables: Record<string, string>;
}

/**
 * parses the specified file to load publish settings
 */
export async function load(profileUri: Uri, apiWrapper: ApiWrapper,): Promise<PublishProfile> {
	const profileText = await fs.readFile(profileUri.fsPath);
	const profileXmlDoc = new xmldom.DOMParser().parseFromString(profileText.toString());

	// read target database name
	let targetDbName: string = '';
	let targetDatabaseNameCount = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName).length;
	if (targetDatabaseNameCount > 0) {
		// if there is more than one TargetDatabaseName nodes, SSDT uses the name in the last one so we'll do the same here
		targetDbName = profileXmlDoc.documentElement.getElementsByTagName(constants.targetDatabaseName)[targetDatabaseNameCount - 1].textContent;
	}

	const connectionInfo = await readConnectionString(profileXmlDoc, apiWrapper);

	// get all SQLCMD variables to include from the profile
	const sqlCmdVariables = readSqlCmdVariables(profileXmlDoc);

	return {
		databaseName: targetDbName,
		connectionId: connectionInfo.connectionId,
		connectionString: connectionInfo.connectionString,
		sqlCmdVariables: sqlCmdVariables
	};
}

/**
 * Read SQLCMD variables from xmlDoc and return them
 * @param xmlDoc xml doc to read SQLCMD variables from. Format must be the same that sqlproj and publish profiles use
 */
export function readSqlCmdVariables(xmlDoc: any): Record<string, string> {
	let sqlCmdVariables: Record<string, string> = {};
	for (let i = 0; i < xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable).length; i++) {
		const sqlCmdVar = xmlDoc.documentElement.getElementsByTagName(constants.SqlCmdVariable)[i];
		const varName = sqlCmdVar.getAttribute(constants.Include);

		const varValue = sqlCmdVar.getElementsByTagName(constants.DefaultValue)[0].childNodes[0].nodeValue;
		sqlCmdVariables[varName] = varValue;
	}

	return sqlCmdVariables;
}

async function readConnectionString(xmlDoc: any, apiWrapper: ApiWrapper): Promise<{ connectionId: string, connectionString: string }> {
	let targetConnectionString: string = '';
	let connId: string = '';

	if (xmlDoc.documentElement.getElementsByTagName('TargetConnectionString').length > 0) {
		targetConnectionString = xmlDoc.documentElement.getElementsByTagName('TargetConnectionString')[0].textContent;
		const dataSource = new SqlConnectionDataSource('temp', targetConnectionString);
		const connectionProfile = dataSource.getConnectionProfile();

		try {
			if (dataSource.integratedSecurity) {
				connId = (await apiWrapper.connectionConnect(connectionProfile, false, false)).connectionId;
			}
			else {
				connId = (await apiWrapper.openConnectionDialog(undefined, connectionProfile)).connectionId;
			}
		} catch (err) {
			throw new Error(constants.unableToCreatePublishConnection(utils.getErrorMessage(err)));
		}
	}

	// mask password in connection string
	targetConnectionString = await apiWrapper.getConnectionString(connId, false);

	return {
		connectionId: connId,
		connectionString: targetConnectionString
	};
}
