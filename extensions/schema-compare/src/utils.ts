/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../mssql';

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: any): IPackageInfo {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
}

/**
 * Map an error message into a short name for the type of error.
 * @param msg The error message to map
 */
export function getTelemetryErrorType(msg: string): string {
	if (msg.indexOf('Object reference not set to an instance of an object') !== -1) {
		return 'ObjectReferenceNotSet';
	}
	else {
		return 'Other';
	}
}

/**
 * Return the appropriate endpoint name depending on if the endpoint is a dacpac or a database
 * @param endpoint endpoint to get the name of
 */
export function getEndpointName(endpoint: mssql.SchemaCompareEndpointInfo): string {
	if (!endpoint) {
		return ' ';
	}

	if (endpoint.endpointType === mssql.SchemaCompareEndpointType.Database) {
		if (!endpoint.serverName && endpoint.connectionDetails) {
			endpoint.serverName = endpoint.connectionDetails['serverName'];
		}
		return `${endpoint.serverName}.${endpoint.databaseName}`;
	} else {
		return endpoint.packageFilePath;
	}
}

function connectionInfoToConnectionProfile(details: azdata.ConnectionInfo): azdata.IConnectionProfile {
	return {
		serverName: details['serverName'],
		databaseName: details['databaseName'],
		authenticationType: details['authenticationType'],
		providerName: 'MSSQL',
		connectionName: '',
		userName: details['userName'],
		password: details['password'],
		savePassword: false,
		groupFullName: undefined,
		saveProfile: true,
		id: undefined,
		groupId: undefined,
		options: details['options']
	};
}

export async function verifyConnectionAndGetOwnerUri(endpoint: mssql.SchemaCompareEndpointInfo): Promise<string> {
	if (endpoint.endpointType === mssql.SchemaCompareEndpointType.Database && endpoint.connectionDetails) {
		let connection = await azdata.connection.connect(connectionInfoToConnectionProfile(endpoint.connectionDetails), false, false);

		// show error message if the can't connect to the database
		if (connection.errorMessage) {
			vscode.window.showErrorMessage(connection.errorMessage);
		}
		return await azdata.connection.getUriForConnection(connection.connectionId);
	}
	return undefined;
}
