/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { FlatFileWizard } from '../wizard/flatFileWizard';
import { ImportDataModel } from '../wizard/api/models';
import { ApiWrapper } from '../common/apiWrapper';
import { FileConfigPage } from '../wizard/pages/fileConfigPage';
import * as should from 'should';
import { ensure } from '../services/serviceUtils';
import MainController from '../controllers/mainController';

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

		it('FileConfigPage - get schema returns active schema first', async () => {
			mockApiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny()));
			let mockQueryProvider = TypeMoq.Mock.ofType(TestQueryProvider);
			let schemaQueryResult: azdata.SimpleExecuteResult = {
				rowCount: 3,
				rows: [
					[
						{displayValue: 'schema1', isNull: false, invariantCultureDisplayValue:'schema1'}
					],
					[
						{displayValue: 'schema2', isNull: false, invariantCultureDisplayValue:'schema2'}
					],
					[
						{displayValue: 'schema3', isNull: false, invariantCultureDisplayValue:'schema3'}
					]
				],
				columnInfo: undefined
			}

			let expectedSchemaValues = [
				{ displayName: 'schema2', name: 'schema2' }, // This should be the first database as it is active in the extension.
				{ displayName: 'schema1', name: 'schema1' },
				{ displayName: 'schema3', name: 'schema3' }
			];

			mockImportModel.object.schema = 'schema2';
			mockImportModel.object.server = {
				providerName: 'MSSQL',
				connectionId: 'testConnectionId',
				options: {}
			};
			mockQueryProvider.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => {return schemaQueryResult});
			mockApiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return mockQueryProvider.object; });

			let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny(), mockApiWrapper.object);
			let actualSchemaValues = await importPage.getSchemaValues();

			should(expectedSchemaValues).deepEqual(actualSchemaValues);
		});
	});

	describe('import extension flat file wizard', () => {
		let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
		this.beforeEach(() => {
			mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		});
		it('FlatFileWizard opens connectionDialog when there are no active connections', async () => {
			let testConnection: azdata.connection.Connection = {
				providerName: 'MSSQL',
				connectionId: 'testConnectionId',
				options: {}
			};

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
			// The active connection doesn't have a valid Provider
			let testConnectionProfile: azdata.connection.ConnectionProfile = ImportTestUtils.getTestConnectionProfile();
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(testConnectionProfile); });
			mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(() => { return undefined; });

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			await testFlatFileWizard.getConnectionId();

			mockApiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

		});

		it('FlatFileWizard- shows error message when no connection is selected', async () => {
			// The active connection doesn't have a valid Provider
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return undefined; });
			mockApiWrapper.setup(x => x.openConnectionDialog(TypeMoq.It.isAny())).returns(() => { return undefined; });

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			await testFlatFileWizard.getConnectionId();

			mockApiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());

		});

		it('FlatFileWizard- getConnection returns active connection', async () => {
			let testConnectionProfile = ImportTestUtils.getTestConnectionProfile();
			testConnectionProfile.providerId = 'MSSQL';
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(async () => { return testConnectionProfile; })

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			let connectionId = await testFlatFileWizard.getConnectionId();

			should(connectionId).equals(testConnectionProfile.connectionId);
		});

		it('FlatFileWizard- should initialize all pages', async () => {
			let testConnectionProfile = ImportTestUtils.getTestConnectionProfile();
			testConnectionProfile.providerId = 'MSSQL';
			mockApiWrapper.setup(x => x.getCurrentConnection()).returns(async () => { return testConnectionProfile; })
			let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
			let mockWizard = TypeMoq.Mock.ofType(TestWizard);
			let mockWizardPage = TypeMoq.Mock.ofType(TestWizardPage);
			let mockButton = TypeMoq.Mock.ofType(TestButton, TypeMoq.MockBehavior.Loose, undefined, onClick);

			let testProvider = {
				providerId: 'testProviderId',
				connectionProfile: ImportTestUtils.getTestConnectionProfile()
			};


			mockApiWrapper.setup(x => x.createWizard(TypeMoq.It.isAnyString())).returns(() => { return mockWizard.object; });
			mockApiWrapper.setup(x => x.createWizardPage(TypeMoq.It.isAnyString())).returns(() => { return mockWizardPage.object; });
			mockApiWrapper.setup(x => x.createButton(TypeMoq.It.isAnyString())).returns(() => { return mockButton.object; });

			let testFlatFileWizard = new FlatFileWizard(TypeMoq.It.isAny(), mockApiWrapper.object);

			await testFlatFileWizard.start(testProvider);

			should.notEqual(testFlatFileWizard.wizard, undefined);
			should.notEqual(testFlatFileWizard.page1, undefined);
			should.notEqual(testFlatFileWizard.page2, undefined);
			should.notEqual(testFlatFileWizard.page3, undefined);
			should.notEqual(testFlatFileWizard.page4, undefined);

			let expectedPages = [
				testFlatFileWizard.page1,
				testFlatFileWizard.page2,
				testFlatFileWizard.page3,
				testFlatFileWizard.page4
			];
			should.deepEqual(testFlatFileWizard.wizard.pages, expectedPages);

		});

	});

	describe('Service utitlities test', () => {
		it('ensure returns null if property not found ', () => {
			// ensure will return an empty object when key is not found
			should(ensure({ 'testkey1': 'testval' }, 'testkey')).deepEqual({});
		});
		it('ensure returns property value if it is present in targer', () => {
			// when property is present it will return the value
			should(ensure({ 'testkey': 'testval' }, 'testkey')).equal('testval');
		});
	});

	describe('Main Controller', () => {
		let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
		let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
		//let testController: MainController;

		this.beforeEach(() => {
			mockExtensionContext = TypeMoq.Mock.ofType(TestExtensionContext, TypeMoq.MockBehavior.Loose);
			mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		});

		it('Should create new instance successfully', async () => {
			// mocking createOutputChannel in API wrapper
			mockApiWrapper.setup(x => x.createOutputChannel(TypeMoq.It.isAny()));

			// creating a Main Controller
			new MainController(mockExtensionContext.object, mockApiWrapper.object);

			// verifying if the output channel is created
			mockApiWrapper.verify(x => x.createOutputChannel(TypeMoq.It.isAny()), TypeMoq.Times.once());
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

class TestQueryProvider implements azdata.QueryProvider {
	cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult> {
		throw new Error('Method not implemented.');
	}
	runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	runQueryString(ownerUri: string, queryString: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> {
		throw new Error('Method not implemented.');
	}
	parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> {
		throw new Error('Method not implemented.');
	}
	getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> {
		throw new Error('Method not implemented.');
	}
	disposeQuery(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> {
		throw new Error('Method not implemented.');
	}
	setQueryExecutionOptions(ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	registerOnQueryComplete(handler: (result: azdata.QueryExecuteCompleteNotificationResult) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnBatchStart(handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnBatchComplete(handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnResultSetAvailable(handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnResultSetUpdated(handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnMessage(handler: (message: azdata.QueryExecuteMessageParams) => any): void {
		throw new Error('Method not implemented.');
	}
	commitEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		throw new Error('Method not implemented.');
	}
	deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	disposeEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		throw new Error('Method not implemented.');
	}
	revertRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		throw new Error('Method not implemented.');
	}
	getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> {
		throw new Error('Method not implemented.');
	}
	registerOnEditSessionReady(handler: (ownerUri: string, success: boolean, message: string) => any): void {
		throw new Error('Method not implemented.');
	}
	handle?: number;
	providerId: string;

}

class TestWizard implements azdata.window.Wizard {
	title: string;
	pages: azdata.window.WizardPage[];
	currentPage: number;
	doneButton: azdata.window.Button;
	cancelButton: azdata.window.Button;
	generateScriptButton: azdata.window.Button = azdata.window.createButton('testButton');
	nextButton: azdata.window.Button;
	backButton: azdata.window.Button;
	customButtons: azdata.window.Button[];
	displayPageTitles: boolean;
	onPageChanged: vscode.Event<azdata.window.WizardPageChangeInfo> = new vscode.EventEmitter<any>().event;
	addPage(page: azdata.window.WizardPage, index?: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	removePage(index: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	setCurrentPage(index: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	open(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	close(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>): void {
		throw new Error('Method not implemented.');
	}
	message: azdata.window.DialogMessage;
	registerOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		throw new Error('Method not implemented.');
	}

}

class TestWizardPage implements azdata.window.WizardPage {
	title: string;
	content: string;
	customButtons: azdata.window.Button[];
	enabled: boolean;
	description: string;
	registerContent(handler: (view: azdata.ModelView) => Thenable<void>): void {
		throw new Error('Method not implemented.');
	}
	modelView: azdata.ModelView;
	valid: boolean;
	onValidityChanged: vscode.Event<boolean>;

}

class TestButton implements azdata.window.Button {
	label: string;
	enabled: boolean;
	hidden: boolean;
	focused?: boolean;
	constructor(private onClickEmitter: vscode.EventEmitter<void>) {
	}
	onClick: vscode.Event<void> = this.onClickEmitter.event;
	position?: azdata.window.DialogButtonPosition;
}

class TestExtensionContext implements vscode.ExtensionContext {
	subscriptions: { dispose(): any; }[];
	workspaceState: vscode.Memento;
	globalState: vscode.Memento;
	extensionUri: vscode.Uri;
	extensionPath: string;
	environmentVariableCollection: vscode.EnvironmentVariableCollection;
	asAbsolutePath(relativePath: string): string {
		throw new Error('Method not implemented.');
	}
	storagePath: string;
	globalStoragePath: string;
	logPath: string;
}

export class TestImportDataModel implements ImportDataModel {
	server: azdata.connection.Connection;
	serverId: string;
	ownerUri: string;
	proseColumns: import('../wizard/api/models').ColumnMetadata[];
	proseDataPreview: string[][];
	database: string;
	table: string;
	schema: string;
	filePath: string;
	fileType: string;
}
