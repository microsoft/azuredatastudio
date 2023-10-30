/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IConnectionProfile } from 'azdata';
import { Session, Kernel } from '@jupyterlab/services';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as path from 'path';
const localize = nls.loadMessageBundle();

import { JupyterKernel } from './jupyterKernel';
import { Deferred } from '../common/promise';
import { JupyterServerInstallation } from './jupyterServerInstallation';

export class JupyterSessionManager implements nb.SessionManager, vscode.Disposable {
	private _ready: Deferred<void>;
	private _isReady: boolean;
	private _sessionManager: Session.IManager;
	private static _sessions: JupyterSession[] = [];
	private _installation: JupyterServerInstallation;

	constructor() {
		this._isReady = false;
		this._ready = new Deferred<void>();
	}

	public setJupyterSessionManager(sessionManager: Session.IManager): void {
		this._sessionManager = sessionManager;
		sessionManager.ready
			.then(() => {
				this._isReady = true;
				this._ready.resolve();
			}).catch((error) => {
				this._isReady = false;
				this._ready.reject(error);
			});
	}

	public set installation(installation: JupyterServerInstallation) {
		this._installation = installation;
		JupyterSessionManager._sessions.forEach(session => {
			session.installation = installation;
		});
	}
	public get isReady(): boolean {
		return this._isReady;
	}
	public get ready(): Promise<void> {
		return this._ready.promise;
	}

	public get specs(): nb.IAllKernels | undefined {
		if (!this._isReady) {
			return undefined;
		}
		let specs = this._sessionManager.specs;
		if (!specs) {
			return undefined;
		}
		let kernels: nb.IKernelSpec[] = Object.keys(specs.kernelspecs).map(k => {
			let value = specs.kernelspecs[k];
			let kernel: nb.IKernelSpec = {
				name: k,
				display_name: value.display_name ? value.display_name : k
			};
			// TODO add more info to kernels
			return kernel;
		});

		let allKernels: nb.IAllKernels = {
			defaultKernel: specs.default,
			kernels: kernels
		};
		return allKernels;
	}

	public async startNew(options: nb.ISessionOptions, skipSettingEnvironmentVars?: boolean): Promise<nb.ISession> {
		if (!this._isReady) {
			// no-op
			return Promise.reject(new Error(localize('errorStartBeforeReady', "Cannot start a session, the manager is not yet initialized")));
		}

		// Prompt for Python Install to check that all dependencies are installed.
		// This prevents the kernel from getting stuck if a user deletes a dependency after the server has been started.
		let kernelDisplayName: string = this.specs?.kernels.find(k => k.name === options.kernelName)?.display_name;
		await this._installation?.promptForPythonInstall(kernelDisplayName);

		let sessionImpl = await this._sessionManager.startNew(options);
		let jupyterSession = new JupyterSession(sessionImpl, this._installation, skipSettingEnvironmentVars, this._installation?.pythonEnvVarPath);
		await jupyterSession.messagesComplete;
		let index = JupyterSessionManager._sessions.findIndex(session => session.path === options.path);
		if (index > -1) {
			JupyterSessionManager._sessions.splice(index);
		}
		JupyterSessionManager._sessions.push(jupyterSession);
		return jupyterSession;
	}

	public listRunning(): JupyterSession[] {
		return JupyterSessionManager._sessions;
	}

	public shutdown(id: string): Promise<void> {
		if (!this._isReady) {
			// no-op
			return Promise.resolve();
		}
		let index = JupyterSessionManager._sessions.findIndex(session => session.id === id);
		if (index > -1) {
			JupyterSessionManager._sessions.splice(index);
		}
		if (this._sessionManager && !this._sessionManager.isDisposed) {
			return this._sessionManager.shutdown(id);
		}
		return undefined;
	}

	public shutdownAll(): Promise<void> {
		if (this._isReady) {
			return this._sessionManager.shutdownAll();
		}
		return Promise.resolve();
	}

	public dispose(): void {
		if (this._isReady) {
			this._sessionManager.dispose();
		}
	}
}

export class JupyterSession implements nb.ISession {
	private _kernel: nb.IKernel;
	private _messagesComplete: Deferred<void> = new Deferred<void>();

	constructor(
		private sessionImpl: Session.ISession,
		private _installation: JupyterServerInstallation,
		skipSettingEnvironmentVars?: boolean,
		private _pythonEnvVarPath?: string) {
		this.setEnvironmentVars(skipSettingEnvironmentVars).catch(error => {
			console.error('Unexpected exception setting Jupyter Session variables : ', error);
			// We don't want callers to hang forever waiting - it's better to continue on even if we weren't
			// able to set environment variables
			this._messagesComplete.resolve();
		});
	}

	public get canChangeKernels(): boolean {
		return true;
	}

	public get id(): string {
		return this.sessionImpl.id;
	}

	public get path(): string {
		return this.sessionImpl.path;
	}

	public get name(): string {
		return this.sessionImpl.name;
	}

	public get type(): string {
		return this.sessionImpl.type;
	}

	public get status(): nb.KernelStatus {
		return this.sessionImpl.status;
	}

	public get kernel(): nb.IKernel {
		if (!this._kernel) {
			let kernelImpl = this.sessionImpl.kernel;
			if (kernelImpl) {
				this._kernel = new JupyterKernel(kernelImpl);
			}
		}
		return this._kernel;
	}

	// Sent when startup messages have been sent
	public get messagesComplete(): Promise<void> {
		return this._messagesComplete.promise;
	}

	public set installation(installation: JupyterServerInstallation) {
		this._installation = installation;
	}

	public async changeKernel(kernelInfo: nb.IKernelSpec): Promise<nb.IKernel> {
		if (this._installation) {
			try {
				await this._installation.promptForPythonInstall(kernelInfo.display_name);
			} catch (err) {
				// Have to swallow the error here to prevent hangs when changing back to the old kernel.
				console.error('Exception encountered prompting for Python install', err);
				return this._kernel;
			}
		}
		// For now, Jupyter implementation handles disposal etc. so we can just
		// null out our kernel and let the changeKernel call handle this
		this._kernel = undefined;
		// For now, just using name. It's unclear how we'd know the ID
		let options: Partial<Kernel.IModel> = {
			name: kernelInfo.name
		};
		return this.sessionImpl.changeKernel(options).then((kernelImpl) => {
			this._kernel = new JupyterKernel(kernelImpl);
			return this._kernel;
		});
	}

	configureKernel(kernelInfo: nb.IKernelSpec): Thenable<void> {
		return Promise.resolve();
	}

	configureConnection(connection: IConnectionProfile): Thenable<void> {
		return Promise.resolve();
	}

	private async setEnvironmentVars(skip: boolean = false): Promise<void> {
		// The PowerShell kernel doesn't define the %cd and %set_env magics; no need to run those here then
		if (!skip && this.sessionImpl?.kernel?.name !== 'powershell') {
			let allCode: string = '';
			// Ensure cwd matches notebook path (this follows Jupyter behavior)
			if (this.path && path.dirname(this.path)) {
				allCode += `%cd ${path.dirname(this.path)}\n`;
			}
			for (let i = 0; i < Object.keys(process.env).length; i++) {
				let key = Object.keys(process.env)[i];
				if (key.toLowerCase() === 'path' && this._pythonEnvVarPath) {
					allCode += `%set_env ${key}=${this._pythonEnvVarPath}\n`;
				} else {
					// Jupyter doesn't seem to alow for setting multiple variables at once, so doing it with multiple commands
					allCode += `%set_env ${key}=${process.env[key]}\n`;
				}
			}

			let future = this.sessionImpl.kernel.requestExecute({
				code: allCode,
				silent: true,
				store_history: false
			}, true);
			await future.done;
		}
		this._messagesComplete.resolve();
	}
}
