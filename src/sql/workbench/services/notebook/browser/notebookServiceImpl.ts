/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { localize } from 'vs/nls';
import { URI, UriComponents } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';

import {
	INotebookService, IExecuteManager, IExecuteProvider,
	DEFAULT_NOTEBOOK_FILETYPE, INotebookEditor, SQL_NOTEBOOK_PROVIDER, INavigationProvider, ILanguageMagic, NavigationProviders, unsavedBooksContextKey, ISerializationProvider
} from 'sql/workbench/services/notebook/browser/notebookService';
import { RenderMimeRegistry } from 'sql/workbench/services/notebook/browser/outputs/registry';
import { standardRendererFactories } from 'sql/workbench/services/notebook/browser/outputs/factories';
import { Extensions, INotebookProviderRegistry, ExecuteProviderRegistration, SerializationProviderRegistration } from 'sql/workbench/services/notebook/common/notebookRegistry';
import { Emitter, Event } from 'vs/base/common/event';
import { Memento } from 'vs/workbench/common/memento';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IExtensionManagementService, IExtensionIdentifier } from 'vs/platform/extensionManagement/common/extensionManagement';
import { Disposable } from 'vs/base/common/lifecycle';
import { Deferred } from 'sql/base/common/promise';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ILifecycleService } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { SqlExecuteProvider } from 'sql/workbench/services/notebook/browser/sql/sqlExecuteProvider';
import { IFileService, IFileStatWithMetadata } from 'vs/platform/files/common/files';
import { Schemas } from 'vs/base/common/network';
import { ILogService } from 'vs/platform/log/common/log';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { onUnexpectedError } from 'vs/base/common/errors';
import { notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IProductService } from 'vs/platform/product/common/productService';
import { viewColumnToEditorGroup } from 'vs/workbench/api/common/shared/editor';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { Extensions as LanguageAssociationExtensions, ILanguageAssociationRegistry } from 'sql/workbench/services/languageAssociation/common/languageAssociation';

import * as path from 'vs/base/common/path';

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';

import { IEditorInput, IEditorPane } from 'vs/workbench/common/editor';
import { isINotebookInput } from 'sql/workbench/services/notebook/browser/interface';
import { INotebookShowOptions } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { NotebookLanguage } from 'sql/workbench/common/constants';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { SqlSerializationProvider } from 'sql/workbench/services/notebook/browser/sql/sqlSerializationProvider';

const languageAssociationRegistry = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

export interface NotebookProviderProperties {
	provider: string;
	fileExtensions: string[];
}

interface NotebookProviderCache {
	[id: string]: NotebookProviderProperties;
}

export interface NotebookProvidersMemento {
	notebookSerializationProviderCache: NotebookProviderCache;
	notebookExecuteProviderCache: NotebookProviderCache;
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

const notebookSerializationRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookSerializationProviderContribution);
const notebookExecuteRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookExecuteProviderContribution);

export class SerializationProviderDescriptor {
	private _instanceReady = new Deferred<ISerializationProvider>();
	constructor(private _instance?: ISerializationProvider) {
		if (_instance) {
			this._instanceReady.resolve(_instance);
		}
	}

	public get instanceReady(): Promise<ISerializationProvider> {
		return this._instanceReady.promise;
	}

	public get instance(): ISerializationProvider {
		return this._instance;
	}
	public set instance(value: ISerializationProvider) {
		this._instance = value;
		this._instanceReady.resolve(value);
	}
}

export class ExecuteProviderDescriptor {
	private _instanceReady = new Deferred<IExecuteProvider>();
	constructor(private _instance?: IExecuteProvider) {
		if (_instance) {
			this._instanceReady.resolve(_instance);
		}
	}

	public get instanceReady(): Promise<IExecuteProvider> {
		return this._instanceReady.promise;
	}

	public get instance(): IExecuteProvider {
		return this._instance;
	}
	public set instance(value: IExecuteProvider) {
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
	private _serializationProviders: Map<string, SerializationProviderDescriptor> = new Map();
	private _executeProviders: Map<string, ExecuteProviderDescriptor> = new Map();
	private _navigationProviders: Map<string, INavigationProvider> = new Map();
	private _managersMap: Map<string, IExecuteManager[]> = new Map();
	private _onNotebookEditorAdd = new Emitter<INotebookEditor>();
	private _onNotebookEditorRemove = new Emitter<INotebookEditor>();
	private _onNotebookEditorRename = new Emitter<INotebookEditor>();
	private _editors = new Map<string, INotebookEditor>();
	private _fileToSerializationProviders = new Map<string, SerializationProviderRegistration[]>();
	private _providerToStandardKernels = new Map<string, nb.IStandardKernel[]>();
	private _registrationComplete = new Deferred<void>();
	private _isRegistrationComplete = false;
	private _trustedCacheQueue: URI[] = [];
	private _unTrustedCacheQueue: URI[] = [];
	private _onCodeCellExecutionStart: Emitter<void> = new Emitter<void>();

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
		@IProductService private readonly productService: IProductService,
		@IEditorService private _editorService: IEditorService,
		@IUntitledTextEditorService private _untitledEditorService: IUntitledTextEditorService,
		@IEditorGroupsService private _editorGroupService: IEditorGroupsService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		super();
		this._providersMemento = new Memento('notebookProviders', this._storageService);
		this._trustedNotebooksMemento = new Memento(TrustedNotebooksMementoId, this._storageService);
		if (this._storageService !== undefined && this.providersMemento.notebookSerializationProviderCache === undefined && this.providersMemento.notebookExecuteProviderCache === undefined) {
			this.providersMemento.notebookSerializationProviderCache = <NotebookProviderCache>{};
			this.providersMemento.notebookExecuteProviderCache = <NotebookProviderCache>{};
		}
		this._register(notebookSerializationRegistry.onNewSerializationRegistration(this.updateRegisteredSerializationProviders, this));
		this._register(notebookExecuteRegistry.onNewExecuteRegistration(this.updateRegisteredExecuteProviders, this));
		this.registerBuiltInProviders();

		// If a provider has been already registered, the onNewRegistration event will not have a listener attached yet
		// So, explicitly updating registered providers here.
		if (notebookSerializationRegistry.serializationProviders.length > 0) {
			notebookSerializationRegistry.serializationProviders.forEach(p => {
				// Don't need to re-register SQL_NOTEBOOK_PROVIDER
				if (p.provider !== SQL_NOTEBOOK_PROVIDER) {
					this.updateRegisteredSerializationProviders({ id: p.provider, registration: p });
				}
			});
		}
		if (notebookExecuteRegistry.executeProviders.length > 0) {
			notebookExecuteRegistry.executeProviders.forEach(p => {
				// Don't need to re-register SQL_NOTEBOOK_PROVIDER
				if (p.provider !== SQL_NOTEBOOK_PROVIDER) {
					this.updateRegisteredExecuteProviders({ id: p.provider, registration: p });
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

	public async openNotebook(resource: UriComponents, options: INotebookShowOptions): Promise<IEditorPane | undefined> {
		const uri = URI.revive(resource);

		const editorOptions: ITextEditorOptions = {
			preserveFocus: options.preserveFocus,
			pinned: !options.preview
		};
		let isUntitled: boolean = uri.scheme === Schemas.untitled;

		let fileInput: IEditorInput;
		if (isUntitled && path.isAbsolute(uri.fsPath)) {
			const model = this._untitledEditorService.create({ associatedResource: uri, mode: 'notebook', initialValue: options.initialContent });
			fileInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
		} else {
			if (isUntitled) {
				const model = this._untitledEditorService.create({ untitledResource: uri, mode: 'notebook', initialValue: options.initialContent });
				fileInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
			} else {
				fileInput = this._editorService.createEditorInput({ forceFile: true, resource: uri, mode: 'notebook' });
			}
		}
		// We only need to get the Notebook language association as such we only need to use ipynb
		const inputCreator = languageAssociationRegistry.getAssociationForLanguage(NotebookLanguage.Ipynb);
		if (inputCreator) {
			fileInput = await inputCreator.convertInput(fileInput);
			if (isINotebookInput(fileInput)) {
				fileInput.defaultKernel = options.defaultKernel;
				fileInput.connectionProfile = options.connectionProfile;

				if (isUntitled) {
					let untitledModel = await fileInput.resolve();
					await untitledModel.resolve();
					if (options.initialDirtyState === false) {
						fileInput.setDirty(false);
					}
				}
			}
		}
		return await this._editorService.openEditor(fileInput, editorOptions, viewColumnToEditorGroup(this._editorGroupService, options.position));
	}

	/**
	 * Will iterate the title of the parameterized notebook since the original notebook is still open
	 * @param originalTitle is the title of the original notebook that we run parameterized action from
	 * @returns the title of the parameterized notebook
	 */
	public getUntitledUriPath(originalTitle: string): string {
		let title = originalTitle;
		let nextVal = 0;
		let ext = path.extname(title);
		while (this.listNotebookEditors().findIndex(doc => path.basename(doc.notebookParams.notebookUri.fsPath) === title) > -1) {
			if (ext) {
				// Need it to be `Readme-0.txt` not `Readme.txt-0`
				let titleStart = originalTitle.slice(0, originalTitle.length - ext.length);
				title = `${titleStart}-${nextVal}${ext}`;
			} else {
				title = `${originalTitle}-${nextVal}`;
			}
			nextVal++;
		}
		return title;
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

	private updateRegisteredSerializationProviders(p: { id: string; registration: SerializationProviderRegistration }) {
		let registration = p.registration;

		if (!this._serializationProviders.has(p.id)) {
			this._serializationProviders.set(p.id, new SerializationProviderDescriptor());
		}
		if (registration.fileExtensions) {
			if (Array.isArray(registration.fileExtensions)) {
				for (let fileType of registration.fileExtensions) {
					this.addFileSerializationProvider(fileType, registration);
				}
			}
			else {
				this.addFileSerializationProvider(registration.fileExtensions, registration);
			}
		}
	}

	private updateRegisteredExecuteProviders(p: { id: string; registration: ExecuteProviderRegistration }) {
		let registration = p.registration;

		if (!this._executeProviders.has(p.id)) {
			this._executeProviders.set(p.id, new ExecuteProviderDescriptor());
		}
		if (registration.standardKernels) {
			this.addStandardKernels(registration);
		}
	}

	registerSerializationProvider(providerId: string, instance: ISerializationProvider): void {
		let providerDescriptor = this._serializationProviders.get(providerId);
		if (providerDescriptor) {
			// Update, which will resolve the promise for anyone waiting on the instance to be registered
			providerDescriptor.instance = instance;
		} else {
			this._serializationProviders.set(providerId, new SerializationProviderDescriptor(instance));
		}
	}

	registerExecuteProvider(providerId: string, instance: IExecuteProvider): void {
		let providerDescriptor = this._executeProviders.get(providerId);
		if (providerDescriptor) {
			// Update, which will resolve the promise for anyone waiting on the instance to be registered
			providerDescriptor.instance = instance;
		} else {
			this._executeProviders.set(providerId, new ExecuteProviderDescriptor(instance));
		}
	}

	unregisterSerializationProvider(providerId: string): void {
		this._serializationProviders.delete(providerId);
	}

	unregisterExecuteProvider(providerId: string): void {
		this._executeProviders.delete(providerId);
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

	private addFileSerializationProvider(fileType: string, provider: SerializationProviderRegistration) {
		let providers = this._fileToSerializationProviders.get(fileType.toUpperCase());
		if (!providers) {
			providers = [];
		}
		providers.push(provider);
		this._fileToSerializationProviders.set(fileType.toUpperCase(), providers);
	}

	// Standard kernels are contributed where a list of kernels are defined that can be shown
	// in the kernels dropdown list before a SessionManager has been started; this way,
	// every NotebookProvider doesn't need to have an active SessionManager in order to contribute
	// kernels to the dropdown
	private addStandardKernels(provider: ExecuteProviderRegistration) {
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

	getSerializationProvidersForFileType(fileType: string): string[] {
		fileType = fileType.toUpperCase();
		let providers = this._fileToSerializationProviders.get(fileType);

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

	async getOrCreateNotebookManager(providerId: string, uri: URI): Promise<IExecuteManager> {
		if (!uri) {
			throw new Error(NotebookUriNotDefined);
		}
		let uriString = uri.toString();
		let managers: IExecuteManager[] = this._managersMap.get(uriString);
		// If manager already exists for a given notebook, return it
		if (managers) {
			let index = managers.findIndex(m => m.providerId === providerId);
			if (index >= 0) {
				return managers[index];
			}
		}
		let newManager = await this.doWithProvider(providerId, (provider) => provider.getExecuteManager(uri));

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
		let uriString = getNotebookUri(notebookUri);
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
		return notebookExecuteRegistry.languageMagics;
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
				let provider = this._executeProviders.get(m.providerId);
				provider.instance.handleNotebookClosed(notebookUri);
			});
		}
	}

	private async doWithProvider<T>(providerId: string, op: (provider: IExecuteProvider) => Thenable<T>): Promise<T> {
		// Make sure the provider exists before attempting to retrieve accounts
		let provider: IExecuteProvider = await this.getProviderInstance(providerId);
		return op(provider);
	}

	private async getProviderInstance(providerId: string, timeout?: number): Promise<IExecuteProvider> {
		let providerDescriptor = this._executeProviders.get(providerId);
		let instance: IExecuteProvider;

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
			providerDescriptor = this._executeProviders.get(SQL_NOTEBOOK_PROVIDER);
			instance = providerDescriptor ? providerDescriptor.instance : undefined;
		}

		// Should never happen, but if default wasn't registered we should throw
		if (!instance) {
			throw new Error(NotebookServiceNoProviderRegistered);
		}
		return instance;
	}

	private waitOnProviderAvailability(providerDescriptor: ExecuteProviderDescriptor, timeout?: number): Promise<IExecuteProvider> {
		// Wait up to 30 seconds for the provider to be registered
		timeout = timeout ?? 30000;
		let promises: Promise<IExecuteProvider>[] = [
			providerDescriptor.instanceReady,
			new Promise<IExecuteProvider>((resolve, reject) => setTimeout(() => resolve(undefined), timeout))
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
		return this._providersMemento.getMemento(StorageScope.GLOBAL, StorageTarget.MACHINE) as NotebookProvidersMemento;
	}

	private get trustedNotebooksMemento(): TrustedNotebooksMemento {
		let cache = this._trustedNotebooksMemento.getMemento(StorageScope.GLOBAL, StorageTarget.MACHINE) as TrustedNotebooksMemento;
		if (!cache.trustedNotebooksCache) {
			cache.trustedNotebooksCache = {};
		}
		return cache;
	}

	private cleanupProviders(): void {
		let knownExecuteProviders = Object.keys(notebookExecuteRegistry.executeProviders);
		let executeCache = this.providersMemento.notebookExecuteProviderCache;
		for (let key in executeCache) {
			if (!knownExecuteProviders.some(x => x === key)) {
				this._executeProviders.delete(key);
				delete executeCache[key];
			}
		}

		let knownSerializationProviders = Object.keys(notebookSerializationRegistry.serializationProviders);
		let serializationCache = this.providersMemento.notebookSerializationProviderCache;
		for (let key in serializationCache) {
			if (!knownSerializationProviders.some(x => x === key)) {
				this._serializationProviders.delete(key);
				delete serializationCache[key];
			}
		}
	}

	private registerBuiltInProviders() {
		let serializationProvider = new SqlSerializationProvider(this._instantiationService);
		this.registerSerializationProvider(serializationProvider.providerId, serializationProvider);
		notebookSerializationRegistry.registerSerializationProvider({
			provider: serializationProvider.providerId,
			fileExtensions: DEFAULT_NOTEBOOK_FILETYPE
		});

		let executeProvider = new SqlExecuteProvider(this._instantiationService);
		this.registerExecuteProvider(executeProvider.providerId, executeProvider);
		notebookExecuteRegistry.registerExecuteProvider({
			provider: executeProvider.providerId,
			standardKernels: { name: notebookConstants.SQL, displayName: notebookConstants.SQL, connectionProviderIds: [notebookConstants.SQL_CONNECTION_PROVIDER] }
		});
	}

	protected async removeContributedProvidersFromCache(identifier: IExtensionIdentifier, extensionService: IExtensionService): Promise<void> {
		try {
			const extensionDescriptions = await extensionService.getExtensions();
			let extensionDescription = extensionDescriptions.find(c => c.identifier.value.toLowerCase() === identifier.id.toLowerCase());
			if (extensionDescription && extensionDescription.contributes) {
				if (extensionDescription.contributes[Extensions.NotebookExecuteProviderContribution]
					&& extensionDescription.contributes[Extensions.NotebookExecuteProviderContribution].providerId) {
					let id = extensionDescription.contributes[Extensions.NotebookExecuteProviderContribution].providerId;
					delete this.providersMemento.notebookExecuteProviderCache[id];
				}
				if (extensionDescription.contributes[Extensions.NotebookSerializationProviderContribution]
					&& extensionDescription.contributes[Extensions.NotebookSerializationProviderContribution].providerId) {
					let id = extensionDescription.contributes[Extensions.NotebookSerializationProviderContribution].providerId;
					delete this.providersMemento.notebookSerializationProviderCache[id];
				}
			}
		} catch (err) {
			onUnexpectedError(err);
		}
	}

	async isNotebookTrustCached(notebookUri: URI, isDirty: boolean): Promise<boolean> {
		if (notebookUri.scheme === Schemas.untitled) {
			return true;
		}
		const trustedBooksConfigKey = 'notebook.trustedBooks';

		let cacheInfo = this.trustedNotebooksMemento.trustedNotebooksCache[notebookUri.toString()];
		if (!cacheInfo) {
			// Check if the notebook belongs to a book that's trusted
			// and is not part of untrusted queue.
			let trustedBookDirectories: string[] = !this._unTrustedCacheQueue.find(n => n === notebookUri) ? this._configurationService?.getValue(trustedBooksConfigKey) ?? [] : [];
			if (trustedBookDirectories.find(b => notebookUri.fsPath.indexOf(b) > -1)) {
				return true;
				// note: we're ignoring the dirty check below since that's needed only when
				// someone trusts notebook after it's loaded and this check is during the load time
			} else {
				// This notebook was never trusted
				return false;
			}
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

	get onCodeCellExecutionStart(): Event<void> {
		return this._onCodeCellExecutionStart.event;
	}

	notifyCellExecutionStarted(): void {
		this._onCodeCellExecutionStart.fire();
	}
}

/**
 * Untitled notebookUri's need to have the query in order to get the NotebookEditor to run other actions (Run All Cells for example) on parameterized notebooks
 * otherwise we strip the query and fragment from the notebookUri for all other file schemes
 * @param notebookUri of the notebook
 * @returns uriString that contains the formatted notebookUri
 */
export function getNotebookUri(notebookUri: URI): string {
	if (notebookUri.scheme === 'untitled') {
		return notebookUri.toString();
	}
	return notebookUri.with({ query: '', fragment: '' }).toString();
}
