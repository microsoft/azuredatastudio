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
	DEFAULT_NOTEBOOK_FILETYPE, INotebookEditor, SQL_NOTEBOOK_PROVIDER, INavigationProvider, ILanguageMagic, NavigationProviders, unsavedBooksContextKey, ISerializationProvider, ISerializationManager, DefaultNotebookProviders
} from 'sql/workbench/services/notebook/browser/notebookService';
import { RenderMimeRegistry } from 'sql/workbench/services/notebook/browser/outputs/registry';
import { standardRendererFactories } from 'sql/workbench/services/notebook/browser/outputs/factories';
import { Extensions, INotebookProviderRegistry, NotebookProviderRegistryId, ProviderDescriptionRegistration } from 'sql/workbench/services/notebook/common/notebookRegistry';
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
import { IExistingUntitledTextEditorOptions, INewUntitledTextEditorWithAssociatedResourceOptions, IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';

import { IEditorPane, IUntypedFileEditorInput } from 'vs/workbench/common/editor';
import { isINotebookInput } from 'sql/workbench/services/notebook/browser/interface';
import { INotebookShowOptions } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { INTERACTIVE_PROVIDER_ID, NotebookLanguage } from 'sql/workbench/common/constants';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { SqlSerializationProvider } from 'sql/workbench/services/notebook/browser/sql/sqlSerializationProvider';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';

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

const notebookRegistry = Registry.as<INotebookProviderRegistry>(NotebookProviderRegistryId);

export class SerializationProviderDescriptor {
	private _instanceReady = new Deferred<ISerializationProvider>();
	constructor(private readonly _providerId: string, private _instance?: ISerializationProvider) {
		if (_instance) {
			this._instanceReady.resolve(_instance);
		}
	}

	public get providerId(): string {
		return this._providerId;
	}

	public get instanceReady(): Promise<ISerializationProvider> {
		return this._instanceReady.promise;
	}

	public get instance(): ISerializationProvider | undefined {
		return this._instance;
	}
	public set instance(value: ISerializationProvider) {
		this._instance = value;
		this._instanceReady.resolve(value);
	}
}

export class ExecuteProviderDescriptor {
	private _instanceReady = new Deferred<IExecuteProvider>();
	constructor(private readonly _providerId: string, private _instance?: IExecuteProvider) {
		if (_instance) {
			this._instanceReady.resolve(_instance);
		}
	}

	public get providerId(): string {
		return this._providerId;
	}

	public get instanceReady(): Promise<IExecuteProvider> {
		return this._instanceReady.promise;
	}

	public get instance(): IExecuteProvider | undefined {
		return this._instance;
	}
	public set instance(value: IExecuteProvider) {
		this._instance = value;
		this._instanceReady.resolve(value);
	}
}

export class StandardKernelsDescriptor {
	private _instanceReady = new Deferred<nb.IStandardKernel[]>();
	constructor(private readonly _providerId: string, private _instance?: nb.IStandardKernel[]) {
		if (_instance) {
			this._instanceReady.resolve(_instance);
		}
	}

	public get providerId(): string {
		return this._providerId;
	}

	public get instanceReady(): Promise<nb.IStandardKernel[]> {
		return this._instanceReady.promise;
	}

	public get instance(): nb.IStandardKernel[] | undefined {
		return this._instance;
	}
	public set instance(value: nb.IStandardKernel[]) {
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
	private _serializationManagersMap: Map<string, ISerializationManager[]> = new Map();
	private _executeManagersMap: Map<string, IExecuteManager[]> = new Map();
	private _onNotebookEditorAdd = new Emitter<INotebookEditor>();
	private _onNotebookEditorRemove = new Emitter<INotebookEditor>();
	private _onNotebookEditorRename = new Emitter<INotebookEditor>();
	private _onNotebookKernelsAdded = new Emitter<IStandardKernelWithProvider[]>();
	private _editors = new Map<string, INotebookEditor>();
	private _fileToProviderDescriptions = new Map<string, ProviderDescriptionRegistration[]>();
	private _providerToStandardKernels = new Map<string, StandardKernelsDescriptor>(); // Note: providerId key here should be in upper case
	private _registrationComplete = new Deferred<void>();
	private _isRegistrationComplete = false;
	private _trustedCacheQueue: URI[] = [];
	private _unTrustedCacheQueue: URI[] = [];
	private _onCodeCellExecutionStart: Emitter<void> = new Emitter<void>();
	private _notebookInputsMap: Map<string, EditorInput> = new Map();

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
		if (this._storageService !== undefined) {
			if (this.providersMemento.notebookSerializationProviderCache === undefined) {
				this.providersMemento.notebookSerializationProviderCache = <NotebookProviderCache>{};
			}
			if (this.providersMemento.notebookExecuteProviderCache === undefined) {
				this.providersMemento.notebookExecuteProviderCache = <NotebookProviderCache>{};
			}
		}
		this._register(notebookRegistry.onNewDescriptionRegistration(this.handleNewProviderDescriptions, this));
		this.registerBuiltInProviders();

		// If a provider has been already registered, the onNewRegistration event will not have a listener attached yet
		// So, explicitly updating registered providers here.
		if (notebookRegistry.providerDescriptions.length > 0) {
			notebookRegistry.providerDescriptions.forEach(p => {
				// Don't need to re-register SQL_NOTEBOOK_PROVIDER
				if (p.provider !== SQL_NOTEBOOK_PROVIDER) {
					this.handleNewProviderDescriptions({ id: p.provider, registration: p });
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

	private getUntitledFileUri(): URI {
		// Need to create a new untitled URI, so find the lowest numbered one that's available
		let uri: URI;
		let counter = 1;
		do {
			uri = URI.from({ scheme: Schemas.untitled, path: `Notebook-${counter}` });
			counter++;
		} while (this._untitledEditorService.get(uri) || this._notebookInputsMap.has(uri.toString())); // Also have to check stored inputs, since those might not be opened in an editor yet.
		return uri;
	}

	public async createNotebookInputFromContents(providerId: string, contents?: nb.INotebookContents, resource?: UriComponents): Promise<EditorInput> {
		let uri: URI;
		if (resource) {
			uri = URI.revive(resource);
		} else {
			uri = this.getUntitledFileUri();
			resource = uri;
		}

		let options: INotebookShowOptions = {
			providerId: providerId,
			initialContent: contents
		};
		return this.createNotebookInput(options, resource);
	}

	private async createNotebookInput(options: INotebookShowOptions, resource?: UriComponents): Promise<EditorInput | undefined> {
		let uri: URI;
		if (resource) {
			uri = URI.revive(resource);
			if (this._notebookInputsMap.has(uri.toString())) {
				return this._notebookInputsMap.get(uri.toString());
			}
		} else {
			uri = this.getUntitledFileUri();
		}
		let isUntitled: boolean = uri.scheme === Schemas.untitled;

		let fileInput: EditorInput;
		let languageId = options.providerId === INTERACTIVE_PROVIDER_ID ? NotebookLanguage.Interactive : NotebookLanguage.Notebook;
		let initialStringContents: string;
		if (options.initialContent) {
			if (typeof options.initialContent === 'string') {
				initialStringContents = options.initialContent;
			} else {
				let manager = await this.getOrCreateSerializationManager(options.providerId, uri);
				initialStringContents = await manager.contentManager.serializeNotebook(options.initialContent);
			}
		}
		if (isUntitled && path.isAbsolute(uri.fsPath)) {
			const options: INewUntitledTextEditorWithAssociatedResourceOptions = {
				associatedResource: uri,
				languageId,
				initialValue: initialStringContents
			}
			const model = this._untitledEditorService.create(options);
			fileInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
		} else {
			if (isUntitled) {
				const options: IExistingUntitledTextEditorOptions = {
					untitledResource: uri,
					languageId,
					initialValue: initialStringContents
				}
				const model = this._untitledEditorService.create(options);
				fileInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
			} else {
				let input: IUntypedFileEditorInput = { forceFile: true, resource: uri, languageId };
				fileInput = await this._editorService.createEditorInput(input);
			}
		}

		// We only need to get the Notebook language association as such we only need to use ipynb
		const inputCreator = languageAssociationRegistry.getAssociationForLanguage(NotebookLanguage.Ipynb);
		if (inputCreator) {
			fileInput = await inputCreator.convertInput(fileInput);
			if (isINotebookInput(fileInput)) {
				fileInput.defaultKernel = options.defaultKernel;
				fileInput.connectionProfile = options.connectionProfile;
				if (typeof options.initialContent !== 'string') {
					fileInput.setNotebookContents(options.initialContent);
				}

				if (isUntitled) {
					let untitledModel = await fileInput.resolve();
					await untitledModel.resolve();
					if (options.initialDirtyState === false) {
						fileInput.setDirty(false);
					}
				}
			}
		}

		if (!fileInput) {
			throw new Error(localize('failedToCreateNotebookInput', "Failed to create notebook input for provider '{0}'", options.providerId));
		}

		this._notebookInputsMap.set(uri.toString(), fileInput);
		return fileInput;
	}

	public async openNotebook(resource: UriComponents, options: INotebookShowOptions): Promise<IEditorPane | undefined> {
		const editorOptions: ITextEditorOptions = {
			preserveFocus: options.preserveFocus,
			pinned: !options.preview
		};
		let input = await this.createNotebookInput(options, resource);
		return await this._editorService.openEditor(input, editorOptions, viewColumnToEditorGroup(this._editorGroupService, options.position));
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

	public getNotebookURIForCell(cellUri: URI): URI | undefined {
		for (let editor of this.listNotebookEditors()) {
			if (editor.cells) {
				for (let cell of editor.cells) {
					if (cell.cellUri === cellUri) {
						return editor.notebookParams.notebookUri;
					}
				}
			}
		}
		return undefined;
	}

	private updateSQLRegistrationWithConnectionProviders() {
		// Update the SQL extension
		let sqlNotebookKernels = this._providerToStandardKernels.get(notebookConstants.SQL);
		if (sqlNotebookKernels) {
			let sqlConnectionTypes = this._queryManagementService.getRegisteredProviders();
			let kernel = sqlNotebookKernels.instance.find(p => p.name === notebookConstants.SQL);
			if (kernel) {
				let descriptor = new StandardKernelsDescriptor(notebookConstants.SQL, [{
					name: notebookConstants.SQL,
					displayName: notebookConstants.SQL,
					connectionProviderIds: sqlConnectionTypes,
					supportedLanguages: [notebookConstants.sqlKernelSpec.language]
				}]);
				this._providerToStandardKernels.set(notebookConstants.SQL, descriptor);
			}
		}
		this._isRegistrationComplete = true;
		this._registrationComplete.resolve();
	}

	private handleNewProviderDescriptions(p: { id: string; registration: ProviderDescriptionRegistration }) {
		let registration = p.registration;
		if (registration.fileExtensions?.length > 0) {
			let extensions = registration.fileExtensions;
			if (!this._serializationProviders.has(p.id)) {
				// Only add a new provider descriptor if the provider
				// supports file extensions beyond the default ipynb
				let addNewProvider = extensions.some(ext => ext?.length > 0 && ext.toLowerCase() !== DEFAULT_NOTEBOOK_FILETYPE);
				if (addNewProvider) {
					this._serializationProviders.set(p.id, new SerializationProviderDescriptor(p.id));
				}
			}
			for (let fileType of extensions) {
				this.addFileProvider(fileType, registration);
			}
		}
		if (registration.standardKernels?.length > 0) {
			if (!this._executeProviders.has(p.id)) {
				this._executeProviders.set(p.id, new ExecuteProviderDescriptor(p.id));
			}
			this.addStandardKernels(registration, registration.fileExtensions);
		} else {
			// Standard kernels might get registered later for VSCode notebooks, so add a descriptor to wait on
			if (!this._providerToStandardKernels.has(p.id)) {
				let descriptor = new StandardKernelsDescriptor(p.id);
				this._providerToStandardKernels.set(p.id.toUpperCase(), descriptor);
			}
		}

		// Emit activation event if the provider is not one of the default options
		if (!DefaultNotebookProviders.includes(p.id)) {
			this._extensionService.whenInstalledExtensionsRegistered()
				.then(() => this._extensionService.activateByEvent(`onNotebook:${p.id}`))
				.then(() => this._extensionService.activateByEvent(`onNotebook:*`))
				.catch(err => onUnexpectedError(err));
		}
	}

	registerSerializationProvider(providerId: string, instance: ISerializationProvider): void {
		let providerDescriptor = this._serializationProviders.get(providerId);
		if (providerDescriptor) {
			// Update, which will resolve the promise for anyone waiting on the instance to be registered
			providerDescriptor.instance = instance;
		} else {
			this._serializationProviders.set(providerId, new SerializationProviderDescriptor(providerId, instance));
		}
	}

	registerExecuteProvider(providerId: string, instance: IExecuteProvider): void {
		let providerDescriptor = this._executeProviders.get(providerId);
		if (providerDescriptor) {
			// Update, which will resolve the promise for anyone waiting on the instance to be registered
			providerDescriptor.instance = instance;
		} else {
			this._executeProviders.set(providerId, new ExecuteProviderDescriptor(providerId, instance));
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

	private addFileProvider(fileType: string, provider: ProviderDescriptionRegistration) {
		let providers = this._fileToProviderDescriptions.get(fileType.toLowerCase());
		if (!providers) {
			providers = [];
		}
		providers.push(provider);
		this._fileToProviderDescriptions.set(fileType.toLowerCase(), providers);
	}

	// Standard kernels are contributed where a list of kernels are defined that can be shown
	// in the kernels dropdown list before a SessionManager has been started; this way,
	// every NotebookProvider doesn't need to have an active SessionManager in order to contribute
	// kernels to the dropdown
	private addStandardKernels(provider: ProviderDescriptionRegistration, supportedFileExtensions?: string[]) {
		let providerUpperCase = provider.provider.toUpperCase();
		let descriptor = this._providerToStandardKernels.get(providerUpperCase);
		if (!descriptor) {
			descriptor = new StandardKernelsDescriptor(provider.provider);
		}
		let standardKernels = descriptor.instance;
		if (!standardKernels) {
			standardKernels = [];
		}
		provider.standardKernels.forEach(kernel => {
			standardKernels.push(kernel);
		});

		// Filter out unusable kernels when running on a SAW
		if (this.productService.quality === 'saw') {
			standardKernels = standardKernels.filter(kernel => !kernel.blockedOnSAW);
		}
		descriptor.instance = standardKernels;
		this._providerToStandardKernels.set(providerUpperCase, descriptor);

		// Emit update event if the provider is not one of the default options
		if (!DefaultNotebookProviders.includes(provider.provider) && standardKernels.length > 0) {
			this._onNotebookKernelsAdded.fire(standardKernels.map(kernel => {
				return {
					name: kernel.name,
					displayName: kernel.displayName,
					connectionProviderIds: kernel.connectionProviderIds,
					notebookProvider: provider.provider,
					supportedLanguages: kernel.supportedLanguages,
					supportedFileExtensions: supportedFileExtensions
				};
			}));
		}
	}

	getSupportedFileExtensions(): string[] {
		return Array.from(this._fileToProviderDescriptions.keys());
	}

	getProvidersForFileType(fileType: string): string[] | undefined {
		let provDescriptions = this._fileToProviderDescriptions.get(fileType.toLowerCase());
		let providers = provDescriptions?.map(provider => provider.provider);
		return providers ? [...new Set(providers)] : undefined; // Use a set to remove duplicates
	}

	public async getStandardKernelsForProvider(provider: string): Promise<nb.IStandardKernel[] | undefined> {
		let descriptor = this._providerToStandardKernels.get(provider.toUpperCase());
		let kernels: nb.IStandardKernel[] = undefined;
		if (descriptor) {
			if (descriptor.instance) {
				kernels = descriptor.instance;
			} else {
				kernels = await this.waitOnStandardKernelsAvailability(descriptor);
			}
		}
		return kernels;
	}

	public async getSupportedLanguagesForProvider(provider: string, kernelDisplayName?: string): Promise<string[]> {
		let languages: string[] = [];
		let kernels = await this.getStandardKernelsForProvider(provider);
		if (kernelDisplayName && kernels) {
			kernels = kernels.filter(kernel => kernel.displayName === kernelDisplayName);
		}
		kernels?.forEach(kernel => {
			if (kernel.supportedLanguages) {
				languages.push(...kernel.supportedLanguages);
			}
		});
		// Remove duplicates
		languages = [...new Set(languages)];
		return languages;
	}

	private shutdown(): void {
		this._executeManagersMap.forEach(manager => {
			manager.forEach(m => {
				if (m.serverManager) {
					// TODO should this thenable be awaited?
					m.serverManager.stopServer();
				}
			});
		});
	}

	async getOrCreateSerializationManager(providerId: string, uri: URI): Promise<ISerializationManager> {
		if (!uri) {
			throw new Error(NotebookUriNotDefined);
		}
		let uriString = uri.toString();
		let managers: ISerializationManager[] = this._serializationManagersMap.get(uriString);
		// If manager already exists for a given notebook, return it
		if (managers) {
			let index = managers.findIndex(m => m.providerId === providerId);
			if (index >= 0) {
				return managers[index];
			}
		}
		let newManager = await this.doWithSerializationProvider(providerId, (provider) => provider.getSerializationManager(uri));

		managers = managers || [];
		managers.push(newManager);
		this._serializationManagersMap.set(uriString, managers);
		return newManager;
	}

	async getOrCreateExecuteManager(providerId: string, uri: URI): Promise<IExecuteManager> {
		if (!uri) {
			throw new Error(NotebookUriNotDefined);
		}
		let uriString = uri.toString();
		let managers: IExecuteManager[] = this._executeManagersMap.get(uriString);
		// If manager already exists for a given notebook, return it
		if (managers) {
			let index = managers.findIndex(m => m.providerId === providerId);
			if (index >= 0) {
				return managers[index];
			}
		}
		let newManager = await this.doWithExecuteProvider(providerId, (provider) => provider.getExecuteManager(uri));

		managers = managers || [];
		managers.push(newManager);
		this._executeManagersMap.set(uriString, managers);
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

	get onNotebookKernelsAdded(): Event<IStandardKernelWithProvider[]> {
		return this._onNotebookKernelsAdded.event;
	}

	addNotebookEditor(editor: INotebookEditor): void {
		this._editors.set(editor.id, editor);
		this._onNotebookEditorAdd.fire(editor);
	}

	removeNotebookEditor(editor: INotebookEditor): void {
		if (this._editors.delete(editor.id)) {
			this._onNotebookEditorRemove.fire(editor);
		}
		this._notebookInputsMap.delete(editor.notebookParams.notebookUri.toString());

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
		return notebookRegistry.languageMagics;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////

	private sendNotebookCloseToProvider(editor: INotebookEditor): void {
		let notebookUri = editor.notebookParams.notebookUri;
		let uriString = notebookUri.toString();
		let managers = this._executeManagersMap.get(uriString);
		if (managers) {
			// As we have a manager, we can assume provider is ready
			this._executeManagersMap.delete(uriString);
			managers.forEach(m => {
				let provider = this._executeProviders.get(m.providerId);
				provider?.instance?.handleNotebookClosed(notebookUri);
			});
		}
	}

	private async doWithSerializationProvider<T>(providerId: string, op: (provider: ISerializationProvider) => Thenable<T>): Promise<T> {
		// Make sure the provider exists before attempting to retrieve accounts
		let provider: ISerializationProvider = await this.getSerializationProviderInstance(providerId);
		return op(provider);
	}

	private async doWithExecuteProvider<T>(providerId: string, op: (provider: IExecuteProvider) => Thenable<T>): Promise<T> {
		// Make sure the provider exists before attempting to retrieve accounts
		let provider: IExecuteProvider = await this.getExecuteProviderInstance(providerId);
		return op(provider);
	}

	private async getSerializationProviderInstance(providerId: string, timeout?: number): Promise<ISerializationProvider> {
		let providerDescriptor = this._serializationProviders.get(providerId);
		let instance: ISerializationProvider;

		// Try get from actual provider, waiting on its registration
		if (providerDescriptor) {
			if (!providerDescriptor.instance) {
				// Await extension registration before awaiting provider registration
				try {
					await this._extensionService.whenInstalledExtensionsRegistered();
				} catch (error) {
					this._logService.error(error);
				}
				instance = await this.waitOnSerializationProviderAvailability(providerDescriptor, timeout);
			} else {
				instance = providerDescriptor.instance;
			}
		}

		// Fall back to default (SQL) if this failed
		if (!instance) {
			providerDescriptor = this._serializationProviders.get(SQL_NOTEBOOK_PROVIDER);
			instance = providerDescriptor ? providerDescriptor.instance : undefined;
		}

		// Should never happen, but if default wasn't registered we should throw
		if (!instance) {
			throw new Error(NotebookServiceNoProviderRegistered);
		}
		return instance;
	}

	private async getExecuteProviderInstance(providerId: string, timeout?: number): Promise<IExecuteProvider> {
		let providerDescriptor = this._executeProviders.get(providerId);
		let kernelDescriptor = this._providerToStandardKernels.get(providerId.toUpperCase());
		let instance: IExecuteProvider;

		// Try get from actual provider, waiting on its registration
		if (providerDescriptor && kernelDescriptor) {
			if (!providerDescriptor.instance || !kernelDescriptor.instance) {
				// Await extension registration before awaiting provider registration
				try {
					await this._extensionService.whenInstalledExtensionsRegistered();
				} catch (error) {
					this._logService.error(error);
				}

				if (providerDescriptor.instance) {
					instance = providerDescriptor.instance;
				} else {
					instance = await this.waitOnExecuteProviderAvailability(providerDescriptor, timeout);
				}

				// Even if we have an execute provider, we still need standard kernels to be able to use it
				if (instance && !kernelDescriptor.instance) {
					let kernels = await this.waitOnStandardKernelsAvailability(kernelDescriptor, timeout);
					if (!kernels) {
						instance = undefined;
					}
				}
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

	private waitOnSerializationProviderAvailability(providerDescriptor: SerializationProviderDescriptor, timeout?: number): Promise<ISerializationProvider | undefined> {
		// Wait up to 30 seconds for the provider to be registered
		timeout = timeout ?? 30000;
		let promises: Promise<ISerializationProvider | undefined>[] = [
			providerDescriptor.instanceReady,
			new Promise<ISerializationProvider | undefined>((resolve, reject) => setTimeout(() => {
				if (!providerDescriptor.instance) {
					this._serializationProviders.delete(providerDescriptor.providerId); // Remove waiting descriptor so we don't timeout again
					onUnexpectedError(localize('serializationProviderTimeout', 'Waiting for Serialization Provider availability timed out for notebook provider \'{0}\'', providerDescriptor.providerId));
				}
				resolve(undefined);
			}, timeout))
		];
		return Promise.race(promises);
	}

	private waitOnExecuteProviderAvailability(providerDescriptor: ExecuteProviderDescriptor, timeout?: number): Promise<IExecuteProvider | undefined> {
		// Wait up to 30 seconds for the provider to be registered
		timeout = timeout ?? 30000;
		let promises: Promise<IExecuteProvider | undefined>[] = [
			providerDescriptor.instanceReady,
			new Promise<IExecuteProvider | undefined>((resolve, reject) => setTimeout(() => {
				if (!providerDescriptor.instance) {
					this._executeProviders.delete(providerDescriptor.providerId); // Remove waiting descriptor so we don't timeout again
					onUnexpectedError(localize('executeProviderTimeout', 'Waiting for Execute Provider availability timed out for notebook provider \'{0}\'', providerDescriptor.providerId));
				}
				resolve(undefined);
			}, timeout))
		];
		return Promise.race(promises);
	}

	private waitOnStandardKernelsAvailability(kernelsDescriptor: StandardKernelsDescriptor, timeout?: number): Promise<nb.IStandardKernel[] | undefined> {
		// Wait up to 30 seconds for the kernels to be registered
		timeout = timeout ?? 30000;
		let promises: Promise<nb.IStandardKernel[] | undefined>[] = [
			kernelsDescriptor.instanceReady,
			new Promise<nb.IStandardKernel[] | undefined>((resolve, reject) => setTimeout(() => {
				if (!kernelsDescriptor.instance) {
					this._providerToStandardKernels.delete(kernelsDescriptor.providerId.toUpperCase()); // Remove waiting descriptor so we don't timeout again
					onUnexpectedError(localize('standardKernelsTimeout', 'Waiting for Standard Kernels availability timed out for notebook provider \'{0}\'', kernelsDescriptor.providerId));
				}
				resolve(undefined);
			}, timeout))
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
		let knownProviders = notebookRegistry.providerDescriptions.map(d => d.provider);
		let executeCache = this.providersMemento.notebookExecuteProviderCache;
		for (let key in executeCache) {
			if (!knownProviders.some(x => x === key)) {
				this._executeProviders.delete(key);
				delete executeCache[key];
			}
		}

		let serializationCache = this.providersMemento.notebookSerializationProviderCache;
		for (let key in serializationCache) {
			if (!knownProviders.some(x => x === key)) {
				this._serializationProviders.delete(key);
				delete serializationCache[key];
			}
		}
	}

	private registerBuiltInProviders() {
		let serializationProvider = new SqlSerializationProvider(this._instantiationService);
		this.registerSerializationProvider(serializationProvider.providerId, serializationProvider);

		let executeProvider = new SqlExecuteProvider(this._instantiationService);
		this.registerExecuteProvider(executeProvider.providerId, executeProvider);

		notebookRegistry.registerProviderDescription({
			provider: serializationProvider.providerId,
			fileExtensions: [DEFAULT_NOTEBOOK_FILETYPE],
			standardKernels: [{
				name: notebookConstants.SQL,
				displayName: notebookConstants.SQL,
				connectionProviderIds: [notebookConstants.SQL_CONNECTION_PROVIDER],
				supportedLanguages: [notebookConstants.sqlKernelSpec.language]
			}]
		});
	}

	protected async removeContributedProvidersFromCache(identifier: IExtensionIdentifier, extensionService: IExtensionService): Promise<void> {
		try {
			const extensionDescriptions = await extensionService.getExtensions();
			let extensionDescription = extensionDescriptions.find(c => c.identifier.value.toLowerCase() === identifier.id.toLowerCase());
			if (extensionDescription && extensionDescription.contributes
				&& extensionDescription.contributes[Extensions.NotebookProviderDescriptionContribution]
				&& extensionDescription.contributes[Extensions.NotebookProviderDescriptionContribution].providerId) {
				let id = extensionDescription.contributes[Extensions.NotebookProviderDescriptionContribution].providerId;
				delete this.providersMemento.notebookSerializationProviderCache[id];
				delete this.providersMemento.notebookExecuteProviderCache[id];
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
