/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as should from 'should';

import { VirtualizeDataModel } from '../wizards/virtualizeData/virtualizeDataModel';
import { CheckboxTreeNode } from '../wizards/virtualizeData/virtualizeDataTree';
import {
	MockInputBoxComponent, MockWizard, VirtualizeDataMockEnv, MockTextComponent,
	MockDeclarativeTableComponent, MockDataSourceService, MockConnectionProfile
} from './stubs';
import { CreateMasterKeyPage, MasterKeyUiElements } from '../wizards/virtualizeData/createMasterKeyPage';
import { SummaryPage, SummaryUiElements } from '../wizards/virtualizeData/summaryPage';
import { VDIManager } from '../wizards/virtualizeData/virtualizeDataInputManager';
import { ColumnDefinition } from '../services/contracts';

describe('Wizard Setup Tests', function (): void {
	it('Should set model fields after creating session.', async () => {
		let mockWizard = new MockWizard();
		mockWizard.message = undefined;
		let vdiManager = (new VirtualizeDataMockEnv()).getMockedVDIManager();
		let model = new VirtualizeDataModel(new MockConnectionProfile(), new MockDataSourceService(), new MockWizard(), vdiManager);
		await model.createSession();

		should(model.sessionId).be.eql('TestSessionId');
		should(model.destDatabaseList.length).be.greaterThan(0);
		should(model.destDatabaseList).containEql({ name: 'TestDb', hasMasterKey: false });
	});
});

describe('MasterKeyPage Tests', function (): void {
	it('[MasterKeyPage Test] MasterKeyPage should create a wizard page and register content during the initialization.', async () => {
		let env = new VirtualizeDataMockEnv();
		let mockDataModel = env.getMockedVirtualizeDataModel();
		let vdiManager = env.getMockedVDIManager();
		let appContext = env.getMockedAppContext();
		let apiWrapper = env.getApiWrapperMock();
		let wizardPage = env.getWizardPageMock();

		let masterKeyPage = new CreateMasterKeyPage(mockDataModel, vdiManager, appContext);
		apiWrapper.verifyAll();
		wizardPage.verifyAll();
		should(masterKeyPage).not.be.null();
	});

	it('[MasterKeyPage Test] MasterKeyPage should get data from VirtualizeDataModel when the page is opened.', async () => {
		let uiElement = new MasterKeyUiElements();
		uiElement.masterKeyPasswordInput = new MockInputBoxComponent();
		uiElement.masterKeyPasswordConfirmInput = new MockInputBoxComponent();

		let env = new VirtualizeDataMockEnv();
		env.getMockEnvConstants().destDbMasterKeyPwd = undefined;

		let dataModel = env.getMockedVirtualizeDataModel();
		let dataModelMock = env.getVirtualizeDataModelMock();
		let vdiManager = env.getMockedVDIManager();
		let appContext = env.getMockedAppContext();

		let masterKeyPage = new CreateMasterKeyPage(dataModel, vdiManager, appContext);
		masterKeyPage.setUi(uiElement);
		await masterKeyPage.updatePage();

		dataModelMock.verify(x => x.hasMasterKey(), TypeMoq.Times.once());
		should(uiElement.masterKeyPasswordInput.enabled).be.false;
		should(uiElement.masterKeyPasswordConfirmInput.enabled).be.false;

		env.getMockEnvConstants().destDbMasterKeyPwd = 'Chanel$4700'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Unit test - not actually used to authenticate")]
		await masterKeyPage.updatePage();

		should(uiElement.masterKeyPasswordInput.enabled).be.true;
		should(uiElement.masterKeyPasswordConfirmInput.enabled).be.true;
	});

	it('[MasterKeyPage Test] MasterKeyPage should fail validation if page content is invalid.', async () => {
		let uiElement = new MasterKeyUiElements();
		uiElement.masterKeyPasswordInput = new MockInputBoxComponent();
		uiElement.masterKeyPasswordConfirmInput = new MockInputBoxComponent();

		let env = new VirtualizeDataMockEnv();
		let dataModel = env.getMockedVirtualizeDataModel();
		let dataModelMock = env.getVirtualizeDataModelMock();
		let vdiManager = env.getMockedVDIManager();
		let vdiManagerMock = env.getVDIManagerMock();
		let appContext = env.getMockedAppContext();

		let masterKeyPage = new CreateMasterKeyPage(dataModel, vdiManager, appContext);
		masterKeyPage.setUi(uiElement);

		uiElement.masterKeyPasswordInput.value = 'test123';
		uiElement.masterKeyPasswordConfirmInput.value = '123test';

		should(await masterKeyPage.validate()).be.false;
		dataModelMock.verify(x => x.showWizardError(TypeMoq.It.isAny()), TypeMoq.Times.once());
		dataModelMock.verify(x => x.validateInput(TypeMoq.It.isAny()), TypeMoq.Times.never());
		vdiManagerMock.verify(x => x.getVirtualizeDataInput(TypeMoq.It.isAny()), TypeMoq.Times.never());
	});

	it('[MasterKeyPage Test] MasterKeyPage should pass validation if page content is valid.', async () => {
		let uiElement = new MasterKeyUiElements();
		uiElement.masterKeyPasswordInput = new MockInputBoxComponent();
		uiElement.masterKeyPasswordConfirmInput = new MockInputBoxComponent();

		let env = new VirtualizeDataMockEnv();
		let dataModel = env.getMockedVirtualizeDataModel();
		let dataModelMock = env.getVirtualizeDataModelMock();
		let vdiManager = env.getMockedVDIManager();
		let vdiManagerMock = env.getVDIManagerMock();
		let appContext = env.getMockedAppContext();

		let masterKeyPage = new CreateMasterKeyPage(dataModel, vdiManager, appContext);
		masterKeyPage.setUi(uiElement);

		uiElement.masterKeyPasswordInput.value = 'test123';
		uiElement.masterKeyPasswordConfirmInput.value = 'test123';
		should(await masterKeyPage.validate()).be.true;

		dataModelMock.verify(x => x.showWizardError(TypeMoq.It.isAny()), TypeMoq.Times.never());
		dataModelMock.verify(x => x.validateInput(TypeMoq.It.isAny()), TypeMoq.Times.once());
		vdiManagerMock.verify(x => x.getVirtualizeDataInput(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});

describe('ObjectMappingPage Tests', function (): void {
	it('[ObjectMappingPage Test] ObjectMappingPage should create a wizard page and register content during the initialization.', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		let apiWrapper = env.getApiWrapperMock();
		let wizardPage = env.getWizardPageMock();
		apiWrapper.verify(x => x.createWizardPage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		wizardPage.verify(x => x.registerContent(TypeMoq.It.isAny()), TypeMoq.Times.once());
		should(objectMappingPage).not.be.undefined();
	});

	it('[ObjectMappingPage Test] ObjectMappingPage should get data from VirtualizeDataModel when the page is opened.', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;
		let rootNode = omPage._treeRootNode;
		should(rootNode).not.be.undefined();
		let databaseNodes = await rootNode.getChildren();
		should(databaseNodes).not.be.undefined();
		should(databaseNodes.length > 0).be.true();

		let dataModelMock = env.getVirtualizeDataModelMock();
		dataModelMock.verify(x => x.getSourceDatabases(TypeMoq.It.isAny()), TypeMoq.Times.atLeastOnce());
	});

	it('[ObjectMappingPage Test] Database node should generate children, and mark them as checked when database node is checked before generating children.', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;
		let rootNode: CheckboxTreeNode = omPage._treeRootNode as CheckboxTreeNode;
		let databaseNodes: CheckboxTreeNode[] = await rootNode.getChildren();
		should(databaseNodes).not.be.undefined();
		should(databaseNodes.length > 0).be.true();

		should(databaseNodes[0].hasChildren).be.false();
		await omPage.actionOnNodeCheckStatusChanged(databaseNodes[0], true);
		should(databaseNodes[0].hasChildren).be.true();
		let children: CheckboxTreeNode[] = await databaseNodes[0].getChildren();
		let tableFolderNode: CheckboxTreeNode = children[0];
		let viewFolderNode: CheckboxTreeNode = children[1];
		should(tableFolderNode.checked).be.true();
		should(viewFolderNode.checked).be.true();
		should(tableFolderNode.hasChildren).be.true();
		should(viewFolderNode.hasChildren).be.true();
		let tableNodes: CheckboxTreeNode[] = await tableFolderNode.getChildren();
		tableNodes.forEach(tableNode => {
			should(tableNode.checked).be.true();
		});
		let viewNodes: CheckboxTreeNode[] = await viewFolderNode.getChildren();
		viewNodes.forEach(viewNode => {
			should(viewNode.checked).be.true();
		});
	});

	it('[ObjectMappingPage Test] Column definition mapping table should be updated when table or view node is selected.', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;
		let rootNode: CheckboxTreeNode = omPage._treeRootNode as CheckboxTreeNode;
		let databaseNodes: CheckboxTreeNode[] = await rootNode.getChildren();
		should(databaseNodes).not.be.undefined();
		should(databaseNodes.length > 0).be.true();
		let folderNodes: CheckboxTreeNode[] = await databaseNodes[0].getChildren();
		should(folderNodes).not.be.undefined();
		should(folderNodes.length === 2).be.true();
		let tableFolderNodes: CheckboxTreeNode = folderNodes[0];
		let tableNodes: CheckboxTreeNode[] = await tableFolderNodes.getChildren();
		should(tableNodes).not.be.undefined();
		should(tableNodes.length > 0).be.true();
		let viewFolderNodes: CheckboxTreeNode = folderNodes[1];
		let viewNodes: CheckboxTreeNode[] = await viewFolderNodes.getChildren();
		should(viewNodes).not.be.undefined();
		should(viewNodes.length > 0).be.true();

		let colDefTable = omPage._columnMappingTable as azdata.DeclarativeTableComponent;
		colDefTable.updateProperties({ data: undefined });
		should(colDefTable.data).be.undefined();
		await omPage.actionOnNodeIsSelected(tableNodes[0]);
		should(colDefTable.data).not.be.undefined();
		should(colDefTable.data.length > 0).be.true();
		colDefTable.data.forEach(row => {
			should(row.length > 0).be.true();
			should(row[0] !== undefined && row[0] !== '').be.true();
		});

		let colDefs = (await omPage._dataSourceBrowser.getColumnDefinitions((<any>tableNodes[0]).location)) as ColumnDefinition[];
		for (let i = 0; i < colDefs.length; ++i) {
			should(colDefs[i].columnName === colDefTable.data[i][0]).be.true();
			should(colDefs[i].columnName === colDefTable.data[i][1]).be.true();
			should(colDefs[i].dataType === colDefTable.data[i][2]).be.true();
			should(colDefs[i].isNullable === colDefTable.data[i][3]).be.true();
			should(colDefs[i].collationName === colDefTable.data[i][4]).be.true();
		}

		colDefTable.updateProperties({ data: undefined });
		should(colDefTable.data).be.undefined();
		await omPage.actionOnNodeIsSelected(viewNodes[0]);
		should(colDefTable.data).not.be.undefined();
		should(colDefTable.data.length > 0).be.true();
		colDefTable.data.forEach(row => {
			should(row.length > 0).be.true();
			should(row[0] !== undefined && row[0] !== '').be.true();
		});

		colDefs = (await omPage._dataSourceBrowser.getColumnDefinitions((<any>viewNodes[0]).location)) as ColumnDefinition[];
		for (let i = 0; i < colDefs.length; ++i) {
			should(colDefs[i].columnName === colDefTable.data[i][0]).be.true();
			should(colDefs[i].columnName === colDefTable.data[i][1]).be.true();
			should(colDefs[i].dataType === colDefTable.data[i][2]).be.true();
			should(colDefs[i].isNullable === colDefTable.data[i][3]).be.true();
			should(colDefs[i].collationName === colDefTable.data[i][4]).be.true();
		}
	});

	it('[ObjectMappingPage Test] ObjectMappingPage should return table information for creation for checked tables', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;
		let rootNode: CheckboxTreeNode = omPage._treeRootNode as CheckboxTreeNode;
		let databaseNodes: CheckboxTreeNode[] = await rootNode.getChildren();

		for (let i = 0; i < databaseNodes.length; ++i) {
			await omPage.actionOnNodeCheckStatusChanged(databaseNodes[i], true);
		}

		let inputValues = VDIManager.getEmptyInputInstance();
		omPage.getInputValues(inputValues);
		should(inputValues).not.be.undefined();
		should(inputValues.externalTableInfoList).not.be.undefined();
		let tablesToBeCreated = inputValues.externalTableInfoList;
		should(tablesToBeCreated.length > 0).be.true();
	});

	it('[ObjectMappingPage Test] Database nodes and table nodes should be able to expand successfully.', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;
		let rootNode: CheckboxTreeNode = omPage._treeRootNode as CheckboxTreeNode;
		let databaseNodes: CheckboxTreeNode[] = await rootNode.getChildren();
		should(rootNode.hasChildren).be.true();
		should(databaseNodes).not.be.undefined();
		should(databaseNodes.length > 0).be.true();

		for (let i = 0; i < databaseNodes.length; ++i) {
			let tableNodes: CheckboxTreeNode[] = await databaseNodes[i].getChildren();
			should(databaseNodes[i].hasChildren).be.True();
			should(tableNodes).not.be.undefined();
			should(tableNodes.length > 0).be.true();
		}
	});

	it('[ObjectMappingPage Test] Tree view should be updated every time objectMappingPage is loaded', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;

		let rootNode: CheckboxTreeNode = omPage._treeRootNode as CheckboxTreeNode;
		should(rootNode.hasChildren).be.false();
		let databaseNodes: CheckboxTreeNode[] = await rootNode.getChildren();
		should(rootNode.hasChildren).be.true();

		await objectMappingPage.updatePage();
		rootNode = omPage._treeRootNode as CheckboxTreeNode;
		should(rootNode.hasChildren).be.false();
	});

	it('[ObjectMappingPage Test] ObjectMappingPage should show table help text when the page is updated', async () => {
		let env = new VirtualizeDataMockEnv();
		let objectMappingPage = env.getMockedObjectMappingPage();
		await objectMappingPage.updatePage();
		let omPage = <any>objectMappingPage;
		let objectMappingWrapper = omPage._objectMappingWrapper;
		should(objectMappingWrapper).not.be.undefined();
		should(objectMappingWrapper.items.length === 1).be.true();
	});
});

describe('Summary Page Tests', function (): void {
	it('[SummaryPage Test] SummaryPage should create a wizard page and register content during the initialization.', async () => {
		let env = new VirtualizeDataMockEnv();
		let dataModel = env.getMockedVirtualizeDataModel();
		let vdiManager = env.getMockedVDIManager();
		let apiContext = env.getMockedAppContext();
		let apiWrapperMock = env.getApiWrapperMock();
		let wizardPageMock = env.getWizardPageMock();

		let summaryPage = new SummaryPage(dataModel, vdiManager, apiContext);
		wizardPageMock.verify(x => x.registerContent(TypeMoq.It.isAny()), TypeMoq.Times.once());
		apiWrapperMock.verify(x => x.createWizardPage(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
		should(summaryPage).not.be.null();
	});

	it('[SummaryPage Test] SummaryPage should get data from VirtualizeDataModel when the page is opened.', async () => {
		let uiElement = new SummaryUiElements();
		uiElement.destDBLabel = new MockTextComponent();
		uiElement.summaryTable = new MockDeclarativeTableComponent();

		let env = new VirtualizeDataMockEnv();
		let dataModel = env.getMockedVirtualizeDataModel();
		let vdiManager = env.getMockedVDIManager();
		let apiContext = env.getMockedAppContext();
		let vdiManagerMock = env.getVDIManagerMock();

		let summaryPage = new SummaryPage(dataModel, vdiManager, apiContext);
		summaryPage.setUi(uiElement);
		await summaryPage.updatePage();

		vdiManagerMock.verify(x => x.getVirtualizeDataInput(TypeMoq.It.isAny()), TypeMoq.Times.once());

		let testData = env.getMockEnvConstants();
		should(uiElement.destDBLabel.value).be.eql(testData.destDbNameSelected);

		let summaryHasKey = function (key: string): boolean {
			return uiElement.summaryTable.data.some(row => row && row[0] === key);
		};
		let summaryHasValue = function (value: string): boolean {
			return uiElement.summaryTable.data.some(row => row && row.length > 1 && row[1] === value);
		};
		should(summaryHasValue(testData.newCredentialName)).be.true;
		should(summaryHasValue(testData.newDataSourceName)).be.true;
		should(summaryHasValue(testData.externalTableInfoList[0].externalTableName.join('.'))).be.true;
		// No value is included for the master key row, so check the row's key instead
		should(summaryHasKey('Database Master Key')).be.true;
	});

	it('[SummaryPage Test] SummaryPage should register task operation on wizard submit.', async () => {
		let uiElement = new SummaryUiElements();
		uiElement.destDBLabel = new MockTextComponent();
		uiElement.summaryTable = new MockDeclarativeTableComponent();

		let env = new VirtualizeDataMockEnv();
		let dataModel = env.getMockedVirtualizeDataModel();
		let vdiManager = env.getMockedVDIManager();
		let apiContext = env.getMockedAppContext();
		let wizardMock = env.getWizardMock();

		let summaryPage = new SummaryPage(dataModel, vdiManager, apiContext);
		summaryPage.setUi(uiElement);

		should(await summaryPage.validate()).be.true;
		wizardMock.verify(x => x.registerOperation(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});
