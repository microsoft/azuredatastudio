/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import { ApiWrapper } from '../../../common/apiWrapper';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, TestQueryProvider } from '../../utils.test';
import { FileConfigPage } from '../../../wizard/pages/fileConfigPage';
import * as should from 'should';
import { ImportPage } from '../../../wizard/api/importPage';
import * as constants from '../../../common/constants';

describe('File config page', function () {

	// declaring mock variables
	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;

	// declaring instance variables
	let fileConfigPage: FileConfigPage;
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();

	this.beforeEach(function () {
		// initializing mock variables
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), mockApiWrapper.object);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);

		// using the actual vscode and azdata apis.
		mockApiWrapper.callBase = true;

		// creating a wizard and adding page that will contain the fileConfigPage
		wizard = mockApiWrapper.object.createWizard(constants.wizardNameText);
		page = mockApiWrapper.object.createWizardPage(constants.page1NameText);
	});

	it('getSchema returns active schema first', async function () {

		// Creating a mock query provider that will return mock results for schema query
		let mockQueryProvider = TypeMoq.Mock.ofType(TestQueryProvider);

		// mock result for the schema query
		let schemaQueryResult: azdata.SimpleExecuteResult = {
			rowCount: 3,
			rows: [
				[
					{ displayValue: 'schema1', isNull: false, invariantCultureDisplayValue: 'schema1' }
				],
				[
					{ displayValue: 'schema2', isNull: false, invariantCultureDisplayValue: 'schema2' }
				],
				[
					{ displayValue: 'schema3', isNull: false, invariantCultureDisplayValue: 'schema3' }
				]
			],
			columnInfo: undefined
		};

		// setting the default schema for the current connection. This schema should be the first value in the dropdown array
		mockImportModel.object.schema = 'schema2';

		// expected schema values for the dropdown that will be created
		let expectedSchemaValues = [
			{ displayName: 'schema2', name: 'schema2' }, // This should be the first database as it is active in the extension.
			{ displayName: 'schema1', name: 'schema1' },
			{ displayName: 'schema3', name: 'schema3' }
		];

		// creating a mock connection
		mockImportModel.object.server = {
			providerName: 'MSSQL',
			connectionId: 'testConnectionId',
			options: {}
		};

		// setting up mocks to return test objects created earlier
		mockQueryProvider.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => { return schemaQueryResult; });
		mockApiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return mockQueryProvider.object; });

		// creating a fileConfig Page and calling getSchema Value
		let fileConfigPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny(), mockApiWrapper.object);
		let actualSchemaValues = await fileConfigPage.getSchemaValues();

		// verifying if the correct values were returned by the getSchema method.
		should(expectedSchemaValues).deepEqual(actualSchemaValues);
	});

	it('checking if all components are initialized properly', async function () {

		// Opening the wizard and initializing the page as FileConfigPage
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				fileConfigPage = new FileConfigPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), mockApiWrapper.object);
				pages.set(1, fileConfigPage);
				await fileConfigPage.start().then(() => {
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});

		// checking if all the required components are correctly initialized
		should.notEqual(fileConfigPage.serverDropdown, undefined);
		should.notEqual(fileConfigPage.databaseDropdown, undefined);
		should.notEqual(fileConfigPage.fileTextBox, undefined);
		should.notEqual(fileConfigPage.fileButton, undefined);
		should.notEqual(fileConfigPage.tableNameTextBox, undefined);
		should.notEqual(fileConfigPage.schemaDropdown, undefined);
		should.notEqual(fileConfigPage.form, undefined);
		should.notEqual(fileConfigPage.databaseLoader, undefined);
		should.notEqual(fileConfigPage.schemaLoader, undefined);

		// Calling the clean up code
		await fileConfigPage.onPageLeave();
		await fileConfigPage.cleanup();
	});

	it('Dropdown values are correctly set', async function () {

		// using the actual vscode and azdata apis.
		mockApiWrapper.callBase = true;

		// creating a wizard and adding page that will contain the fileConfigPage
		wizard = mockApiWrapper.object.createWizard(constants.wizardNameText);
		page = mockApiWrapper.object.createWizardPage(constants.page1NameText);

		// creating mock server values
		let testActiveConnections: azdata.connection.Connection[] = [
			{
				providerName: 'MSSQL',
				connectionId: 'testConnection1Id',
				options: {
					user: 'testcon1user',
					server: 'testcon1server',
					database: 'testdb1'
				}
			},
			{
				providerName: 'MSSQL',
				connectionId: 'testConnection2Id',
				options: {
					user: 'testcon2user',
					server: 'testcon2server',
					database: 'testdb2'
				}
			},
			{
				providerName: 'PGSQL',
				connectionId: 'testConnection3Id',
				options: {
					user: undefined, // setting it undefined to check if function return user as 'default
					server: 'testcon3server',
					database: 'testdb3'
				}
			}
		];
		mockApiWrapper.setup(x => x.getActiveConnections()).returns(async () => { return testActiveConnections; });

		// creating a test active connection. This connection will be the first value in server dropdown array
		let testServerConnection: azdata.connection.Connection = {
			providerName: 'MSSQL',
			connectionId: 'testConnection2Id',
			options: {
				// default database. This datatabe will be the first value in the database dropdown
				database: 'testdb2',
				user: 'testcon2user',
					server: 'testcon2server'
			}
		};
		mockImportModel.object.server = testServerConnection;
		mockImportModel.object.server.options = testServerConnection.options;

		// expected values for the server dropdown
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

		//  creating mock database values
		let databases: string[] = ['testdb1', 'testdb2', 'testdb3'];
		mockApiWrapper.setup(x => x.listDatabases(TypeMoq.It.isAnyString())).returns(async () => { return databases; });
		mockImportModel.object.database = 'testdb2';

		// expected values for the database dropdown
		let expectedDatabaseDropdownValues = [
			{
				displayName: 'testdb2',
				name: 'testdb2'
			},
			{
				displayName: 'testdb1',
				name: 'testdb1'
			},
			{
				displayName: 'testdb3',
				name: 'testdb3'
			}
		];

		// mock result for the schema query
		let schemaQueryResult: azdata.SimpleExecuteResult = {
			rowCount: 3,
			rows: [
				[
					{ displayValue: 'schema1', isNull: false, invariantCultureDisplayValue: 'schema1' }
				],
				[
					{ displayValue: 'schema2', isNull: false, invariantCultureDisplayValue: 'schema2' }
				],
				[
					{ displayValue: 'schema3', isNull: false, invariantCultureDisplayValue: 'schema3' }
				]
			],
			columnInfo: undefined
		};
		mockImportModel.object.schema = 'schema2';

		// expected values for the schema dropdown
		let expectedSchemaValues = [
			{ displayName: 'schema2', name: 'schema2' }, // This should be the first database as it is active in the extension.
			{ displayName: 'schema1', name: 'schema1' },
			{ displayName: 'schema3', name: 'schema3' }
		];

		// creating mock query provider to get test schemas
		let mockQueryProvider = TypeMoq.Mock.ofType(TestQueryProvider);
		mockApiWrapper.setup(x => x.getProvider(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return mockQueryProvider.object;});
		mockQueryProvider.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => { return schemaQueryResult; });

		// Opening the wizard and initializing the page as FileConfigPage
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				fileConfigPage = new FileConfigPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), mockApiWrapper.object);
				pages.set(1, fileConfigPage);
				await fileConfigPage.start().then(async () => {
					await fileConfigPage.setupNavigationValidator();
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});


		await fileConfigPage.onPageEnter();

		should.deepEqual(fileConfigPage.serverDropdown.value,expectedConnectionValues[0]);
		should.deepEqual(fileConfigPage.serverDropdown.values,expectedConnectionValues);
		should.deepEqual(fileConfigPage.databaseDropdown.value, expectedDatabaseDropdownValues[0]);
		should.deepEqual(fileConfigPage.databaseDropdown.values, expectedDatabaseDropdownValues);
		should.deepEqual(fileConfigPage.schemaDropdown.value, expectedSchemaValues[0]);
		should.deepEqual(fileConfigPage.schemaDropdown.values, expectedSchemaValues);
	});
});
