/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { Deferred } from '../../../common/promise';
import { FilePicker } from '../../../ui/components/filePicker';
import { createModelViewMock } from 'azdata-test/out/mocks/modelView/modelViewMock';
import { StubButton } from 'azdata-test/out/stubs/modelView/stubButton';

let filePicker: FilePicker;
const initialPath = path.join('path', 'to', '.kube','config');
const newFileUri = vscode.Uri.file(path.join('path', 'to', 'new', '.kube', 'config'));
describe('filePicker', function (): void {
	beforeEach(async () => {
		const { modelBuilderMock } = createModelViewMock();
		filePicker = new FilePicker(modelBuilderMock.object, initialPath, (_disposable) => { });
	});

	afterEach(() => {
		sinon.restore();
	});

	it('browse Button chooses new FilePath', async () => {
		should(filePicker.filePathInputBox.value).should.not.be.undefined();
		filePicker.value!.should.equal(initialPath);
		filePicker.component().items.length.should.equal(2, 'Filepicker container should have two components');
		const deferred = new Deferred();
		sinon.stub(vscode.window, 'showOpenDialog').callsFake(async (_options) => {
			deferred.resolve();
			return [newFileUri];
		});
		(filePicker.filePickerButton as StubButton).click();
		await deferred;
		filePicker.value!.should.equal(newFileUri.fsPath);
	});

	describe('getters and setters', async () => {
		it('component getter', () => {
			should(filePicker.component()).not.be.undefined();
		});
	});
});



