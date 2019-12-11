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
import { NodeStub, NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { basenameOrAuthority } from 'vs/base/common/resources';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { SimpleUriLabelService } from 'vs/editor/standalone/browser/simpleServices';
import { IExtensionService, NullExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { INotebookService, IProviderInfo } from 'sql/workbench/services/notebook/browser/notebookService';

suite('Notebook Input', function (): void {
	const instantiationService = workbenchInstantiationService();

	const testTitle = 'TestTitle';
	const testProvider = 'TestProvider';
	const untitledUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });

	let fileInput: FileNotebookInput;

	let untitledTextInput: UntitledTextEditorInput;
	let untitledInput: UntitledNotebookInput;

	setup(() => {
		let fileUri = URI.from({ scheme: Schemas.file, path: 'TestPath' });
		fileInput = instantiationService.createInstance(FileNotebookInput, testTitle, fileUri, undefined);

		untitledTextInput = new UntitledTextEditorInput(untitledUri, false, '', '', '', instantiationService, undefined, new SimpleUriLabelService(), undefined, undefined, undefined);
		untitledInput = instantiationService.createInstance(UntitledNotebookInput, testTitle, untitledUri, untitledTextInput);

		// Override private service fields
		let mockExtensionService = TypeMoq.Mock.ofType<IExtensionService>(NullExtensionService);
		mockExtensionService.setup(s => s.whenInstalledExtensionsRegistered()).returns(() => Promise.resolve(true));

		let mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
		mockNotebookService.setup(s => s.getProvidersForFileType(TypeMoq.It.isAny())).returns(() => [testProvider]);
		mockNotebookService.setup(s => s.getStandardKernelsForProvider(TypeMoq.It.isAny())).returns(() => {
			return [{
				name: 'TestName',
				displayName: 'TestDisplayName',
				connectionProviderIds: ['TestId'],
				notebookProvider: 'TestProvider'
			}];
		});

		(<any>untitledInput).textModelService = undefined;
		(<any>untitledInput).instantiationService = instantiationService;
		(<any>untitledInput).notebookService = mockNotebookService.object;
		(<any>untitledInput).extensionService = mockExtensionService.object;
	});

	test('File Notebook Input', async function (): Promise<void> {
		let inputId = fileInput.getTypeId();
		assert.strictEqual(inputId, FileNotebookInput.ID);
		assert.strictEqual(fileInput.isUntitled(), false, 'File Input should not be untitled');
	});

	test('Untitled Notebook Input', async function (): Promise<void> {
		let inputId = untitledInput.getTypeId();
		assert.strictEqual(inputId, UntitledNotebookInput.ID);
		assert.ok(untitledInput.isUntitled(), 'Untitled Input should be untitled');
	});

	test('Getters and Setters', async function (): Promise<void> {
		// Input title
		assert.strictEqual(untitledInput.getTitle(), testTitle);

		let noTitleInput = instantiationService.createInstance(UntitledNotebookInput, undefined, untitledUri, undefined);
		assert.strictEqual(noTitleInput.getTitle(), basenameOrAuthority(untitledUri));

		// Text Input
		assert.strictEqual(untitledInput.textInput, untitledTextInput);

		// Notebook URI
		assert.deepStrictEqual(untitledInput.notebookUri, untitledUri);

		// Content Manager
		assert.notStrictEqual(untitledInput.editorOpenedTimestamp, undefined);

		// Notebook editor timestamp
		assert.notStrictEqual(untitledInput.contentManager, undefined);

		// Layout changed event
		assert.notStrictEqual(untitledInput.layoutChanged, undefined);

		// Connection Profile
		let testProfile = <IConnectionProfile>{};
		untitledInput.connectionProfile = testProfile;
		assert.strictEqual(untitledInput.connectionProfile, testProfile);

		// Default Kernel
		let testDefaultKernel: nb.IKernelSpec = {
			name: 'TestName',
			language: 'TestLanguage',
			display_name: 'TestDisplayName'
		};
		untitledInput.defaultKernel = testDefaultKernel;
		assert.strictEqual(untitledInput.defaultKernel, testDefaultKernel);

		// Untitled Editor Model
		let testModel = <UntitledTextEditorModel>{};
		untitledInput.untitledEditorModel = testModel;
		assert.strictEqual(untitledInput.untitledEditorModel, testModel);

		// getResource
		assert.strictEqual(untitledInput.getResource(), untitledUri);

		// Standard kernels
		let testKernels = [{
			name: 'TestName1',
			displayName: 'TestDisplayName1',
			connectionProviderIds: ['TestId1'],
			notebookProvider: 'TestProvider'
		}, {
			name: 'TestName2',
			displayName: 'TestDisplayName2',
			connectionProviderIds: ['TestId2'],
			notebookProvider: 'TestProvider'
		}];
		untitledInput.standardKernels = testKernels;
		assert.deepStrictEqual(untitledInput.standardKernels, testKernels);

		// Provider Info
		let provider = await untitledInput.getProviderInfo();
		assert.deepStrictEqual(provider, <IProviderInfo>{
			providerId: testProvider,
			providers: [testProvider]
		});
	});

	test('Parent container', async function (): Promise<void> {
		// Undefined container
		let testContainer = undefined;
		untitledInput.container = testContainer;
		assert.strictEqual(untitledInput.container, testContainer);

		// Dispose old container when setting new one
		let removedContainer: HTMLElement;
		let mockParentNode = TypeMoq.Mock.ofType<Node>(NodeStub);
		mockParentNode.setup(e => e.removeChild(TypeMoq.It.isAny())).returns(oldChild => {
			removedContainer = oldChild;
			return oldChild;
		});
		testContainer = <HTMLElement>{ parentNode: mockParentNode.object };
		untitledInput.container = testContainer;
		assert.strictEqual(untitledInput.container, testContainer);

		let oldContainer = testContainer;
		testContainer = <HTMLElement>{};
		untitledInput.container = testContainer;
		assert.strictEqual(untitledInput.container, testContainer);
		mockParentNode.verify(e => e.removeChild(TypeMoq.It.isAny()), TypeMoq.Times.once());
		assert.strictEqual(removedContainer, oldContainer);
	});

	test('Matches other input', async function (): Promise<void> {
		assert.strictEqual(untitledInput.matches(undefined), false, 'Input should not match undefined.');

		assert.ok(untitledInput.matches(untitledInput), 'Input should match itself.');

		let otherTestUri = URI.from({ scheme: Schemas.untitled, path: 'OtherTestPath' });
		let otherTextInput = new UntitledTextEditorInput(otherTestUri, false, '', '', '', instantiationService, undefined, new SimpleUriLabelService(), undefined, undefined, undefined);
		let otherInput = instantiationService.createInstance(UntitledNotebookInput, 'OtherTestInput', otherTestUri, otherTextInput);

		assert.strictEqual(untitledInput.matches(otherInput), false, 'Input should not match different input.');
	});
});
