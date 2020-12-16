/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import * as should from 'should';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { Deferred } from '../../../common/promise';
import { FilePicker } from '../../../ui/components/filePicker';
import { createModelViewMock } from '../../stubs';

let filePicker: FilePicker;
const initialPath = path.join('path', 'to', '.kube','config');
const newFileUri = vscode.Uri.file(path.join('path', 'to', 'new', '.kube', 'config'));
let filePathInputBox: azdata.InputBoxComponent;
let browseButton: azdata.ButtonComponent;
let flexContainer: azdata.FlexContainer;
const browseButtonEmitter = new vscode.EventEmitter<undefined>();
describe('filePicker', function (): void {
	beforeEach(async () => {
		const { mockModelBuilder, mockInputBoxBuilder, mockButtonBuilder, mockFlexBuilder } = createModelViewMock(browseButtonEmitter);
		filePicker = new FilePicker(mockModelBuilder.object, initialPath, (_disposable) => { });
		filePathInputBox = mockInputBoxBuilder.object.component();
		browseButton = mockButtonBuilder.object.component();
		flexContainer = mockFlexBuilder.object.component();
	});

	afterEach(() => {
		sinon.restore();
	});

	it('browse Button chooses new FilePath', async () => {
		should(filePathInputBox.value).should.not.be.undefined();
		filePicker.value!.should.equal(initialPath);
		flexContainer.items.should.deepEqual([filePathInputBox, browseButton]);
		const deferred = new Deferred();
		sinon.stub(vscode.window, 'showOpenDialog').callsFake(async (_options) => {
			deferred.resolve();
			return [newFileUri];
		});
		browseButtonEmitter.fire(undefined); //simulate the click of the browseButton
		await deferred;
		filePicker.value!.should.equal(newFileUri.fsPath);
	});

	describe('getters and setters', async () => {
		it('component getter', () => {
			should(filePicker.component()).equal(flexContainer);
		});
		[true, false].forEach(testValue => {
			it(`Test readOnly with testValue: ${testValue}`, () => {
				filePicker.readOnly = testValue;
				filePicker.readOnly!.should.equal(testValue);
			});
			it(`Test enabled with testValue: ${testValue}`, () => {
				filePicker.enabled = testValue;
				filePicker.enabled!.should.equal(testValue);
			});
		});
	});
});



