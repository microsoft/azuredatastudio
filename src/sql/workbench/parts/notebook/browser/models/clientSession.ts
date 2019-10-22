/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This code is based on @jupyterlab/packages/apputils/src/clientsession.tsx

import { nb } from 'azdata';
import { URI } from 'vs/base/common/uri';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { getErrorMessage } from 'vs/base/common/errors';

import { IClientSession, IKernelPreference, IClientSessionOptions } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';
import { Deferred } from 'sql/base/common/promise';
import { INotebookManager } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

type KernelChangeHandler = (kernel: nb.IKernelChangedArgs) => Promise<void>;
/**
 * Implementation of a client session. This is a model over session operations,
 * which may come from the session manager or a specific session.
 */
export class ClientSession implements IClientSession {
	//#region private fields with public accessors
	private _terminatedEmitter = new Emitter<void>();
	private _kernelChangedEmitter = new Emitter<nb.IKernelChangedArgs>();
	private _statusChangedEmitter = new Emitter<nb.ISession>();
	private _iopubMessageEmitter = new Emitter<nb.IMessage>();
	private _unhandledMessageEmitter = new Emitter<nb.IMessage>();
	private _propertyChangedEmitter = new Emitter<'path' | 'name' | 'type'>();
	private _notebookUri: URI;
	private _type: string;
	private _name: string;
	private _isReady: boolean;
	private _ready: Deferred<void>;
	private _kernelChangeCompleted: Deferred<void>;
	private _kernelPreference: IKernelPreference;
	private _kernelDisplayName: string;
	private _errorMessage: string;
	private _cachedKernelSpec: nb.IKernelSpec;
	private _kernelChangeHandlers: KernelChangeHandler[] = [];
	private _defaultKernel: nb.IKernelSpec;

	//#endregion

	private _serverLoadFinished: Promise<void>;
	private _session: nb.ISession;
	private isServerStarted: boolean;
	private notebookManager: INotebookManager;
	private _kernelConfigActions: ((kernelName: string) => Promise<any>)[] = [];

	constructor(private options: IClientSessionOptions) {
		this._notebookUri = options.notebookUri;
		this.notebookManager = options.notebookManager;
		this._isReady = false;
		this._ready = new Deferred<void>();
		this._kernelChangeCompleted = new Deferred<void>();
		this._defaultKernel = options.kernelSpec;
	}

	public async initialize(): Promise<void> {
		try {
			this._serverLoadFinished = this.startServer();
			await this._serverLoadFinished;
			await this.initializeSession();
			await this.updateCachedKernelSpec();
		} catch (err) {
			this._errorMessage = getErrorMessage(err) || localize('clientSession.unknownError', "An error occurred while starting the notebook session");
		}
		// Always resolving for now. It's up to callers to check for error case
		this._isReady = true;
		this._ready.resolve();
		if (!this.isInErrorState && this._session && this._session.kernel) {
			await this.notifyKernelChanged(undefined, this._session.kernel);
		}
	}

	private async startServer(): Promise<void> {
		let serverManager = this.notebookManager.serverManager;
		if (serverManager && !serverManager.isStarted) {
			await serverManager.startServer();
			if (!serverManager.isStarted) {
				throw new Error(localize('ServerNotStarted', "Server did not start for unknown reason"));
			}
			this.isServerStarted = serverManager.isStarted;
		} else {
			this.isServerStarted = true;
		}
	}

	private async initializeSession(): Promise<void> {
		await this._serverLoadFinished;
		if (this.isServerStarted) {
			if (!this.notebookManager.sessionManager.isReady) {
				await this.notebookManager.sessionManager.ready;
			}
			if (this._defaultKernel) {
				await this.startSessionInstance(this._defaultKernel.name);
			}
		}
	}

	private async startSessionInstance(kernelName: string): Promise<void> {
		let session: nb.ISession;
		try {
			// TODO #3164 should use URI instead of path for startNew
			session = await this.notebookManager.sessionManager.startNew({
				path: this.notebookUri.fsPath,
				kernelName: kernelName
				// TODO add kernel name if saved in the document
			});
			session.defaultKernelLoaded = true;
		} catch (err) {
			// TODO move registration
			if (err && err.response && err.response.status === 501) {
				this.options.notificationService.warn(localize('kernelRequiresConnection', "Kernel {0} was not found. The default kernel will be used instead.", kernelName));
				session = await this.notebookManager.sessionManager.startNew({
					path: this.notebookUri.fsPath,
					kernelName: undefined
				});
				session.defaultKernelLoaded = false;
			} else {
				throw err;
			}
		}
		this._session = session;
		await this.runKernelConfigActions(kernelName);
		this._statusChangedEmitter.fire(session);
	}

	private async runKernelConfigActions(kernelName: string): Promise<void> {
		for (let startAction of this._kernelConfigActions) {
			await startAction(kernelName);
		}
	}

	public dispose(): void {
		// No-op for now
	}

	/**
	 * Indicates the server has finished loading. It may have failed to load in
	 * which case the view will be in an error state.
	 */
	public get serverLoadFinished(): Promise<void> {
		return this._serverLoadFinished;
	}


	//#region IClientSession Properties
	public get terminated(): Event<void> {
		return this._terminatedEmitter.event;
	}
	public get kernelChanged(): Event<nb.IKernelChangedArgs> {
		return this._kernelChangedEmitter.event;
	}

	public onKernelChanging(changeHandler: (kernel: nb.IKernelChangedArgs) => Promise<void>): void {
		if (changeHandler) {
			this._kernelChangeHandlers.push(changeHandler);
		}
	}
	public get statusChanged(): Event<nb.ISession> {
		return this._statusChangedEmitter.event;
	}
	public get iopubMessage(): Event<nb.IMessage> {
		return this._iopubMessageEmitter.event;
	}
	public get unhandledMessage(): Event<nb.IMessage> {
		return this._unhandledMessageEmitter.event;
	}
	public get propertyChanged(): Event<'path' | 'name' | 'type'> {
		return this._propertyChangedEmitter.event;
	}
	public get kernel(): nb.IKernel | null {
		return this._session ? this._session.kernel : undefined;
	}
	public get notebookUri(): URI {
		return this._notebookUri;
	}
	public get name(): string {
		return this._name;
	}
	public get type(): string {
		return this._type;
	}
	public get status(): nb.KernelStatus {
		if (!this.isReady) {
			return 'starting';
		}
		return this._session ? this._session.status : 'dead';
	}
	public get isReady(): boolean {
		return this._isReady;
	}
	public get ready(): Promise<void> {
		return this._ready.promise;
	}
	public get kernelChangeCompleted(): Promise<void> {
		return this._kernelChangeCompleted.promise;
	}
	public get kernelPreference(): IKernelPreference {
		return this._kernelPreference;
	}
	public set kernelPreference(value: IKernelPreference) {
		this._kernelPreference = value;
	}
	public get kernelDisplayName(): string {
		return this._kernelDisplayName;
	}
	public get errorMessage(): string {
		return this._errorMessage;
	}
	public get isInErrorState(): boolean {
		return !!this._errorMessage;
	}

	public get cachedKernelSpec(): nb.IKernelSpec {
		return this._cachedKernelSpec;
	}
	//#endregion

	//#region Not Yet Implemented
	/**
	 * Change the current kernel associated with the document.
	 */
	async changeKernel(options: nb.IKernelSpec, oldValue?: nb.IKernel): Promise<nb.IKernel> {
		this._kernelChangeCompleted = new Deferred<void>();
		this._isReady = false;
		let oldKernel = oldValue ? oldValue : this.kernel;
		let newKernel = this.kernel;

		let kernel = await this.doChangeKernel(options);
		try {
			await kernel.ready;
		} catch (error) {
			// Cleanup some state before re-throwing
			this._isReady = kernel.isReady;
			this._kernelChangeCompleted.resolve();
			throw error;
		}
		newKernel = this._session ? kernel : this._session.kernel;
		this._isReady = kernel.isReady;
		await this.updateCachedKernelSpec();
		// Send resolution events to listeners
		await this.notifyKernelChanged(oldKernel, newKernel);
		return kernel;
	}

	private async notifyKernelChanged(oldKernel: nb.IKernel, newKernel: nb.IKernel): Promise<void> {
		let changeArgs: nb.IKernelChangedArgs = {
			oldValue: oldKernel,
			newValue: newKernel
		};
		let changePromises = this._kernelChangeHandlers.map(handler => handler(changeArgs));
		await Promise.all(changePromises);
		// Wait on connection configuration to complete before resolving full kernel change
		this._kernelChangeCompleted.resolve();
		this._kernelChangedEmitter.fire(changeArgs);
	}

	private async updateCachedKernelSpec(): Promise<void> {
		this._cachedKernelSpec = undefined;
		let kernel = this.kernel;
		if (kernel) {
			await kernel.ready;
			if (kernel.isReady) {
				this._cachedKernelSpec = await kernel.getSpec();
			}
		}
	}

	/**
	 * Helper method to either call ChangeKernel on current session, or start a new session
	 */
	private async doChangeKernel(options: nb.IKernelSpec): Promise<nb.IKernel> {
		let kernel: nb.IKernel;
		if (this._session) {
			kernel = await this._session.changeKernel(options);
			await this.runKernelConfigActions(kernel.name);
		} else {
			kernel = await this.startSessionInstance(options.name).then(() => this.kernel);
		}
		return kernel;
	}

	public async configureKernel(options: nb.IKernelSpec): Promise<void> {
		if (this._session) {
			await this._session.configureKernel(options);
		}
	}

	public async updateConnection(connection: IConnectionProfile): Promise<void> {
		if (!this.kernel) {
			// TODO is there any case where skipping causes errors? So far it seems like it gets called twice
			return;
		}
		if (connection.id !== '-1') {
			await this._session.configureConnection(connection);
		}
	}

	/**
	 * Kill the kernel and shutdown the session.
	 *
	 * @returns A promise that resolves when the session is shut down.
	 */
	public async shutdown(): Promise<void> {
		// Always try to shut down session
		if (this._session && this._session.id && this.notebookManager && this.notebookManager.sessionManager) {
			await this.notebookManager.sessionManager.shutdown(this._session.id);
		}
	}

	/**
	 * Select a kernel for the session.
	 */
	selectKernel(): Promise<void> {
		throw new Error('Not implemented');
	}

	/**
	 * Restart the session.
	 *
	 * @returns A promise that resolves with whether the kernel has restarted.
	 *
	 * #### Notes
	 * If there is a running kernel, present a dialog.
	 * If there is no kernel, we start a kernel with the last run
	 * kernel name and resolves with `true`. If no kernel has been started,
	 * this is a no-op, and resolves with `false`.
	 */
	restart(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	/**
	 * Change the session path.
	 *
	 * @param path - The new session path.
	 *
	 * @returns A promise that resolves when the session has renamed.
	 *
	 * #### Notes
	 * This uses the Jupyter REST API, and the response is validated.
	 * The promise is fulfilled on a valid response and rejected otherwise.
	 */
	setPath(path: string): Promise<void> {
		throw new Error('Not implemented');
	}

	/**
	 * Change the session name.
	 */
	setName(name: string): Promise<void> {
		throw new Error('Not implemented');
	}

	/**
	 * Change the session type.
	 */
	setType(type: string): Promise<void> {
		throw new Error('Not implemented');
	}
	//#endregion
}
