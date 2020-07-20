/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import * as sinon from 'sinon';
import { Deferred } from 'sql/base/common/promise';
import { NBTestQueryManagementService } from 'sql/workbench/contrib/notebook/test/nbTestQueryManagementService';
import { NotebookModelStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/testCommon';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INavigationProvider, INotebookEditor, INotebookManager, INotebookParams, INotebookProvider, NavigationProviders, SQL_NOTEBOOK_PROVIDER, unsavedBooksContextKey } from 'sql/workbench/services/notebook/browser/notebookService';
import { FailToSaveTrustState, NotebookService, NotebookServiceNoProviderRegistered, NotebookUriNotDefined, ProviderDescriptor } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Extensions, INotebookProviderRegistry, NotebookProviderRegistration } from 'sql/workbench/services/notebook/common/notebookRegistry';
import * as TypeMoq from 'typemoq';
import { errorHandler, onUnexpectedError } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { DidInstallExtensionEvent, DidUninstallExtensionEvent, IExtensionIdentifier, IExtensionManagementService, InstallExtensionEvent } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { NullLogService } from 'vs/platform/log/common/log';
import { Registry } from 'vs/platform/registry/common/platform';
import { ExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/extensionManagementService';
import { TestFileService, TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestExtensionService, TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';
import { IProductService } from 'vs/platform/product/common/productService';

/**
 * class to mock azdata.nb.ServerManager object
 */
class TestServerManager implements azdata.nb.ServerManager {
	isStarted: boolean = true; //by default our mock creates ServerManager in started mode.
	onServerStarted: Event<void>;
	async startServer(kernelSpec: azdata.nb.IKernelSpec): Promise<void> {
		this.isStarted = true;
	}
	async stopServer(): Promise<void> {
		this.isStarted = false;
	}

}

/**
 * TestNotebookManager - creates a NotebookManager object that helps keep track of state needed by testing
 */
class TestNotebookManager implements INotebookManager {
	contentManager: undefined;
	sessionManager: undefined;
	constructor(
		public providerId: string = 'providerId1',
		public serverManager: TestServerManager = new TestServerManager()
	) { }
}

/**
 * * TestNotebookProvider - creates a NotebookManager object that helps keep track of state needed by testing
 */
class TestNotebookProvider implements INotebookProvider {
	constructor(
		public providerId: string = 'providerId1',
		public manager: TestNotebookManager = new TestNotebookManager(providerId)
	) { }

	getNotebookManager(uri: URI): Thenable<INotebookManager> {
		return Promise.resolve(this.manager);
	}

	handleNotebookClosed(_notebookUri: URI): void {
		// do nothing
	}
}

suite('ProviderDescriptor:', () => {
	test('Verifies varies getter setters of Provider Descriptor', async () => {
		const notebookProvider = <INotebookProvider>{};
		const providerDescriptor = new ProviderDescriptor(notebookProvider);
		assert.strictEqual(providerDescriptor.instance, notebookProvider, `providerDescriptor instance should be the value passed into the constructor`);
		const providerInstancePromise = providerDescriptor.instanceReady;
		assert.notStrictEqual(providerInstancePromise, undefined, `providerDescriptor instanceReady should not return an undefined promise object`);
		const result = await providerInstancePromise;
		assert.strictEqual(result, notebookProvider, `instanceReady property of the providerDescriptor should resolve with notebookProvider object that it was constructed with`);

		providerDescriptor.instance = undefined;
		assert.strictEqual(providerDescriptor.instance, undefined, `provider.Descriptor instance should be undefined when we set it explicitly to undefined`);
		providerDescriptor.instance = notebookProvider;
		assert.strictEqual(providerDescriptor.instance, notebookProvider, `provider.Descriptor instance should be instance: ${notebookProvider} that we explicitly set it to`);
	});
});

suite('NotebookService:', function (): void {
	let notebookService: NotebookService;
	let lifecycleService: TestLifecycleService;
	let storageService: TestStorageService;
	let extensionService: TestExtensionService;
	let fileService: TestFileService;
	let logService: NullLogService;
	let logServiceMock: TypeMoq.Mock<NullLogService>;
	let contextService: MockContextKeyService;
	let queryManagementService: NBTestQueryManagementService;
	let instantiationService: TestInstantiationService;
	let extensionManagementService: IExtensionManagementService;
	let extensionServiceMock: TypeMoq.Mock<TestExtensionService>;
	let testNo = 0;
	let sandbox: sinon.SinonSandbox;
	let productService: IProductService;

	let installExtensionEmitter: Emitter<InstallExtensionEvent>,
		didInstallExtensionEmitter: Emitter<DidInstallExtensionEvent>,
		uninstallExtensionEmitter: Emitter<IExtensionIdentifier>,
		didUninstallExtensionEmitter: Emitter<DidUninstallExtensionEvent>;

	setup(() => {
		testNo++;
		lifecycleService = new TestLifecycleService();
		storageService = new TestStorageService();

		extensionService = new TestExtensionService();
		extensionServiceMock = TypeMoq.Mock.ofInstance(extensionService);
		extensionServiceMock.callBase = true;

		fileService = new TestFileService();
		logService = new NullLogService();
		logServiceMock = TypeMoq.Mock.ofInstance(logService);
		logServiceMock.callBase = true;

		contextService = new MockContextKeyService();
		queryManagementService = new NBTestQueryManagementService();
		instantiationService = new TestInstantiationService();

		installExtensionEmitter = new Emitter<InstallExtensionEvent>();
		didInstallExtensionEmitter = new Emitter<DidInstallExtensionEvent>();
		uninstallExtensionEmitter = new Emitter<IExtensionIdentifier>();
		didUninstallExtensionEmitter = new Emitter<DidUninstallExtensionEvent>();

		instantiationService.stub(IExtensionManagementService, ExtensionManagementService);
		instantiationService.stub(IExtensionManagementService, 'onInstallExtension', installExtensionEmitter.event);
		instantiationService.stub(IExtensionManagementService, 'onDidInstallExtension', didInstallExtensionEmitter.event);
		instantiationService.stub(IExtensionManagementService, 'onUninstallExtension', uninstallExtensionEmitter.event);
		instantiationService.stub(IExtensionManagementService, 'onDidUninstallExtension', didUninstallExtensionEmitter.event);
		extensionManagementService = instantiationService.get(IExtensionManagementService);

		instantiationService.stub(IProductService, { quality: 'stable' });
		productService = instantiationService.get(IProductService);

		notebookService = new NotebookService(lifecycleService, storageService, extensionServiceMock.object, extensionManagementService, instantiationService, fileService, logServiceMock.object, queryManagementService, contextService, productService);
		sandbox = sinon.sandbox.create();
	});

	teardown(() => {
		sandbox.restore();
	});

	test(`verify that setTrusted logs message and does not throw when storageService.store throws`, async () => {
		const saveError = new Error(`exception encountered while storing`);
		sandbox.stub(storageService, 'store').throws(saveError);
		logServiceMock.setup(x => x.trace(TypeMoq.It.isAnyString())).returns((message: string) => {
			assert.ok(message.startsWith(FailToSaveTrustState), `the traced log message must start with ${FailToSaveTrustState}`);
		}).verifiable(TypeMoq.Times.once());
		const notebookUri = setTrustedSetup(notebookService);
		await notebookService.setTrusted(notebookUri, true);
		logServiceMock.verifyAll();
	});

	test('Validate default properties on create', async function (): Promise<void> {
		assert.equal(notebookService.languageMagics.length, 0, 'No language magics should exist after creation');
		assert.equal(notebookService.listNotebookEditors().length, 0, 'No notebook editors should be listed');
		assert.equal(notebookService.getMimeRegistry().mimeTypes.length, 15, 'MIME Types need to have appropriate tests when added or removed');
		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql'], 'sql provider should be registered for ipynb extension');
		assert.equal(notebookService.getStandardKernelsForProvider('sql').length, 1, 'SQL kernel should be provided by default');
		assert.equal(notebookService.getStandardKernelsForProvider('otherProvider'), undefined, 'Other provider should not have kernels since it has not been added as a provider');
		assert.deepEqual(notebookService.getSupportedFileExtensions(), ['IPYNB'], 'IPYNB file extension should be supported by default');
		await notebookService.registrationComplete;
		assert.ok(notebookService.isRegistrationComplete, `notebookService.isRegistrationComplete should be true once its registrationComplete promise is resolved`);
	});

	test('Validate another provider added successfully', async function (): Promise<void> {
		await notebookService.registrationComplete;
		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql'], 'sql provider should be registered for ipynb extension');

		const otherProviderRegistration: NotebookProviderRegistration = {
			fileExtensions: 'ipynb',
			standardKernels: {
				name: 'kernel1',
				connectionProviderIds: [],
				displayName: 'Kernel 1'
			},
			provider: 'otherProvider'
		};

		const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
		notebookRegistry.registerNotebookProvider(otherProviderRegistration);

		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql', 'otherProvider'], 'otherProvider should also be registered for ipynb extension');
		assert.deepEqual(notebookService.getSupportedFileExtensions(), ['IPYNB'], 'Only IPYNB should be registered as supported file extension');
		assert.equal(notebookService.getStandardKernelsForProvider('otherProvider').length, 1, 'otherProvider kernel info could not be found');
		assert.deepEqual(notebookService.getStandardKernelsForProvider('otherProvider')[0], otherProviderRegistration.standardKernels, 'otherProviderRegistration standard kernels does not match');
	});

	test('tests that dispose() method calls dispose on underlying disposable objects exactly once', async () => {
		await notebookService.registrationComplete;
		notebookService.dispose();
		assert.strictEqual(notebookService['_store']['_isDisposed'], true, `underlying disposable store object should be disposed state`);
	});

	test('verify that getOrCreateNotebookManager does not throw when extensionService.whenInstalledExtensionRegistered() throws', async () => {
		const providerId = 'providerId1';
		createRegisteredProviderWithManager({ notebookService, providerId });
		notebookService.registerProvider(providerId, undefined);
		//verify method under test logs error and does not throw when extensionService.whenInstalledExtensionRegistered() throws
		const error: Error = new Error('Extension Registration Failed');
		extensionServiceMock.setup(x => x.whenInstalledExtensionsRegistered()).throws(error);

		logServiceMock.setup(x => x.error(TypeMoq.It.isAny()))
			.returns((_error: string | Error, ...args: any[]) => {
				assert.strictEqual(_error, error, `error object passed to logService.error call must be the one thrown from whenInstalledExtensionsRegistered call`);
			})
			.verifiable(TypeMoq.Times.once());
		await notebookService.getOrCreateNotebookManager(providerId, URI.parse('untitled:uri1'));
		logServiceMock.verifyAll();
	});


	test('verify that getOrCreateNotebookManager throws when no providers are registered', async () => {
		const methodName = 'getOrCreateNotebookManager';

		// register the builtin sql provider to be undefined
		notebookService.registerProvider(SQL_NOTEBOOK_PROVIDER, undefined);
		try {
			await notebookService.getOrCreateNotebookManager('test', URI.parse('untitled:uri1'));
			throw Error(`${methodName}  did not throw as was expected`);
		} catch (error) {
			assert.strictEqual((error as Error).message, NotebookServiceNoProviderRegistered, `${methodName} should throw error with message:${NotebookServiceNoProviderRegistered}' when no providers are registered`);
		}

		// when even the default provider is not registered, method under test throws exception
		unRegisterProviders(notebookService);
		try {
			await notebookService.getOrCreateNotebookManager(SQL_NOTEBOOK_PROVIDER, URI.parse('untitled:uri1'));
			throw Error(`${methodName} did not throw as was expected`);
		} catch (error) {
			assert.strictEqual((error as Error).message, NotebookServiceNoProviderRegistered, `${methodName} should throw error with message:${NotebookServiceNoProviderRegistered}' when no providers are registered`);
		}
	});

	test('test register/get of navigationProviders', async () => {
		const methodName = 'getNavigationProvider';
		assert.strictEqual(notebookService.getNavigationProvider(), undefined, `${methodName} returns undefined with no providers registered`);

		let providerId = NavigationProviders.NotebooksNavigator;
		let provider1 = <INavigationProvider>{ providerId: providerId };
		notebookService.registerNavigationProvider(provider1);
		let result = notebookService.getNavigationProvider();
		assert.strictEqual(result, provider1, `${methodName} must return the provider that we registered with netbookService for the provider id: ${provider1.providerId}`);

		providerId = NavigationProviders.ProvidedBooksNavigator;
		provider1 = <INavigationProvider>{ providerId: providerId };
		notebookService.registerNavigationProvider(provider1);
		contextService.createKey(unsavedBooksContextKey, {});
		result = notebookService.getNavigationProvider();

		assert.strictEqual(result, provider1, `${methodName} must return the provider that we registered with netbookService for the provider id: ${provider1.providerId}`);
	});

	test('verifies return value of getOrCreateNotebookManager', async () => {
		await notebookService.registrationComplete;
		try {
			await notebookService.getOrCreateNotebookManager(SQL_NOTEBOOK_PROVIDER, undefined);
			throw new Error('expected exception was not thrown');
		} catch (error) {
			assert.strictEqual((error as Error).message, NotebookUriNotDefined, `getOrCreateNotebookManager must throw with UriNotDefined error, when a valid uri is not provided`);
		}
		const provider1Id = SQL_NOTEBOOK_PROVIDER;
		const { providerId: provider2Id, manager: provider2Manager } = createRegisteredProviderWithManager({ providerId: 'provider2Id', notebookService });

		const uri1: URI = URI.parse(`untitled:test1`);
		const uri2: URI = URI.parse(`untitled:test2`);
		const result1 = await notebookService.getOrCreateNotebookManager(provider1Id, uri1);
		const result2 = await notebookService.getOrCreateNotebookManager(provider2Id, uri2);
		const result1Again = await notebookService.getOrCreateNotebookManager(provider1Id, uri1);
		assert.strictEqual(result2, provider2Manager, `the notebook manager for the provider must be the one returned by getNotebookManager of the provider`);
		assert.notStrictEqual(result1, result2, `different notebookManagers should be returned for different uris`);
		assert.strictEqual(result1, result1Again, `same notebookManagers should be returned for same uri for builtin providers`);
		const result2Again = await notebookService.getOrCreateNotebookManager(provider2Id, uri2);
		assert.strictEqual(result2, result2Again, `same notebookManagers should be returned for same uri for custom providers`);
	});

	test('verifies add/remove/find/list/renameNotebookEditor methods and corresponding events', async () => {
		assert.strictEqual(notebookService.findNotebookEditor(undefined), undefined, `findNotebookEditor should return undefined for undefined input`);

		let editorsAdded = 0;
		let editorsRemoved = 0;
		let editorsRenamed = 0;

		const editor1Uri = URI.parse('id1');
		const editor1 = new NotebookEditorStub({
			notebookParams: <INotebookParams>{
				notebookUri: editor1Uri
			}
		});
		// add provider managers for the old and the new uri.
		await addManagers({ notebookService, prefix: 'id', uriPrefix: 'id' });
		await addManagers({ notebookService, prefix: 'newId', uriPrefix: 'newId' });
		notebookService.onNotebookEditorAdd((e: INotebookEditor) => {
			assert.strictEqual(e, editor1, `onNotebookEditorAdd event should fire with the INotebookEditor object that we passed to addNotebookEditor call`);
			editorsAdded++;
		});

		notebookService.onNotebookEditorRemove((e: INotebookEditor) => {
			assert.strictEqual(e, editor1, `onNotebookEditorRemove event should fire with the INotebookEditor object that we passed to removeNotebookEditor call`);
			editorsRemoved++;
		});

		notebookService.onNotebookEditorRename((e: INotebookEditor) => {
			assert.strictEqual(e, editor1, `onNotebookEditorRename event should fire with the INotebookEditor object that we passed to renameNotebookEditor call`);
			editorsRenamed++;
		});
		notebookService.addNotebookEditor(editor1);
		assert.strictEqual(editorsAdded, 1, `onNotebookEditorAdd should have been called that increments editorsAdded value`);
		const newEditor1Uri = URI.parse('newId1');
		notebookService.renameNotebookEditor(editor1Uri, newEditor1Uri, editor1);
		assert.strictEqual(editorsRenamed, 1, `onNotebookEditorRename should have been called that increments editorsRenamed value`);
		const resultOld = notebookService.findNotebookEditor(editor1Uri);
		assert.strictEqual(resultOld, undefined, `findNotebookEditor should return undefined when searching with oldUri`);
		const resultNew = notebookService.findNotebookEditor(newEditor1Uri);
		assert.strictEqual(resultNew, editor1, `findNotebookEditor should return the editor when searching with the latest Uri`);
		let editorList = notebookService.listNotebookEditors();
		assert.strictEqual(editorList.length, 1, `the editor list should just have 1 item`);
		assert.strictEqual(editorList[0], editor1, `the first element in the editor list should be the one that we added`);
		notebookService.removeNotebookEditor(editor1);
		assert.strictEqual(editorsRemoved, 1, `onNotebookEditorRemove should have been called that increments editorsRemoved value`);
		editorList = notebookService.listNotebookEditors();
		assert.strictEqual(editorList.length, 0, `the editor list should be empty after we remove the only item that we added`);

		//Remove editor when there are managers already populated
		await addManagers({ notebookService, prefix: 'newId', uriPrefix: 'newId' });
		editorsRemoved = 0; editorsAdded = 0;
		notebookService.addNotebookEditor(editor1);
		notebookService.removeNotebookEditor(editor1);
		assert.strictEqual(editorsRemoved, 1, `onNotebookEditorRemove should have been called that increments editorsRemoved value`);
	});

	test('test registration of a new provider with multiple filetypes & kernels and verify that corresponding manager is returned by getOrCreateNotebookManager', async () => {
		const providerId = 'Jpeg';
		const notebookProviderRegistration = <NotebookProviderRegistration>{
			provider: providerId,
			fileExtensions: ['jpeg', 'jpg'],
			standardKernels: [<azdata.nb.IStandardKernel>{ name: 'kernel1' }, <azdata.nb.IStandardKernel>{ name: 'kernel2' }]
		};
		const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
		notebookRegistry.registerNotebookProvider(notebookProviderRegistration);
		const managerPromise = notebookService.getOrCreateNotebookManager(providerId, URI.parse('untitled:jpg'));
		const providerInstance = createRegisteredProviderWithManager({ notebookService, providerId });
		notebookService.registerProvider(providerId, providerInstance);
		const result = await managerPromise;

		// verify result
		assert.strictEqual(result, providerInstance.manager, `createRegisteredProviderWithManager must return the manager corresponding to INotebookProvider that we registered`);
	});


	test('verify that firing of extensionService.onDidUninstallExtension event calls removeContributedProvidersFromCache', async () => {
		const methodName = 'removeContributedProvidersFromCache';
		await notebookService.registrationComplete;
		const providerId = 'providerId1';
		extensionServiceMock.setup(x => x.getExtensions()).returns(() => {
			return Promise.resolve([
				<IExtensionDescription>{
					name: 'testExtension',
					publisher: 'Test',
					version: '1.0.0',
					engines: {
						vscode: 'vscode-engine'
					},
					identifier: new ExtensionIdentifier('id1'),
					contributes: {
						notebookProvider: {
							providerId: providerId
						}
					},
					isBuiltin: false,
					isUnderDevelopment: true,
					extensionLocation: URI.parse('extLocation1'),
					enableProposedApi: false,
					forceReload: true
				}
			]);
		});
		const extensionIdentifier = (<DidUninstallExtensionEvent>{
			identifier: {
				id: 'id1'
			}
		});
		const targetMethodSpy = sandbox.spy(notebookService, methodName);
		didUninstallExtensionEmitter.fire(extensionIdentifier);
		assert.ok(targetMethodSpy.calledWithExactly(extensionIdentifier.identifier, extensionServiceMock.object), `call arguments to ${methodName} should be ${extensionIdentifier.identifier} & ${extensionServiceMock.object}`);
		assert.ok(targetMethodSpy.calledOnce, `${methodName} should be called exactly once`);
	});

	test('verify removeContributedProvidersFromCache raises unExpectedError and does not throw', async () => {
		const methodName = 'removeContributedProvidersFromCache';
		const onUnexpectedErrorVerifier = (error: any) => {
			assert.ok(error instanceof Error, `${onUnexpectedError} must be passed an instance of ${Error}`);
			assert.strictEqual((error as Error).message, `Cannot read property 'find' of undefined`, `Error text must be "Cannot read property 'find' of undefined"" when extensionService.getExtensions() returns undefined`);
		};
		errorHandler.setUnexpectedErrorHandler(onUnexpectedErrorVerifier);
		await notebookService.registrationComplete;
		extensionServiceMock.setup(x => x.getExtensions()).returns(() => undefined);
		const extensionIdentifier = (<DidUninstallExtensionEvent>{
			identifier: {
				id: 'id1'
			}
		});
		const targetMethodSpy = sandbox.spy(notebookService, methodName);
		// the following call will encounter an exception internally with extensionService.getExtensions() returning undefined.
		didUninstallExtensionEmitter.fire(extensionIdentifier);
		assert.ok(targetMethodSpy.calledWithExactly(extensionIdentifier.identifier, extensionServiceMock.object), `call arguments to ${methodName} should be ${extensionIdentifier.identifier} & ${extensionServiceMock.object}`);
	});

	test('verify that firing of queryManagementService.onHandlerAdded event completes registration', async () => {
		await notebookService.registrationComplete;
		queryManagementService.onHandlerAddedEmitter.fire(SQL_NOTEBOOK_PROVIDER);
		const connectionTypes = queryManagementService.getRegisteredProviders();
		const kernels = notebookService.getStandardKernelsForProvider(SQL_NOTEBOOK_PROVIDER);
		for (const kernel of kernels) {
			assert.strictEqual(kernel.name, notebookConstants.SQL, `kernel name for standard kernels should be ${notebookConstants.SQL}`);
			assert.strictEqual(kernel.displayName, notebookConstants.SQL, `kernel displayName for standard kernels should be ${notebookConstants.SQL}`);
			assert.deepStrictEqual(kernel.connectionProviderIds, connectionTypes, `kernel's connectionProviderIds for standard kernels should be connectionType:${JSON.stringify(connectionTypes)}`);
		}
	});

	test('verify that notebookService constructor raises error and does not throw when an exception occurs', async () => {
		let unexpectedErrorCalled = false;
		let unexpectedErrorPromise: Deferred<void> = new Deferred<void>();
		const onUnexpectedErrorVerifier = async (error: any) => {
			unexpectedErrorCalled = true;
			assert.ok(error instanceof Error, `onUnexpectedError must be passed an instance of Error`);
			assert.strictEqual((error as Error).message, `Cannot read property 'getRegisteredProviders' of undefined`, `Error text must be "Cannot read property 'getRegisteredProviders' of undefined" when queryManagementService is undefined`);
			unexpectedErrorPromise.resolve();
		};
		errorHandler.setUnexpectedErrorHandler(onUnexpectedErrorVerifier);
		// The following call throws an exception internally with queryManagementService parameter being undefined.
		new NotebookService(lifecycleService, storageService, extensionService, extensionManagementService, instantiationService, fileService, logService, /* queryManagementService */ undefined, contextService, productService);
		await unexpectedErrorPromise;
		assert.strictEqual(unexpectedErrorCalled, true, `onUnexpectedError must be have been raised when queryManagementService is undefined when calling NotebookService constructor`);
	});

	test('verify that shutdown executes in response to lifecycleService.onWillShutdown to stop all serverManager objects', async () => {
		await notebookService.registrationComplete;
		// no managers case
		lifecycleService.fireShutdown();

		// actual shutdown with managers defined
		const testProviders = await addManagers({ notebookService, count: 4 });
		lifecycleService.fireShutdown();
		// verify that all managers are in shutdown state.
		for (const provider of testProviders) {
			assert.strictEqual(provider.manager.serverManager.isStarted, false, `Test Manager:${JSON.stringify(provider.manager)} should be in stopped state after shutdown has been called`);
		}
	});

	suite(`serialization tests`, () => {
		for (const isTrusted of [true, false, undefined]) {
			for (const isModelTrusted of [true, false]) {
				if (isTrusted !== undefined && !isModelTrusted) {
					continue; // if isTrusted is true or false then we need to do only one case of isModelTrusted value and we are arbitrarily choose true as isModelTrusted does not matter in that case.
				}
				test(`verify serializeNotebookStateCache serializes correctly when notebook:isTrusted:${isTrusted} && notebookModel:isTrusted:${isModelTrusted}`, async () => {
					const notebookUri = URI.parse('uri' + testNo); //Generate a unique notebookUri for each test so that information stored by serializeNotebookStateChange is unique for each test.
					const model = new NotebookModelStub();
					const modelMock = TypeMoq.Mock.ofInstance(model);
					modelMock.callBase = true;
					const notebookEditor = new NotebookEditorStub({
						notebookParams: <INotebookParams>{
							notebookUri: notebookUri,
						},
						model: modelMock.object
					});
					notebookEditor.model.trustedMode = isModelTrusted;
					notebookService.addNotebookEditor(notebookEditor);
					const changeType = NotebookChangeType.Saved;
					const cellModel = <ICellModel>{};
					modelMock.setup(x => x.serializationStateChanged(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
						.returns((_changeType: NotebookChangeType, _cellModel?: ICellModel) => {
							assert.strictEqual(_changeType, changeType, `changeType value sent to INotebookModel.serializationStateChange should be the one passed to NotebookService.serializeNotebookStateChange`);
							assert.strictEqual(_cellModel, cellModel, `cellModel value sent to INotebookModel.serializationStateChange should be the one passed to NotebookService.serializeNotebookStateChange`);
						})
						.verifiable(TypeMoq.Times.once());
					await notebookService.serializeNotebookStateChange(notebookUri, changeType, cellModel, isTrusted);
					modelMock.verifyAll();
				});
			}
		}
	});

	test(`verify isNotebookTrustCached when notebook was not previously trusted`, async () => {
		assert.strictEqual(await notebookService.isNotebookTrustCached(URI.parse('untitled:foo'), /* isDirty */ false), true, `untitled notebooks are always trust cached`);
		const notebookUri = URI.parse('id-NeverTrusted');
		const notebookEditor = new NotebookEditorStub({
			notebookParams: <INotebookParams>{
				notebookUri: notebookUri,
			},
			model: new NotebookModelStub()
		});
		notebookService.addNotebookEditor(notebookEditor);
		const result = await notebookService.isNotebookTrustCached(notebookUri, true);
		assert.strictEqual(result, false, 'isNotebookTrustCached returns false when notebookUri was not previously cached');
	});

	for (const isTrusted of [true, false]) {
		for (const isDirty of [true, false]) {
			if (isDirty && !isTrusted) {
				continue;
			}
			test(`verify setTrusted & isNotebookTrustCached calls for isDirty=${isDirty}, isTrusted=${isTrusted}`, async () => {
				const notebookUri = setTrustedSetup(notebookService);
				await notebookService.setTrusted(notebookUri, isTrusted);
				const result = await notebookService.isNotebookTrustCached(notebookUri, isDirty);
				if (isDirty) {
					assert.strictEqual(result, true, 'isNotebookTrustCached returns true when notebookUri was previously cached');
				}
			});
		}
	}

	test(`verify that navigateTo call calls navigateToSection on the editor corresponding to the URI passed in`, async () => {
		const notebookUri = URI.parse('id1');
		const notebookEditor = new NotebookEditorStub({
			notebookParams: <INotebookParams>{
				notebookUri: notebookUri,
			},
			model: new NotebookModelStub()
		});
		const sectionId = 'section1';
		const mock = TypeMoq.Mock.ofInstance(notebookEditor);
		mock.callBase = true;
		notebookService.addNotebookEditor(mock.object);
		mock.setup(x => x.navigateToSection(TypeMoq.It.isAnyString()))
			.returns((_sectionId: string) => {
				assert.strictEqual(_sectionId, sectionId, `sectionId passed into the notebookEditor.navigateToSection must be the one that we passed into notebookService.navigateTo method`);
			})
			.verifiable(TypeMoq.Times.once());
		notebookService.navigateTo(notebookUri, sectionId);
		mock.verifyAll();

	});
});

function unRegisterProviders(notebookService: NotebookService) {
	const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
	// unregister all builtin providers
	for (const providerContribution of notebookRegistry.providers) {
		notebookService.unregisterProvider(providerContribution.provider);
	}
}

function setTrustedSetup(notebookService: NotebookService) {
	const notebookUri = URI.parse('id1');
	const notebookEditor = new NotebookEditorStub({
		notebookParams: <INotebookParams>{
			notebookUri: notebookUri,
		},
		model: new NotebookModelStub()
	});
	notebookService.addNotebookEditor(notebookEditor);
	return notebookUri;
}

function createRegisteredProviderWithManager({ notebookService, providerId = 'providerId', testProviderManagers = undefined }: { providerId?: string; notebookService: NotebookService; testProviderManagers?: TestNotebookProvider[] }): TestNotebookProvider {
	const provider = new TestNotebookProvider(providerId);
	notebookService.registerProvider(providerId, provider);
	if (testProviderManagers !== undefined) {
		testProviderManagers.push(provider);
	}
	return provider;
}

async function addManagers({ notebookService, prefix = 'providerId', uriPrefix = 'id', count = 1 }: { notebookService: NotebookService; prefix?: string; uriPrefix?: string; count?: number; }): Promise<TestNotebookProvider[]> {
	const testProviderManagers = [];
	for (let i: number = 1; i <= count; i++) {
		const providerId = `${prefix}${i}`;
		createRegisteredProviderWithManager({ providerId, notebookService, testProviderManagers });
		await notebookService.getOrCreateNotebookManager(providerId, URI.parse(`${uriPrefix}${i}`));
	}
	return testProviderManagers;
}
