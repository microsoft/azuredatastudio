/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This code is based on @jupyterlab/packages/apputils/src/clientsession.tsx

import { nb } from 'azdata';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { getErrorMessage } from 'vs/base/common/errors';

import { IClientSession, IClientSessionOptions } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Deferred } from 'sql/base/common/promise';
import { IExecuteManager } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

type KernelChangeHandler = (kernel: nb.IKernelChangedArgs) => Promise<void>;
/**
 * Implementation of a client session. This is a model over session operations,
 * which may come from the session manager or a specific session.
 */
export class ClientSession implements IClientSession {
	//#region private fields with public accessors
	private _notebookUri: URI;
	private _isReady: boolean;
	private _ready: Deferred<void>;
	private _kernelChangeCompleted: Deferred<void>;
	private _errorMessage: string = '';
	private _cachedKernelSpec: nb.IKernelSpec | undefined;
	private _kernelChangeHandlers: KernelChangeHandler[] = [];
	private _defaultKernel: nb.IKernelSpec;

	//#endregion

	private _serverLoadFinished: Promise<void> = Promise.resolve();
	private _session: nb.ISession | undefined;
	private _isServerStarted: boolean = false;
	private _executeManager: IExecuteManager;
	private _kernelConfigActions: ((kernelName: string) => Promise<any>)[] = [];
	private _connectionId: string = '';

	private readonly _kernelNotFoundError = 501;

	constructor(private options: IClientSessionOptions) {
		this._notebookUri = options.notebookUri;
		this._executeManager = options.executeManager;
		this._isReady = false;
		this._ready = new Deferred<void>();
		this._kernelChangeCompleted = new Deferred<void>();
		this._defaultKernel = options.kernelSpec;
	}

	public async initialize(): Promise<void> {
		try {
			this._serverLoadFinished = this.startServer(this.options.kernelSpec);
			await this.initializeSession();
			await this.updateCachedKernelSpec();
		} catch (err) {
			this._errorMessage = getErrorMessage(err) || localize('clientSession.unknownError', "An error occurred while starting the notebook session");
		}
		// Always resolving for now. It's up to callers to check for error case
		this._isReady = true;
		this._ready.resolve();
		if (!this.isInErrorState && this._session && this._session.kernel) {
			await this.notifyKernelChanged(this._session.kernel);
		}
	}

	private async startServer(kernelSpec: nb.IKernelSpec): Promise<void> {
		if (!this._executeManager) {
			throw new Error(localize('NoExecuteManager', "Server could not start because a provider was not defined for this notebook file type."));
		}
		let serverManager = this._executeManager.serverManager;
		if (serverManager) {
			await serverManager.startServer(kernelSpec);
			if (!serverManager.isStarted) {
				throw new Error(localize('ServerNotStarted', "Server did not start for unknown reason"));
			}
			this._isServerStarted = serverManager.isStarted;
		} else {
			this._isServerStarted = true;
		}
	}

	private async initializeSession(): Promise<void> {
		await this._serverLoadFinished;
		if (this._isServerStarted) {
			if (!this._executeManager.sessionManager.isReady) {
				await this._executeManager.sessionManager.ready;
			}
			if (this._defaultKernel) {
				await this.startSessionInstance(this._defaultKernel);
			}
		}
	}

	private async startSessionInstance(kernelSpec: nb.IKernelSpec): Promise<void> {
		let session: nb.ISession;
		try {
			// TODO #3164 should use URI instead of path for startNew
			session = await this._executeManager.sessionManager.startNew({
				path: this.notebookUri.fsPath,
				kernelName: kernelSpec.name,
				kernelSpec: kernelSpec
			});
			session.defaultKernelLoaded = true;
		} catch (err) {
			// TODO move registration
			if (err.response?.status === this._kernelNotFoundError || err.errorCode === this._kernelNotFoundError) {
				this.options.notificationService.warn(localize('kernelRequiresConnection', "Kernel '{0}' was not found. The default kernel will be used instead.", kernelSpec.name));
				session = await this._executeManager.sessionManager.startNew({
					path: this.notebookUri.fsPath,
					kernelName: undefined
				});
				session.defaultKernelLoaded = false;
			} else {
				throw err;
			}
		}
		this._session = session;
		await this.runKernelConfigActions(kernelSpec.name);
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
	public onKernelChanging(changeHandler: (kernel: nb.IKernelChangedArgs) => Promise<void>): void {
		if (changeHandler) {
			this._kernelChangeHandlers.push(changeHandler);
		}
	}
	public get kernel(): nb.IKernel | undefined {
		return this._session ? this._session.kernel : undefined;
	}
	public get notebookUri(): URI {
		return this._notebookUri;
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
	public get errorMessage(): string {
		return this._errorMessage;
	}
	public get isInErrorState(): boolean {
		return !!this._errorMessage;
	}

	public get cachedKernelSpec(): nb.IKernelSpec | undefined {
		return this._cachedKernelSpec;
	}
	//#endregion

	//#region Not Yet Implemented
	/**
	 * Change the current kernel associated with the document.
	 */
	async changeKernel(options: nb.IKernelSpec, oldValue?: nb.IKernel): Promise<nb.IKernel | undefined> {
		this._kernelChangeCompleted = new Deferred<void>();
		this._isReady = false;
		let oldKernel = oldValue ? oldValue : this.kernel;

		let kernel = await this.doChangeKernel(options);
		try {
			await kernel?.ready;
		} catch (error) {
			// Cleanup some state before re-throwing
			this._isReady = kernel ? kernel.isReady : false;
			this._kernelChangeCompleted.resolve();
			throw error;
		}
		let newKernel = this._session ? this._session.kernel : kernel;
		this._isReady = kernel ? kernel.isReady : false;
		await this.updateCachedKernelSpec();
		// Send resolution events to listeners
		if (newKernel) {
			await this.notifyKernelChanged(newKernel, oldKernel);
		}
		return kernel;
	}

	private async notifyKernelChanged(newKernel: nb.IKernel, oldKernel?: nb.IKernel): Promise<void> {
		let changeArgs: nb.IKernelChangedArgs = {
			oldValue: oldKernel,
			newValue: newKernel
		};
		let changePromises = this._kernelChangeHandlers.map(handler => handler(changeArgs));
		await Promise.all(changePromises);
		// Wait on connection configuration to complete before resolving full kernel change
		this._kernelChangeCompleted.resolve();
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
	private async doChangeKernel(options: nb.IKernelSpec): Promise<nb.IKernel | undefined> {
		let kernel: nb.IKernel | undefined;
		if (this._session) {
			kernel = await this._session.changeKernel(options);
			await this.runKernelConfigActions(kernel.name);
		} else {
			kernel = await this.startSessionInstance(options).then(() => this.kernel);
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
		if (connection.id !== '-1' && connection.id !== this._connectionId && this._session) {
			await this._session.configureConnection(connection);
			this._connectionId = connection.id;
		}
	}

	/**
	 * Kill the kernel and shutdown the session.
	 *
	 * @returns A promise that resolves when the session is shut down.
	 */
	public async shutdown(): Promise<void> {
		// Always try to shut down session
		if (this._session && this._session.id && this._executeManager && this._executeManager.sessionManager) {
			await this._executeManager.sessionManager.shutdown(this._session.id);
		}
	}

	/**
	 * Restart the session.
	 *
	 * @returns A promise that resolves when the kernel has restarted.
	 *
	 * #### Notes
	 * If there is an existing kernel, restart it and resolve.
	 * If no kernel has been started, this is a no-op, and resolves.
	 * Reject on error.
	 */
	restart(): Promise<void> {
		if (!this._session?.kernel) {
			// no-op if no kernel is present
			return Promise.resolve();
		}
		let restartCompleted = new Deferred<void>();
		this._session?.kernel?.restart().then(() => {
			this.options.notificationService.info(localize('kernelRestartedSuccessfully', 'Kernel restarted successfully'));
			restartCompleted.resolve();
		}, err => {
			this.options.notificationService.error(localize('kernelRestartFailed', 'Kernel restart failed: {0}', err));
			restartCompleted.reject(err);
		});
		return restartCompleted.promise;
	}
	//#endregion
}
