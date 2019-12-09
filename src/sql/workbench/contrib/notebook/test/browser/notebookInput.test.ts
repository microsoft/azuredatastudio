/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { nb } from 'azdata';
import { workbenchInstantiationService } from 'vs/workbench/test/workbenchTestServices';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/common/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/common/models/fileNotebookInput';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { UntitledTextEditorModel } from 'vs/workbench/common/editor/untitledTextEditorModel';
import { NodeStub } from 'sql/workbench/contrib/notebook/test/browser/common';

suite('Notebook Input', function (): void {
	const instantiationService = workbenchInstantiationService();

	test('File Notebook Input', async function (): Promise<void> {
		let uri = URI.from({ scheme: Schemas.file, path: 'TestPath' });
		let input = instantiationService.createInstance(FileNotebookInput, 'TestInput', uri, undefined);

		let inputId = input.getTypeId();
		assert.strictEqual(inputId, FileNotebookInput.ID);
	});

	test('Untitled Notebook Input', async function (): Promise<void> {
		let uri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', uri, undefined);

		let inputId = input.getTypeId();
		assert.strictEqual(inputId, UntitledNotebookInput.ID);
	});

	test('Getters and Setters', async function (): Promise<void> {
		let testUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', testUri, undefined);

		// Text Input
		assert.strictEqual(input.textInput, undefined);

		// Notebook URI
		assert.deepStrictEqual(input.notebookUri, testUri);

		// Content Manager
		assert.ok(input.contentManager !== undefined);

		// Connection Profile
		let testProfile = <IConnectionProfile>{};
		input.connectionProfile = testProfile;
		assert.strictEqual(input.connectionProfile, testProfile);

		// Default Kernel
		let testKernel: nb.IKernelSpec = {
			name: 'TestName',
			language: 'TestLanguage',
			display_name: 'TestDisplayName'
		};
		input.defaultKernel = testKernel;
		assert.strictEqual(input.defaultKernel, testKernel);

		// Untitled Editor Model
		let testModel = <UntitledTextEditorModel>{};
		input.untitledEditorModel = testModel;
		assert.strictEqual(input.untitledEditorModel, testModel);

		// getResource
		assert.strictEqual(input.getResource(), testUri);

		// Container
		let testContainer = undefined;
		input.container = testContainer;
		assert.strictEqual(input.container, testContainer);

		// Dispose old container when setting new one
		let removedContainer: HTMLElement;
		let mockParentNode = TypeMoq.Mock.ofType<Node>(NodeStub);
		mockParentNode.setup(e => e.removeChild(TypeMoq.It.isAny())).returns(oldChild => {
			removedContainer = oldChild;
			return oldChild;
		});
		testContainer = <HTMLElement>{ parentNode: mockParentNode.object };
		input.container = testContainer;
		assert.strictEqual(input.container, testContainer);

		let oldContainer = testContainer;
		testContainer = <HTMLElement>{};
		input.container = testContainer;
		assert.strictEqual(input.container, testContainer);
		mockParentNode.verify(e => e.removeChild(TypeMoq.It.isAny()), TypeMoq.Times.once());
		assert.strictEqual(removedContainer, oldContainer);
	});
});
