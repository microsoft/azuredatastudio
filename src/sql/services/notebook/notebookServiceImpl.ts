/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';
import { localize } from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';

import {
	INotebookService, INotebookManager, INotebookProvider, DEFAULT_NOTEBOOK_PROVIDER,
	DEFAULT_NOTEBOOK_FILETYPE, INotebookEditor
} from 'sql/services/notebook/notebookService';
import { RenderMimeRegistry } from 'sql/parts/notebook/outputs/registry';
import { standardRendererFactories } from 'sql/parts/notebook/outputs/factories';
import { LocalContentManager } from 'sql/services/notebook/localContentManager';
import { SessionManager } from 'sql/services/notebook/sessionManager';
import { Extensions, INotebookProviderRegistry, NotebookProviderRegistration } from 'sql/services/notebook/notebookRegistry';
import { Emitter, Event } from 'vs/base/common/event';
import { Memento } from 'vs/workbench/common/memento';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IExtensionManagementService, IExtensionIdentifier } from 'vs/platform/extensionManagement/common/extensionManagement';
import { Disposable } from 'vs/base/common/lifecycle';
import { getIdFromLocalExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { Deferred } from 'sql/base/common/promise';

export interface NotebookProviderProperties {
	provider: string;
	fileExtensions: string[];
}

interface NotebookProviderCache {
	[id: string]: NotebookProviderProperties;
}

interface NotebookProvidersMemento {
	notebookProviderCache: NotebookProviderCache;
}

const notebookRegistry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);

class ProviderDescriptor {
	private _instanceReady = new Deferred<INotebookProvider>();
	constructor(private providerId: string, private _instance?: INotebookProvider) {
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

export class NotebookService extends Disposable implements INotebookService {
	_serviceBrand: any;

	private _memento: Memento;
	private _mimeRegistry: RenderMimeRegistry;
	private _providers: Map<string, ProviderDescriptor> = new Map();
	private _managers: Map<string, INotebookManager> = new Map();
	private _onNotebookEditorAdd = new Emitter<INotebookEditor>();
	private _onNotebookEditorRemove = new Emitter<INotebookEditor>();
	private _onCellChanged = new Emitter<INotebookEditor>();
	private _onNotebookEditorRename = new Emitter<INotebookEditor>();
	private _editors = new Map<string, INotebookEditor>();
	private _fileToProviders = new Map<string, NotebookProviderRegistration>();
	private _registrationComplete = new Deferred<void>();
	private _isRegistrationComplete = false;

	constructor(
		@IStorageService private _storageService: IStorageService,
		@IExtensionService extensionService: IExtensionService,
		@IExtensionManagementService extensionManagementService: IExtensionManagementService
	) {
		super();
		this._memento = new Memento('notebookProviders', this._storageService);
		this._register(notebookRegistry.onNewRegistration(this.updateRegisteredProviders, this));
		this.registerDefaultProvider();

		if (extensionService) {
				extensionService.whenInstalledExtensionsRegistered().then(() => {
				this.cleanupProviders();
				this._isRegistrationComplete = true;
				this._registrationComplete.resolve();
			});
		}
		if (extensionManagementService) {
			this._register(extensionManagementService.onDidUninstallExtension(({ identifier }) => this.removeContributedProvidersFromCache(identifier, extensionService)));
		}
	}

	private updateRegisteredProviders(p: { id: string; registration: NotebookProviderRegistration; }) {
		let registration = p.registration;

		if (!this._providers.has(p.id)) {
			this._providers.set(p.id, new ProviderDescriptor(p.id));
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
	}

	registerProvider(providerId: string, instance: INotebookProvider): void {
		let providerDescriptor = this._providers.get(providerId);
		if (providerDescriptor) {
			// Update, which will resolve the promise for anyone waiting on the instance to be registered
			providerDescriptor.instance = instance;
		} else {
			this._providers.set(providerId, new ProviderDescriptor(providerId, instance));
		}
	}

	unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
	}

	get isRegistrationComplete(): boolean {
		return this._isRegistrationComplete;
	}

	get registrationComplete(): Promise<void> {
		return this._registrationComplete.promise;
	}

	private addFileProvider(fileType: string, provider: NotebookProviderRegistration) {
		this._fileToProviders.set(fileType.toUpperCase(), provider);
	}

	getSupportedFileExtensions(): string[] {
		return Array.from(this._fileToProviders.keys());
	}

	getProviderForFileType(fileType: string): string {
		fileType = fileType.toUpperCase();
		let provider = this._fileToProviders.get(fileType);
		return provider ? provider.provider : undefined;
	}

	public shutdown(): void {
		this._managers.forEach(manager => {
			if (manager.serverManager) {
				// TODO should this thenable be awaited?
				manager.serverManager.stopServer();
			}
		});
	}

	async getOrCreateNotebookManager(providerId: string, uri: URI): Promise<INotebookManager> {
		if (!uri) {
			throw new Error(localize('notebookUriNotDefined', 'No URI was passed when creating a notebook manager'));
		}
		let uriString = uri.toString();
		let manager = this._managers.get(uriString);
		if (!manager) {
			manager = await this.doWithProvider(providerId, (provider) => provider.getNotebookManager(uri));
			if (manager) {
				this._managers.set(uriString, manager);
			}
		}
		return manager;
	}

	get onNotebookEditorAdd(): Event<INotebookEditor> {
		return this._onNotebookEditorAdd.event;
	}
	get onNotebookEditorRemove(): Event<INotebookEditor> {
		return this._onNotebookEditorRemove.event;
	}
	get onCellChanged(): Event<INotebookEditor> {
		return this._onCellChanged.event;
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

	listNotebookEditors(): INotebookEditor[] {
		let editors = [];
		this._editors.forEach(e => editors.push(e));
		return editors;
	}

	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void {
		let oldUriKey = oldUri.toString();
		if(this._editors.has(oldUriKey))
		{
			this._editors.delete(oldUriKey);
			currentEditor.notebookParams.notebookUri = newUri;
			this._editors.set(newUri.toString(), currentEditor);
			this._onNotebookEditorRename.fire(currentEditor);
		}
	}

	private sendNotebookCloseToProvider(editor: INotebookEditor): void {
		let notebookUri = editor.notebookParams.notebookUri;
		let uriString = notebookUri.toString();
		let manager = this._managers.get(uriString);
		if (manager) {
			// As we have a manager, we can assume provider is ready
			this._managers.delete(uriString);
			let provider = this._providers.get(manager.providerId);
			provider.instance.handleNotebookClosed(notebookUri);
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
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
				instance = await this.waitOnProviderAvailability(providerDescriptor);
			} else {
				instance = providerDescriptor.instance;
			}
		}

		// Fall back to default if this failed
		if (!instance) {
			providerDescriptor = this._providers.get(DEFAULT_NOTEBOOK_PROVIDER);
			instance = providerDescriptor ? providerDescriptor.instance : undefined;
		}

		// Should never happen, but if default wasn't registered we should throw
		if (!instance) {
			throw new Error(localize('notebookServiceNoProvider', 'Notebook provider does not exist'));
		}
		return instance;
	}

	private waitOnProviderAvailability(providerDescriptor: ProviderDescriptor, timeout?: number): Promise<INotebookProvider> {
		// Wait up to 10 seconds for the provider to be registered
		timeout = timeout || 10000;
		let promises: Promise<INotebookProvider>[] = [
			providerDescriptor.instanceReady,
			new Promise<INotebookProvider>((resolve, reject) => setTimeout(() => resolve(), timeout))
		];
		return Promise.race(promises);
	}

	//Returns an instantiation of RenderMimeRegistry class
	getMimeRegistry(): RenderMimeRegistry {
		if (!this._mimeRegistry) {
			return new RenderMimeRegistry({
				initialFactories: standardRendererFactories
			});
		}
		return this._mimeRegistry;
	}

	private get providersMemento(): NotebookProvidersMemento {
		return this._memento.getMemento(StorageScope.GLOBAL) as NotebookProvidersMemento;
	}

	private cleanupProviders(): void {
		let knownProviders = Object.keys(notebookRegistry.registrations);
		let cache = this.providersMemento.notebookProviderCache;
		for (let key in cache) {
			if (!knownProviders.includes(key)) {
				this._providers.delete(key);
				delete cache[key];
			}
		}
	}

	private registerDefaultProvider() {
		let defaultProvider = new BuiltinProvider();
		this.registerProvider(defaultProvider.providerId, defaultProvider);
		notebookRegistry.registerNotebookProvider({
			provider: defaultProvider.providerId,
			fileExtensions: DEFAULT_NOTEBOOK_FILETYPE
		});
	}

	private removeContributedProvidersFromCache(identifier: IExtensionIdentifier, extensionService: IExtensionService) {
		let extensionid = getIdFromLocalExtensionId(identifier.id);
		extensionService.getExtensions().then(i => {
			let extension = i.find(c => c.id === extensionid);
			if (extension && extension.contributes['notebookProvider']) {
				let id = extension.contributes['notebookProvider'].providerId;
				delete this.providersMemento.notebookProviderCache[id];
			}
		});
	}
}

export class BuiltinProvider implements INotebookProvider {
	private manager: BuiltInNotebookManager;

	constructor() {
		this.manager = new BuiltInNotebookManager();
	}
	public get providerId(): string {
		return DEFAULT_NOTEBOOK_PROVIDER;
	}

	getNotebookManager(notebookUri: URI): Thenable<INotebookManager> {
		return Promise.resolve(this.manager);
	}
	handleNotebookClosed(notebookUri: URI): void {
		// No-op
	}
}

export class BuiltInNotebookManager implements INotebookManager {
	private _contentManager: nb.ContentManager;
	private _sessionManager: nb.SessionManager;

	constructor() {
		this._contentManager = new LocalContentManager();
		this._sessionManager = new SessionManager();
	}
	public get providerId(): string {
		return DEFAULT_NOTEBOOK_PROVIDER;
	}

	public get contentManager(): nb.ContentManager {
		return this._contentManager;
	}

	public get serverManager(): nb.ServerManager {
		return undefined;
	}

	public get sessionManager(): nb.SessionManager {
		return this._sessionManager;
	}

}
