/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { nb } from 'azdata';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { NodeStub, NotebookServiceStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { basenameOrAuthority } from 'vs/base/common/resources';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IExtensionService, NullExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { INotebookService, IProviderInfo } from 'sql/workbench/services/notebook/browser/notebookService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';

suite('Notebook Input', function (): void {
	const instantiationService = workbenchInstantiationService();

	const testTitle = 'TestTitle';
	const testProvider = 'TestProvider';
	const untitledUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });

	const mockExtensionService = TypeMoq.Mock.ofType<IExtensionService>(NullExtensionService);
	mockExtensionService.setup(s => s.whenInstalledExtensionsRegistered()).returns(() => Promise.resolve(true));

	const mockNotebookService = TypeMoq.Mock.ofType<INotebookService>(NotebookServiceStub);
	mockNotebookService.setup(s => s.getProvidersForFileType(TypeMoq.It.isAny())).returns(() => [testProvider]);
	mockNotebookService.setup(s => s.getStandardKernelsForProvider(TypeMoq.It.isAny())).returns(() => {
		return [{
			name: 'TestName',
			displayName: 'TestDisplayName',
			connectionProviderIds: ['TestId'],
			notebookProvider: 'TestProvider'
		}];
	});

	(instantiationService as TestInstantiationService).stub(INotebookService, mockNotebookService.object);

	let untitledTextInput: UntitledTextEditorInput;
	let untitledNotebookInput: UntitledNotebookInput;

	setup(() => {
		const accessor = instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		untitledTextInput = instantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: untitledUri }));
		untitledNotebookInput = new UntitledNotebookInput(
			testTitle, untitledUri, untitledTextInput,
			undefined, instantiationService, mockNotebookService.object, mockExtensionService.object);
	});

	test('File Notebook Input', async function (): Promise<void> {
		let fileUri = URI.from({ scheme: Schemas.file, path: 'TestPath' });
		let fileNotebookInput = new FileNotebookInput(
			testTitle, fileUri, undefined,
			undefined, instantiationService, mockNotebookService.object, mockExtensionService.object);

		let inputId = fileNotebookInput.getTypeId();
		assert.strictEqual(inputId, FileNotebookInput.ID);
		assert.strictEqual(fileNotebookInput.isUntitled(), false, 'File Input should not be untitled');
	});

	test('Untitled Notebook Input', async function (): Promise<void> {
		let inputId = untitledNotebookInput.getTypeId();
		assert.strictEqual(inputId, UntitledNotebookInput.ID);
		assert.ok(untitledNotebookInput.isUntitled(), 'Untitled Input should be untitled');
	});

	test('Getters and Setters', async function (): Promise<void> {
		// Input title
		assert.strictEqual(untitledNotebookInput.getTitle(), testTitle);

		let noTitleInput = instantiationService.createInstance(UntitledNotebookInput, undefined, untitledUri, undefined);
		assert.strictEqual(noTitleInput.getTitle(), basenameOrAuthority(untitledUri));

		// Text Input
		assert.strictEqual(untitledNotebookInput.textInput, untitledTextInput);

		// Notebook URI
		assert.deepStrictEqual(untitledNotebookInput.notebookUri, untitledUri);

		// Content Manager
		assert.notStrictEqual(untitledNotebookInput.editorOpenedTimestamp, undefined);

		// Notebook editor timestamp
		assert.notStrictEqual(untitledNotebookInput.contentManager, undefined);

		// Layout changed event
		assert.notStrictEqual(untitledNotebookInput.layoutChanged, undefined);

		// Connection Profile
		let testProfile = <IConnectionProfile>{};
		untitledNotebookInput.connectionProfile = testProfile;
		assert.strictEqual(untitledNotebookInput.connectionProfile, testProfile);

		// Default Kernel
		let testDefaultKernel: nb.IKernelSpec = {
			name: 'TestName',
			language: 'TestLanguage',
			display_name: 'TestDisplayName'
		};
		untitledNotebookInput.defaultKernel = testDefaultKernel;
		assert.strictEqual(untitledNotebookInput.defaultKernel, testDefaultKernel);

		// Untitled Editor Model
		let testModel = <UntitledTextEditorModel>{};
		untitledNotebookInput.untitledEditorModel = testModel;
		assert.strictEqual(untitledNotebookInput.untitledEditorModel, testModel);

		// getResource
		assert.strictEqual(untitledNotebookInput.resource, untitledUri);

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
		untitledNotebookInput.standardKernels = testKernels;
		assert.deepStrictEqual(untitledNotebookInput.standardKernels, testKernels);

		// Provider Info
		let provider = await untitledNotebookInput.getProviderInfo();
		assert.deepStrictEqual(provider, <IProviderInfo>{
			providerId: testProvider,
			providers: [testProvider]
		});
	});

	test('Parent container', async function (): Promise<void> {
		// Undefined container
		let testContainer = undefined;
		untitledNotebookInput.container = testContainer;
		assert.strictEqual(untitledNotebookInput.container, testContainer);

		// Dispose old container when setting new one
		let removedContainer: HTMLElement;
		let mockParentNode = TypeMoq.Mock.ofType<Node>(NodeStub);
		mockParentNode.setup(e => e.removeChild(TypeMoq.It.isAny())).returns(oldChild => {
			removedContainer = oldChild;
			return oldChild;
		});
		testContainer = <HTMLElement>{ parentNode: mockParentNode.object };
		untitledNotebookInput.container = testContainer;
		assert.strictEqual(untitledNotebookInput.container, testContainer);

		let oldContainer = testContainer;
		testContainer = <HTMLElement>{};
		untitledNotebookInput.container = testContainer;
		assert.strictEqual(untitledNotebookInput.container, testContainer);
		mockParentNode.verify(e => e.removeChild(TypeMoq.It.isAny()), TypeMoq.Times.once());
		assert.strictEqual(removedContainer, oldContainer);
	});

	test('Matches other input', async function (): Promise<void> {
		assert.strictEqual(untitledNotebookInput.matches(undefined), false, 'Input should not match undefined.');

		assert.ok(untitledNotebookInput.matches(untitledNotebookInput), 'Input should match itself.');

		let otherTestUri = URI.from({ scheme: Schemas.untitled, path: 'OtherTestPath' });
		const accessor = instantiationService.createInstance(ServiceAccessor);
		const service = accessor.untitledTextEditorService;
		let otherTextInput = instantiationService.createInstance(UntitledTextEditorInput, service.create({ associatedResource: otherTestUri }));
		let otherInput = instantiationService.createInstance(UntitledNotebookInput, 'OtherTestInput', otherTestUri, otherTextInput);

		assert.strictEqual(untitledNotebookInput.matches(otherInput), false, 'Input should not match different input.');
	});
});

class ServiceAccessor {
	constructor(
		@IUntitledTextEditorService public readonly untitledTextEditorService: IUntitledTextEditorService
	) { }
}
