/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as should from 'should';
import * as sinon from 'sinon';
import { FilePicker } from '../../../ui/components/filePicker';
import { browseButton, browseButtonEmitter, filePathInputBox, flexContainer, modelBuilder } from '../../mocks/fakeContainersAndBuilders';

let filePicker: FilePicker;
const initialPath = '/path/to/.kube/config';
const newFilePath = '/path/to/new/.kube/config';
describe('filePicker', function (): void {
	beforeEach(async () => {
		filePicker = new FilePicker(modelBuilder, initialPath, (_disposable) => { });
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



