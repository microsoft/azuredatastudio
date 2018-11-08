/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { SqlExtHostContext, SqlMainContext, ExtHostNotebookShape, MainThreadNotebookShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { Disposable } from 'vs/base/common/lifecycle';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';
import URI from 'vs/base/common/uri';

import { INotebookService, INotebookProvider, INotebookManager } from 'sql/services/notebook/notebookService';
import { INotebookManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { LocalContentManager } from 'sql/services/notebook/localContentManager';

@extHostNamedCustomer(SqlMainContext.MainThreadNotebook)
export class MainThreadNotebook extends Disposable implements MainThreadNotebookShape {

	private _proxy: ExtHostNotebookShape;
	private _providers = new Map<number, NotebookProviderWrapper>();

	constructor(
		extHostContext: IExtHostContext,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostNotebook);
		}
	}

	//#region Extension host callable methods
	public $registerNotebookProvider(providerId: string, handle: number): void {
		let notebookProvider = new NotebookProviderWrapper(this._proxy, providerId, handle);
		this._providers.set(handle, notebookProvider);
		this.notebookService.registerProvider(providerId, notebookProvider);
	}

	public $unregisterNotebookProvider(handle: number): void {
		let registration = this._providers.get(handle);
		if (registration) {
			this.notebookService.unregisterProvider(registration.providerId);
			registration.dispose();
			this._providers.delete(handle);
		}
	}

	//#endregion

}

class NotebookProviderWrapper extends Disposable implements INotebookProvider {
	private _managers = new Map<string, NotebookManagerWrapper>();

	constructor(private _proxy: ExtHostNotebookShape, public readonly providerId, public readonly providerHandle: number) {
		super();
	}

	getNotebookManager(notebookUri: URI): Thenable<INotebookManager> {
		// TODO must call through to setup in the extension host
		return this.doGetNotebookManager(notebookUri);
	}

	private async doGetNotebookManager(notebookUri: URI): Promise<INotebookManager> {
		let uriString = notebookUri.toString();
		let manager = this._managers.get(uriString);
		if (!manager) {
			manager = new NotebookManagerWrapper(this._proxy, this.providerId, notebookUri);
			await manager.initialize(this.providerHandle);
			this._managers.set(uriString, manager);
		}
		return manager;
	}

	handleNotebookClosed(notebookUri: URI): void {
		this._proxy.$handleNotebookClosed(notebookUri);
	}

}

class NotebookManagerWrapper implements INotebookManager {
	private _sessionManager: sqlops.nb.SessionManager;
	private _contentManager: sqlops.nb.ContentManager;
	private _serverManager: sqlops.nb.ServerManager;
	private managerDetails: INotebookManagerDetails;

	constructor(private _proxy: ExtHostNotebookShape,
		public readonly providerId,
		private notebookUri: URI
	) { }

	public async initialize(providerHandle: number): Promise<NotebookManagerWrapper> {
		this.managerDetails = await this._proxy.$getNotebookManager(providerHandle, this.notebookUri);
		let managerHandle = this.managerDetails.handle;
		this._contentManager = this.managerDetails.hasContentManager ? new ContentManagerWrapper(managerHandle, this._proxy) : new LocalContentManager();
		this._serverManager = this.managerDetails.hasServerManager ? new ServerManagerWrapper(managerHandle, this._proxy) : undefined;
		this._sessionManager = new SessionManagerWrapper(managerHandle, this._proxy);
		return this;
	}

	public get sessionManager(): sqlops.nb.SessionManager {
		return this._sessionManager;
	}
	public get contentManager(): sqlops.nb.ContentManager {
		return this._contentManager;
	}
	public get serverManager(): sqlops.nb.ServerManager {
		return this._serverManager;
	}

	public get managerHandle(): number {
		return this.managerDetails.handle;
	}

}

class ContentManagerWrapper implements sqlops.nb.ContentManager {

	constructor(private handle: number, private _proxy: ExtHostNotebookShape) {
	}
	getNotebookContents(notebookUri: URI): Thenable<sqlops.nb.INotebook> {
		return this._proxy.$getNotebookContents(this.handle, notebookUri);
	}

	save(path: URI, notebook: sqlops.nb.INotebook): Thenable<sqlops.nb.INotebook> {
		return this._proxy.$save(this.handle, path, notebook);
	}
}

class ServerManagerWrapper implements sqlops.nb.ServerManager {
	private onServerStartedEmitter: Emitter<void>;
	private _isStarted: boolean;
	constructor(private handle: number, private _proxy: ExtHostNotebookShape) {
		this._isStarted = false;
	}

	get isStarted(): boolean {
		return this._isStarted;
	}

	get onServerStarted(): Event<void> {
		return this.onServerStartedEmitter.event;
	}

	startServer(): Thenable<void> {
		return this.doStartServer();
	}

	private async doStartServer(): Promise<void> {
		await this._proxy.$doStartServer(this.handle);
		this._isStarted = true;
		this.onServerStartedEmitter.fire();
	}

	stopServer(): Thenable<void> {
		return this.doStopServer();
	}

	private async doStopServer(): Promise<void> {
		try {
			await this._proxy.$doStopServer(this.handle);
		} finally {
			// Always consider this a stopping event, even if a failure occurred.
			this._isStarted = false;
		}
	}
}

class SessionManagerWrapper implements sqlops.nb.SessionManager {
	constructor(private handle: number, private _proxy: ExtHostNotebookShape) {
	}

	get isReady(): boolean {
		throw new Error('Method not implemented.');

	}

	get ready(): Thenable<void> {
		throw new Error('Method not implemented.');

	}
	get specs(): sqlops.nb.IAllKernels {
		throw new Error('Method not implemented.');

	}

	startNew(options: sqlops.nb.ISessionOptions): Thenable<sqlops.nb.ISession> {
		throw new Error('Method not implemented.');
	}

	shutdown(id: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}


}