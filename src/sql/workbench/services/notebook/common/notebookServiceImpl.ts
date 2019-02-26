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
	DEFAULT_NOTEBOOK_FILETYPE, INotebookEditor, SQL_NOTEBOOK_PROVIDER, OVERRIDE_EDITOR_THEMING_SETTING
} from 'sql/workbench/services/notebook/common/notebookService';
import { RenderMimeRegistry } from 'sql/parts/notebook/outputs/registry';
import { standardRendererFactories } from 'sql/parts/notebook/outputs/factories';
import { LocalContentManager } from 'sql/workbench/services/notebook/node/localContentManager';
import { SessionManager, noKernel } from 'sql/workbench/services/notebook/common/sessionManager';
import { Extensions, INotebookProviderRegistry, NotebookProviderRegistration } from 'sql/workbench/services/notebook/common/notebookRegistry';
import { Emitter, Event } from 'vs/base/common/event';
import { Memento } from 'vs/workbench/common/memento';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IExtensionManagementService, IExtensionIdentifier } from 'vs/platform/extensionManagement/common/extensionManagement';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { getIdFromLocalExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { Deferred } from 'sql/base/common/promise';
import { SqlSessionManager } from 'sql/workbench/services/notebook/common/sqlSessionManager';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { NotebookEditorVisibleContext } from 'sql/workbench/services/notebook/common/notebookContext';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { NotebookEditor } from 'sql/parts/notebook/notebookEditor';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { registerNotebookThemes } from 'sql/parts/notebook/notebookStyles';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import { ILanguageMagic, notebookConstants } from 'sql/parts/notebook/models/modelInterfaces';

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
	private _managersMap: Map<string, INotebookManager[]> = new Map();
	private _onNotebookEditorAdd = new Emitter<INotebookEditor>();
	private _onNotebookEditorRemove = new Emitter<INotebookEditor>();
	private _onCellChanged = new Emitter<INotebookEditor>();
	private _onNotebookEditorRename = new Emitter<INotebookEditor>();
	private _editors = new Map<string, INotebookEditor>();
	private _fileToProviders = new Map<string, NotebookProviderRegistration[]>();
	private _providerToStandardKernels = new Map<string, nb.IStandardKernel[]>();
	private _registrationComplete = new Deferred<void>();
	private _isRegistrationComplete = false;
	private notebookEditorVisible: IContextKey<boolean>;
	private _themeParticipant: IDisposable;
	private _overrideEditorThemeSetting: boolean;

	constructor(
		@IStorageService private _storageService: IStorageService,
		@IExtensionService extensionService: IExtensionService,
		@IExtensionManagementService extensionManagementService: IExtensionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextKeyService private _contextKeyService: IContextKeyService,
		@IEditorService private readonly _editorService: IEditorService,
		@IEditorGroupsService private readonly _editorGroupsService: IEditorGroupsService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IThemeService private readonly _themeService: IThemeService,
		@IQueryManagementService private readonly _queryManagementService
	) {
		super();
		this._memento = new Memento('notebookProviders', this._storageService);
		this._register(notebookRegistry.onNewRegistration(this.updateRegisteredProviders, this));
		this.registerBuiltInProvider();

		if (extensionService) {
			extensionService.whenInstalledExtensionsRegistered().then(() => {
				this.cleanupProviders();

				// If providers have already registered by this point, add them now (since onHandlerAdded will never fire)
				if (this._queryManagementService.registeredProviders && this._queryManagementService.registeredProviders.length > 0) {
					this.updateSQLRegistrationWithConnectionProviders();
				}

				this._register(this._queryManagementService.onHandlerAdded((queryType) => {
					this.updateSQLRegistrationWithConnectionProviders();
				}));
			});
		}
		if (extensionManagementService) {
			this._register(extensionManagementService.onDidUninstallExtension(({ identifier }) => this.removeContributedProvidersFromCache(identifier, extensionService)));
		}
		this.hookContextKeyListeners();
		this.hookNotebookThemesAndConfigListener();
	}

	public dispose(): void {
		super.dispose();
		if (this._themeParticipant) {
			this._themeParticipant.dispose();
		}
	}

	private hookContextKeyListeners(): void {
		const updateEditorContextKeys = () => {
			const visibleEditors = this._editorService.visibleControls;
			this.notebookEditorVisible.set(visibleEditors.some(control => control.getId() === NotebookEditor.ID));
		};
		if (this._contextKeyService) {
			this.notebookEditorVisible = NotebookEditorVisibleContext.bindTo(this._contextKeyService);
		}
		if (this._editorService) {
			this._register(this._editorService.onDidActiveEditorChange(() => updateEditorContextKeys()));
			this._register(this._editorService.onDidVisibleEditorsChange(() => updateEditorContextKeys()));
			this._register(this._editorGroupsService.onDidAddGroup(() => updateEditorContextKeys()));
			this._register(this._editorGroupsService.onDidRemoveGroup(() => updateEditorContextKeys()));
		}
	}

	private hookNotebookThemesAndConfigListener(): void {
		if(this._configurationService) {
			this.updateNotebookThemes();
			this._register(this._configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(OVERRIDE_EDITOR_THEMING_SETTING)) {
					this.updateNotebookThemes();
				}
			}));
		}
	}

	private updateSQLRegistrationWithConnectionProviders() {
		// Update the SQL extension
		let sqlNotebookProvider = this._providerToStandardKernels.get(notebookConstants.SQL);
		if (sqlNotebookProvider) {
			let sqlConnectionTypes = this._queryManagementService.getRegisteredProviders();
			let provider = sqlNotebookProvider.find(p => p.name === notebookConstants.SQL);
			if (provider) {
				this._providerToStandardKernels.set(notebookConstants.SQL, [{
					name: notebookConstants.SQL,
					connectionProviderIds: sqlConnectionTypes
				}]);
			}
		}
		this._isRegistrationComplete = true;
		this._registrationComplete.resolve();
	}

	private updateNotebookThemes() {
		let overrideEditorSetting = this._configurationService.getValue<boolean>(OVERRIDE_EDITOR_THEMING_SETTING);
		if (overrideEditorSetting !== this._overrideEditorThemeSetting) {
			// Re-add the participant since this will trigger update of theming rules, can't just
			// update something and ask to change
			if (this._themeParticipant) {
				this._themeParticipant.dispose();
			}
			this._overrideEditorThemeSetting = overrideEditorSetting;
			this._themeParticipant = registerNotebookThemes(overrideEditorSetting);
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

	public shutdown(): void {
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
			throw new Error(localize('notebookUriNotDefined', 'No URI was passed when creating a notebook manager'));
		}
		let uriString = uri.toString();
		let managers: INotebookManager[] = this._managersMap.get(uriString);
		// If manager already exists for a given notebook, return it
		if (managers) {
			let index = managers.findIndex(m => m.providerId === providerId);
			if (index && index >= 0) {
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
		if (this._editors.has(oldUriKey)) {
			this._editors.delete(oldUriKey);
			currentEditor.notebookParams.notebookUri = newUri;
			this._editors.set(newUri.toString(), currentEditor);
			this._onNotebookEditorRename.fire(currentEditor);
		}
	}

	get languageMagics(): ILanguageMagic[] {
		return notebookRegistry.languageMagics;
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////

	private sendNotebookCloseToProvider(editor: INotebookEditor): void {
		let notebookUri = editor.notebookParams.notebookUri;
		let uriString = notebookUri.toString();
		let manager = this._managersMap.get(uriString);
		if (manager) {
			// As we have a manager, we can assume provider is ready
			this._managersMap.delete(uriString);
			manager.forEach(m => {
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
		let knownProviders = Object.keys(notebookRegistry.providers);
		let cache = this.providersMemento.notebookProviderCache;
		for (let key in cache) {
			if (!knownProviders.includes(key)) {
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
			standardKernels: { name: 'SQL', connectionProviderIds: ['MSSQL'] }
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

export class SqlNotebookProvider implements INotebookProvider {
	private manager: SqlNotebookManager;

	constructor(private _instantiationService: IInstantiationService) {
		this.manager = new SqlNotebookManager(this._instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
	}

	getNotebookManager(notebookUri: URI): Thenable<INotebookManager> {
		return Promise.resolve(this.manager);
	}

	handleNotebookClosed(notebookUri: URI): void {
		// No-op
	}
}

export class SqlNotebookManager implements INotebookManager {
	private _contentManager: nb.ContentManager;
	private _sessionManager: nb.SessionManager;

	constructor(private _instantiationService: IInstantiationService) {
		this._contentManager = new LocalContentManager();
		this._sessionManager = new SqlSessionManager(this._instantiationService);
	}

	public get providerId(): string {
		return SQL_NOTEBOOK_PROVIDER;
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