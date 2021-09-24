/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';

import { URI, UriComponents } from 'vs/base/common/uri';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';

import { MainThreadNotebook } from 'sql/workbench/api/browser/mainThreadNotebook';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { IExecuteProvider, ISerializationProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { IExecuteManagerDetails, INotebookSessionDetails, INotebookKernelDetails, INotebookFutureDetails, ISerializationManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { LocalContentManager } from 'sql/workbench/services/notebook/common/localContentManager';
import { TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { ExtHostNotebookShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IProductService } from 'vs/platform/product/common/productService';

suite('MainThreadNotebook Tests', () => {

	let mainThreadNotebook: MainThreadNotebook;
	let mockProxy: TypeMoq.Mock<ExtHostNotebookShape>;
	let notebookUri: URI;
	let mockNotebookService: TypeMoq.Mock<NotebookService>;
	let providerId = 'TestProvider';

	setup(() => {
		mockProxy = TypeMoq.Mock.ofType<ExtHostNotebookShape>(ExtHostNotebookStub);
		let extContext = <IExtHostContext>{
			getProxy: proxyType => mockProxy.object
		};
		const instantiationService = new TestInstantiationService();
		instantiationService.stub(IProductService, { quality: 'stable' });
		let notebookService = new NotebookService(
			new TestLifecycleService(),
			undefined,
			undefined,
			undefined,
			instantiationService,
			undefined,
			undefined,
			undefined,
			new MockContextKeyService(),
			instantiationService.get(IProductService),
			undefined,
			undefined,
			undefined,
			undefined,
		);
		mockNotebookService = TypeMoq.Mock.ofInstance(notebookService);
		notebookUri = URI.parse('file:/user/default/my.ipynb');
		mainThreadNotebook = new MainThreadNotebook(extContext, mockNotebookService.object, instantiationService);
	});

	suite('On registering a serialization provider', () => {
		let provider: ISerializationProvider;
		setup(() => {
			mockNotebookService.setup(s => s.registerSerializationProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				provider = providerImpl;
			});
		});

		test('should call through to notebook service', () => {
			// When I register a provider
			mainThreadNotebook.$registerSerializationProvider(providerId, 1);
			// Then I expect a provider implementation to be passed to the service
			mockNotebookService.verify(s => s.registerSerializationProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.strictEqual(provider.providerId, providerId);
		});
		test('should unregister in service', () => {
			// Given we have a provider
			mainThreadNotebook.$registerSerializationProvider(providerId, 1);
			// When I unregister a provider twice
			mainThreadNotebook.$unregisterSerializationProvider(1);
			mainThreadNotebook.$unregisterSerializationProvider(1);
			// Then I expect it to be unregistered in the service just 1 time
			mockNotebookService.verify(s => s.unregisterSerializationProvider(TypeMoq.It.isValue(providerId)), TypeMoq.Times.once());
		});
	});

	suite('On registering an execute provider', () => {
		let provider: IExecuteProvider;
		setup(() => {
			mockNotebookService.setup(s => s.registerExecuteProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				provider = providerImpl;
			});
		});

		test('should call through to notebook service', () => {
			// When I register a provider
			mainThreadNotebook.$registerExecuteProvider(providerId, 1);
			// Then I expect a provider implementation to be passed to the service
			mockNotebookService.verify(s => s.registerExecuteProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.strictEqual(provider.providerId, providerId);
		});
		test('should unregister in service', () => {
			// Given we have a provider
			mainThreadNotebook.$registerExecuteProvider(providerId, 1);
			// When I unregister a provider twice
			mainThreadNotebook.$unregisterExecuteProvider(1);
			mainThreadNotebook.$unregisterExecuteProvider(1);
			// Then I expect it to be unregistered in the service just 1 time
			mockNotebookService.verify(s => s.unregisterExecuteProvider(TypeMoq.It.isValue(providerId)), TypeMoq.Times.once());
		});
	});

	suite('get notebook managers', () => {
		let serializationManagerWithAllFeatures: ISerializationManagerDetails;
		let executeManagerWithAllFeatures: IExecuteManagerDetails;
		let serializationProvider: ISerializationProvider;
		let executeProvider: IExecuteProvider;

		setup(() => {
			serializationManagerWithAllFeatures = {
				handle: 3,
				hasContentManager: true,
			};
			executeManagerWithAllFeatures = {
				handle: 4,
				hasServerManager: true
			};
			mockNotebookService.setup(s => s.registerSerializationProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				serializationProvider = providerImpl;
			});
			mainThreadNotebook.$registerSerializationProvider(providerId, 1);
			mockNotebookService.setup(s => s.registerExecuteProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				executeProvider = providerImpl;
			});
			mainThreadNotebook.$registerExecuteProvider(providerId, 2);

			// Always return empty specs in this test suite
			mockProxy.setup(p => p.$refreshSpecs(TypeMoq.It.isAnyNumber())).returns(() => Promise.resolve(undefined));
		});

		test('should return execute manager with undefined server manager if extension host has none', async () => {
			// Given the extension provider doesn't have acontent or server manager
			let details: IExecuteManagerDetails = {
				handle: 2,
				hasServerManager: false
			};
			mockProxy.setup(p => p.$getExecuteManagerDetails(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
				.returns(() => Promise.resolve(details));

			// When I get the notebook manager
			let manager = await executeProvider.getExecuteManager(notebookUri);

			// And it should not define a server manager
			assert.strictEqual(manager.serverManager, undefined);
		});

		test('should return serialization manager with a content manager if extension host has these', async () => {
			// Given the extension provider doesn't have acontent or server manager
			mockProxy.setup(p => p.$getSerializationManagerDetails(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
				.returns(() => Promise.resolve(serializationManagerWithAllFeatures));

			// When I get the notebook manager
			let manager = await serializationProvider.getSerializationManager(notebookUri);

			// Then it shouldn't have wrappers for the content manager
			assert.ok(!(manager.contentManager instanceof LocalContentManager));
		});

		test('should return execute manager with a server manager if extension host has these', async () => {
			// Given the extension provider doesn't have acontent or server manager
			mockProxy.setup(p => p.$getExecuteManagerDetails(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
				.returns(() => Promise.resolve(executeManagerWithAllFeatures));

			// When I get the notebook manager
			let manager = await executeProvider.getExecuteManager(notebookUri);

			// Then it shouldn't have wrappers for the server manager
			assert.notStrictEqual(manager.serverManager, undefined);
		});
	});

});

class ExtHostNotebookStub implements ExtHostNotebookShape {
	$getSerializationManagerDetails(providerHandle: number, notebookUri: UriComponents): Thenable<ISerializationManagerDetails> {
		throw new Error('Method not implemented.');
	}
	$getExecuteManagerDetails(providerHandle: number, notebookUri: UriComponents): Thenable<IExecuteManagerDetails> {
		throw new Error('Method not implemented.');
	}
	$handleNotebookClosed(notebookUri: UriComponents): void {
		throw new Error('Method not implemented.');
	}
	$doStartServer(managerHandle: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$doStopServer(managerHandle: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$deserializeNotebook(managerHandle: number, contents: string): Thenable<azdata.nb.INotebookContents> {
		throw new Error('Method not implemented.');
	}
	$serializeNotebook(managerHandle: number, notebook: azdata.nb.INotebookContents): Thenable<string> {
		throw new Error('Method not implemented.');
	}
	$refreshSpecs(managerHandle: number): Thenable<azdata.nb.IAllKernels> {
		throw new Error('Method not implemented.');
	}
	$startNewSession(managerHandle: number, options: azdata.nb.ISessionOptions): Thenable<INotebookSessionDetails> {
		throw new Error('Method not implemented.');
	}
	$shutdownSession(managerHandle: number, sessionId: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$shutdownAll(managerHandle: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$changeKernel(sessionId: number, kernelInfo: azdata.nb.IKernelSpec): Thenable<INotebookKernelDetails> {
		throw new Error('Method not implemented.');
	}
	$configureKernel(sessionId: number, kernelInfo: azdata.nb.IKernelSpec): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$configureConnection(sessionId: number, conneection: azdata.IConnectionProfile): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$getKernelReadyStatus(kernelId: number): Thenable<azdata.nb.IInfoReply> {
		throw new Error('Method not implemented.');
	}
	$getKernelSpec(kernelId: number): Thenable<azdata.nb.IKernelSpec> {
		throw new Error('Method not implemented.');
	}
	$requestComplete(kernelId: number, content: azdata.nb.ICompleteRequest): Thenable<azdata.nb.ICompleteReplyMsg> {
		throw new Error('Method not implemented.');
	}
	$requestExecute(kernelId: number, content: azdata.nb.IExecuteRequest, disposeOnDone?: boolean): Thenable<INotebookFutureDetails> {
		throw new Error('Method not implemented.');
	}
	$interruptKernel(kernelId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	$sendInputReply(futureId: number, content: azdata.nb.IInputReply): void {
		throw new Error('Method not implemented.');
	}
	$disposeFuture(futureId: number): void {
		throw new Error('Method not implemented.');
	}
	$dispose(): void {
		throw new Error('Method not implemented.');
	}
}
