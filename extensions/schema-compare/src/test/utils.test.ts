/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as mssql from '../../../mssql';
import {getEndpointName, verifyConnectionAndGetOwnerUri } from '../utils';
import {mockDacpacEndpoint, mockDatabaseEndpoint, mockFilePath, mockConnectionInfo} from './testUtils';

describe('utils: Tests to verify getEndpointName', function (): void {
	it('Should generate correct endpoint information', async () => {
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		should(getEndpointName(endpointInfo)).equal(' ');
		should(getEndpointName(mockDacpacEndpoint)).equal(mockFilePath);
		should(getEndpointName(mockDatabaseEndpoint)).equal(' ');
	});

	it('Should get endpoint information from ConnectionInfo', async () => {
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = mockDatabaseEndpoint;
		testDatabaseEndpoint.connectionDetails = mockConnectionInfo;

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});

	it('Should get correct endpoint information from SchemaCompareEndpointInfo', async () => {
		let dbName = 'My Database';
		let serverName = 'My Server';
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = {...mockDatabaseEndpoint};
		testDatabaseEndpoint.databaseName = dbName;
		testDatabaseEndpoint.serverName = serverName;

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});
});

describe('utils: Tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	it('Should return undefined for endpoint as dacpac', async function (): Promise<void> {
		let ownerUri = undefined;
		ownerUri = await verifyConnectionAndGetOwnerUri(mockDacpacEndpoint, 'test');

		should(ownerUri).equal(undefined);
	});

	it('Should return undefined for endpoint as database and no ConnectionInfo', async function (): Promise<void> {
		let ownerUri = undefined;
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = {...mockDatabaseEndpoint};
		testDatabaseEndpoint.connectionDetails = undefined;

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test');

		should(ownerUri).equal(undefined);
	});
});
