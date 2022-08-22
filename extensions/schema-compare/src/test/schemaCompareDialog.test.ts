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
import * as azdataTest from '@microsoft/azdata-test';

import 'mocha';
import { ConnectionDropdownValue, SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { createContext, TestContext } from './testContext';
import { setDacpacEndpointInfo } from './testUtils';
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

	it('Verify server dropdown gets populated appropriately', async function (): Promise<void> {
		const connectionProfile = azdataTest.stubs.connectionProfile.createConnectionProfile();
		const getConnectionsResults: azdata.connection.ConnectionProfile[] = [{ ...connectionProfile }];
		sinon.stub(azdata.connection, 'getCurrentConnection').resolves(undefined);
		sinon.stub(azdata.connection, 'openConnectionDialog').resolves(<any>Promise.resolve(connectionProfile));
		sinon.stub(azdata.connection, 'getConnections').resolves(<any>Promise.resolve(getConnectionsResults));
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);

		let schemaCompareResult = new SchemaCompareMainWindow(undefined, mockExtensionContext.object);
		let dialog = new SchemaCompareDialogTest(schemaCompareResult, undefined, mockExtensionContext.object);

		should.equal(dialog.getSourceServerDropdownValue(), undefined);
		should.equal(dialog.getTargetServerDropdownValue(), undefined);

		await dialog.openDialog();
		await dialog.connectionButtonClick(false);

		await dialog.promise;
		await dialog.promise2;

		// Confirm source server dropdown has the new connection as its value
		should.notEqual(dialog.getSourceServerDropdownValue(), undefined);
		should((dialog.getSourceServerDropdownValue() as ConnectionDropdownValue).connection).deepEqual(connectionProfile, `SourceDropdownValue: (Actual) ${(dialog.getSourceServerDropdownValue() as ConnectionDropdownValue).connection} (Expected) ${connectionProfile}`);

		// Target server dropdown passively populated with the new connection, since it wasn't pre-populated
		should.notEqual(dialog.getTargetServerDropdownValue(), undefined);
		should((dialog.getTargetServerDropdownValue() as ConnectionDropdownValue).connection).deepEqual(connectionProfile, `TargetDropdownValue: (Actual) ${(dialog.getTargetServerDropdownValue() as ConnectionDropdownValue).connection} (Expected) ${connectionProfile}`);
	});

	it('Verify source server dropdown does not get updated when target server is updated', async function (): Promise<void> {
		const connectionProfile1 = azdataTest.stubs.connectionProfile.createConnectionProfile({ connectionName: 'connection1', connectionId: 'testId1', databaseName: 'db1'});
		const connectionProfile2 = azdataTest.stubs.connectionProfile.createConnectionProfile({ connectionName: 'connection2', connectionId: 'testId2', databaseName: 'db2'});

		sinon.stub(azdata.connection, 'getCurrentConnection').resolves({ ...connectionProfile1 });
		sinon.stub(azdata.connection, 'openConnectionDialog').resolves(<any>Promise.resolve(connectionProfile2));
		sinon.stub(azdata.connection, 'getConnections').resolves(<any>Promise.resolve([{ ...connectionProfile1 }, { ...connectionProfile2 }]));
		sinon.stub(azdata.connection, 'listDatabases').resolves(['My Database']);

		let schemaCompareResult = new SchemaCompareMainWindow(undefined, mockExtensionContext.object);
		let dialog = new SchemaCompareDialogTest(schemaCompareResult, undefined, mockExtensionContext.object);

		should.equal(dialog.getSourceServerDropdownValue(), undefined);
		should.equal(dialog.getTargetServerDropdownValue(), undefined);

		await dialog.openDialog();
		await dialog.connectionButtonClick(true);	// openConnectionDialog for target server

		await dialog.promise;
		await dialog.promise2;

		// Confirm source server dropdown has the current connection (from getCurrentConnection) as its value (and doesn't get updated to what target server is)
		should.notEqual(dialog.getSourceServerDropdownValue(), undefined);
		should((dialog.getSourceServerDropdownValue() as ConnectionDropdownValue).connection).deepEqual(connectionProfile1, `SourceDropdownValue: (Actual) ${(dialog.getSourceServerDropdownValue() as ConnectionDropdownValue).connection} (Expected) ${connectionProfile1}`);

		// Confirm target server dropdown has the new connection (from openConnectionDialog) as its value
		should.notEqual(dialog.getTargetServerDropdownValue(), undefined);
		should((dialog.getTargetServerDropdownValue() as ConnectionDropdownValue).connection).deepEqual(connectionProfile2, `TargetDropdownValue: (Actual) ${(dialog.getTargetServerDropdownValue() as ConnectionDropdownValue).connection} (Expected) ${connectionProfile2}`);
	});
});
