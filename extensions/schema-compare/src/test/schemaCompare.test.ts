/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import * as TypeMoq from 'typemoq';
import 'mocha';
import { SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { SchemaCompareTestService } from './testSchemaCompareService';
import { createContext, TestContext } from './testContext';
import { mockIConnectionProfile, mockDacpacEndpoint } from './testUtils';

// Mock test data
const mocksource: string = 'source.dacpac';
const mocktarget: string = 'target.dacpac';

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let testContext: TestContext;

before(async function (): Promise<void> {
	testContext = createContext();
});
describe('SchemaCompareDialog.openDialog', function (): void {
	beforeEach(() => {
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

describe('SchemaCompareResult.start', function (): void {
	beforeEach(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
	});
	it('Should be correct when created.', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindow(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		await result.start(null);
		let promise = new Promise(resolve => setTimeout(resolve, 5000)); // to ensure comparison result view is initialized
		await promise;

		should(result.getComparisonResult() === undefined);

		let sourceEndpointInfo : mssql.SchemaCompareEndpointInfo = {...mockDacpacEndpoint};
		let targetEndpointInfo : mssql.SchemaCompareEndpointInfo = {...mockDacpacEndpoint};
		result.sourceEndpointInfo = sourceEndpointInfo;
		result.sourceEndpointInfo.packageFilePath = mocksource;
		result.targetEndpointInfo = targetEndpointInfo;
		result.targetEndpointInfo.packageFilePath = mocktarget;
		await result.execute();

		should(result.getComparisonResult() !== undefined);
		should(result.getComparisonResult().operationId === 'Test Operation Id');
	});

	it('Should start with the source as undefined', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindow(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		await result.start(undefined);
		let promise = new Promise(resolve => setTimeout(resolve, 5000)); // to ensure comparison result view is initialized
		await promise;

		should.equal(result.sourceEndpointInfo, undefined);
		should.equal(result.targetEndpointInfo, undefined);
	});

	it('Should start with the source as database', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindow(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		await result.start({connectionProfile: mockIConnectionProfile});
		let promise = new Promise(resolve => setTimeout(resolve, 5000)); // to ensure comparison result view is initialized
		await promise;

		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Database);
		should.equal(result.sourceEndpointInfo.serverName, mockIConnectionProfile.serverName);
		should.equal(result.sourceEndpointInfo.databaseName, mockIConnectionProfile.databaseName);
		should.equal(result.targetEndpointInfo, undefined);
	});

	it('Should start with the source as dacpac.', async function (): Promise<void> {
		let sc = new SchemaCompareTestService();

		let result = new SchemaCompareMainWindow(testContext.apiWrapper.object, sc, mockExtensionContext.object);
		const dacpacPath = 'C:\\users\\test\\test.dacpac';
		await result.start(dacpacPath);
		let promise = new Promise(resolve => setTimeout(resolve, 5000)); // to ensure comparison result view is initialized
		await promise;

		should.notEqual(result.sourceEndpointInfo, undefined);
		should.equal(result.sourceEndpointInfo.endpointType, mssql.SchemaCompareEndpointType.Dacpac);
		should.equal(result.sourceEndpointInfo.packageFilePath, dacpacPath);
		should.equal(result.targetEndpointInfo, undefined);
	});
});
