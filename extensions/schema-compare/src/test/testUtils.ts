/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as mssql from '../../../mssql';
import should = require('should');
import { AssertionError } from 'assert';

// Mock test data
export const mockConnectionProfile: azdata.IConnectionProfile = {
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
	connectionDetails: undefined
};

export const mockDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Database,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: '',
	connectionDetails: undefined
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
