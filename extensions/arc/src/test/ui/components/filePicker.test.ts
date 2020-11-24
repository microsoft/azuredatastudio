/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import { FilePicker } from '../../../ui/components/filePicker';
import { createModelViewMock } from '../../stubs';

let filePicker: FilePicker;
const initialPath = '/path/to/.kube/config';
const newFilePath = '/path/to/new/.kube/config';
let filePathInputBox: azdata.InputBoxComponent;
let browseButton: azdata.ButtonComponent;
let flexContainer: azdata.FlexContainer;
const browseButtonEmitter = new vscode.EventEmitter<undefined>();
describe('filePicker', function (): void {
	beforeEach(async () => {
		const { mockModelBuilder, mockInputBoxBuilder, mockButtonBuilder } = createModelViewMock();
		filePicker = new FilePicker(mockModelBuilder.object, initialPath, (_disposable) => { });
		filePathInputBox = mockInputBoxBuilder.object.component();
		browseButton = mockButtonBuilder.object.component();
	});

	afterEach(() => {
		sinon.restore();
	});

	it('browse Button chooses new FilePath', async () => {
		should(filePathInputBox.value).should.not.be.undefined();
		filePathInputBox.value!.should.equal(initialPath);
		flexContainer.items.should.deepEqual([filePathInputBox, browseButton]);
		sinon.stub(vscode.window, 'showOpenDialog').resolves([<vscode.Uri>{ fsPath: newFilePath }]);
		browseButtonEmitter.fire(undefined); //simulate the click of the browseButton
		filePathInputBox.value!.should.equal(newFilePath);
	});

	it('getters and setters', async () => {
		filePicker.component().should.equal(filePathInputBox);
		[true, false, undefined].forEach(testValue => {
			filePicker.readOnly = testValue;
			filePicker.readOnly!.should.equal(testValue);
			filePicker.enabled = testValue;
			filePicker.enabled!.should.equal(testValue);
		});
	});
});



