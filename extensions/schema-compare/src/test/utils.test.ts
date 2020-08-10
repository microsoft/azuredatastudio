/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as mssql from '../../../mssql';
import * as loc from '../localizedConstants';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import * as uuid from 'uuid';
import * as os from 'os';
import { promises as fs } from 'fs';
import { getEndpointName, verifyConnectionAndGetOwnerUri, exists } from '../utils';
import { mockDacpacEndpoint, mockDatabaseEndpoint, mockFilePath, mockConnectionInfo, shouldThrowSpecificError, mockConnectionResult, mockConnectionProfile } from './testUtils';
import { createContext, TestContext } from './testContext';

let testContext: TestContext;

describe('utils: Tests to verify getEndpointName', function (): void {
	it('Should generate correct endpoint information', () => {
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		should(getEndpointName(endpointInfo)).equal(' ');
		should(getEndpointName(mockDacpacEndpoint)).equal(mockFilePath);
		should(getEndpointName(mockDatabaseEndpoint)).equal(' ');
	});

	it('Should get endpoint information from ConnectionInfo', () => {
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});

	it('Should get correct endpoint information from SchemaCompareEndpointInfo', () => {
		let dbName = 'My Database';
		let serverName = 'My Server';
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.databaseName = dbName;
		testDatabaseEndpoint.serverName = serverName;

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});
});

describe('utils: Basic tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(function (): void {
		testContext = createContext();
	});

	it('Should return undefined for endpoint as dacpac', async function (): Promise<void> {
		let ownerUri = undefined;
		ownerUri = await verifyConnectionAndGetOwnerUri(mockDacpacEndpoint, 'test', testContext.apiWrapper.object);

		should(ownerUri).equal(undefined);
	});

	it('Should return undefined for endpoint as database and no ConnectionInfo', async function (): Promise<void> {
		let ownerUri = undefined;
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = undefined;

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object);

		should(ownerUri).equal(undefined);
	});
});

describe('utils: In-depth tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(function (): void {
		testContext = createContext();
	});

	it('Should throw an error asking to make a connection', async function (): Promise<void> {
		let getConnectionsResults: azdata.connection.ConnectionProfile[] = [];
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };
		const getConnectionString = loc.getConnectionString('test');

		testContext.apiWrapper.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return Promise.resolve(connection); });
		testContext.apiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(undefined); });
		testContext.apiWrapper.setup(x => x.getConnections(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(getConnectionsResults); });
		testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object), getConnectionString);
	});

	it('Should throw an error for login failure', async function (): Promise<void> {
		let getConnectionsResults: azdata.connection.ConnectionProfile[] = [{ ...mockConnectionProfile }];
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		testContext.apiWrapper.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return Promise.resolve(connection); });
		testContext.apiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(undefined); });
		testContext.apiWrapper.setup(x => x.getConnections(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(getConnectionsResults); });
		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object), connection.errorMessage);
	});

	it('Should throw an error for login failure with openConnectionDialog but no ownerUri', async function (): Promise<void> {
		let getConnectionsResults: azdata.connection.ConnectionProfile[] = [];
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		testContext.apiWrapper.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return Promise.resolve(connection); });
		testContext.apiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(undefined); });
		testContext.apiWrapper.setup(x => x.getConnections(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(getConnectionsResults); });
		testContext.apiWrapper.setup(x => x.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return Promise.resolve(loc.YesButtonText); });
		testContext.apiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return Promise.resolve(undefined); });

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object), connection.errorMessage);
	});

	it('Should not throw an error and set ownerUri appropriately', async function (): Promise<void> {
		let ownerUri = undefined;
		let connection = { ...mockConnectionResult };
		let testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		let expectedOwnerUri: string = 'providerName:MSSQL|authenticationType:SqlLogin|database:My Database|server:My Server|user:My User|databaseDisplayName:My Database';
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		testContext.apiWrapper.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return Promise.resolve(connection); });
		testContext.apiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(expectedOwnerUri); });

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test', testContext.apiWrapper.object);

		should(ownerUri).equal(expectedOwnerUri);
	});
});

describe('utils: Test to verify exists method', () => {
	it('Should run as expected', async () => {
		const filename = path.join(os.tmpdir(), `SchemaCompareUtilsTest_${uuid.v4()}`);
		try {
			should(await exists(filename)).be.false();
			await fs.writeFile(filename, '');
			should(await exists(filename)).be.true();
		} finally {
			try {
				await fs.unlink(filename);
			} catch { /* no-op */ }
		}
	});
});
