/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as TypeMoq from 'typemoq';
import * as loc from '../localizedConstants';
import 'mocha';
import * as sinon from 'sinon';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { SchemaCompareTestService, testStateScmp } from './testSchemaCompareService';
import { createContext, TestContext } from './testContext';
import { mockIConnectionProfile, mockFilePath, setDacpacEndpointInfo, setDatabaseEndpointInfo, shouldThrowSpecificError } from './testUtils';
import { SchemaCompareMainWindowTest } from './testSchemaCompareMainWindow';

// Mock test data
const mocksource: string = 'source.dacpac';
const mocktarget: string = 'target.dacpac';

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let testContext: TestContext;

before(function (): void {
	testContext = createContext();
});

describe('SchemaCompareMainWindow.start @DacFx@', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
	});

	this.afterEach(() => {
		sinon.restore();
	});

	it('Should be correct when created.', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);
		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await result.execute();

		should(result.getComparisonResult() !== undefined);
		should(result.getComparisonResult().operationId === 'Test Operation Id');
	});

	it('Should start with the source as undefined', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);
		await result.start(undefined);

		should.equal(result.sourceEndpointInfo, undefined);
		should.equal(result.targetEndpointInfo, undefined);
	});

	it('Should start with the source as database', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);
		await result.start({connectionProfile: mockIConnectionProfile});

		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Database);
		should.equal(result.sourceEndpointInfo.serverName, mockIConnectionProfile.serverName);
		should.equal(result.sourceEndpointInfo.databaseName, mockIConnectionProfile.databaseName);
		should.equal(result.targetEndpointInfo, undefined);
	});

	it('Should start with the source as dacpac.', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);
		const dacpacPath = mockFilePath;
		await result.start(dacpacPath);

		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Dacpac);
		should.equal(result.sourceEndpointInfo.packageFilePath, dacpacPath);
		should.equal(result.targetEndpointInfo, undefined);
	});
});
let showErrorMessageSpy: any;
let showWarningMessageStub: any;
let showOpenDialogStub: any;

describe('SchemaCompareMainWindow.results @DacFx@', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
	});

	this.afterEach(() => {
		sinon.restore();
	});

	this.beforeEach(() => {
		sinon.restore();
		showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
	});

	it('Should show error if publish changes fails', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaComparePublishDatabaseChanges(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: false,
			errorMessage: 'error1'
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));

		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.publishChanges();

		should(showErrorMessageSpy.calledOnce).be.true();
		should.equal(showErrorMessageSpy.getCall(0).args[0], loc.applyErrorMessage('error1'));
	});

	it('Should show not error if publish changes succeed', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaComparePublishDatabaseChanges(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: true,
			errorMessage: ''
		}));
		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.publishChanges();
		should(showErrorMessageSpy.notCalled).be.true();
	});

	it('Should show error if openScmp fails', async function (): Promise<void> {
		let service = createServiceMock();
		let files: vscode.Uri[] = [vscode.Uri.parse('file:///test')];
		service.setup(x => x.schemaCompareOpenScmp(TypeMoq.It.isAny())).returns(() => Promise.resolve({
			sourceEndpointInfo: undefined,
			targetEndpointInfo: undefined,
			originalTargetName: 'string',
			originalConnectionString: '',
			deploymentOptions: undefined,
			excludedSourceElements: [],
			excludedTargetElements: [],
			success: false,
			errorMessage: 'error1'
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));
		showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog').returns(<any>Promise.resolve(files));

		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.openScmp();

		should(showErrorMessageSpy.calledOnce).be.true();
		should.equal(showErrorMessageSpy.getCall(0).args[0], loc.openScmpErrorMessage('error1'));
	});

	it('Should show error if saveScmp fails', async function (): Promise<void> {
		let service = createServiceMock();
		let file: vscode.Uri = vscode.Uri.parse('file:///test');
		service.setup(x => x.schemaCompareSaveScmp(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			sourceEndpointInfo: undefined,
			targetEndpointInfo: undefined,
			originalTargetName: 'string',
			originalConnectionString: '',
			deploymentOptions: undefined,
			excludedSourceElements: [],
			excludedTargetElements: [],
			success: false,
			errorMessage: 'error1'
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));
		showOpenDialogStub = sinon.stub(vscode.window, 'showSaveDialog').returns(<any>Promise.resolve(file));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.saveScmp();

		should(showErrorMessageSpy.calledOnce).be.true();
		should.equal(showErrorMessageSpy.getCall(0).args[0], loc.saveScmpErrorMessage('error1'));
	});


	it('Should show error if generateScript fails', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaCompareGenerateScript(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: false,
			errorMessage: 'error1'
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.generateScript();

		should(showErrorMessageSpy.calledOnce).be.true();
		should.equal(showErrorMessageSpy.getCall(0).args[0], loc.generateScriptErrorMessage('error1'));
	});

	it('Should show error if cancel fails', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaCompareCancel(TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: false,
			errorMessage: 'error1'
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('Yes'));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.cancelCompare();

		should(showErrorMessageSpy.calledOnce).be.true();
		should.equal(showErrorMessageSpy.getCall(0).args[0], loc.cancelErrorMessage('error1'));
	});

	it('Should show error if IncludeExcludeNode fails', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaCompareIncludeExcludeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: false,
			errorMessage: '',
			affectedDependencies: [],
			blockingDependencies: [{
				updateAction: 2,
				differenceType: 0,
				name: 'SqlTable',
				sourceValue: ['dbo', 'table1'],
				targetValue: null,
				parent: null,
				children: [{
					updateAction: 2,
					differenceType: 0,
					name: 'SqlSimpleColumn',
					sourceValue: ['dbo', 'table1', 'id'],
					targetValue: null,
					parent: null,
					children: [],
					sourceScript: '',
					targetScript: null,
					included: false
				}],
				sourceScript: 'CREATE TABLE [dbo].[table1](id int)',
				targetScript: null,
				included: true
			}]
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(''));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.applyIncludeExclude({
			row: 0,
			column: 0,
			columnName: 1,
			checked: true
		});

		should(showWarningMessageStub.calledOnce).be.true();
	});

	it('Should not show warning if IncludeExcludeNode succeed', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaCompareIncludeExcludeNode(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: true,
			errorMessage: '',
			affectedDependencies: [],
			blockingDependencies: [{
				updateAction: 2,
				differenceType: 0,
				name: 'SqlTable',
				sourceValue: ['dbo', 'table1'],
				targetValue: null,
				parent: null,
				children: [{
					updateAction: 2,
					differenceType: 0,
					name: 'SqlSimpleColumn',
					sourceValue: ['dbo', 'table1', 'id'],
					targetValue: null,
					parent: null,
					children: [],
					sourceScript: '',
					targetScript: null,
					included: false
				}],
				sourceScript: 'CREATE TABLE [dbo].[table1](id int)',
				targetScript: null,
				included: true
			}]
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve(''));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.applyIncludeExclude({
			row: 0,
			column: 0,
			columnName: 1,
			checked: false
		});

		should(showWarningMessageStub.notCalled).be.true();
	});

	it('Should not show error if user does not want to publish', async function (): Promise<void> {
		let service = createServiceMock();
		service.setup(x => x.schemaComparePublishDatabaseChanges(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({
			success: true,
			errorMessage: ''
		}));

		showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage').returns(<any>Promise.resolve('No'));
		let schemaCompareResult = new SchemaCompareMainWindow(service.object, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);

		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);
		await schemaCompareResult.execute();
		await schemaCompareResult.publishChanges();

		should(showErrorMessageSpy.notCalled).be.true();
	});

	function createServiceMock() {
		let sc = new SchemaCompareTestService(testStateScmp.SUCCESS_NOT_EQUAL);
		let service = TypeMoq.Mock.ofInstance(new SchemaCompareTestService());
		service.setup(x => x.schemaCompareGetDefaultOptions()).returns(x => sc.schemaCompareGetDefaultOptions());
		service.setup(x => x.schemaCompare(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => sc.schemaCompare('', undefined, undefined, undefined, undefined));
		return service;
	}
});

let showErrorMessageStub: any;
describe('SchemaCompareMainWindow.execute @DacFx@', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
		testContext = createContext();
	});

	this.afterEach(() => {
		sinon.restore();
	});

	this.beforeEach(() => {
		sinon.restore();
	});

	it('Should fail for failing Schema Compare service', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.FAILURE);

		showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').callsFake((message) => {
			throw new Error(message);
		});

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);
		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		await shouldThrowSpecificError(async () => await result.execute(), loc.compareErrorMessage('Test failure'));
	});

	it('Should exit for failing Schema Compare service', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.FAILURE);

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		await result.execute();
	});

	it('Should disable script button and apply button for Schema Compare service for dacpac', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.SUCCESS_NOT_EQUAL);

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		await result.execute();

		//Generate script button and apply button should be disabled for dacpac comparison
		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});

	it('Should enable script button and apply button for Schema Compare service for database', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.SUCCESS_NOT_EQUAL);

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDatabaseEndpointInfo();

		await result.execute();

		//Generate script button and apply button should be enabled for database comparison
		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: true,
			applyButtonState: true
		});
	});

	it('Should enable script button and apply button for Schema Compare service for database, using button onClick fire event', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.SUCCESS_NOT_EQUAL);

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, testContext.viewContext.view);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDatabaseEndpointInfo();

		testContext.viewContext.compareButtonOnClick.fire(undefined);
		await result.promise;

		//Generate script button and apply button should be enabled for database comparison
		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: true,
			applyButtonState: true} );
	});

});

describe('SchemaCompareMainWindow.updateSourceAndTarget @DacFx@', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
		testContext = createContext();
	});

	it('Should set buttons appropriately when source and target endpoints are empty', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = { ...endpointInfo };
		result.targetEndpointInfo = { ...endpointInfo };

		result.updateSourceAndTarget();

		result.verifyButtonsState({
			compareButtonState: false,
			optionsButtonState: false,
			switchButtonState: false,
			openScmpButtonState: true,
			saveScmpButtonState: false,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});

	it('Should set buttons appropriately when source endpoint is empty and target endpoint is populated', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = { ...endpointInfo };
		result.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		result.updateSourceAndTarget();

		result.verifyButtonsState({
			compareButtonState: false,
			optionsButtonState: false,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: false,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});

	it('Should set buttons appropriately when source and target endpoints are populated', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, null);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		result.updateSourceAndTarget();

		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});

});

describe('SchemaCompareMainWindow: Button clicks @DacFx@', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
		testContext = createContext();
	});
	this.beforeEach(() => {
		sinon.restore();
		showErrorMessageSpy = sinon.spy(vscode.window, 'showErrorMessage');
	});
	this.afterEach(() => {
		sinon.restore();
	});

	it('createSwitchButton click to start schema comparison', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, testContext.viewContext.view);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDatabaseEndpointInfo();

		testContext.viewContext.switchDirectionButtonOnClick.fire(undefined);
		await result.promise;

		//Verify that switch actually happened
		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Database);
		should.equal(result.sourceEndpointInfo.serverName, 'My Server');
		should.equal(result.sourceEndpointInfo.databaseName, 'My Database');
		should.notEqual(result.targetEndpointInfo, undefined);
		should.equal(result.targetEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Dacpac);
		should.equal(result.targetEndpointInfo.packageFilePath, 'source.dacpac');

		//Generate script button and apply button should be disabled for database to dacpac comparison
		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});

	it('SourceAndTarget selection should open schemaCompareDialog', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, testContext.viewContext.view);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDatabaseEndpointInfo();

		testContext.viewContext.selectButtonOnClick.fire(undefined);
		await result.promise;

		//Verify that Select button click opened a Schema Compare dialog
		should.notEqual(result.schemaCompareDialog, undefined);
		should.notEqual(result.schemaCompareDialog.dialog, undefined);
		should(result.schemaCompareDialog.dialog.title).equal(loc.SchemaCompareLabel);
		should(result.schemaCompareDialog.dialog.okButton.label).equal(loc.OkButtonText);
		should(result.schemaCompareDialog.dialog.okButton.enabled).equal(false); // Should be false when open
	});

	it('cancelCompare click to cancel schema comparison', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, testContext.viewContext.view);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDatabaseEndpointInfo();
		await result.execute();

		testContext.viewContext.cancelCompareButtonOnClick.fire(undefined);

		//Verify no error message was thrown
		should(showErrorMessageSpy.notCalled).be.true();

		//Generate script button and apply button should be enabled for database comparison
		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});

	it('generateScript click to generate script for schema comparison', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(sc, mockExtensionContext.object, testContext.viewContext.view);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = setDatabaseEndpointInfo();
		await result.execute();

		testContext.viewContext.generateScriptButtonOnClick.fire(undefined);

		//Verify no error message was thrown
		should(showErrorMessageSpy.notCalled).be.true();

		result.verifyButtonsState({
			compareButtonState: true,
			optionsButtonState: true,
			switchButtonState: true,
			openScmpButtonState: true,
			saveScmpButtonState: true,
			cancelCompareButtonState: false,
			selectSourceButtonState: true,
			selectTargetButtonState: true,
			generateScriptButtonState: false,
			applyButtonState: false
		});
	});
});

