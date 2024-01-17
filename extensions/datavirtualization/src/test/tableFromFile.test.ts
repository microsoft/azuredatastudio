/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as should from 'should';
import * as path from 'path';
import * as azdata from 'azdata';
import { VirtualizeDataMockEnv, MockDataSourceService, MockInputBoxComponent, MockDropdownComponent, MockTextComponent, MockLoadingComponent, MockDeclarativeTableComponent, MockTableComponent, MockConnectionProfile, MockButtonComponent } from './stubs';
import { TableFromFileWizard } from '../wizards/tableFromFile/tableFromFileWizard';
import { ImportDataModel } from '../wizards/tableFromFile/api/models';
import { FileConfigPage, FileConfigPageUiElements } from '../wizards/tableFromFile/pages/fileConfigPage';
import { ProsePreviewPage, ProsePreviewPageUiElements } from '../wizards/tableFromFile/pages/prosePreviewPage';
import { ModifyColumnsPage, ModifyColumnsPageUiElements } from '../wizards/tableFromFile/pages/modifyColumnsPage';
import { SummaryPage, SummaryPageUiElements } from '../wizards/tableFromFile/pages/summaryPage';
import { FileNode } from '../hdfsProvider';
import { DataSourceInstance } from '../services/contracts';
import { stripUrlPathSlashes } from '../utils';
import { DataSourceType, delimitedTextFileType } from '../constants';

describe('Table From File Wizard:', function () {
	let env = new VirtualizeDataMockEnv();
	let appContext = env.getMockedAppContext();
	let service = new MockDataSourceService();

	let mockWizard = TypeMoq.Mock.ofType(TableFromFileWizard, undefined, undefined, appContext, service);

	describe('File Config Page Tests', function () {
		let mockPage = env.getMockedWizardPage();
		let model = <ImportDataModel>{};

		let mockService = TypeMoq.Mock.ofType(MockDataSourceService);
		let page = new FileConfigPage(mockWizard.object, mockPage, model, undefined, mockService.object);
		let ui: FileConfigPageUiElements = {
			fileTextBox: new MockTextComponent(),
			serverTextBox: new MockTextComponent(),
			databaseDropdown: new MockDropdownComponent(),
			dataSourceDropdown: new MockDropdownComponent(),
			tableNameTextBox: new MockInputBoxComponent(),
			schemaDropdown: new MockDropdownComponent(),
			databaseLoader: new MockLoadingComponent(),
			dataSourceLoader: new MockLoadingComponent(),
			schemaLoader: new MockLoadingComponent(),
			fileFormatNameTextBox: new MockInputBoxComponent(),
			refreshButton: new MockButtonComponent()
		};
		page.setUi(ui);

		model.allDatabases = ['TestDb'];
		model.serverConn = new MockConnectionProfile();

		mockService.setup(s => s.createDataSourceWizardSession(TypeMoq.It.isAny())).returns(() => service.createDataSourceWizardSession(undefined));
		mockService.setup(s => s.getDatabaseInfo(TypeMoq.It.isAny())).returns(() => service.getDatabaseInfo(undefined));

		let onPageEnterTest = async function (tableName: string) {
			(<any>page).pageSetupComplete = false;
			await page.onPageEnter();

			should(ui.fileTextBox.value).be.equal(model.parentFile.filePath);
			should(ui.serverTextBox.value).be.equal(model.serverConn.serverName);
			should(ui.databaseDropdown.value).be.equal('TestDb');
			should(ui.dataSourceDropdown.value).be.equal('TestSource');
			should(ui.tableNameTextBox.value).be.equal(tableName);
			should(ui.schemaDropdown.value).be.equal('TestSchema');
			should(ui.fileFormatNameTextBox.value).be.equal(`FileFormat_${tableName}`);

			should(ui.databaseLoader.loading).be.false();
			should(ui.databaseDropdown.enabled).be.true();

			should(ui.dataSourceLoader.loading).be.false();
			should(ui.schemaLoader.loading).be.false();
			should(ui.refreshButton.enabled).be.true();

			should(model.sessionId).be.equal('TestSessionId');
			should(model.allDatabases.length).be.equal(1);
			should(model.allDatabases[0]).be.equal('TestDb');
			should(model.fileType).be.equal('TXT');
			should(model.database).be.equal('TestDb');
			should(model.existingDataSource).be.equal('TestSource');
			should(model.table).be.equal(tableName);
			should(model.existingSchema).be.equal('TestSchema');
			should(model.newSchema).be.undefined();
			should(model.fileFormat).be.equal(`FileFormat_${tableName}`);
		};

		let mockFileNode = TypeMoq.Mock.ofType(FileNode);
		model.proseParsingFile = mockFileNode.object;

		it('OnPageEnter Test', async function () {
			// With file
			let tableName = 'TestFile';
			model.parentFile = {
				isFolder: false,
				filePath: path.join('BaseDir', 'AnotherDir', `${tableName}.csv`)
			};
			mockFileNode.setup(node => node.hdfsPath).returns(() => model.parentFile.filePath);
			await onPageEnterTest(tableName);

			// With existing session
			model.sessionId = 'OldTestId';
			model.allDatabases = ['OldTestDb1', 'OldTestDb2'];
			mockService.setup(s => s.disposeWizardSession(TypeMoq.It.isAny())).returns(() => Promise.resolve(true));
			await onPageEnterTest(tableName);
			mockService.verify(s => s.disposeWizardSession(TypeMoq.It.isAny()), TypeMoq.Times.once());

			// With folder
			tableName = 'CsvTest';
			model.parentFile = {
				isFolder: true,
				filePath: path.join('BaseDir', 'AnotherDir', tableName)
			};
			mockFileNode.setup(node => node.hdfsPath).returns(() => path.join(model.parentFile.filePath, 'TestFile.csv'));
			await onPageEnterTest(tableName);
		});

		it('OnPageLeave Test', async function () {
			model.existingDataSource = undefined;
			(await page.onPageLeave(true)).should.be.false();

			model.existingDataSource = '';
			(await page.onPageLeave(true)).should.be.false();

			model.existingDataSource = 'TestSource';
			model.existingSchema = undefined;
			(await page.onPageLeave(true)).should.be.false();

			model.existingSchema = '';
			(await page.onPageLeave(true)).should.be.false();

			model.existingSchema = 'TestSchema';
			(await page.onPageLeave(true)).should.be.true();

			model.existingSchema = undefined;
			model.newSchema = 'NewTestSchema';
			(await page.onPageLeave(true)).should.be.true();

			model.fileFormat = 'TestExternalFileFormat';
			(await page.onPageLeave(true)).should.be.false();

			model.fileFormat = 'NotAnExistingFileFormat';
			(await page.onPageLeave(true)).should.be.true();

			// Existing table, but using new schema
			model.table = 'TestExternalTable';
			(await page.onPageLeave(true)).should.be.true();

			model.existingSchema = 'TestSchema';
			model.newSchema = undefined;
			model.table = 'TestExternalTable';
			(await page.onPageLeave(true)).should.be.false();

			model.table = 'NotAnExistingFileTable';
			(await page.onPageLeave(true)).should.be.true();

			ui.databaseLoader.loading = true;
			(await page.onPageLeave(false)).should.be.false();

			ui.databaseLoader.loading = false;
			ui.dataSourceLoader.loading = true;
			(await page.onPageLeave(false)).should.be.false();

			ui.dataSourceLoader.loading = false;
			ui.schemaLoader.loading = true;
			(await page.onPageLeave(false)).should.be.false();

			ui.schemaLoader.loading = false;
			(await page.onPageLeave(false)).should.be.true();
		});

		it('Data Sources Test', async function () {
			let dbInfo = await service.getDatabaseInfo(undefined);
			let sessionInfo = await service.createDataSourceWizardSession(undefined);
			model.parentFile = {
				isFolder: false,
				filePath: path.join('BaseDir', 'AnotherDir', 'TestFile.csv')
			};
			let setupMocks = () => {
				mockService.setup(s => s.getDatabaseInfo(TypeMoq.It.isAny())).returns(() => Promise.resolve(dbInfo));
				mockService.setup(s => s.createDataSourceWizardSession(TypeMoq.It.isAny())).returns(() => Promise.resolve(sessionInfo));
				mockFileNode.setup(node => node.hdfsPath).returns(() => model.parentFile.filePath);
			};
			let testDataSource = (productVersion: string, dataSourceName: string, dataSourceLocation: string) => {
				should(model.versionInfo.productLevel).be.equal(productVersion);
				should(model.existingDataSource).be.undefined();
				should(model.newDataSource).not.be.undefined();
				should(model.newDataSource.name).be.equal(dataSourceName);
				should(model.newDataSource.location).be.equal(dataSourceLocation);
				should(model.newDataSource.authenticationType).be.undefined();
				should(model.newDataSource.credentialName).be.undefined();
				should(model.newDataSource.username).be.undefined();
			};
			let testNewCtp24Source = (dataSourceName: string = 'SqlStoragePool') => {
				testDataSource('CTP2.4', dataSourceName, 'sqlhdfs://service-master-pool:50070/');
			};
			let testNewCtp25Source = (dataSourceName: string = 'SqlStoragePool') => {
				testDataSource('CTP2.5', dataSourceName, 'sqlhdfs://nmnode-0-svc:50070/');
			};
			let testNewCtp3Source = (dataSourceName: string = 'SqlStoragePool') => {
				testDataSource('CTP3.0', dataSourceName, 'sqlhdfs://controller-svc:8080/default');
			};

			setupMocks();
			await (<any>page).refreshPage();
			should(model.versionInfo.productLevel).be.equal('CTP3.1');
			should(model.existingDataSource).be.equal('TestSource');
			should(model.newDataSource).be.undefined();

			sessionInfo.productLevel = 'CTP2.4';
			setupMocks();
			await (<any>page).refreshPage();
			testNewCtp24Source();

			sessionInfo.productLevel = 'CTP2.5';
			setupMocks();
			await (<any>page).refreshPage();
			testNewCtp25Source();

			dbInfo.databaseInfo.externalDataSources = [];
			sessionInfo.productLevel = 'CTP3.0';
			setupMocks();
			await (<any>page).refreshPage();
			testNewCtp3Source();

			dbInfo.databaseInfo.externalDataSources = [<DataSourceInstance>{
				name: 'RandomSource',
				location: 'sqlhdfs://NotARealSource:50070/'
			}, <DataSourceInstance>{
				name: 'SqlStoragePool',
				location: 'sqlhdfs://NotARealSource:50070/'
			}, <DataSourceInstance>{
				name: 'SqlStoragePool1',
				location: 'sqlhdfs://NotARealSource1:8080/default'
			}, <DataSourceInstance>{
				name: 'SqlStoragePool2',
				location: 'sqlhdfs://NotARealSource2:8080/default'
			}];
			setupMocks();
			await (<any>page).refreshPage();
			testNewCtp3Source('SqlStoragePool3');

			sessionInfo.productLevel = 'CTP2.4';
			setupMocks();
			await (<any>page).refreshPage();
			testNewCtp24Source('SqlStoragePool3');

			sessionInfo.serverMajorVersion = 1000;
			sessionInfo.productLevel = 'NotARealCtpVersion';
			setupMocks();
			await (<any>page).refreshPage();
			// Default to the latest version's data source location
			testDataSource(sessionInfo.productLevel, 'SqlStoragePool3', 'sqlhdfs://controller-svc/default');
		});

		it('Refresh Test', async function () {
			let dbInfo = await service.getDatabaseInfo(undefined);
			let sessionInfo = await service.createDataSourceWizardSession(undefined);
			model.parentFile = {
				isFolder: false,
				filePath: path.join('BaseDir', 'AnotherDir', 'TestFile.csv')
			};
			let setupMocks = () => {
				mockService.setup(s => s.getDatabaseInfo(TypeMoq.It.isAny())).returns(() => Promise.resolve(dbInfo));
				mockService.setup(s => s.createDataSourceWizardSession(TypeMoq.It.isAny())).returns(() => Promise.resolve(sessionInfo));
				mockFileNode.setup(node => node.hdfsPath).returns(() => model.parentFile.filePath);
			};
			setupMocks();

			let testStr = 'RefreshTestStr';
			await (<any>page).refreshPage();
			should(model.database).not.be.equal(testStr);
			should(model.existingDataSource).not.be.equal(testStr);
			should(model.table).not.be.equal(testStr);
			should(model.existingSchema).not.be.equal(testStr);
			should(model.fileFormat).not.be.equal(`FileFormat_${testStr}`);

			sessionInfo.databaseList = [{ name: testStr, hasMasterKey: false }];
			dbInfo.databaseInfo.externalDataSources[0].name = testStr;
			model.parentFile = {
				isFolder: false,
				filePath: path.join('BaseDir', 'AnotherDir', `${testStr}.csv`)
			};
			dbInfo.databaseInfo.schemaList = [testStr];
			setupMocks();

			await (<any>page).refreshPage();
			should(model.database).be.equal(testStr);
			should(model.existingDataSource).be.equal(testStr);
			should(model.table).be.equal(testStr);
			should(model.existingSchema).be.equal(testStr);
			should(model.fileFormat).be.equal(`FileFormat_${testStr}`);
		});
	});

	describe('Preview Page Tests', function () {
		let mockPage = env.getMockedWizardPage();
		let fileNodeMock = TypeMoq.Mock.ofType(FileNode);
		let model = <ImportDataModel>{};
		model.proseParsingFile = fileNodeMock.object;

		fileNodeMock.setup(f => f.getFileLinesAsString(TypeMoq.It.isAny())).returns(() => Promise.resolve(service.proseTestData));

		let page = new ProsePreviewPage(mockWizard.object, mockPage, model, undefined, service);
		let ui: ProsePreviewPageUiElements = {
			table: new MockTableComponent(),
			loading: new MockLoadingComponent()
		};
		page.setUi(ui);

		it('OnPageEnter Test', async function () {
			await page.onPageEnter();

			should(ui.loading.loading).be.false();

			should(model.columnDelimiter).be.equal(',');
			should(model.firstRow).be.equal(2);
			should(model.quoteCharacter).be.equal('"');

			should(ui.table.columns.length).be.equal(2);
			should(ui.table.columns[0]).be.equal('TestId');
			should(ui.table.columns[1]).be.equal('TestStr');

			should(ui.table.data.length).be.equal(1);
			should(ui.table.data[0].length).be.equal(2);
			should(ui.table.data[0][0]).be.equal('1');
			should(ui.table.data[0][1]).be.equal('abc');
		});

		it('OnPageEnter Error Test', async function () {
			let errorMockWizard = TypeMoq.Mock.ofType(TableFromFileWizard, undefined, undefined, appContext, service);
			let errorFileNodeMock = TypeMoq.Mock.ofType(FileNode);
			let errorModel = <ImportDataModel>{};
			errorModel.proseParsingFile = errorFileNodeMock.object;

			let errorMsg = 'Expected Test Error';
			errorFileNodeMock.setup(f => f.getFileLinesAsString(TypeMoq.It.isAny())).throws(new Error(errorMsg));
			errorMockWizard.setup(w => w.showErrorMessage(TypeMoq.It.isValue(errorMsg)));

			let errorPage = new ProsePreviewPage(errorMockWizard.object, mockPage, errorModel, undefined, service);
			errorMockWizard.verify((w => w.showErrorMessage(TypeMoq.It.isValue(errorMsg))), TypeMoq.Times.never());

			errorPage.setUi({
				table: new MockTableComponent(),
				loading: new MockLoadingComponent()
			});
			await errorPage.onPageEnter();

			errorMockWizard.verify((w => w.showErrorMessage(TypeMoq.It.isValue(errorMsg))), TypeMoq.Times.once());
		});

		it('OnPageLeave Test', async function () {
			(await page.onPageLeave(true)).should.be.true();
		});
	});

	describe('Modify Columns Page Tests', function () {
		let mockPage = env.getMockedWizardPage();
		let model = <ImportDataModel>{};

		let page = new ModifyColumnsPage(mockWizard.object, mockPage, model, undefined, service);
		let ui: ModifyColumnsPageUiElements = {
			table: new MockDeclarativeTableComponent,
			loading: new MockLoadingComponent,
			text: new MockTextComponent()
		};
		page.setUi(ui);

		model.proseColumns = [{
			columnName: 'TestId',
			dataType: 'int',
			collationName: undefined,
			isNullable: false
		}, {
			columnName: 'TestStr',
			dataType: 'varchar(50)',
			collationName: undefined,
			isNullable: true
		}];

		it('OnPageEnter Test', async function () {
			await page.onPageEnter();

			should(ui.loading.loading).be.false();

			should(ui.table.data.length).be.equal(2);
			should(ui.table.data[0][0]).be.equal('TestId');
			should(ui.table.data[0][1]).be.equal('int');
			should(ui.table.data[0][2]).be.equal(false);
			should(ui.table.data[1][0]).be.equal('TestStr');
			should(ui.table.data[1][1]).be.equal('varchar(50)');
			should(ui.table.data[1][2]).be.equal(true);
		});

		it('OnPageLeave Test', async function () {
			(await page.onPageLeave(true)).should.be.true();
		});
	});

	describe('Summary Page Tests', function () {
		let mockPage = env.getMockedWizardPage();
		let model = <ImportDataModel>{};

		let page = new SummaryPage(mockWizard.object, mockPage, model, undefined, service);
		let ui: SummaryPageUiElements = {
			table: new MockTableComponent()
		};
		page.setUi(ui);

		it('OnPageEnter Test', async function () {
			model.serverConn = <azdata.connection.ConnectionProfile>{
				providerId: undefined,
				connectionId: undefined,
				serverName: 'TestServer'
			};
			model.database = 'TestDb';
			model.table = 'TestTable';
			model.existingSchema = 'dbo';
			model.fileFormat = 'TestFileFormat';
			model.parentFile = {
				isFolder: false,
				filePath: path.join('BaseDir', 'AnotherDir', 'TestTable.csv')
			};

			mockWizard.setup(w => w.changeDoneButtonLabel(TypeMoq.It.isValue('Virtualize Data')));
			mockWizard.setup(w => w.setGenerateScriptVisibility(TypeMoq.It.isValue(true)));

			await page.onPageEnter();

			mockWizard.verify(w => w.changeDoneButtonLabel(TypeMoq.It.isValue('Virtualize Data')), TypeMoq.Times.once());
			mockWizard.verify(w => w.setGenerateScriptVisibility(TypeMoq.It.isValue(true)), TypeMoq.Times.once());

			should(ui.table.data[0][1]).be.equal(model.serverConn.serverName);
			should(ui.table.data[1][1]).be.equal(model.database);
			should(ui.table.data[2][1]).be.equal(model.table);
			should(ui.table.data[3][1]).be.equal(model.existingSchema);
			should(ui.table.data[4][1]).be.equal(model.fileFormat);
			should(ui.table.data[5][1]).be.equal(model.parentFile.filePath);
		});

		it('OnPageLeave Test', async function () {
			mockWizard.setup(w => w.changeDoneButtonLabel(TypeMoq.It.isValue('Next')));
			mockWizard.setup(w => w.setGenerateScriptVisibility(TypeMoq.It.isValue(false)));

			(await page.onPageLeave(true)).should.be.true();

			mockWizard.verify(w => w.changeDoneButtonLabel(TypeMoq.It.isValue('Next')), TypeMoq.Times.once());
			mockWizard.verify(w => w.setGenerateScriptVisibility(TypeMoq.It.isValue(false)), TypeMoq.Times.once());
		});
	});

	describe('Utilities Tests', function () {
		it('Generate Input From Model Test', function () {
			let input = TableFromFileWizard.generateInputFromModel(undefined);
			should(input).be.undefined();

			let model = <ImportDataModel>{
				sessionId: 'TestId',
				columnDelimiter: ',',
				database: 'TestDatabase',
				fileFormat: 'FileFormat_TestTable',
				firstRow: 1,
				newDataSource: {
					name: 'SqlStoragePool',
					location: 'sqlhdfs://controller-svc:8080/default/',
					authenticationType: undefined,
					username: undefined,
					credentialName: undefined
				},
				newSchema: 'TestSchema',
				parentFile: {
					filePath: 'test/TestTable.csv',
					isFolder: false
				},
				proseColumns: [{
					collationName: undefined,
					columnName: 'column1',
					dataType: 'nvarchar(50)',
					isNullable: true,
				}],
				quoteCharacter: '\"',
				table: 'TestTable'
			};

			input = TableFromFileWizard.generateInputFromModel(model);
			should(input).not.be.undefined();
			should(input.sessionId).be.equal(model.sessionId);
			should(input.destDatabaseName).be.equal(model.database);
			should(input.sourceServerType).be.equal(DataSourceType.SqlHDFS);

			should(input.externalTableInfoList).not.be.undefined();
			should(input.externalTableInfoList.length).be.equal(1);

			let tableInfo = input.externalTableInfoList[0];
			should(tableInfo.externalTableName).not.be.undefined();
			should(tableInfo.externalTableName.length).be.equal(2);
			should(tableInfo.externalTableName[0]).be.equal(model.newSchema);
			should(tableInfo.externalTableName[1]).be.equal(model.table);

			should(tableInfo.columnDefinitionList).not.be.undefined();
			should(tableInfo.columnDefinitionList.length).be.equal(1);
			let columnInfo = tableInfo.columnDefinitionList[0];
			let proseInfo = model.proseColumns[0];
			should(columnInfo.collationName).be.equal(proseInfo.collationName);
			should(columnInfo.columnName).be.equal(proseInfo.columnName);
			should(columnInfo.dataType).be.equal(proseInfo.dataType);
			should(columnInfo.isNullable).be.equal(proseInfo.isNullable);

			should(tableInfo.sourceTableLocation).not.be.undefined();
			should(tableInfo.sourceTableLocation.length).be.equal(1);
			should(tableInfo.sourceTableLocation[0]).be.equal(model.parentFile.filePath);

			should(tableInfo.fileFormat).not.be.undefined();
			should(tableInfo.fileFormat.formatName).be.equal(model.fileFormat);
			should(tableInfo.fileFormat.formatType).be.equal(delimitedTextFileType);
			should(tableInfo.fileFormat.fieldTerminator).be.equal(model.columnDelimiter);
			should(tableInfo.fileFormat.stringDelimiter).be.equal(model.quoteCharacter);
			should(tableInfo.fileFormat.firstRow).be.equal(model.firstRow);

			should(input.newDataSourceName).be.equal(model.newDataSource.name);
			should(input.sourceServerName).be.equal('controller-svc:8080/default/');
			should(input.existingDataSourceName).be.undefined();

			should(input.newSchemas).not.be.undefined();
			should(input.newSchemas.length).be.equal(1);
			should(input.newSchemas[0]).be.equal(model.newSchema);
		});

		it('Remove URL Path Slashes Test', function () {
			let testPath = undefined;
			should(stripUrlPathSlashes(testPath)).be.equal('');

			testPath = '';
			should(stripUrlPathSlashes(testPath)).be.equal('');

			testPath = '//////////';
			should(stripUrlPathSlashes(testPath)).be.equal('');

			testPath = 'a/';
			should(stripUrlPathSlashes(testPath)).be.equal('a');

			testPath = 'testPath';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath');

			testPath = '/testPath';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath');

			testPath = '/testPath/testPath2';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath/testPath2');

			testPath = 'testPath/testPath2';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath/testPath2');

			testPath = 'testPath/testPath2///';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath/testPath2');

			testPath = '/testPath/testPath2///';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath/testPath2');

			testPath = '/testPath/testPath2/testPath3/////';
			should(stripUrlPathSlashes(testPath)).be.equal('testPath/testPath2/testPath3');
		});
	});
});
