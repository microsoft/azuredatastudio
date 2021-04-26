/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as loc from '../localizedConstants';
import * as sinon from 'sinon';
import * as azdata from 'azdata';
import 'mocha';
import { ConnectionDropdownValue, SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { createContext, TestContext } from './testContext';
import { mockConnection, mockConnectionProfile, setDacpacEndpointInfo } from './testUtils';
import { SchemaCompareMainWindowTest } from './testSchemaCompareMainWindow';
import { SchemaCompareDialogTest } from './testSchemaCompareDialog';

// Mock test data
const mocksource: string = 'source.dacpac';
const mocktarget: string = 'target.dacpac';

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let testContext: TestContext;

before(function (): void {
	testContext = createContext();
});

afterEach(() => {
	sinon.restore();
});

describe('SchemaCompareDialog.openDialog @DacFx@', function (): void {
	before(() => {
		mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
		mockExtensionContext.setup(x => x.extensionPath).returns(() => '');
	});

	it('Should be correct when created.', async function (): Promise<void> {
		let schemaCompareResult = new SchemaCompareMainWindow(undefined, mockExtensionContext.object);
		let dialog = new SchemaCompareDialog(schemaCompareResult, undefined, mockExtensionContext.object);
		await dialog.openDialog();

		should(dialog.dialog.title).equal(loc.SchemaCompareLabel);
		should(dialog.dialog.okButton.label).equal(loc.OkButtonText);
		should(dialog.dialog.okButton.enabled).equal(false); // Should be false when open
	});

	it('Simulate ok button- with both endpoints set to dacpac', async function (): Promise<void> {
		let schemaCompareResult = new SchemaCompareMainWindowTest(undefined, mockExtensionContext.object, undefined);
		await schemaCompareResult.start(undefined);
		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		let dialog = new SchemaCompareDialog(schemaCompareResult, undefined, mockExtensionContext.object);
		await dialog.openDialog();

		await dialog.execute();

		// Confirm that ok button got clicked
		schemaCompareResult.verifyButtonsState({
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

	it('Verify database dropdown gets populated appropriately', async function (): Promise<void> {
		const getConnectionsResults: azdata.connection.ConnectionProfile[] = [{ ...mockConnectionProfile }];
		sinon.stub(azdata.connection, 'getCurrentConnection').resolves(undefined);
		sinon.stub(azdata.connection, 'openConnectionDialog').resolves(<any>Promise.resolve(mockConnection));
		sinon.stub(azdata.connection, 'getConnections').resolves(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);

		let schemaCompareResult = new SchemaCompareMainWindow(undefined, mockExtensionContext.object);
		let dialog = new SchemaCompareDialogTest(schemaCompareResult, undefined, mockExtensionContext.object);

		should.equal(dialog.getSourceDropdownValue(), undefined);
		should.equal(dialog.getTargetDropdownValue(), undefined);

		await dialog.openDialog();
		await dialog.connectionButtonClick(false);

		// Confirm source and target dropdowns have the new connection as its value
		should.notEqual(dialog.getSourceDropdownValue(), undefined);
		should((dialog.getSourceDropdownValue() as ConnectionDropdownValue).connection).deepEqual(mockConnectionProfile, `SourceDropdownValue: (Actual) ${(dialog.getSourceDropdownValue() as ConnectionDropdownValue).connection} (Expected) ${mockConnectionProfile}`);

		should.notEqual(dialog.getTargetDropdownValue(), undefined);
		should((dialog.getTargetDropdownValue() as ConnectionDropdownValue).connection).deepEqual(mockConnectionProfile, `TargetDropdownValue: (Actual) ${(dialog.getTargetDropdownValue() as ConnectionDropdownValue).connection} (Expected) ${mockConnectionProfile}`);
	});
});
