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
import { URI } from 'vs/base/common/uri';

import { INotebookService, INotebookProvider, INotebookManager } from 'sql/workbench/services/notebook/common/notebookService';
import { INotebookManagerDetails, INotebookSessionDetails, INotebookKernelDetails, FutureMessageType, INotebookFutureDetails, INotebookFutureDone } from 'sql/workbench/api/common/sqlExtHostTypes';
import { LocalContentManager } from 'sql/workbench/services/notebook/node/localContentManager';
import { Deferred } from 'sql/base/common/promise';
import { FutureInternal } from 'sql/parts/notebook/models/modelInterfaces';

@extHostNamedCustomer(SqlMainContext.MainThreadNotebook)
export class MainThreadNotebook extends Disposable implements MainThreadNotebookShape {

	private _proxy: ExtHostNotebookShape;
	private _providers = new Map<number, NotebookProviderWrapper>();
	private _futures = new Map<number, FutureWrapper>();

	constructor(
		extHostContext: IExtHostContext,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostNotebook);
		}
	}

	public addFuture(futureId: number, future: FutureWrapper): void {
		this._futures.set(futureId, future);
	}

	public disposeFuture(futureId: number): void {
		this._futures.delete(futureId);
	}

	//#region Extension host callable methods
	public $registerNotebookProvider(providerId: string, handle: number): void {
		let proxy: Proxies = {
			main: this,
			ext: this._proxy
		};
		let notebookProvider = new NotebookProviderWrapper(proxy, providerId, handle);
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

	public $onFutureMessage(futureId: number, type: FutureMessageType, payload: sqlops.nb.IMessage): void {
		let future = this._futures.get(futureId);
		if (future) {
			future.onMessage(type, payload);
		}
	}

	public $onFutureDone(futureId: number, done: INotebookFutureDone): void {
		let future = this._futures.get(futureId);
		if (future) {
			future.onDone(done);
		}

	}
	//#endregion
}

interface Proxies {
	main: MainThreadNotebook;
	ext: ExtHostNotebookShape;
}

class NotebookProviderWrapper extends Disposable implements INotebookProvider {
	private _notebookUriToManagerMap = new Map<string, NotebookManagerWrapper>();

	constructor(private _proxy: Proxies, public readonly providerId, public readonly providerHandle: number) {
		super();
	}

	getNotebookManager(notebookUri: URI): Thenable<INotebookManager> {
		// TODO must call through to setup in the extension host
		return this.doGetNotebookManager(notebookUri);
	}

	private async doGetNotebookManager(notebookUri: URI): Promise<INotebookManager> {
		let uriString = notebookUri.toString();
		let manager = this._notebookUriToManagerMap.get(uriString);
		if (!manager) {
			manager = new NotebookManagerWrapper(this._proxy, this.providerId, notebookUri);
			await manager.initialize(this.providerHandle);
			this._notebookUriToManagerMap.set(uriString, manager);
		}
		return manager;
	}

	handleNotebookClosed(notebookUri: URI): void {
		this._notebookUriToManagerMap.delete(notebookUri.toString());
		this._proxy.ext.$handleNotebookClosed(notebookUri);
	}
}

class NotebookManagerWrapper implements INotebookManager {
	private _sessionManager: sqlops.nb.SessionManager;
	private _contentManager: sqlops.nb.ContentManager;
	private _serverManager: sqlops.nb.ServerManager;
	private managerDetails: INotebookManagerDetails;

	constructor(private _proxy: Proxies,
		public readonly providerId,
		private notebookUri: URI
	) { }

	public async initialize(providerHandle: number): Promise<NotebookManagerWrapper> {
		this.managerDetails = await this._proxy.ext.$getNotebookManager(providerHandle, this.notebookUri);
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

	constructor(private handle: number, private _proxy: Proxies) {
	}
	getNotebookContents(notebookUri: URI): Thenable<sqlops.nb.INotebookContents> {
		return this._proxy.ext.$getNotebookContents(this.handle, notebookUri);
	}

	save(path: URI, notebook: sqlops.nb.INotebookContents): Thenable<sqlops.nb.INotebookContents> {
		return this._proxy.ext.$save(this.handle, path, notebook);
	}
}

class ServerManagerWrapper implements sqlops.nb.ServerManager {
	private onServerStartedEmitter = new Emitter<void>();
	private _isStarted: boolean;
	constructor(private handle: number, private _proxy: Proxies) {
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
		await this._proxy.ext.$doStartServer(this.handle);
		this._isStarted = true;
		this.onServerStartedEmitter.fire();
	}

	stopServer(): Thenable<void> {
		return this.doStopServer();
	}

	private async doStopServer(): Promise<void> {
		try {
			await this._proxy.ext.$doStopServer(this.handle);
		} finally {
			// Always consider this a stopping event, even if a failure occurred.
			this._isStarted = false;
		}
	}
}

class SessionManagerWrapper implements sqlops.nb.SessionManager {
	private readyPromise: Promise<void>;
	private _isReady: boolean;
	private _specs: sqlops.nb.IAllKernels;
	constructor(private managerHandle: number, private _proxy: Proxies) {
		this._isReady = false;
		this.readyPromise = this.initializeSessionManager();
	}

	get isReady(): boolean {
		return this._isReady;
	}

	get ready(): Thenable<void> {
		return this.readyPromise;
	}

	get specs(): sqlops.nb.IAllKernels {
		return this._specs;
	}

	startNew(options: sqlops.nb.ISessionOptions): Thenable<sqlops.nb.ISession> {
		return this.doStartNew(options);
	}

	private async doStartNew(options: sqlops.nb.ISessionOptions): Promise<sqlops.nb.ISession> {
		let sessionDetails = await this._proxy.ext.$startNewSession(this.managerHandle, options);
		return new SessionWrapper(this._proxy, sessionDetails);
	}

	shutdown(id: string): Thenable<void> {
		return this._proxy.ext.$shutdownSession(this.managerHandle, id);
	}

	private async initializeSessionManager(): Promise<void> {
		await this.refreshSpecs();
		this._isReady = true;
	}

	private async refreshSpecs(): Promise<void> {
		let specs = await this._proxy.ext.$refreshSpecs(this.managerHandle);
		if (specs) {
			this._specs = specs;
		}
	}
}

class SessionWrapper implements sqlops.nb.ISession {
	private _kernel: KernelWrapper;
	constructor(private _proxy: Proxies, private sessionDetails: INotebookSessionDetails) {
		if (sessionDetails && sessionDetails.kernelDetails) {
			this._kernel = new KernelWrapper(_proxy, sessionDetails.kernelDetails);
		}
	}

	get canChangeKernels(): boolean {
		return this.sessionDetails.canChangeKernels;
	}

	get id(): string {
		return this.sessionDetails.id;
	}

	get path(): string {
		return this.sessionDetails.path;
	}

	get name(): string {
		return this.sessionDetails.name;
	}

	get type(): string {
		return this.sessionDetails.type;
	}

	get status(): sqlops.nb.KernelStatus {
		return this.sessionDetails.status as sqlops.nb.KernelStatus;
	}

	get kernel(): sqlops.nb.IKernel {
		return this._kernel;
	}

	changeKernel(kernelInfo: sqlops.nb.IKernelSpec): Thenable<sqlops.nb.IKernel> {
		return this.doChangeKernel(kernelInfo);
	}

	configureKernel(kernelInfo: sqlops.nb.IKernelSpec): Thenable<void> {
		return this.doConfigureKernel(kernelInfo);
	}

	configureConnection(connection: sqlops.IConnectionProfile): Thenable<void> {
		if (connection['capabilitiesService'] !== undefined) {
			connection['capabilitiesService'] = undefined;
		}
		return this.doConfigureConnection(connection);
	}

	private async doChangeKernel(kernelInfo: sqlops.nb.IKernelSpec): Promise<sqlops.nb.IKernel> {
		let kernelDetails = await this._proxy.ext.$changeKernel(this.sessionDetails.sessionId, kernelInfo);
		this._kernel = new KernelWrapper(this._proxy, kernelDetails);
		return this._kernel;
	}

	private async doConfigureKernel(kernelInfo: sqlops.nb.IKernelSpec): Promise<void> {
		await this._proxy.ext.$configureKernel(this.sessionDetails.sessionId, kernelInfo);
	}

	private async doConfigureConnection(connection: sqlops.IConnectionProfile): Promise<void> {
		await this._proxy.ext.$configureConnection(this.sessionDetails.sessionId, connection);
	}
}

class KernelWrapper implements sqlops.nb.IKernel {
	private _isReady: boolean = false;
	private _ready = new Deferred<void>();
	private _info: sqlops.nb.IInfoReply;
	constructor(private _proxy: Proxies, private kernelDetails: INotebookKernelDetails) {
		this.initialize(kernelDetails);
	}

	private async initialize(kernelDetails: INotebookKernelDetails): Promise<void> {
		try {
			this._info = await this._proxy.ext.$getKernelReadyStatus(kernelDetails.kernelId);
			this._isReady = true;
			this._ready.resolve();
		} catch (error) {
			this._isReady = false;
			this._ready.reject(error);
		}
	}

	get isReady(): boolean {
		return this._isReady;
	}
	get ready(): Thenable<void> {
		return this._ready.promise;
	}

	get id(): string {
		return this.kernelDetails.id;
	}

	get name(): string {
		return this.kernelDetails.name;
	}

	get supportsIntellisense(): boolean {
		return this.kernelDetails.supportsIntellisense;
	}

	get info(): sqlops.nb.IInfoReply {
		return this._info;
	}

	getSpec(): Thenable<sqlops.nb.IKernelSpec> {
		return this._proxy.ext.$getKernelSpec(this.kernelDetails.kernelId);
	}

	requestComplete(content: sqlops.nb.ICompleteRequest): Thenable<sqlops.nb.ICompleteReplyMsg> {
		return this._proxy.ext.$requestComplete(this.kernelDetails.kernelId, content);
	}

	requestExecute(content: sqlops.nb.IExecuteRequest, disposeOnDone?: boolean): sqlops.nb.IFuture {
		let future = new FutureWrapper(this._proxy);
		this._proxy.ext.$requestExecute(this.kernelDetails.kernelId, content, disposeOnDone)
			.then(details => {
				future.setDetails(details);
				// Save the future in the main thread notebook so extension can call through and reference it
				this._proxy.main.addFuture(details.futureId, future);
			}, error => future.setError(error));
		return future;
	}

	interrupt(): Thenable<void> {
		return this._proxy.ext.$interruptKernel(this.kernelDetails.kernelId);
	}
}


class FutureWrapper implements FutureInternal {
	private _futureId: number;
	private _done = new Deferred<sqlops.nb.IShellMessage>();
	private _messageHandlers = new Map<FutureMessageType, sqlops.nb.MessageHandler<sqlops.nb.IMessage>>();
	private _msg: sqlops.nb.IMessage;
	private _inProgress: boolean;

	constructor(private _proxy: Proxies) {
		this._inProgress = true;
	}

	public setDetails(details: INotebookFutureDetails): void {
		this._futureId = details.futureId;
		this._msg = details.msg;
	}

	public setError(error: Error | string): void {
		this._done.reject(error);
	}

	public onMessage(type: FutureMessageType, payload: sqlops.nb.IMessage): void {
		let handler = this._messageHandlers.get(type);
		if (handler) {
			try {
				handler.handle(payload);
			} catch (error) {
				// TODO log errors from the handler
			}
		}
	}

	public onDone(done: INotebookFutureDone): void {
		this._inProgress = false;
		if (done.succeeded) {
			this._done.resolve(done.message);
		} else {
			this._done.reject(new Error(done.rejectReason));
		}
	}

	private addMessageHandler(type: FutureMessageType, handler: sqlops.nb.MessageHandler<sqlops.nb.IMessage>): void {
		// Note: there can only be 1 message handler according to the Jupyter Notebook spec.
		// You can use a message hook to override this / add additional side-processors
		this._messageHandlers.set(type, handler);
	}

	//#region Public APIs
	get inProgress(): boolean {
		return this._inProgress;
	}

	set inProgress(value: boolean) {
		this._inProgress = value;
	}

	get msg(): sqlops.nb.IMessage {
		return this._msg;
	}

	get done(): Thenable<sqlops.nb.IShellMessage> {
		return this._done.promise;
	}

	setReplyHandler(handler: sqlops.nb.MessageHandler<sqlops.nb.IShellMessage>): void {
		this.addMessageHandler(FutureMessageType.Reply, handler);
	}

	setStdInHandler(handler: sqlops.nb.MessageHandler<sqlops.nb.IStdinMessage>): void {
		this.addMessageHandler(FutureMessageType.StdIn, handler);
	}

	setIOPubHandler(handler: sqlops.nb.MessageHandler<sqlops.nb.IIOPubMessage>): void {
		this.addMessageHandler(FutureMessageType.IOPub, handler);
	}

	sendInputReply(content: sqlops.nb.IInputReply): void {
		this._proxy.ext.$sendInputReply(this._futureId, content);
	}

	dispose() {
		this._proxy.main.disposeFuture(this._futureId);
		this._proxy.ext.$disposeFuture(this._futureId);
	}

	registerMessageHook(hook: (msg: sqlops.nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		throw new Error('Method not implemented.');
	}
	removeMessageHook(hook: (msg: sqlops.nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		throw new Error('Method not implemented.');
	}
	//#endregion
}
