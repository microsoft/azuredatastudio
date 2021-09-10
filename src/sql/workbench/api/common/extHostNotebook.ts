/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import { localize } from 'vs/nls';
import { URI, UriComponents } from 'vs/base/common/uri';

import { ExtHostNotebookShape, MainThreadNotebookShape, SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExecuteManagerDetails, INotebookSessionDetails, INotebookKernelDetails, INotebookFutureDetails, FutureMessageType, ISerializationManagerDetails } from 'sql/workbench/api/common/sqlExtHostTypes';

type Adapter = azdata.nb.NotebookSerializationProvider | azdata.nb.SerializationManager | azdata.nb.NotebookExecuteProvider | azdata.nb.ExecuteManager | azdata.nb.ISession | azdata.nb.IKernel | azdata.nb.IFuture;

export class ExtHostNotebook implements ExtHostNotebookShape {
	private static _handlePool: number = 0;

	private readonly _proxy: MainThreadNotebookShape;
	private _adapters = new Map<number, Adapter>();

	// Notebook URI to manager lookup.
	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadNotebook);
	}

	//#region APIs called by main thread
	async $getSerializationManagerDetails(providerHandle: number, notebookUri: UriComponents): Promise<ISerializationManagerDetails> {
		let uri = URI.revive(notebookUri);
		let uriString = uri.toString();
		let adapter = this.findSerializationManagerForUri(uriString);
		if (!adapter) {
			adapter = await this._withSerializationProvider(providerHandle, (provider) => {
				return this.getOrCreateSerializationManager(provider, uri);
			});
		}

		return {
			handle: adapter.handle,
			hasContentManager: !!adapter.contentManager
		};
	}
	async $getExecuteManagerDetails(providerHandle: number, notebookUri: UriComponents): Promise<IExecuteManagerDetails> {
		let uri = URI.revive(notebookUri);
		let uriString = uri.toString();
		let adapter = this.findExecuteManagerForUri(uriString);
		if (!adapter) {
			adapter = await this._withExecuteProvider(providerHandle, (provider) => {
				return this.getOrCreateExecuteManager(provider, uri);
			});
		}

		return {
			handle: adapter.handle,
			hasServerManager: !!adapter.serverManager
		};
	}
	$handleNotebookClosed(notebookUri: UriComponents): void {
		let uri = URI.revive(notebookUri);
		let uriString = uri.toString();
		let manager = this.findExecuteManagerForUri(uriString);
		if (manager) {
			manager.provider.handleNotebookClosed(uri);
			this._adapters.delete(manager.handle);
		}
	}

	$doStartServer(managerHandle: number, kernelSpec: azdata.nb.IKernelSpec): Thenable<void> {
		return this._withServerManager(managerHandle, (serverManager) => serverManager.startServer(kernelSpec));
	}

	$doStopServer(managerHandle: number): Thenable<void> {
		return this._withServerManager(managerHandle, (serverManager) => serverManager.stopServer());
	}

	$getNotebookContents(managerHandle: number, notebookUri: UriComponents): Thenable<azdata.nb.INotebookContents> {
		return this._withContentManager(managerHandle, (contentManager) => contentManager.getNotebookContents(URI.revive(notebookUri)));
	}

	$save(managerHandle: number, notebookUri: UriComponents, notebook: azdata.nb.INotebookContents): Thenable<azdata.nb.INotebookContents> {
		return this._withContentManager(managerHandle, (contentManager) => contentManager.save(URI.revive(notebookUri), notebook));
	}

	$refreshSpecs(managerHandle: number): Thenable<azdata.nb.IAllKernels> {
		return this._withSessionManager(managerHandle, async (sessionManager) => {
			await sessionManager.ready;
			return sessionManager.specs;
		});
	}

	$startNewSession(managerHandle: number, options: azdata.nb.ISessionOptions): Thenable<INotebookSessionDetails> {
		return this._withSessionManager(managerHandle, async (sessionManager) => {
			try {
				let session = await sessionManager.startNew(options);
				let sessionId = this._addNewAdapter(session);
				let kernelDetails: INotebookKernelDetails = undefined;
				if (session.kernel) {
					kernelDetails = this.saveKernel(session.kernel);
				}
				let details: INotebookSessionDetails = {
					sessionId: sessionId,
					id: session.id,
					path: session.path,
					name: session.name,
					type: session.type,
					status: session.status,
					canChangeKernels: session.canChangeKernels,
					kernelDetails: kernelDetails
				};
				return details;
			} catch (error) {
				throw typeof (error) === 'string' ? new Error(error) : error;
			}
		});
	}

	private saveKernel(kernel: azdata.nb.IKernel): INotebookKernelDetails {
		let kernelId = this._addNewAdapter(kernel);
		let kernelDetails: INotebookKernelDetails = {
			kernelId: kernelId,
			id: kernel.id,
			info: kernel.info,
			name: kernel.name,
			supportsIntellisense: kernel.supportsIntellisense,
			requiresConnection: kernel.requiresConnection
		};
		return kernelDetails;
	}

	$shutdownSession(managerHandle: number, sessionId: string): Thenable<void> {
		// If manager handle has already been removed, don't try to access it again when shutting down
		if (this._adapters.get(managerHandle) === undefined) {
			return undefined;
		}
		return this._withSessionManager(managerHandle, async (sessionManager) => {
			return sessionManager.shutdown(sessionId);
		});
	}

	$shutdownAll(managerHandle: number): Thenable<void> {
		return this._withSessionManager(managerHandle, async (sessionManager) => {
			return sessionManager.shutdownAll();
		});
	}

	$changeKernel(sessionId: number, kernelInfo: azdata.nb.IKernelSpec): Thenable<INotebookKernelDetails> {
		let session = this._getAdapter<azdata.nb.ISession>(sessionId);
		return session.changeKernel(kernelInfo).then(kernel => this.saveKernel(kernel));
	}

	$configureKernel(sessionId: number, kernelInfo: azdata.nb.IKernelSpec): Thenable<void> {
		let session = this._getAdapter<azdata.nb.ISession>(sessionId);
		return session.configureKernel(kernelInfo).then(() => null);
	}

	$configureConnection(sessionId: number, connection: azdata.IConnectionProfile): Thenable<void> {
		let session = this._getAdapter<azdata.nb.ISession>(sessionId);
		return session.configureConnection(connection).then(() => null);
	}

	$getKernelReadyStatus(kernelId: number): Thenable<azdata.nb.IInfoReply> {
		let kernel = this._getAdapter<azdata.nb.IKernel>(kernelId);
		return kernel.ready.then(success => kernel.info);
	}

	$getKernelSpec(kernelId: number): Thenable<azdata.nb.IKernelSpec> {
		let kernel = this._getAdapter<azdata.nb.IKernel>(kernelId);
		return kernel.getSpec();
	}

	$requestComplete(kernelId: number, content: azdata.nb.ICompleteRequest): Thenable<azdata.nb.ICompleteReplyMsg> {
		let kernel = this._getAdapter<azdata.nb.IKernel>(kernelId);
		return kernel.requestComplete(content);
	}

	$requestExecute(kernelId: number, content: azdata.nb.IExecuteRequest, disposeOnDone?: boolean): Thenable<INotebookFutureDetails> {
		let kernel = this._getAdapter<azdata.nb.IKernel>(kernelId);
		let future = kernel.requestExecute(content, disposeOnDone);
		let futureId = this._addNewAdapter(future);
		this.hookFutureDone(futureId, future);
		this.hookFutureMessages(futureId, future);
		return Promise.resolve({
			futureId: futureId,
			msg: future.msg
		});
	}

	private hookFutureDone(futureId: number, future: azdata.nb.IFuture): void {
		future.done.then(success => {
			return this._proxy.$onFutureDone(futureId, { succeeded: true, message: success, rejectReason: undefined });
		}, err => {
			let rejectReason: string;
			if (typeof err === 'string') {
				rejectReason = err;
			}
			else if (err instanceof Error && typeof err.message === 'string') {
				rejectReason = err.message;
			}
			else {
				rejectReason = err;
			}
			return this._proxy.$onFutureDone(futureId, { succeeded: false, message: undefined, rejectReason: rejectReason });
		});
	}

	private hookFutureMessages(futureId: number, future: azdata.nb.IFuture): void {
		future.setReplyHandler({ handle: (msg) => this._proxy.$onFutureMessage(futureId, FutureMessageType.Reply, msg) });
		future.setStdInHandler({ handle: (msg) => this._proxy.$onFutureMessage(futureId, FutureMessageType.StdIn, msg) });
		future.setIOPubHandler({ handle: (msg) => this._proxy.$onFutureMessage(futureId, FutureMessageType.IOPub, msg) });
	}

	$interruptKernel(kernelId: number): Thenable<void> {
		let kernel = this._getAdapter<azdata.nb.IKernel>(kernelId);
		return kernel.interrupt();
	}

	$sendInputReply(futureId: number, content: azdata.nb.IInputReply): void {
		let future = this._getAdapter<azdata.nb.IFuture>(futureId);
		return future.sendInputReply(content);
	}

	$disposeFuture(futureId: number): void {
		let future = this._getAdapter<azdata.nb.IFuture>(futureId);
		future.dispose();
	}

	$dispose(managerHandle: number): Thenable<void> {
		return this._withSessionManager(managerHandle, async (sessionManager) => {
			return sessionManager.dispose();
		});
	}

	//#endregion

	//#region APIs called by extensions
	registerExecuteProvider(provider: azdata.nb.NotebookExecuteProvider): vscode.Disposable {
		if (!provider || !provider.providerId) {
			throw new Error(localize('executeProviderRequired', "A NotebookExecuteProvider with valid providerId must be passed to this method"));
		}
		const handle = this._addNewAdapter(provider);
		this._proxy.$registerExecuteProvider(provider.providerId, handle);
		return this._createDisposable(handle);
	}

	registerSerializationProvider(provider: azdata.nb.NotebookSerializationProvider): vscode.Disposable {
		if (!provider || !provider.providerId) {
			throw new Error(localize('serializationProviderRequired', "A NotebookSerializationProvider with valid providerId must be passed to this method"));
		}
		const handle = this._addNewAdapter(provider);
		this._proxy.$registerSerializationProvider(provider.providerId, handle);
		return this._createDisposable(handle);
	}
	//#endregion


	//#region private methods

	private getAdapters<A>(ctor: { new(...args: any[]): A }): A[] {
		let matchingAdapters = [];
		this._adapters.forEach(a => {
			if (a instanceof ctor) {
				matchingAdapters.push(a);
			}
		});
		return matchingAdapters;
	}

	private findSerializationManagerForUri(uriString: string): SerializationManagerAdapter {
		for (let manager of this.getAdapters(SerializationManagerAdapter)) {
			if (manager.uriString === uriString) {
				return manager;
			}
		}
		return undefined;
	}

	private findExecuteManagerForUri(uriString: string): ExecuteManagerAdapter {
		for (let manager of this.getAdapters(ExecuteManagerAdapter)) {
			if (manager.uriString === uriString) {
				return manager;
			}
		}
		return undefined;
	}

	private async getOrCreateSerializationManager(provider: azdata.nb.NotebookSerializationProvider, notebookUri: URI): Promise<SerializationManagerAdapter> {
		let manager = await provider.getSerializationManager(notebookUri);
		let uriString = notebookUri.toString();
		let adapter = new SerializationManagerAdapter(provider, manager, uriString);
		adapter.handle = this._addNewAdapter(adapter);
		return adapter;
	}

	private async getOrCreateExecuteManager(provider: azdata.nb.NotebookExecuteProvider, notebookUri: URI): Promise<ExecuteManagerAdapter> {
		let manager = await provider.getExecuteManager(notebookUri);
		let uriString = notebookUri.toString();
		let adapter = new ExecuteManagerAdapter(provider, manager, uriString);
		adapter.handle = this._addNewAdapter(adapter);
		return adapter;
	}

	private _createDisposable(handle: number): Disposable {
		return new Disposable(() => {
			this._adapters.delete(handle);
		});
	}

	private _nextHandle(): number {
		return ExtHostNotebook._handlePool++;
	}

	private _withSerializationProvider(handle: number, callback: (provider: azdata.nb.NotebookSerializationProvider) => SerializationManagerAdapter | PromiseLike<SerializationManagerAdapter>): Promise<SerializationManagerAdapter> {
		let provider = this._adapters.get(handle) as azdata.nb.NotebookSerializationProvider;
		if (provider === undefined) {
			return Promise.reject(new Error(localize('errNoSerializationProvider', "no notebook serialization provider found")));
		}
		return Promise.resolve(callback(provider));
	}

	private _withExecuteProvider(handle: number, callback: (provider: azdata.nb.NotebookExecuteProvider) => ExecuteManagerAdapter | PromiseLike<ExecuteManagerAdapter>): Promise<ExecuteManagerAdapter> {
		let provider = this._adapters.get(handle) as azdata.nb.NotebookExecuteProvider;
		if (provider === undefined) {
			return Promise.reject(new Error(localize('errNoExecuteProvider', "no notebook execute provider found")));
		}
		return Promise.resolve(callback(provider));
	}

	private _withSerializationManager<R>(handle: number, callback: (manager: SerializationManagerAdapter) => R | PromiseLike<R>): Promise<R> {
		let manager = this._adapters.get(handle) as SerializationManagerAdapter;
		if (manager === undefined) {
			return Promise.reject(new Error(localize('errNoManager', "No Manager found")));
		}
		return this.callbackWithErrorWrap<SerializationManagerAdapter, R>(callback, manager);
	}

	private _withExecuteManager<R>(handle: number, callback: (manager: ExecuteManagerAdapter) => R | PromiseLike<R>): Promise<R> {
		let manager = this._adapters.get(handle) as ExecuteManagerAdapter;
		if (manager === undefined) {
			return Promise.reject(new Error(localize('errNoManager', "No Manager found")));
		}
		return this.callbackWithErrorWrap<ExecuteManagerAdapter, R>(callback, manager);
	}

	private async callbackWithErrorWrap<A, R>(callback: (manager: A) => R | PromiseLike<R>, manager: A): Promise<R> {
		try {
			let value = await callback(manager);
			return value;
		} catch (error) {
			throw typeof (error) === 'string' ? new Error(error) : error;
		}
	}

	private _withServerManager<R>(handle: number, callback: (manager: azdata.nb.ServerManager) => PromiseLike<R>): Promise<R> {
		return this._withExecuteManager(handle, (notebookManager) => {
			let serverManager = notebookManager.serverManager;
			if (!serverManager) {
				return Promise.reject(new Error(localize('noServerManager', "Notebook Manager for notebook {0} does not have a server manager. Cannot perform operations on it", notebookManager.uriString)));
			}
			return callback(serverManager);
		});
	}

	private _withContentManager<R>(handle: number, callback: (manager: azdata.nb.ContentManager) => PromiseLike<R>): Promise<R> {
		return this._withSerializationManager(handle, (notebookManager) => {
			let contentManager = notebookManager.contentManager;
			if (!contentManager) {
				return Promise.reject(new Error(localize('noContentManager', "Notebook Manager for notebook {0} does not have a content manager. Cannot perform operations on it", notebookManager.uriString)));
			}
			return callback(contentManager);
		});
	}

	private _withSessionManager<R>(handle: number, callback: (manager: azdata.nb.SessionManager) => PromiseLike<R>): Promise<R> {
		return this._withExecuteManager(handle, (notebookManager) => {
			let sessionManager = notebookManager.sessionManager;
			if (!sessionManager) {
				return Promise.reject(new Error(localize('noSessionManager', "Notebook Manager for notebook {0} does not have a session manager. Cannot perform operations on it", notebookManager.uriString)));
			}
			return callback(sessionManager);
		});
	}

	private _addNewAdapter(adapter: Adapter): number {
		const handle = this._nextHandle();
		this._adapters.set(handle, adapter);
		return handle;
	}

	private _getAdapter<T>(id: number): T {
		let adapter = <T><any>this._adapters.get(id);
		if (adapter === undefined) {
			throw new Error('No adapter found');
		}
		return adapter;
	}

	//#endregion
}

class SerializationManagerAdapter implements azdata.nb.SerializationManager {
	public handle: number;
	constructor(
		public readonly provider: azdata.nb.NotebookSerializationProvider,
		private manager: azdata.nb.SerializationManager,
		public readonly uriString: string
	) {
	}

	public get contentManager(): azdata.nb.ContentManager {
		return this.manager.contentManager;
	}
}

class ExecuteManagerAdapter implements azdata.nb.ExecuteManager {
	public handle: number;
	constructor(
		public readonly provider: azdata.nb.NotebookExecuteProvider,
		private manager: azdata.nb.ExecuteManager,
		public readonly uriString: string
	) {
	}

	public get sessionManager(): azdata.nb.SessionManager {
		return this.manager.sessionManager;
	}

	public get serverManager(): azdata.nb.ServerManager {
		return this.manager.serverManager;
	}
}
