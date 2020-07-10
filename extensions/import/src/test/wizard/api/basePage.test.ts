/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import { ApiWrapper } from '../../../common/apiWrapper';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, ImportTestUtils } from '../../utils.test';
import { FileConfigPage } from '../../../wizard/pages/fileConfigPage';
import * as should from 'should';

describe('import extension wizard pages', function () {

	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;

	this.beforeEach(function () {
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), mockApiWrapper.object);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
	});

	it('getDatabaseValue returns active database first', async function () {
		// setting up the environment
		let databases: string[] = ['testdb1', 'testdb2', 'testdb3'];
		let activeDatabase: string = 'testdb2';

		// setting up mocks
		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny(), mockApiWrapper.object);
		mockApiWrapper.setup(x => x.listDatabases(TypeMoq.It.isAnyString())).returns(async () => { return databases; });
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

		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny(), mockApiWrapper.object);

		// mocking getActive connection to return null
		mockApiWrapper.setup(x => x.getActiveConnections()).returns(async () => { return undefined; });

		let serverValues = await importPage.getServerValues();

		should(serverValues).undefined();

		// mocking getActive connection returns empty array
		mockApiWrapper.setup(x => x.getActiveConnections()).returns(async () => { return [] as azdata.connection.Connection[]; });

		serverValues = await importPage.getServerValues();
		should(serverValues).undefined();
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

		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny(), mockApiWrapper.object);
		mockApiWrapper.setup(x => x.getActiveConnections()).returns(async () => { return testActiveConnections; });
		mockImportModel.object.server = ImportTestUtils.getTestServer();

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
