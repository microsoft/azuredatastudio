/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { TPromise } from 'vs/base/common/winjs.base';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import { localize } from 'vs/nls';


import { ExtHostNotebookShape, MainThreadNotebookShape, SqlMainContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import URI, { UriComponents } from 'vs/base/common/uri';
import { INotebookManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';

export class ExtHostNotebook implements ExtHostNotebookShape {
	private static _handlePool: number = 0;

	private readonly _proxy: MainThreadNotebookShape;
	private _providers = new Map<number, sqlops.nb.NotebookProvider>();
	// Notebook URI to manager lookup.
	private _managers = new Map<number, NotebookManagerAdapter>();
	constructor(private _mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadNotebook);
	}

	//#region APIs called by main thread
	async $getNotebookManager(providerHandle: number, notebookUri: UriComponents): Promise<INotebookManagerDetails> {
		let uri = URI.revive(notebookUri);
		let uriString = uri.toString();
		let adapter = this.findManagerForUri(uriString);
		if (!adapter) {
			adapter = await this._withProvider(providerHandle, (provider) => {
				return this.createManager(provider, uri);
			});
		}

		return {
			handle: adapter.managerHandle,
			hasContentManager: !!adapter.contentManager,
			hasServerManager: !!adapter.serverManager
		};
	}
	$handleNotebookClosed(notebookUri: UriComponents): void {
		let uri = URI.revive(notebookUri);
		let uriString = uri.toString();
		let manager = this.findManagerForUri(uriString);
		if (manager) {
			manager.provider.handleNotebookClosed(uri);
			this._managers.delete(manager.managerHandle);
		}
	}

	$doStartServer(managerHandle: number): Thenable<void> {
		return this._withServerManager(managerHandle, (serverManager) => serverManager.startServer());
	}

	$doStopServer(managerHandle: number): Thenable<void> {
		return this._withServerManager(managerHandle, (serverManager) => serverManager.stopServer());
	}

	$getNotebookContents(managerHandle: number, notebookUri: UriComponents): Thenable<sqlops.nb.INotebook> {
		return this._withContentManager(managerHandle, (contentManager) => contentManager.getNotebookContents(URI.revive(notebookUri)));
	}

	$save(managerHandle: number, notebookUri: UriComponents, notebook: sqlops.nb.INotebook): Thenable<sqlops.nb.INotebook> {
		return this._withContentManager(managerHandle, (contentManager) => contentManager.save(URI.revive(notebookUri), notebook));
	}

	//#endregion

	//#region APIs called by extensions
	registerNotebookProvider(provider: sqlops.nb.NotebookProvider): vscode.Disposable {
		if (!provider || !provider.providerId) {
			throw new Error(localize('providerRequired', 'A NotebookProvider with valid providerId must be passed to this method'));
		}
		const handle = this._addNewProvider(provider);
		this._proxy.$registerNotebookProvider(provider.providerId, handle);
		return this._createDisposable(handle);
	}
	//#endregion


	//#region private methods

	private findManagerForUri(uriString: string): NotebookManagerAdapter {
		for(let manager of Array.from(this._managers.values())) {
			if (manager.uriString === uriString) {
				return manager;
			}
		}
		return undefined;
	}

	private async createManager(provider: sqlops.nb.NotebookProvider, notebookUri: URI): Promise<NotebookManagerAdapter> {
		let manager = await provider.getNotebookManager(notebookUri);
		let uriString = notebookUri.toString();
		let handle = this._nextHandle();
		let adapter = new NotebookManagerAdapter(provider, handle, manager, uriString);
		this._managers.set(handle, adapter);
		return adapter;
	}

	private _createDisposable(handle: number): Disposable {
		return new Disposable(() => {
			this._providers.delete(handle);
			this._proxy.$unregisterNotebookProvider(handle);
		});
	}

	private _nextHandle(): number {
		return ExtHostNotebook._handlePool++;
	}

	private _withProvider<R>(handle: number, callback: (provider: sqlops.nb.NotebookProvider) => R | PromiseLike<R>): TPromise<R> {
		let provider = this._providers.get(handle);
		if (provider === undefined) {
			return TPromise.wrapError<R>(new Error(localize('errNoProvider', 'no notebook provider found')));
		}
		return TPromise.wrap(callback(provider));
	}

	private _withNotebookManager<R>(handle: number, callback: (manager: NotebookManagerAdapter) => R | PromiseLike<R>): TPromise<R> {
		let manager = this._managers.get(handle);
		if (manager === undefined) {
			return TPromise.wrapError<R>(new Error(localize('errNoManager', 'No Manager found')));
		}
		return TPromise.wrap(callback(manager));
	}

	private _withServerManager<R>(handle: number, callback: (manager: sqlops.nb.ServerManager) => R | PromiseLike<R>): TPromise<R> {
		return this._withNotebookManager(handle, (notebookManager) => {
			let serverManager = notebookManager.serverManager;
			if (!serverManager) {
				return TPromise.wrapError(new Error(localize('noServerManager', 'Notebook Manager for notebook {0} does not have a server manager. Cannot perform operations on it', notebookManager.uriString)));
			}
			return callback(serverManager);
		});
	}

	private _withContentManager<R>(handle: number, callback: (manager: sqlops.nb.ContentManager) => R | PromiseLike<R>): TPromise<R> {
		return this._withNotebookManager(handle, (notebookManager) => {
			let contentManager = notebookManager.contentManager;
			if (!contentManager) {
				return TPromise.wrapError(new Error(localize('noContentManager', 'Notebook Manager for notebook {0} does not have a content manager. Cannot perform operations on it', notebookManager.uriString)));
			}
			return callback(contentManager);
		});
	}

	private _withSessionManager<R>(handle: number, callback: (manager: sqlops.nb.SessionManager) => R | PromiseLike<R>): TPromise<R> {
		return this._withNotebookManager(handle, (notebookManager) => {
			let sessionManager = notebookManager.sessionManager;
			if (!sessionManager) {
				return TPromise.wrapError(new Error(localize('noSessionManager', 'Notebook Manager for notebook {0} does not have a session manager. Cannot perform operations on it', notebookManager.uriString)));
			}
			return callback(sessionManager);
		});
	}

	private _addNewProvider(adapter: sqlops.nb.NotebookProvider): number {
		const handle = this._nextHandle();
		this._providers.set(handle, adapter);
		return handle;
	}
	//#endregion
}


class NotebookManagerAdapter implements sqlops.nb.NotebookManager {
	constructor(
		public readonly provider: sqlops.nb.NotebookProvider,
		public readonly managerHandle: number,
		private manager: sqlops.nb.NotebookManager,
		public readonly uriString: string
	) {
	}

	public get contentManager(): sqlops.nb.ContentManager {
		return this.manager.contentManager;
	}

	public get sessionManager(): sqlops.nb.SessionManager {
		return this.manager.sessionManager;
	}

	public get serverManager(): sqlops.nb.ServerManager {
		return this.manager.serverManager;
	}

}