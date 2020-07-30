/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { localize } from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';

import {
	INotebookService, INotebookManager, INotebookProvider,
	DEFAULT_NOTEBOOK_FILETYPE, INotebookEditor, SQL_NOTEBOOK_PROVIDER, INavigationProvider, ILanguageMagic, NavigationProviders, unsavedBooksContextKey
} from 'sql/workbench/services/notebook/browser/notebookService';
import { RenderMimeRegistry } from 'sql/workbench/services/notebook/browser/outputs/registry';
import { standardRendererFactories } from 'sql/workbench/services/notebook/browser/outputs/factories';
import { Extensions, INotebookProviderRegistry, NotebookProviderRegistration } from 'sql/workbench/services/notebook/common/notebookRegistry';
import { Emitter, Event } from 'vs/base/common/event';
import { Memento } from 'vs/workbench/common/memento';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IExtensionManagementService, IExtensionIdentifier } from 'vs/platform/extensionManagement/common/extensionManagement';
import { Disposable } from 'vs/base/common/lifecycle';
import { Deferred } from 'sql/base/common/promise';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { SqlNotebookProvider } from 'sql/workbench/services/notebook/browser/sql/sqlNotebookProvider';
import { IFileService, IFileStatWithMetadata } from 'vs/platform/files/common/files';
import { Schemas } from 'vs/base/common/network';
import { ILogService } from 'vs/platform/log/common/log';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { onUnexpectedError } from 'vs/base/common/errors';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IProductService } from 'vs/platform/product/common/productService';

export interface NotebookProviderProperties {
	provider: string;
	fileExtensions: string[];
}

interface NotebookProviderCache {
	[id: string]: NotebookProviderProperties;
}

export interface NotebookProvidersMemento {
	notebookProviderCache: NotebookProviderCache;
}

interface TrustedNotebookMetadata {
	mtime: number;
}
interface TrustedNotebookCache {
	// URI goes to cached
	[uri: string]: TrustedNotebookMetadata;
}

export interface TrustedNotebooksMemento {
	trustedNotebooksCache: TrustedNotebookCache;
}

const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);

export class ProviderDescriptor {
	private _instanceReady = new Deferred<INotebookProvider>();
	constructor(private _instance?: INotebookProvider) {
		if (_instance) {
			this._instanceReady.resolve(_instance);
		}
	}

	public get instanceReady(): Promise<INotebookProvider> {
		return this._instanceReady.promise;
	}

	public get instance(): INotebookProvider {
		return this._instance;
	}
	public set instance(value: INotebookProvider) {
		this._instance = value;
		this._instanceReady.resolve(value);
	}
}

export const NotebookUriNotDefined = localize('notebookUriNotDefined', "No URI was passed when creating a notebook manager");
export const NotebookServiceNoProviderRegistered = localize('notebookServiceNoProvider', "Notebook provider does not exist");
export const FailToSaveTrustState = 'Failed to save trust state to cache';
export const TrustedNotebooksMementoId = 'notebooks.trusted';
export class NotebookService extends Disposable implements INotebookService {
	_serviceBrand: undefined;

	private _providersMemento: Memento;
	private _trustedNotebooksMemento: Memento;
	private _mimeRegistry: RenderMimeRegistry;
	private _providers: Map<string, ProviderDescriptor> = new Map();
	private _navigationProviders: Map<string, INavigationProvider> = new Map();
	private _managersMap: Map<string, INotebookManager[]> = new Map();
	private _onNotebookEditorAdd = new Emitter<INotebookEditor>();
	private _onNotebookEditorRemove = new Emitter<INotebookEditor>();
	private _onNotebookEditorRename = new Emitter<INotebookEditor>();
	private _editors = new Map<string, INotebookEditor>();
	private _fileToProviders = new Map<string, NotebookProviderRegistration[]>();
	private _providerToStandardKernels = new Map<string, nb.IStandardKernel[]>();
	private _registrationComplete = new Deferred<void>();
	private _isRegistrationComplete = false;
	private _trustedCacheQueue: URI[] = [];
	private _unTrustedCacheQueue: URI[] = [];

	constructor(
		@ILifecycleService lifecycleService: ILifecycleService,
		@IStorageService private _storageService: IStorageService,
		@IExtensionService private _extensionService: IExtensionService,
		@IExtensionManagementService extensionManagementService: IExtensionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IFileService private readonly _fileService: IFileService,
		@ILogService private readonly _logService: ILogService,
		@IQueryManagementService private readonly _queryManagementService: IQueryManagementService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IProductService private readonly productService: IProductService
	) {
		super();
		this._providersMemento = new Memento('notebookProviders', this._storageService);
		this._trustedNotebooksMemento = new Memento(TrustedNotebooksMementoId, this._storageService);
		if (this._storageService !== undefined && this.providersMemento.notebookProviderCache === undefined) {
			this.providersMemento.notebookProviderCache = <NotebookProviderCache>{};
		}
		this._register(notebookRegistry.onNewRegistration(this.updateRegisteredProviders, this));
		this.registerBuiltInProvider();

		// If a provider has been already registered, the onNewRegistration event will not have a listener attached yet
		// So, explicitly updating registered providers here.
		if (notebookRegistry.providers.length > 0) {
			notebookRegistry.providers.forEach(p => {
				// Don't need to re-register SQL_NOTEBOOK_PROVIDER
				if (p.provider !== SQL_NOTEBOOK_PROVIDER) {
					this.updateRegisteredProviders({ id: p.provider, registration: p });
				}
			});
		}

		if (this._extensionService) {
			this._extensionService.whenInstalledExtensionsRegistered().then(() => {
				this.cleanupProviders();

				// If providers have already registered by this point, add them now (since onHandlerAdded will never fire)
				if (this._queryManagementService.getRegisteredProviders().length > 0) {
					this.updateSQLRegistrationWithConnectionProviders();
				}

				this._register(this._queryManagementService.onHandlerAdded((_queryType) => {
					this.updateSQLRegistrationWithConnectionProviders();
				}));
			}).catch(err => onUnexpectedError(err));
		}
		if (extensionManagementService) {
			this._register(extensionManagementService.onDidUninstallExtension(async ({ identifier }) => await this.removeContributedProvidersFromCache(identifier, this._extensionService)));
		}

		lifecycleService.onWillShutdown(() => this.shutdown());
	}

	public dispose(): void {
		super.dispose();
	}

	private updateSQLRegistrationWithConnectionProviders() {
		// Update the SQL extension
		let sqlNotebookKernels = this._providerToStandardKernels.get(notebookConstants.SQL);
		if (sqlNotebookKernels) {
			let sqlConnectionTypes = this._queryManagementService.getRegisteredProviders();
			let kernel = sqlNotebookKernels.find(p => p.name === notebookConstants.SQL);
			if (kernel) {
				this._providerToStandardKernels.set(notebookConstants.SQL, [{
					name: notebookConstants.SQL,
					displayName: notebookConstants.SQL,
					connectionProviderIds: sqlConnectionTypes
				}]);
			}
		}
		this._isRegistrationComplete = true;
		this._registrationComplete.resolve();
	}

	private updateRegisteredProviders(p: { id: string; registration: NotebookProviderRegistration }) {
		let registration = p.registration;

		if (!this._providers.has(p.id)) {
			this._providers.set(p.id, new ProviderDescriptor());
		}
		if (registration.fileExtensions) {
			if (Array.isArray<string>(registration.fileExtensions)) {
				for (let fileType of registration.fileExtensions) {
					this.addFileProvider(fileType, registration);
				}
			}
			else {
				this.addFileProvider(registration.fileExtensions, registration);
			}
		}
		if (registration.standardKernels) {
			this.addStandardKernels(registration);
		}
	}

	registerProvider(providerId: string, instance: INotebookProvider): void {
		let providerDescriptor = this._providers.get(providerId);
		if (providerDescriptor) {
			// Update, which will resolve the promise for anyone waiting on the instance to be registered
			providerDescriptor.instance = instance;
		} else {
			this._providers.set(providerId, new ProviderDescriptor(instance));
		}
	}

	unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	registerNavigationProvider(provider: INavigationProvider): void {
		this._navigationProviders.set(provider.providerId, provider);
	}

	getNavigationProvider(): INavigationProvider {
		let provider;
		if (this._navigationProviders.size > 0) {
			const providerName = this.contextKeyService.getContextKeyValue(unsavedBooksContextKey) ? NavigationProviders.ProvidedBooksNavigator : NavigationProviders.NotebooksNavigator;
			provider = this._navigationProviders.get(providerName);
		}
		return provider;
	}

	get isRegistrationComplete(): boolean {
		return this._isRegistrationComplete;
	}

	get registrationComplete(): Promise<void> {
		return this._registrationComplete.promise;
	}

	private addFileProvider(fileType: string, provider: NotebookProviderRegistration) {
		let providers = this._fileToProviders.get(fileType.toUpperCase());
		if (!providers) {
			providers = [];
		}
		providers.push(provider);
		this._fileToProviders.set(fileType.toUpperCase(), providers);
	}

	// Standard kernels are contributed where a list of kernels are defined that can be shown
	// in the kernels dropdown list before a SessionManager has been started; this way,
	// every NotebookProvider doesn't need to have an active SessionManager in order to contribute
	// kernels to the dropdown
	private addStandardKernels(provider: NotebookProviderRegistration) {
		let providerUpperCase = provider.provider.toUpperCase();
		let standardKernels = this._providerToStandardKernels.get(providerUpperCase);
		if (!standardKernels) {
			standardKernels = [];
		}
		if (Array.isArray(provider.standardKernels)) {
			provider.standardKernels.forEach(kernel => {
				standardKernels.push(kernel);
			});
		} else {
			standardKernels.push(provider.standardKernels);
		}
		// Filter out unusable kernels when running on a SAW
		if (this.productService.quality === 'saw') {
			standardKernels = standardKernels.filter(kernel => !kernel.blockedOnSAW);
		}
		this._providerToStandardKernels.set(providerUpperCase, standardKernels);
	}

	getSupportedFileExtensions(): string[] {
		return Array.from(this._fileToProviders.keys());
	}

	getProvidersForFileType(fileType: string): string[] {
		fileType = fileType.toUpperCase();
		let providers = this._fileToProviders.get(fileType);

		return providers ? providers.map(provider => provider.provider) : undefined;
	}

	getStandardKernelsForProvider(provider: string): nb.IStandardKernel[] {
		return this._providerToStandardKernels.get(provider.toUpperCase());
	}

	private shutdown(): void {
		this._managersMap.forEach(manager => {
			manager.forEach(m => {
				if (m.serverManager) {
					// TODO should this thenable be awaited?
					m.serverManager.stopServer();
				}
			});
		});
	}

	async getOrCreateNotebookManager(providerId: string, uri: URI): Promise<INotebookManager> {
		if (!uri) {
			throw new Error(NotebookUriNotDefined);
		}
		let uriString = uri.toString();
		let managers: INotebookManager[] = this._managersMap.get(uriString);
		// If manager already exists for a given notebook, return it
		if (managers) {
			let index = managers.findIndex(m => m.providerId === providerId);
			if (index >= 0) {
				return managers[index];
			}
		}
		let newManager = await this.doWithProvider(providerId, (provider) => provider.getNotebookManager(uri));

		managers = managers || [];
		managers.push(newManager);
		this._managersMap.set(uriString, managers);
		return newManager;
	}

	get onNotebookEditorAdd(): Event<INotebookEditor> {
		return this._onNotebookEditorAdd.event;
	}

	get onNotebookEditorRemove(): Event<INotebookEditor> {
		return this._onNotebookEditorRemove.event;
	}

	get onNotebookEditorRename(): Event<INotebookEditor> {
		return this._onNotebookEditorRename.event;
	}

	addNotebookEditor(editor: INotebookEditor): void {
		this._editors.set(editor.id, editor);
		this._onNotebookEditorAdd.fire(editor);
	}

	removeNotebookEditor(editor: INotebookEditor): void {
		if (this._editors.delete(editor.id)) {
			this._onNotebookEditorRemove.fire(editor);
		}
		// Remove the manager from the tracked list, and let the notebook provider know that it should update its mappings
		this.sendNotebookCloseToProvider(editor);
	}

	findNotebookEditor(notebookUri: URI): INotebookEditor | undefined {
		if (!notebookUri) {
			return undefined;
		}
		let uriString = notebookUri.toString();
		let editor = this.listNotebookEditors().find(n => n.id === uriString);
		return editor;
	}

	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void {
		let oldUriKey = oldUri.toString();
		if (this._editors.has(oldUriKey)) {
			this._editors.delete(oldUriKey);
			currentEditor.notebookParams.notebookUri = newUri; //currentEditor.id gets this value as a string
			this._editors.set(currentEditor.id, currentEditor);
			this._onNotebookEditorRename.fire(currentEditor);
		}
	}

	listNotebookEditors(): INotebookEditor[] {
		let editors = [];
		this._editors.forEach(e => editors.push(e));
		return editors;
	}

	get languageMagics(): ILanguageMagic[] {
		return notebookRegistry.languageMagics;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////

	private sendNotebookCloseToProvider(editor: INotebookEditor): void {
		let notebookUri = editor.notebookParams.notebookUri;
		let uriString = notebookUri.toString();
		let managers = this._managersMap.get(uriString);
		if (managers) {
			// As we have a manager, we can assume provider is ready
			this._managersMap.delete(uriString);
			managers.forEach(m => {
				let provider = this._providers.get(m.providerId);
				provider.instance.handleNotebookClosed(notebookUri);
			});
		}
	}

	private async doWithProvider<T>(providerId: string, op: (provider: INotebookProvider) => Thenable<T>): Promise<T> {
		// Make sure the provider exists before attempting to retrieve accounts
		let provider: INotebookProvider = await this.getProviderInstance(providerId);
		return op(provider);
	}

	private async getProviderInstance(providerId: string, timeout?: number): Promise<INotebookProvider> {
		let providerDescriptor = this._providers.get(providerId);
		let instance: INotebookProvider;

		// Try get from actual provider, waiting on its registration
		if (providerDescriptor) {
			if (!providerDescriptor.instance) {
				// Await extension registration before awaiting provider registration
				try {
					await this._extensionService.whenInstalledExtensionsRegistered();
				} catch (error) {
					this._logService.error(error);
				}
				instance = await this.waitOnProviderAvailability(providerDescriptor, timeout);
			} else {
				instance = providerDescriptor.instance;
			}
		}

		// Fall back to default (SQL) if this failed
		if (!instance) {
			providerDescriptor = this._providers.get(SQL_NOTEBOOK_PROVIDER);
			instance = providerDescriptor ? providerDescriptor.instance : undefined;
		}

		// Should never happen, but if default wasn't registered we should throw
		if (!instance) {
			throw new Error(NotebookServiceNoProviderRegistered);
		}
		return instance;
	}

	private waitOnProviderAvailability(providerDescriptor: ProviderDescriptor, timeout?: number): Promise<INotebookProvider> {
		// Wait up to 30 seconds for the provider to be registered
		timeout = timeout ?? 30000;
		let promises: Promise<INotebookProvider>[] = [
			providerDescriptor.instanceReady,
			new Promise<INotebookProvider>((resolve, reject) => setTimeout(() => resolve(), timeout))
		];
		return Promise.race(promises);
	}

	//Returns an instantiation of RenderMimeRegistry class
	getMimeRegistry(): RenderMimeRegistry {
		if (!this._mimeRegistry) {
			this._mimeRegistry = new RenderMimeRegistry({
				initialFactories: standardRendererFactories
			});
		}
		return this._mimeRegistry;
	}

	private get providersMemento(): NotebookProvidersMemento {
		return this._providersMemento.getMemento(StorageScope.GLOBAL) as NotebookProvidersMemento;
	}

	private get trustedNotebooksMemento(): TrustedNotebooksMemento {
		let cache = this._trustedNotebooksMemento.getMemento(StorageScope.GLOBAL) as TrustedNotebooksMemento;
		if (!cache.trustedNotebooksCache) {
			cache.trustedNotebooksCache = {};
		}
		return cache;
	}

	private cleanupProviders(): void {
		let knownProviders = Object.keys(notebookRegistry.providers);
		let cache = this.providersMemento.notebookProviderCache;
		for (let key in cache) {
			if (!knownProviders.some(x => x === key)) {
				this._providers.delete(key);
				delete cache[key];
			}
		}
	}

	private registerBuiltInProvider() {
		let sqlProvider = new SqlNotebookProvider(this._instantiationService);
		this.registerProvider(sqlProvider.providerId, sqlProvider);
		notebookRegistry.registerNotebookProvider({
			provider: sqlProvider.providerId,
			fileExtensions: DEFAULT_NOTEBOOK_FILETYPE,
			standardKernels: { name: notebookConstants.SQL, displayName: notebookConstants.SQL, connectionProviderIds: [notebookConstants.SQL_CONNECTION_PROVIDER] }
		});
	}

	protected async removeContributedProvidersFromCache(identifier: IExtensionIdentifier, extensionService: IExtensionService): Promise<void> {
		const notebookProvider = 'notebookProvider';
		try {
			const extensionDescriptions = await extensionService.getExtensions();
			let extensionDescription = extensionDescriptions.find(c => c.identifier.value.toLowerCase() === identifier.id.toLowerCase());
			if (extensionDescription && extensionDescription.contributes
				&& extensionDescription.contributes[notebookProvider] //'notebookProvider' isn't a field defined on IExtensionContributions so contributes[notebookProvider] is 'any'. TODO: Code cleanup
				&& extensionDescription.contributes[notebookProvider].providerId) {
				let id = extensionDescription.contributes[notebookProvider].providerId;
				delete this.providersMemento.notebookProviderCache[id];
			}
		} catch (err) {
			onUnexpectedError(err);
		}
	}

	async isNotebookTrustCached(notebookUri: URI, isDirty: boolean): Promise<boolean> {
		if (notebookUri.scheme === Schemas.untitled) {
			return true;
		}

		let cacheInfo = this.trustedNotebooksMemento.trustedNotebooksCache[notebookUri.toString()];
		if (!cacheInfo) {
			// This notebook was never trusted
			return false;
		}
		// This was trusted. If it's not dirty (e.g. if we're not working on our cached copy)
		// then should verify it's not been modified on disk since that invalidates trust relationship
		if (!isDirty) {
			// Check mtime against mtime on disk
			let actualMtime: number = await this.getModifiedTimeForFile(notebookUri);
			if (actualMtime > cacheInfo.mtime) {
				// Modified since last use, so can't guarantee trust.
				return false;
			}
		}
		return true;
	}

	private async getModifiedTimeForFile(notebookUri: URI): Promise<number> {
		try {
			let fstat: IFileStatWithMetadata = await this._fileService.resolve(notebookUri, {
				resolveMetadata: true
			});
			return fstat ? fstat.mtime : 0;
		} catch (err) {
			return 0;
		}
	}

	async serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void> {
		if (notebookUri.scheme !== Schemas.untitled) {
			// Conditions for saving:
			// 1. Not untitled. They're always trusted as we open them
			// 2. Serialization action was a save, since don't need to update on execution etc.
			// 3. Not already saving (e.g. isn't in the queue to be cached)
			// 4. Notebook is trusted. Don't need to save state of untrusted notebooks
			let notebookUriString = notebookUri.toString();
			if (changeType === NotebookChangeType.Saved && this._trustedCacheQueue.findIndex(uri => uri.toString() === notebookUriString) < 0) {
				if (isTrusted) {
					this._trustedCacheQueue.push(notebookUri);
					await this.updateTrustedCache();
				} else if (isTrusted === false) {
					this._unTrustedCacheQueue.push(notebookUri);
					await this.updateTrustedCache();
				} else {
					// Only save as trusted if the associated notebook model is trusted
					let notebook = this.listNotebookEditors().find(n => n.id === notebookUriString);
					if (notebook && notebook.model) {
						if (notebook.model.trustedMode) {
							this._trustedCacheQueue.push(notebookUri);
						} else {
							this._unTrustedCacheQueue.push(notebookUri);
						}
						await this.updateTrustedCache();
					}
				}
			}
		}

		let editor = this.findNotebookEditor(notebookUri);
		if (editor && editor.model) {
			editor.model.serializationStateChanged(changeType, cell);
			// TODO add history notification if a non-untitled notebook has a state change
		}
	}

	private async updateTrustedCache(): Promise<void> {
		try {
			if (this._trustedCacheQueue.length > 0) {
				// Copy out all items from the cache
				let items = this._trustedCacheQueue;
				this._trustedCacheQueue = [];

				// Get all the file stats and then serialize this to a memento
				let itemConfig = items.map(item => {
					return { resource: item, options: { resolveMetadata: true } };
				});
				let metadata = await this._fileService.resolveAll(itemConfig);
				let trustedCache = this.trustedNotebooksMemento.trustedNotebooksCache;
				for (let i = 0; i < metadata.length; i++) {
					let item = items[i];
					let stat = metadata[i] && metadata[i].stat;
					if (stat && stat.mtime) {
						trustedCache[item.toString()] = {
							mtime: stat.mtime
						};
					}
				}
				this._trustedNotebooksMemento.saveMemento();
			}
			if (this._unTrustedCacheQueue.length > 0) {
				// Copy out all items from the cache
				let items = this._unTrustedCacheQueue;
				this._unTrustedCacheQueue = [];
				let trustedCache = this.trustedNotebooksMemento.trustedNotebooksCache;
				//Remove the trusted entry from the cache
				for (let i = 0; i < items.length; i++) {
					if (trustedCache[items[i].toString()]) {
						trustedCache[items[i].toString()] = null;
					}
				}
				this._trustedNotebooksMemento.saveMemento();
			}
		} catch (err) {
			if (this._logService) {
				this._logService.trace(`${FailToSaveTrustState}: ${toErrorMessage(err)}`);
			}
		}
	}

	navigateTo(notebookUri: URI, sectionId: string): void {
		let editor = this._editors.get(notebookUri.toString());
		if (editor) {
			editor.navigateToSection(sectionId);
		}
	}

	/**
	 * Trusts a notebook with the specified URI.
	 * @param notebookUri The notebook URI to set the trusted mode for.
	 * @param isTrusted True if the notebook is to be trusted, false otherwise.
	 */
	async setTrusted(notebookUri: URI, isTrusted: boolean): Promise<boolean> {
		let editor = this.findNotebookEditor(notebookUri);

		if (editor && editor.model) {
			if (isTrusted) {
				this._trustedCacheQueue.push(notebookUri);
			} else {
				this._unTrustedCacheQueue.push(notebookUri);
			}
			await this.updateTrustedCache();
			editor.model.trustedMode = isTrusted;
		}

		return isTrusted;
	}
}
