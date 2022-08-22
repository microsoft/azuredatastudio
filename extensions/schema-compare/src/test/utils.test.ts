/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as loc from '../localizedConstants';
import * as path from 'path';
import * as uuid from 'uuid';
import * as os from 'os';
import * as azdataTest from '@microsoft/azdata-test';

import { promises as fs } from 'fs';
import { getEndpointName, verifyConnectionAndGetOwnerUri, exists } from '../utils';
import { mockDacpacEndpoint, mockDatabaseEndpoint, mockFilePath, mockConnectionInfo, shouldThrowSpecificError, mockConnectionResult } from './testUtils';
import { createContext, TestContext } from './testContext';
import * as sinon from 'sinon';

let testContext: TestContext;

describe('utils: Tests to verify getEndpointName @DacFx@', function (): void {
	afterEach(() => {
		sinon.restore();
	});

	it('Should generate correct endpoint information', () => {
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		should(getEndpointName(endpointInfo)).equal(' ');
		should(getEndpointName(mockDacpacEndpoint)).equal(mockFilePath);
		should(getEndpointName(mockDatabaseEndpoint)).equal(' ');
	});

	it('Should get only database information from ConnectionInfo if connection', () => {
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');

		// set connection name and connection name should be used in endpoint name
		testDatabaseEndpoint.connectionName = 'My Connection';
		should(getEndpointName(testDatabaseEndpoint)).equal('My Connection.My Database');
	});

	it('Should get information from ConnectionInfo if no connection', () => {
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');
	});

	it('Should get correct endpoint information from SchemaCompareEndpointInfo', () => {
		const dbName = 'My Database';
		const serverName = 'My Server';
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.databaseName = dbName;
		testDatabaseEndpoint.serverName = serverName;
		should(getEndpointName(testDatabaseEndpoint)).equal('My Server.My Database');

		// set connection name and verify endpoint name uses connection name
		testDatabaseEndpoint.connectionName = 'My Connection';
		should(getEndpointName(testDatabaseEndpoint)).equal('My Connection.My Database');
	});
});

describe('utils: Basic tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(function (): void {
		testContext = createContext();
	});

	it('Should return undefined for endpoint as dacpac', async function (): Promise<void> {
		let ownerUri = undefined;
		ownerUri = await verifyConnectionAndGetOwnerUri(mockDacpacEndpoint, 'test');

		should(ownerUri).equal(undefined);
	});

	it('Should return undefined for endpoint as database and no ConnectionInfo', async function (): Promise<void> {
		let ownerUri = undefined;
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = undefined;

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test');

		should(ownerUri).equal(undefined);
	});
});

describe('utils: In-depth tests to verify verifyConnectionAndGetOwnerUri', function (): void {
	before(function (): void {
		testContext = createContext();
	});

	afterEach(() => {
		sinon.restore();
	});

	it('Should throw an error asking to make a connection', async function (): Promise<void> {
		const getConnectionsResults: azdata.connection.ConnectionProfile[] = [];
		const connection = { ...mockConnectionResult };
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };
		const getConnectionString = loc.getConnectionString('test');

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'getConnections').returns(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(vscode.window, 'showWarningMessage').callsFake((message) => {
			throw new Error(message);
		});

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test'), getConnectionString);
	});

	it('Should throw an error for login failure', async function (): Promise<void> {
		const connectionProfile = azdataTest.stubs.connectionProfile.createConnectionProfile({
			// these need to match what's in mockConnectionInfo in testUtils.ts
			options: {
				server: mockConnectionInfo.serverName,
				database: mockConnectionInfo.databaseName,
				user: mockConnectionInfo.userName,
				authenticationType: mockConnectionInfo.authenticationType
			}
		});
		const getConnectionsResults: azdata.connection.ConnectionProfile[] = [{ ...connectionProfile }];
		const connection = { ...mockConnectionResult };
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'getConnections').returns(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(loc.YesButtonText));
		sinon.stub(vscode.window, 'showErrorMessage').callsFake((message) => {
			throw new Error(message);
		});

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test'), connection.errorMessage);
	});

	it('Should throw an error for login failure with openConnectionDialog but no ownerUri', async function (): Promise<void> {
		const getConnectionsResults: azdata.connection.ConnectionProfile[] = [];
		const connection = { ...mockConnectionResult };
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(undefined));
		sinon.stub(azdata.connection, 'openConnectionDialog').returns(<any>Promise.resolve({
			connectionId: 'id'
		}));
		sinon.stub(azdata.connection, 'getConnections').returns(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(loc.YesButtonText));
		sinon.stub(vscode.window, 'showErrorMessage').callsFake((message) => {
			throw new Error(message);
		});

		await shouldThrowSpecificError(async () => await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test'), connection.errorMessage);
	});

	it('Should not throw an error and set ownerUri appropriately', async function (): Promise<void> {
		let ownerUri = undefined;
		const connection = { ...mockConnectionResult };
		const testDatabaseEndpoint: mssql.SchemaCompareEndpointInfo = { ...mockDatabaseEndpoint };
		const expectedOwnerUri: string = 'providerName:MSSQL|authenticationType:SqlLogin|database:My Database|server:My Server|user:My User|databaseDisplayName:My Database';
		testDatabaseEndpoint.connectionDetails = { ...mockConnectionInfo };

		sinon.stub(azdata.connection, 'connect').returns(<any>Promise.resolve(connection));
		sinon.stub(azdata.connection, 'getUriForConnection').returns(<any>Promise.resolve(expectedOwnerUri));

		ownerUri = await verifyConnectionAndGetOwnerUri(testDatabaseEndpoint, 'test');

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
