/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, ImportTestUtils } from '../../utils.test';
import { FileConfigPage } from '../../../wizard/pages/fileConfigPage';
import * as should from 'should';
import * as sinon from 'sinon';

describe('Base page tests', function () {

	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;

	beforeEach(function () {
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny());
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('getDatabaseValue returns active database first', async function () {
		// setting up the environment
		let databases: string[] = ['testdb1', 'testdb2', 'testdb3'];
		let activeDatabase: string = 'testdb2';

		// setting up mocks
		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny());
		sinon.stub(azdata.connection, 'listDatabases').returns(Promise.resolve(databases));
		mockImportModel.object.server = {
			providerName: 'MSSQL',
			connectionId: 'testConnectionId',
			options: {}
		};
		mockImportModel.object.database = activeDatabase;

		// Creating assert variables
		let expectedDatabaseValues = [
			{ displayName: 'testdb2', name: 'testdb2' }, // This should be the first database as it is active in the extension.
			{ displayName: 'testdb1', name: 'testdb1' },
			{ displayName: 'testdb3', name: 'testdb3' }
		];

		let actualDatabaseValues = await importPage.getDatabaseValues();
		should(expectedDatabaseValues).deepEqual(actualDatabaseValues);
	});

	it('getServerValue returns null on no active connection', async function () {

		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny());

		// mocking getActive connection to return null
		let getActiveConnectionStub = sinon.stub(azdata.connection, 'getActiveConnections').returns(Promise.resolve(undefined));

		let serverValues = await importPage.getServerValues();

		// getServer should be undefined for null active connections
		should.equal(serverValues, undefined, 'getServer should be undefined for no active connections');

		// mocking getActive connection returns empty array
		getActiveConnectionStub.returns(Promise.resolve([] as azdata.connection.Connection[]));

		serverValues = await importPage.getServerValues();

		// getServer should be undefined for empty active connections
		should.equal(serverValues, undefined, 'getServer should be undefined for empty active conections');
	});

	it('getServerValue return active server value first', async function () {
		// settign up the enviornment
		let testActiveConnections: azdata.connection.Connection[] = [
			{
				providerName: 'MSSQL',
				connectionId: 'testConnection1Id',
				options: {
					user: 'testcon1user',
					server: 'testcon1server'
				}
			},
			{
				providerName: 'MSSQL',
				connectionId: 'testConnection2Id',
				options: {
					user: 'testcon2user',
					server: 'testcon2server'
				}
			},
			{
				providerName: 'PGSQL',
				connectionId: 'testConnection3Id',
				options: {
					user: null, // setting it null to check if function return user as 'default
					server: 'testcon3server'
				}
			}
		];

		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny());
		sinon.stub(azdata.connection, 'getActiveConnections').returns(Promise.resolve(testActiveConnections));
		mockImportModel.object.server = ImportTestUtils.getTestServer();

		// the second connection should be the first element in the array as it is active
		let expectedConnectionValues = [
			{
				connection: testActiveConnections[1],
				displayName: 'testcon2server (testcon2user)',
				name: 'testConnection2Id'
			},
			{
				connection: testActiveConnections[0],
				displayName: 'testcon1server (testcon1user)',
				name: 'testConnection1Id'
			},
			{
				connection: testActiveConnections[2],
				displayName: 'testcon3server (default)',
				name: 'testConnection3Id'
			}
		];
		let actualConnectionValues = await importPage.getServerValues();
		should(expectedConnectionValues).deepEqual(actualConnectionValues);

	});
});
