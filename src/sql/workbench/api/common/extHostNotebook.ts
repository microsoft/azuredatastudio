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
import { INotebookManagerDetails, INotebookSessionDetails, INotebookKernelDetails, INotebookFutureDetails, FutureMessageType } from 'sql/workbench/api/common/sqlExtHostTypes';

type Adapter = azdata.nb.NotebookProvider | azdata.nb.NotebookManager | azdata.nb.ISession | azdata.nb.IKernel | azdata.nb.IFuture;

export class ExtHostNotebook implements ExtHostNotebookShape {
	private static _handlePool: number = 0;

	private readonly _proxy: MainThreadNotebookShape;
	private _adapters = new Map<number, Adapter>();

	// Notebook URI to manager lookup.
	constructor(_mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadNotebook);
	}

	//#region APIs called by main thread
	async $getNotebookManager(providerHandle: number, notebookUri: UriComponents): Promise<INotebookManagerDetails> {
		let uri = URI.revive(notebookUri);
		let uriString = uri.toString();
		let adapter = this.findManagerForUri(uriString);
		if (!adapter) {
			adapter = await this._withProvider(providerHandle, (provider) => {
				return this.getOrCreateManager(provider, uri);
			});
		}

		return {
			handle: adapter.handle,
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

	//#endregion

	//#region APIs called by extensions
	registerNotebookProvider(provider: azdata.nb.NotebookProvider): vscode.Disposable {
		if (!provider || !provider.providerId) {
			throw new Error(localize('providerRequired', "A NotebookProvider with valid providerId must be passed to this method"));
		}
		const handle = this._addNewAdapter(provider);
		this._proxy.$registerNotebookProvider(provider.providerId, handle);
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

	private findManagerForUri(uriString: string): NotebookManagerAdapter {
		for (let manager of this.getAdapters(NotebookManagerAdapter)) {
			if (manager.uriString === uriString) {
				return manager;
			}
		}
		return undefined;
	}

	private async getOrCreateManager(provider: azdata.nb.NotebookProvider, notebookUri: URI): Promise<NotebookManagerAdapter> {
		let manager = await provider.getNotebookManager(notebookUri);
		let uriString = notebookUri.toString();
		let adapter = new NotebookManagerAdapter(provider, manager, uriString);
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

	private _withProvider<R>(handle: number, callback: (provider: azdata.nb.NotebookProvider) => R | PromiseLike<R>): Promise<R> {
		let provider = this._adapters.get(handle) as azdata.nb.NotebookProvider;
		if (provider === undefined) {
			return Promise.reject(new Error(localize('errNoProvider', "no notebook provider found")));
		}
		return Promise.resolve(callback(provider));
	}

	private _withNotebookManager<R>(handle: number, callback: (manager: NotebookManagerAdapter) => R | PromiseLike<R>): Promise<R> {
		let manager = this._adapters.get(handle) as NotebookManagerAdapter;
		if (manager === undefined) {
			return Promise.reject(new Error(localize('errNoManager', "No Manager found")));
		}
		return this.callbackWithErrorWrap<R>(callback, manager);
	}

	private async callbackWithErrorWrap<R>(callback: (manager: NotebookManagerAdapter) => R | PromiseLike<R>, manager: NotebookManagerAdapter): Promise<R> {
		try {
			let value = await callback(manager);
			return value;
		} catch (error) {
			throw typeof (error) === 'string' ? new Error(error) : error;
		}
	}

	private _withServerManager<R>(handle: number, callback: (manager: azdata.nb.ServerManager) => PromiseLike<R>): Promise<R> {
		return this._withNotebookManager(handle, (notebookManager) => {
			let serverManager = notebookManager.serverManager;
			if (!serverManager) {
				return Promise.reject(new Error(localize('noServerManager', "Notebook Manager for notebook {0} does not have a server manager. Cannot perform operations on it", notebookManager.uriString)));
			}
			return callback(serverManager);
		});
	}

	private _withContentManager<R>(handle: number, callback: (manager: azdata.nb.ContentManager) => PromiseLike<R>): Promise<R> {
		return this._withNotebookManager(handle, (notebookManager) => {
			let contentManager = notebookManager.contentManager;
			if (!contentManager) {
				return Promise.reject(new Error(localize('noContentManager', "Notebook Manager for notebook {0} does not have a content manager. Cannot perform operations on it", notebookManager.uriString)));
			}
			return callback(contentManager);
		});
	}

	private _withSessionManager<R>(handle: number, callback: (manager: azdata.nb.SessionManager) => PromiseLike<R>): Promise<R> {
		return this._withNotebookManager(handle, (notebookManager) => {
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


class NotebookManagerAdapter implements azdata.nb.NotebookManager {
	public handle: number;
	constructor(
		public readonly provider: azdata.nb.NotebookProvider,
		private manager: azdata.nb.NotebookManager,
		public readonly uriString: string
	) {
	}

	public get contentManager(): azdata.nb.ContentManager {
		return this.manager.contentManager;
	}

	public get sessionManager(): azdata.nb.SessionManager {
		return this.manager.sessionManager;
	}

	public get serverManager(): azdata.nb.ServerManager {
		return this.manager.serverManager;
	}
}
