/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';
import should = require('should');
import { AssertionError } from 'assert';

// Mock test data
export const mockIConnectionProfile: azdata.IConnectionProfile = {
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	providerName: 'My Provider',
	saveProfile: true,
	id: 'My Id',
	options: null
};

export const mockConnectionProfile: azdata.connection.ConnectionProfile = {
	providerId: 'My Provider',
	connectionId: 'My Id',
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	saveProfile: true,
	options: {
		server: 'My Server',
		database: 'My Database',
		user: 'My User',
		password: 'My Pwd',
		authenticationType: 'SqlLogin'
	}
};

export const mockConnectionProfile2: azdata.connection.ConnectionProfile = {
	providerId: 'My Provider2',
	connectionId: 'My Id2',
	connectionName: 'My Connection2',
	serverName: 'My Server2',
	databaseName: 'My Database2',
	userName: 'My User2',
	password: 'My Pwd2',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName2',
	groupId: 'My GroupId2',
	saveProfile: true,
	options: {
		server: 'My Server2',
		database: 'My Database2',
		user: 'My User2',
		password: 'My Pwd2',
		authenticationType: 'SqlLogin'
	}
};

export const mockConnectionResult: azdata.ConnectionResult = {
	connected: false,
	connectionId: undefined,
	errorMessage: 'Login failed for user \'sa\'',
	errorCode: 18456
};

export const mockConnectionInfo = {
	options: {},
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin'
};

export const mockFilePath: string = 'test.dacpac';

export const mockDacpacEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Dacpac,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: mockFilePath,
	connectionDetails: undefined,
	projectFilePath: '',
	folderStructure: '',
	targetScripts: [],
	dataSchemaProvider: '',
};

export const mockDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Database,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: '',
	connectionDetails: undefined,
	projectFilePath: '',
	folderStructure: '',
	targetScripts: [],
	dataSchemaProvider: '',
};

export async function shouldThrowSpecificError(block: Function, expectedMessage: string, details?: string) {
	let succeeded = false;
	try {
		await block();
		succeeded = true;
	}
	catch (err) {
		should(err.message).equal(expectedMessage);
	}

	if (succeeded) {
		throw new AssertionError({ message: `Operation succeeded, but expected failure with exception: "${expectedMessage}".${details ? '  ' + details : ''}` });
	}
}

export function setDacpacEndpointInfo(path: string): mssql.SchemaCompareEndpointInfo {
	let endpointInfo: mssql.SchemaCompareEndpointInfo;

	endpointInfo = { ...mockDacpacEndpoint };
	endpointInfo.packageFilePath = path;

	return endpointInfo;
}

export function setDatabaseEndpointInfo(): mssql.SchemaCompareEndpointInfo {
	let endpointInfo: mssql.SchemaCompareEndpointInfo;
	const serverName = 'My Server';
	const dbName = 'My Database';
	const serverDisplayName = 'My Connection';

	endpointInfo = { ...mockDatabaseEndpoint };
	endpointInfo.databaseName = dbName;
	endpointInfo.serverDisplayName = serverDisplayName;
	endpointInfo.serverName = serverName;

	return endpointInfo;
}
