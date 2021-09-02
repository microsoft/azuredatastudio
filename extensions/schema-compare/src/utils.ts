/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import type * as azdataType from 'azdata'; // eslint-disable-line no-duplicate-imports
import * as vscode from 'vscode';
import * as mssql from '../../mssql';
import * as os from 'os';
import * as loc from './localizedConstants';
import { promises as fs } from 'fs';

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
	if (msg && msg.indexOf('Object reference not set to an instance of an object') !== -1) {
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
		if (!endpoint.databaseName && endpoint.connectionDetails) {
			endpoint.databaseName = endpoint.connectionDetails['databaseName'];
		}
		if (endpoint.connectionName && endpoint.databaseName) {
			return `${endpoint.connectionName}.${endpoint.databaseName}`;
		}
		if (endpoint.serverName && endpoint.databaseName) {
			return `${endpoint.serverName}.${endpoint.databaseName}`;
		} else {
			return ' ';
		}

	} else if (endpoint.endpointType === mssql.SchemaCompareEndpointType.Dacpac) {
		return endpoint.packageFilePath;

	} else {
		return endpoint.projectFilePath;
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

export async function verifyConnectionAndGetOwnerUri(endpoint: mssql.SchemaCompareEndpointInfo, caller: string): Promise<string | undefined> {
	let ownerUri = undefined;

	if (endpoint.endpointType === mssql.SchemaCompareEndpointType.Database && endpoint.connectionDetails) {
		let connectionProfile = await connectionInfoToConnectionProfile(endpoint.connectionDetails);
		let connection = await azdata.connection.connect(connectionProfile, false, false);

		if (connection) {
			ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);

			if (!ownerUri) {
				let connectionList = await azdata.connection.getConnections(true);

				let userConnection;
				userConnection = connectionList.find(connection =>
				(endpoint.connectionDetails['authenticationType'] === 'SqlLogin'
					&& endpoint.connectionDetails['serverName'] === connection.options.server
					&& endpoint.connectionDetails['userName'] === connection.options.user
					&& (endpoint.connectionDetails['databaseName'].toLowerCase() === connection.options.database.toLowerCase()
						|| connection.options.database.toLowerCase() === 'master')));

				if (userConnection === undefined) {
					const getConnectionString = loc.getConnectionString(caller);
					// need only yes button - since the modal dialog has a default cancel
					let result = await vscode.window.showWarningMessage(getConnectionString, { modal: true }, loc.YesButtonText);
					if (result === loc.YesButtonText) {
						userConnection = await azdata.connection.openConnectionDialog(undefined, connectionProfile);
					}
				}

				if (userConnection !== undefined) {
					ownerUri = await azdata.connection.getUriForConnection(userConnection.connectionId);
				}
			}
			if (!ownerUri && connection.errorMessage) {
				vscode.window.showErrorMessage(connection.errorMessage);
			}
		}
	}
	return ownerUri;
}

/**
 * Returns the folder open in Explorer if there is one, otherwise returns the home directory
 */
export function getRootPath(): string {
	return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : os.homedir();
}

export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

// Try to load the azdata API - but gracefully handle the failure in case we're running
// in a context where the API doesn't exist (such as VS Code)
let azdataApi: typeof azdataType | undefined = undefined;
try {
	azdataApi = require('azdata');
	if (!azdataApi?.version) {
		// webpacking makes the require return an empty object instead of throwing an error so make sure we clear the var
		azdataApi = undefined;
	}
} catch {
	// no-op
}

/**
 * Gets the azdata API if it's available in the context this extension is running in.
 * @returns The azdata API if it's available
 */
export function getAzdataApi(): typeof azdataType | undefined {
	return azdataApi;
}
