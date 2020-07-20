/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as TypeMoq from 'typemoq';
import * as loc from '../localizedConstants';
import 'mocha';
import { SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
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

before(async function (): Promise<void> {
	testContext = createContext();
});
describe('SchemaCompareDialog.openDialog', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
	});

	it('Should be correct when created.', async function (): Promise<void> {
		let schemaCompareResult = new SchemaCompareMainWindow(testContext.apiWrapper.object, undefined, mockExtensionContext.object);
		let dialog = new SchemaCompareDialog(schemaCompareResult);
		await dialog.openDialog();

		should(dialog.dialog.title).equal('Schema Compare');
		should(dialog.dialog.okButton.label).equal('OK');
		should(dialog.dialog.okButton.enabled).equal(false); // Should be false when open
	});
});

describe('SchemaCompareMainWindow.start', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
	});
	it('Should be correct when created.', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = await setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = await setDacpacEndpointInfo(mocktarget);
		await result.execute();

		should(result.getComparisonResult() !== undefined);
		should(result.getComparisonResult().operationId === 'Test Operation Id');
	});

	it('Should start with the source as undefined', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		await result.start(undefined);

		should.equal(result.sourceEndpointInfo, undefined);
		should.equal(result.targetEndpointInfo, undefined);
	});

	it('Should start with the source as database', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		await result.start({connectionProfile: mockIConnectionProfile});

		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Database);
		should.equal(result.sourceEndpointInfo.serverName, mockIConnectionProfile.serverName);
		should.equal(result.sourceEndpointInfo.databaseName, mockIConnectionProfile.databaseName);
		should.equal(result.targetEndpointInfo, undefined);
	});

	it('Should start with the source as dacpac.', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		const dacpacPath = mockFilePath;
		await result.start(dacpacPath);

		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Dacpac);
		should.equal(result.sourceEndpointInfo.packageFilePath, dacpacPath);
		should.equal(result.targetEndpointInfo, undefined);
	});
});

describe('SchemaCompareMainWindow.execute', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
		testContext = createContext();
	});

	beforeEach(async function (): Promise<void> {
		testContext.apiWrapper.reset();
	});

	it('Should fail for failing Schema Compare service', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.FAILURE);

		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns((s) => { throw new Error(s); });
		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = await setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = await setDacpacEndpointInfo(mocktarget);

		await shouldThrowSpecificError(async () => await result.execute(), loc.compareErrorMessage('Test failure'));
	});

	it('Should exit for failing Schema Compare service', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.FAILURE);

		testContext.apiWrapper.setup(x => x.showErrorMessage(TypeMoq.It.isAny())).returns(() => Promise.resolve(''));
		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = await setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = await setDacpacEndpointInfo(mocktarget);

		await result.execute();
		testContext.apiWrapper.verify(x => x.showErrorMessage(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

	it('Should disable script button and apply button for Schema Compare service for dacpac', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.SUCCESS_NOT_EQUAL);

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = await setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = await setDacpacEndpointInfo(mocktarget);

		await result.execute();

		//Generate script button and apply button should be disabled for dacpac comparison
		should(result.verifyButtonsState( {compareButtonState: true, optionsButtonState: true, switchButtonState: true,
			openScmpButtonState: true, saveScmpButtonState: true, cancelCompareButtonState: false,
			selectSourceButtonState: true, selectTargetButtonState: true, generateScriptButtonState: false,
			applyButtonState: false} )).equal(true);
	});

	it('Should disable script button and apply button for Schema Compare service for database', async function (): Promise<void> {
		let sc = new SchemaCompareTestService(testStateScmp.SUCCESS_NOT_EQUAL);

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = await setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = await setDatabaseEndpointInfo();

		await result.execute();

		//Generate script button and apply button should be enabled for database comparison
		should(result.verifyButtonsState( {compareButtonState: true, optionsButtonState: true, switchButtonState: true,
			openScmpButtonState: true, saveScmpButtonState: true, cancelCompareButtonState: false,
			selectSourceButtonState: true, selectTargetButtonState: true, generateScriptButtonState: true,
			applyButtonState: true} )).equal(true);
	});

});

describe('SchemaCompareMainWindow.updateSourceAndTarget', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
		testContext = createContext();
	});

	it('Should set buttons appropriately when source and target endpoints are empty', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = {...endpointInfo};
		result.targetEndpointInfo = {...endpointInfo};

		result.updateSourceAndTarget();

		should(result.verifyButtonsState( {compareButtonState: false, optionsButtonState: false, switchButtonState: false,
			openScmpButtonState: true, saveScmpButtonState: false, cancelCompareButtonState: false,
			selectSourceButtonState: true, selectTargetButtonState: true, generateScriptButtonState: false,
			applyButtonState: false} )).equal(true);
	});

	it('Should set buttons appropriately when source endpoint is empty and target endpoint is populated', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = {...endpointInfo};
		result.targetEndpointInfo = await setDacpacEndpointInfo(mocktarget);

		result.updateSourceAndTarget();

		should(result.verifyButtonsState( {compareButtonState: false, optionsButtonState: false, switchButtonState: true,
			openScmpButtonState: true, saveScmpButtonState: false, cancelCompareButtonState: false,
			selectSourceButtonState: true, selectTargetButtonState: true, generateScriptButtonState: false,
			applyButtonState: false} )).equal(true);
	});

	it('Should set buttons appropriately when source and target endpoints are populated', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();
		let endpointInfo: mssql.SchemaCompareEndpointInfo;

		let result = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, sc, mockExtensionContext.object);

		await result.start(undefined);

		should(result.getComparisonResult() === undefined);

		result.sourceEndpointInfo = await setDacpacEndpointInfo(mocksource);
		result.targetEndpointInfo = await setDacpacEndpointInfo(mocktarget);

		result.updateSourceAndTarget();

		should(result.verifyButtonsState( {compareButtonState: true, optionsButtonState: true, switchButtonState: true,
			openScmpButtonState: true, saveScmpButtonState: true, cancelCompareButtonState: false,
			selectSourceButtonState: true, selectTargetButtonState: true, generateScriptButtonState: false,
			applyButtonState: false} )).equal(true);
	});

});
