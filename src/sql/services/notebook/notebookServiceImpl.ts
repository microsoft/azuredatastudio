/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';
import { localize } from 'vs/nls';
import URI from 'vs/base/common/uri';
import { Registry } from 'vs/platform/registry/common/platform';

import {
	INotebookService, INotebookManager, INotebookProvider, DEFAULT_NOTEBOOK_PROVIDER,
	DEFAULT_NOTEBOOK_FILETYPE, INotebookEditor
} from 'sql/services/notebook/notebookService';
import { RenderMimeRegistry } from 'sql/parts/notebook/outputs/registry';
import { standardRendererFactories } from 'sql/parts/notebook/outputs/factories';
import { LocalContentManager } from 'sql/services/notebook/localContentManager';
import { SessionManager } from 'sql/services/notebook/sessionManager';
import { Extensions, INotebookProviderRegistry } from 'sql/services/notebook/notebookRegistry';
import { Emitter, Event } from 'vs/base/common/event';


export class NotebookService implements INotebookService {
	_serviceBrand: any;
	private _mimeRegistry: RenderMimeRegistry;
	private _providers: Map<string, INotebookProvider> = new Map();
	private _managers: Map<string, INotebookManager> = new Map();
	private _onNotebookEditorAdd = new Emitter<INotebookEditor>();
	private _onNotebookEditorRemove = new Emitter<INotebookEditor>();
	private _editors = new Map<string, INotebookEditor>();

	constructor() {
		this.registerDefaultProvider();
	}

	private registerDefaultProvider() {
		let defaultProvider = new BuiltinProvider();
		this.registerProvider(defaultProvider.providerId, defaultProvider);
		let registry = Registry.as<INotebookProviderRegistry>(Extensions.NotebookProviderContribution);
		registry.registerNotebookProvider({
			provider: defaultProvider.providerId,
			fileExtensions: DEFAULT_NOTEBOOK_FILETYPE
		});
	}

	registerProvider(providerId: string, provider: INotebookProvider): void {
		this._providers.set(providerId, provider);
	}

	unregisterProvider(providerId: string): void {
		this._providers.delete(providerId);
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

	private sendNotebookCloseToProvider(editor: INotebookEditor) {
		let notebookUri = editor.notebookParams.notebookUri;
		let uriString = notebookUri.toString();
		let manager = this._managers.get(uriString);
		if (manager) {
			this._managers.delete(uriString);
			let provider = this._providers.get(manager.providerId);
			provider.handleNotebookClosed(notebookUri);
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private doWithProvider<T>(providerId: string, op: (provider: INotebookProvider) => Thenable<T>): Thenable<T> {
		// Make sure the provider exists before attempting to retrieve accounts
		let provider: INotebookProvider;
		if (this._providers.has(providerId)) {
			provider = this._providers.get(providerId);
		}
		else {
			provider = this._providers.get(DEFAULT_NOTEBOOK_PROVIDER);
		}

		if (!provider) {
			return Promise.reject(new Error(localize('notebookServiceNoProvider', 'Notebook provider does not exist'))).then();
		}
		return op(provider);
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
