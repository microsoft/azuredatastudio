/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import { Deferred } from 'sql/base/common/promise';
import { NBTestQueryManagementService } from 'sql/workbench/contrib/notebook/test/nbTestQueryManagementService';
import { NotebookModelStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { getMockAndSpy, NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/testCommon';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { INavigationProvider, INotebookEditor, INotebookManager, INotebookParams, INotebookProvider, NavigationProviders, SQL_NOTEBOOK_PROVIDER } from 'sql/workbench/services/notebook/browser/notebookService';
import { NotebookProviderProperties, NotebookProvidersMemento, NotebookService, NotebookUriNotDefined, ProviderDescriptor, TrustedNotebooksMemento } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Extensions, INotebookProviderRegistry, NotebookProviderRegistration } from 'sql/workbench/services/notebook/common/notebookRegistry';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import * as TypeMoq from 'typemoq';
import { errorHandler, onUnexpectedError } from 'vs/base/common/errors';
import { Emitter } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { DidInstallExtensionEvent, DidUninstallExtensionEvent, IExtensionIdentifier, IExtensionManagementService, InstallExtensionEvent } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IFileService } from 'vs/platform/files/common/files';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { MockContextKeyService } from 'vs/platform/keybinding/test/common/mockKeybindingService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { Registry } from 'vs/platform/registry/common/platform';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { Memento } from 'vs/workbench/common/memento';
import { ExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/extensionManagementService';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { TestFileService, TestLifecycleService } from 'vs/workbench/test/browser/workbenchTestServices';
import { TestExtensionService, TestStorageService } from 'vs/workbench/test/common/workbenchTestServices';


/**
 * A passthrough Test class for NotebookService. It has no functionality but is just used to keep track of state of underlying
 * NotebookService object and in some case provide access to its protected properties.
 */
class TestNotebookService extends NotebookService {
	constructor(
		_lifecycleService: ILifecycleService,
		_storageService: IStorageService,
		_extensionService: IExtensionService,
		_extensionManagementService: IExtensionManagementService,
		_instantiationService: IInstantiationService,
		_fileService: IFileService,
		_logService: ILogService,
		_queryManagementService: IQueryManagementService,
		_contextKeyService: IContextKeyService
	) {
		super(_lifecycleService, _storageService, _extensionService, _extensionManagementService, _instantiationService, _fileService, _logService, _queryManagementService, _contextKeyService);
	}

	hasShutdown: boolean = false;

	getThemeParticipant = (): IDisposable => this._themeParticipant;
	setThemeParticipant = (themeParticipant: IDisposable) => this._themeParticipant = themeParticipant;
	getProvidersMemento = (): NotebookProvidersMemento => this.providersMemento;
	baseGetTrustedNotebooksMemento = (): TrustedNotebooksMemento => this.trustedNotebooksMemento;
	getTrustedNotebooksMemento = (): Memento => this._trustedNotebooksMemento;
	setTrustedNotebooksMemento = (value: Memento) => this._trustedNotebooksMemento = value;
	getIsRegistrationComplete = (): boolean => this._isRegistrationComplete;
	setIsRegistrationComplete = (value: boolean): boolean => this._isRegistrationComplete = value;
	baseGetProviderInstance = async (providerId: string, timeout?: number): Promise<INotebookProvider> =>
		await this.getProviderInstance(providerId, timeout);
	baseRemoveContributedProvidersFromCache = async (identifier: IExtensionIdentifier, extensionService: IExtensionService): Promise<void> =>
		await this.removeContributedProvidersFromCache(identifier, extensionService);
	getTrustedCacheQueue = (): URI[] => this._trustedCacheQueue;
	setTrustedCacheQueue = (value: URI[]) => this._trustedCacheQueue = value;
	getUnTrustedCacheQueue = (): URI[] => this._unTrustedCacheQueue;
	setUntrustedCacheQueue = (value: URI[]) => this._unTrustedCacheQueue = value;
	executeCleanupProviders = (): void => this.cleanupProviders();
	protected shutdown(): void {
		super.shutdown();
		this.hasShutdown = true;
	}
}

suite('MyTest class ProviderDescriptor:', () => {
	test('Verifies varies getter setters of Provider Descriptor', async () => {
		const notebookProvider = <INotebookProvider>{};
		const providerDescriptor = new ProviderDescriptor(notebookProvider);
		assert.strictEqual(providerDescriptor.instance, notebookProvider, `providerDescriptor instance should be the value passed into the constructor`);
		const providerInstancePromise = providerDescriptor.instanceReady;
		assert.notStrictEqual(providerInstancePromise, undefined, `providerDescriptor instanceReady should return an undefined promise object`);
		const result = await providerInstancePromise;
		assert.strictEqual(result, notebookProvider, `instanceReady property of the providerDescriptor should resolve with notebookProvider object that it was constructed with`);

		providerDescriptor.instance = undefined;
		assert.strictEqual(providerDescriptor.instance, undefined, `provider.Descriptor instance should be undefined when we set it explicitly to undefined`);
		providerDescriptor.instance = notebookProvider;
		assert.strictEqual(providerDescriptor.instance, notebookProvider, `provider.Descriptor instance should be instance: ${notebookProvider} that we explicitly set it to`);
	});
});

suite('MyTest class NotebookService:', function (): void {
	let notebookService: TestNotebookService;
	let lifecycleService: TestLifecycleService;
	let storageService: TestStorageService;
	let extensionService: TestExtensionService;
	let spiedExtensionService: TestExtensionService;
	let fileService: TestFileService;
	let logService: NullLogService;
	let contextService: MockContextKeyService;
	let queryManagementService: NBTestQueryManagementService;
	let instantiationService: TestInstantiationService;
	let extensionManagementService: IExtensionManagementService;
	let extensionServiceMock: TypeMoq.Mock<TestExtensionService>;

	let installExtensionEmitter: Emitter<InstallExtensionEvent>,
		didInstallExtensionEmitter: Emitter<DidInstallExtensionEvent>,
		uninstallExtensionEmitter: Emitter<IExtensionIdentifier>,
		didUninstallExtensionEmitter: Emitter<DidUninstallExtensionEvent>;

	setup(() => {
		lifecycleService = new TestLifecycleService();
		storageService = new TestStorageService();
		extensionService = new TestExtensionService();
		const { mock: mock, spy: spy } = getMockAndSpy(extensionService);
		extensionServiceMock = mock;
		spiedExtensionService = spy;

		fileService = new TestFileService();
		logService = new NullLogService();
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

		notebookService = new TestNotebookService(lifecycleService, storageService, spiedExtensionService, extensionManagementService, instantiationService, fileService, logService, queryManagementService, contextService);
	});

	test('Validate default properties on create', async function (): Promise<void> {
		assert.equal(notebookService.languageMagics.length, 0, 'No language magics should exist after creation');
		assert.equal(notebookService.listNotebookEditors().length, 0, 'No notebook editors should be listed');
		assert.equal(notebookService.getMimeRegistry().mimeTypes.length, 15, 'MIME Types need to have appropriate tests when added or removed');
		assert.deepEqual(notebookService.getProvidersForFileType('ipynb'), ['sql'], 'sql provider should be registered for ipynb extension');
		assert.equal(notebookService.getStandardKernelsForProvider('sql').length, 1, 'SQL kernel should be provided by default');
		assert.equal(notebookService.getStandardKernelsForProvider('otherProvider'), undefined, 'Other provider should not have kernels since it has not been added as a provider');
		assert.deepEqual(notebookService.getSupportedFileExtensions(), ['IPYNB'], 'IPYNB file extension should be supported by default');
	});

	test('Validate another provider added successfully', async function (): Promise<void> {
		await notebookService.registrationComplete;
		assert.equal(notebookService.isRegistrationComplete, true, 'Registration should be complete since sql provider exists in queryManagementService');
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
		let disposeCount: number = 0;
		const themeParticipant: IDisposable = {
			dispose(): void {
				disposeCount++;
			}
		};

		notebookService.setThemeParticipant(themeParticipant);
		notebookService.dispose();
		assert.strictEqual(disposeCount, 1, `underlying disposable object should have been disposed exactly once`);
		assert.strictEqual(notebookService['_store']['_isDisposed'], true, `underlying disposable store object should be disposed state`);
	});

	test('test register/get/unregister of providers', async () => {
		const methodName = 'getProviderInstance';
		const provider1 = <INotebookProvider>{};
		const providerId = 'providerId1';

		notebookService.registerProvider(providerId, provider1);
		const result = await notebookService.baseGetProviderInstance(providerId, 30);
		assert.strictEqual(result, provider1, `${methodName} must return the provider that we registered with netbookService for the specified id`);
		notebookService.unregisterProvider(providerId);
		const sqlProvider = await notebookService.baseGetProviderInstance(SQL_NOTEBOOK_PROVIDER, 30);
		const defaultProvider = await notebookService.baseGetProviderInstance(providerId, 30);
		assert.strictEqual(defaultProvider, sqlProvider, `if the provider for an id is not registered than ${methodName} by default should return SQL_NOTEBOOK_PROVIDER`);
	});

	test('test register/get of navigationProviders', async () => {
		const methodName = 'getNavigationProvider';
		assert.strictEqual(notebookService.getNavigationProvider(), undefined, `${methodName} returns undefined with no providers registered`);
		const providerId = NavigationProviders.NotebooksNavigator; //NavigationProviders.ProvidedBooksNavigator;
		const provider1 = <INavigationProvider>{ providerId: providerId };

		notebookService.registerNavigationProvider(provider1);
		const result = notebookService.getNavigationProvider();
		assert.strictEqual(result, provider1, `${methodName} must return the provider that we registered with netbookService for the provider id: ${provider1.providerId}`);
	});

	test('verifies return value of getOrCreateNotebookManager', async () => {
		await notebookService.registrationComplete;
		try {
			await notebookService.getOrCreateNotebookManager(SQL_NOTEBOOK_PROVIDER, undefined);
		} catch (error) {
			assert.strictEqual((error as Error).message, NotebookUriNotDefined, `getOrCreateNotebookManager must throw with UriNotDefined error, when a valid uri is not provided`);
		}
		const provider1Id = SQL_NOTEBOOK_PROVIDER;
		const { providerId: provider2Id, manager: provider2Manager } = createProviderAndManager({ providerId: 'provider2Id', notebookService });

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
		assert.strictEqual(notebookService.findNotebookEditor(undefined), undefined, `findNotebookEditor should return the editor when searching with the latest Uri`);

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

		// //Remove editor when there are managers already populated
		// await addManagers({ notebookService, prefix:'newId', uriPrefix:'newId' });
		// editorsRemoved = 0; editorsAdded = 0;
		// notebookService.addNotebookEditor(editor1);
		// notebookService.removeNotebookEditor(editor1);
		// assert.strictEqual(editorsRemoved, 1, `onNotebookEditorRemove should have been called that increments editorsRemoved value`);
	});

	test('test registration of a new provider with multiple filetypes & kernels and verify that it is returned by getProviderInstance', async () => {
		const providerId = 'Jpeg';
		const notebookProviderRegistration = <NotebookProviderRegistration>{
			provider: providerId,
			fileExtensions: ['jpeg', 'jpg'],
			standardKernels: [<azdata.nb.IStandardKernel>{ name: 'kernel1' }, <azdata.nb.IStandardKernel>{ name: 'kernel2' }]
		};
		const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
		notebookRegistry.registerNotebookProvider(notebookProviderRegistration);
		const providerInstance = <INotebookProvider>{};

		const providerInstancePromise = notebookService.baseGetProviderInstance(providerId, 2500);
		notebookService.registerProvider(providerId, providerInstance);
		const result = await providerInstancePromise;

		// verify result
		assert.strictEqual(result, providerInstance, `getProviderInstance must return the INotebookProvider that we registered`);
	});

	test('verify trustedNotebooksMemento always returns a valid cache object', async () => {
		const result = notebookService.baseGetTrustedNotebooksMemento();
		// verify result
		assert.notStrictEqual(result?.trustedNotebooksCache, undefined, `trustedNotebooksCache object must be defined`);
	});

	test('verify removeContributedProvidersFromCache cleans up the cache as expected', async () => {
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
		const notebookProviderProperties = (<NotebookProviderProperties>{ provider: providerId, fileExtensions: ['.p1', '.P1'] });
		notebookService.getProvidersMemento().notebookProviderCache = {
			providerId1: notebookProviderProperties
		};
		await notebookService.baseRemoveContributedProvidersFromCache({
			id: 'id1'
		}, spiedExtensionService);
		// verify result
		assert.strictEqual(notebookService.getProvidersMemento().notebookProviderCache[providerId], undefined, `notebookService.providersMemento.notebookProviderCache[${providerId}] object must be undefined`);
	});

	test('verify removeContributedProvidersFromCache raises unExpectedError and does not throw', async () => {
		const methodName = 'removeContributedProvidersFromCache';
		let unexpectedErrorCalled = false;
		const onUnexpectedErrorVerifier = (error: any) => {
			unexpectedErrorCalled = true;
			assert.ok(error instanceof Error, `${onUnexpectedError} must be passed an instance of ${Error}`);
			assert.strictEqual((error as Error).message, `Cannot read property 'getExtensions' of undefined`, `Error text must be "Cannot read property 'getExtensions' of undefined" when extensionService is undefined`);
		};
		errorHandler.setUnexpectedErrorHandler(onUnexpectedErrorVerifier);
		// the following call will encounter an exception internally with extensionService parameter being undefined.
		await notebookService.baseRemoveContributedProvidersFromCache(<IExtensionIdentifier>{}, /* extensionService */ undefined);
		// verify result
		assert.strictEqual(unexpectedErrorCalled, true, `${onUnexpectedError} must be have been raised when extensionService is undefined when calling notebookService.${methodName}`);
	});

	test('verify that firing of extensionService.onDidUninstallExtension event calls removeContributedProvidersFromCache', async () => {
		const methodName = 'removeContributedProvidersFromCache';
		const extensionIdentifier = (<DidUninstallExtensionEvent>{
			identifier: {
				id: 'id1'
			}
		});

		let mockedMethodCalled = 0;
		notebookService[methodName] = async (_identifier: IExtensionIdentifier, _extensionService: IExtensionService) => {
			mockedMethodCalled++;
			assert.strictEqual(_identifier, extensionIdentifier.identifier, `the identifer parameter to ${methodName} must be the one that was passed into the didUninstallExtensionEmitter.fire called`);
			assert.strictEqual(_extensionService, spiedExtensionService, `the extensionService parameter to ${methodName} must be the one that was passed into the notebookService constructor`);
		};
		didUninstallExtensionEmitter.fire(extensionIdentifier);
		assert.strictEqual(mockedMethodCalled, 1, `${methodName} should be called exactly once`);
	});

	test('verify that firing of queryManagementService.onHandlerAdded event completes registration', async () => {
		await notebookService.registrationComplete;
		notebookService.setIsRegistrationComplete(false);
		queryManagementService.onHandlerAddedEmitter.fire('sql');
		assert.strictEqual(notebookService.getIsRegistrationComplete(), true, `registration should be complete once queryManagementService.onHandlerAdded event has been fired`);
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
		new TestNotebookService(lifecycleService, storageService, extensionService, extensionManagementService, instantiationService, fileService, logService, /* queryManagementService */ undefined, contextService);
		await unexpectedErrorPromise;
		assert.strictEqual(unexpectedErrorCalled, true, `onUnexpectedError must be have been raised when queryManagementService is undefined when calling NotebookService constructor`);
	});

	test('verify that shutdown executes in response to lifecycleService.onWillShutdown event', async () => {
		await notebookService.registrationComplete;
		// no managers case
		lifecycleService.fireShutdown();
		assert.strictEqual(notebookService.hasShutdown, true, `TestNotebookService object must be in shutdown state after shutdown has been invoked`);
		// actual shutdown with managers defined
		notebookService.hasShutdown = false;
		await addManagers({ notebookService, count: 4 });
		lifecycleService.fireShutdown();
		assert.strictEqual(notebookService.hasShutdown, true, `TestNotebookService object must be in shutdown state after shutdown has been invoked`);
	});

	for (const isTrusted of [true, false, undefined]) {
		for (const isModelTrusted of [true, false]) {
			if (isTrusted !== undefined && !isModelTrusted) {
				continue; // if isTrusted is true or false then we need to do only one case of isModelTrusted value and we are arbitrarily choose true as isModelTrusted does not matter in that case.
			}
			test(`verify serializeNotebookStateCache serializes to trusted or untrusted cache when notebook:isTrusted:${isTrusted} && notebookModel:isTrusted:${isModelTrusted}`, async () => {
				const notebookUri = URI.parse('id1');
				const model = new NotebookModelStub();
				const { mock: modelMock, spy: spiedModel } = getMockAndSpy(model);
				const notebookEditor = new NotebookEditorStub({
					notebookParams: <INotebookParams>{
						notebookUri: notebookUri,
					},
					model: spiedModel
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
				const { mock: trustedNotebooksMementoMock, spy: spiedTrustedNotebooksMemento } = getMockAndSpy(notebookService.getTrustedNotebooksMemento());
				notebookService.setTrustedNotebooksMemento(spiedTrustedNotebooksMemento);
				trustedNotebooksMementoMock.setup(x => x.saveMemento()).verifiable(TypeMoq.Times.once());
				await notebookService.serializeNotebookStateChange(notebookUri, changeType, cellModel, isTrusted);
				modelMock.verifyAll();
				trustedNotebooksMementoMock.verifyAll();
			});
		}
	}

	test(`verify isNotebookTrustCached when notebook was not previously trusted`, async () => {
		assert.strictEqual(await notebookService.isNotebookTrustCached(URI.parse('untitled:foo'), false /* isDirty */), true, `untitled notebooks are always trust cached`);
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
				const notebookUri = URI.parse('id1');
				const notebookEditor = new NotebookEditorStub({
					notebookParams: <INotebookParams>{
						notebookUri: notebookUri,
					},
					model: new NotebookModelStub()
				});
				notebookService.addNotebookEditor(notebookEditor);
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
		const { mock, spy } = getMockAndSpy(notebookEditor);
		notebookService.addNotebookEditor(spy);
		mock.setup(x => x.navigateToSection(TypeMoq.It.isAnyString()))
			.returns((_sectionId: string) => {
				assert.strictEqual(_sectionId, sectionId, `sectionId passed into the notebookEditor.navigateToSection must be the one that we passed into notebookService.navigateTo method`);
			})
			.verifiable(TypeMoq.Times.once());
		notebookService.navigateTo(notebookUri, sectionId);
		mock.verifyAll();

	});

	test('Debug_verify that cleanupProviders() cleans up all known providers', async () => {
		await notebookService.registrationComplete;
		const providerId = 'ProviderId';
		notebookService.getProvidersMemento().notebookProviderCache = {};
		const notebookProviderCache = notebookService.getProvidersMemento().notebookProviderCache;
		notebookProviderCache[providerId] = <NotebookProviderProperties>{};
		notebookService.executeCleanupProviders();
		assert.strictEqual(notebookProviderCache[providerId], undefined, `providerId:'${providerId}' should have been cleaned out from providersMemento by cleanupProviders() method`);
	});
});

function createProviderAndManager({ providerId = 'providerId', notebookService }: { providerId: string; notebookService: NotebookService; }) {
	const providerManager = <INotebookManager>{
		providerId: providerId,
		serverManager: <azdata.nb.ServerManager>{
			isStarted: false,
			stopServer() { }
		}
	};
	const provider = <INotebookProvider>{
		getNotebookManager(uri: URI): Thenable<INotebookManager> {
			return Promise.resolve(providerManager);
		},
		handleNotebookClosed(_notebookUri: URI): void {
			// do nothing
		}
	};
	notebookService.registerProvider(providerId, provider);
	return { providerId: providerId, provider: provider, manager: providerManager };
}

async function addManagers({ notebookService, prefix = 'providerId', uriPrefix = 'id', count = 1 }: { notebookService: NotebookService; prefix?: string; uriPrefix?: string; count?: number; }) {
	for (let i: number = 1; i <= count; i++) {
		const providerId = `${prefix}${i}`;
		createProviderAndManager({ providerId, notebookService });
		await notebookService.getOrCreateNotebookManager(providerId, URI.parse(`${uriPrefix}${i}`));
	}
}


