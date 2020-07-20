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
import { INotebookProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { INotebookManagerDetails, INotebookSessionDetails, INotebookKernelDetails, INotebookFutureDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
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
		mockProxy = TypeMoq.Mock.ofType(ExtHostNotebookStub);
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
			instantiationService.get(IProductService)
		);
		mockNotebookService = TypeMoq.Mock.ofInstance(notebookService);
		notebookUri = URI.parse('file:/user/default/my.ipynb');
		mainThreadNotebook = new MainThreadNotebook(extContext, mockNotebookService.object, instantiationService);
	});

	suite('On registering a provider', () => {
		let provider: INotebookProvider;
		setup(() => {
			mockNotebookService.setup(s => s.registerProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				provider = providerImpl;
			});
		});

		test('should call through to notebook service', () => {
			// When I register a provider
			mainThreadNotebook.$registerNotebookProvider(providerId, 1);
			// Then I expect a provider implementation to be passed to the service
			mockNotebookService.verify(s => s.registerProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.once());
			assert.equal(provider.providerId, providerId);
		});
		test('should unregister in service', () => {
			// Given we have a provider
			mainThreadNotebook.$registerNotebookProvider(providerId, 1);
			// When I unregister a provider twice
			mainThreadNotebook.$unregisterNotebookProvider(1);
			mainThreadNotebook.$unregisterNotebookProvider(1);
			// Then I expect it to be unregistered in the service just 1 time
			mockNotebookService.verify(s => s.unregisterProvider(TypeMoq.It.isValue(providerId)), TypeMoq.Times.once());
		});
	});

	suite('getNotebookManager', () => {
		let managerWithAllFeatures: INotebookManagerDetails;
		let provider: INotebookProvider;

		setup(() => {
			managerWithAllFeatures = {
				handle: 2,
				hasContentManager: true,
				hasServerManager: true
			};
			mockNotebookService.setup(s => s.registerProvider(TypeMoq.It.isAnyString(), TypeMoq.It.isAny())).returns((id, providerImpl) => {
				provider = providerImpl;
			});
			mainThreadNotebook.$registerNotebookProvider(providerId, 1);

			// Always return empty specs in this test suite
			mockProxy.setup(p => p.$refreshSpecs(TypeMoq.It.isAnyNumber())).returns(() => Promise.resolve(undefined));
		});

		test('should return manager with default content manager & undefined server manager if extension host has none', async () => {
			// Given the extension provider doesn't have acontent or server manager
			let details: INotebookManagerDetails = {
				handle: 2,
				hasContentManager: false,
				hasServerManager: false
			};
			mockProxy.setup(p => p.$getNotebookManager(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
				.returns(() => Promise.resolve(details));

			// When I get the notebook manager
			let manager = await provider.getNotebookManager(notebookUri);

			// Then it should use the built-in content manager
			assert.ok(manager.contentManager instanceof LocalContentManager);
			// And it should not define a server manager
			assert.equal(manager.serverManager, undefined);
		});

		test('should return manager with a content & server manager if extension host has these', async () => {
			// Given the extension provider doesn't have acontent or server manager
			mockProxy.setup(p => p.$getNotebookManager(TypeMoq.It.isAnyNumber(), TypeMoq.It.isValue(notebookUri)))
				.returns(() => Promise.resolve(managerWithAllFeatures));

			// When I get the notebook manager
			let manager = await provider.getNotebookManager(notebookUri);

			// Then it shouldn't have wrappers for the content or server manager
			assert.ok(!(manager.contentManager instanceof LocalContentManager));
			assert.notEqual(manager.serverManager, undefined);
		});
	});

});

class ExtHostNotebookStub implements ExtHostNotebookShape {
	$getNotebookManager(providerHandle: number, notebookUri: UriComponents): Thenable<INotebookManagerDetails> {
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
	$getNotebookContents(managerHandle: number, notebookUri: UriComponents): Thenable<azdata.nb.INotebookContents> {
		throw new Error('Method not implemented.');
	}
	$save(managerHandle: number, notebookUri: UriComponents, notebook: azdata.nb.INotebookContents): Thenable<azdata.nb.INotebookContents> {
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
}
