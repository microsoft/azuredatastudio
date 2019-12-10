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
import { basenameOrAuthority } from 'vs/base/common/resources';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { SimpleUriLabelService } from 'vs/editor/standalone/browser/simpleServices';

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
		const testUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });

		const testTitle = 'TestTitle';
		let input = instantiationService.createInstance(UntitledNotebookInput, testTitle, testUri, undefined);

		// Input title
		assert.strictEqual(input.getTitle(), testTitle);

		let noTitleInput = instantiationService.createInstance(UntitledNotebookInput, undefined, testUri, undefined);
		assert.strictEqual(noTitleInput.getTitle(), basenameOrAuthority(testUri));

		// Text Input
		assert.strictEqual(input.textInput, undefined);

		// Notebook URI
		assert.deepStrictEqual(input.notebookUri, testUri);

		// Content Manager
		assert.notStrictEqual(input.editorOpenedTimestamp, undefined);

		// Notebook editor timestamp
		assert.notStrictEqual(input.contentManager, undefined);

		// Layout changed event
		assert.notStrictEqual(input.layoutChanged, undefined);

		// Connection Profile
		let testProfile = <IConnectionProfile>{};
		input.connectionProfile = testProfile;
		assert.strictEqual(input.connectionProfile, testProfile);

		// Default Kernel
		let testDefaultKernel: nb.IKernelSpec = {
			name: 'TestName',
			language: 'TestLanguage',
			display_name: 'TestDisplayName'
		};
		input.defaultKernel = testDefaultKernel;
		assert.strictEqual(input.defaultKernel, testDefaultKernel);

		// Untitled Editor Model
		let testModel = <UntitledTextEditorModel>{};
		input.untitledEditorModel = testModel;
		assert.strictEqual(input.untitledEditorModel, testModel);

		// getResource
		assert.strictEqual(input.getResource(), testUri);

		// Standard kernels
		let testKernels = [{
			name: 'TestName1',
			displayName: 'TestDisplayName1',
			connectionProviderIds: ['TestId1'],
			notebookProvider: 'TestProvider1'
		}, {
			name: 'TestName2',
			displayName: 'TestDisplayName2',
			connectionProviderIds: ['TestId2'],
			notebookProvider: 'TestProvider2'
		}];
		input.standardKernels = testKernels;
		assert.deepStrictEqual(input.standardKernels, testKernels);
	});

	test('Parent container', async function (): Promise<void> {
		let testUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', testUri, undefined);

		// Undefined container
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

	test('Matches other input', async function (): Promise<void> {
		let testUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let textInput = new UntitledTextEditorInput(testUri, false, '', '', '', instantiationService, undefined, new SimpleUriLabelService(), undefined, undefined, undefined);
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', testUri, textInput);

		assert.strictEqual(input.matches(undefined), false, 'Input should not match undefined.');

		assert.ok(input.matches(input), 'Input should match itself.');

		let otherTestUri = URI.from({ scheme: Schemas.untitled, path: 'OtherTestPath' });
		let otherTextInput = new UntitledTextEditorInput(otherTestUri, false, '', '', '', instantiationService, undefined, new SimpleUriLabelService(), undefined, undefined, undefined);
		let otherInput = instantiationService.createInstance(UntitledNotebookInput, 'OtherTestInput', otherTestUri, otherTextInput);

		assert.strictEqual(input.matches(otherInput), false, 'Input should not match different input.');
	});

	// test('IsDirty state', async function (): Promise<void> {
	// 	let testUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
	// 	let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', testUri, undefined);

	// 	let model = await input.resolve();
	// 	model.setDirty(true);
	// });
});
