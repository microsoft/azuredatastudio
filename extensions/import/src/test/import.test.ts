/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { FlatFileWizard } from '../wizard/flatFileWizard';
import { ImportDataModel } from '../wizard/api/models';
import { ApiWrapper } from '../common/apiWrapper';
import { FileConfigPage } from '../wizard/pages/fileConfigPage';
import * as should from 'should';

describe('import extension tests', function (): void {
	describe('import extension wizard pages', () => {

		let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
		let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
		let mockImportModel: TypeMoq.IMock<ImportDataModel>;

		this.beforeEach(() => {
			mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
			mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), mockApiWrapper.object);
			mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
		});

		it('BasePage- getDatabaseValue returns active database first', async () => {
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

		it('BasePage- getServerValue returns null on no active connection', async () => {

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

		it('BasePage- getServerValue return active server value first', async () => {
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

	describe('import extension flat file wizard', () => {
		it('FlatFileWizard opens connectionDialog when there are no active connections', async () => {
			let testConnection: azdata.connection.Connection = {
				providerName: 'MSSQL',
				connectionId: 'testConnectionId',
				options: {}
			};

			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);
			// There is no current connection.
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return undefined; });


			// openConnectionDialog returns a test connection
			mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(async () => { return testConnection; });

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			await testFlatFileWizard.getConnectionId();

			// openConnectionDialog will be called once
			mockApiWrapper.verify(x => x.openConnectionDialog(TypeMoq.It.isAny()), TypeMoq.Times.once());

		});

		it('FlatFileWizard- shows error message when an invalid connection is selected', async () => {
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);
			// The active connection doesn't have a valid Provider
			let testConnectionProfile: azdata.connection.ConnectionProfile = ImportTestUtils.getTestConnectionProfile();
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(testConnectionProfile); });
			mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(() => { return undefined; });

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			await testFlatFileWizard.getConnectionId();

			mockApiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

		});

		it('FlatFileWizard- shows error message when no connection is selected', async () => {
			let mockApiWrapper: TypeMoq.IMock<ApiWrapper> = TypeMoq.Mock.ofType(ApiWrapper);
			// The active connection doesn't have a valid Provider
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return undefined; });
			mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(() => { return undefined; });

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			await testFlatFileWizard.getConnectionId();

			mockApiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

		});
	});

});

export class ImportTestUtils {

	public static getTestServer(): azdata.connection.Connection {
		return {
			providerName: 'MSSQL',
			connectionId: 'testConnection2Id',
			options: {}
		};
	}

	public static getTestConnectionProfile(): azdata.connection.ConnectionProfile {
		return {
			providerId: 'InvalidProvider',
			databaseName: 'databaseName',
			serverName: 'testServerName',
			connectionId: 'testConnectionId',
			groupId: 'testGroupId',
			connectionName: 'testConnectionName',
			userName: 'testUserName',
			password: 'testPassword',
			authenticationType: 'testAuthenticationType',
			savePassword: true,
			saveProfile: true,
			groupFullName: 'testGroupFullName',
			options: {}
		} as azdata.connection.ConnectionProfile;
	}
}

export class TestImportDataModel implements ImportDataModel {
	server: azdata.connection.Connection;
	serverId: string;
	ownerUri: string;
	proseColumns: import("../wizard/api/models").ColumnMetadata[];
	proseDataPreview: string[][];
	database: string;
	table: string;
	schema: string;
	filePath: string;
	fileType: string;
}
