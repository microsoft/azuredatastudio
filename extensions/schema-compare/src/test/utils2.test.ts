/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as TypeMoq from 'typemoq';
import * as testUtils from './testUtils';
import * as mssql from '../../../mssql/src/mssql';
import * as loc from '../localizedConstants';
import {getEndpointName, verifyConnectionAndGetOwnerUri } from '../utils';
import { createContext, TestContext } from './testContext';

// Mock test data
const mockConnectionProfile: azdata.IConnectionProfile = {
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

let mockConnectionInfo = {
	options: {},
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin'
};

const mockFilePath: string = 'test.dacpac';

let mockDacpacEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Dacpac,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: mockFilePath,
	connectionDetails: undefined
};

let mockDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = {
	endpointType: mssql.SchemaCompareEndpointType.Database,
	serverDisplayName: '',
	serverName: '',
	databaseName: '',
	ownerUri: '',
	packageFilePath: '',
	connectionDetails: undefined
};

let testContext: TestContext;

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
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = mockDatabaseEndpoint;
		testDatabaseEndpoint = mockDatabaseEndpoint;
		testDatabaseEndpoint.databaseName = dbName;
		testDatabaseEndpoint.serverName = serverName;

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});
});

describe('utils: Tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(async function (): Promise<void> {
		testContext = createContext();
	});

	it('Should return undefined for endpoint as dacpac', async function (): Promise<void> {
		let ownerUri = undefined;
		ownerUri = await verifyConnectionAndGetOwnerUri(mockDacpacEndpoint, 'test', testContext.apiWrapper.object);

		should(ownerUri).equal(undefined);
	});

	it('Should return undefined for endpoint as database and no ConnectionInfo', async function (): Promise<void> {
		let ownerUri = undefined;
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = mockDatabaseEndpoint;
		testDatabaseEndpoint.connectionDetails = undefined;

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object);

		should(ownerUri).equal(undefined);
	});

	it('Should throw an error for making a connection', async function (): Promise<void> {
		//testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });
		//testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(loc.YesButtonText));
		let ownerUri = undefined;
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = mockDatabaseEndpoint;
		testDatabaseEndpoint.connectionDetails = mockConnectionInfo;
		const getConnectionString = loc.getConnectionString('test');

		await testUtils.shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object), getConnectionString);
	});
});
