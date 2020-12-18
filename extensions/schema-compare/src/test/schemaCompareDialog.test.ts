/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as loc from '../localizedConstants';
import 'mocha';
import { SchemaCompareDialog } from './../dialogs/schemaCompareDialog';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { createContext, TestContext } from './testContext';
import { setDacpacEndpointInfo } from './testUtils';
import { SchemaCompareMainWindowTest } from './testSchemaCompareMainWindow';

// Mock test data
const mocksource: string = 'source.dacpac';
const mocktarget: string = 'target.dacpac';

let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
let testContext: TestContext;

before(function (): void {
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

		should(dialog.dialog.title).equal(loc.SchemaCompareLabel);
		should(dialog.dialog.okButton.label).equal(loc.OkButtonText);
		should(dialog.dialog.okButton.enabled).equal(false); // Should be false when open
	});

	it('Simulate ok button- with both endpoints set to dacpac', async function (): Promise<void> {
		let schemaCompareResult = new SchemaCompareMainWindowTest(testContext.apiWrapper.object, undefined, mockExtensionContext.object);
		await schemaCompareResult.start(undefined);
		schemaCompareResult.sourceEndpointInfo = setDacpacEndpointInfo(mocksource);
		schemaCompareResult.targetEndpointInfo = setDacpacEndpointInfo(mocktarget);

		let dialog = new SchemaCompareDialog(schemaCompareResult);
		await dialog.openDialog();

		await dialog.execute();

		// Confirm that ok button got clicked
		schemaCompareResult.verifyButtonsState( {
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
		} );
	});
});
