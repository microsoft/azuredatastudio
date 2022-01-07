/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { ADSNotebookController } from 'sql/workbench/api/common/adsNotebookController';
import * as nls from 'vs/nls';
import { URI } from 'vs/base/common/uri';

class VSCodeFuture implements azdata.nb.IFuture {
	private _inProgress = true;

	constructor(private readonly _executeCompletion: Promise<void>) {
	}

	dispose() {
		// No-op
	}

	public get inProgress(): boolean {
		return this._inProgress;
	}

	public set inProgress(value: boolean) {
		this._inProgress = value;
	}

	public get msg(): azdata.nb.IMessage | undefined {
		return undefined;
	}

	public get done(): Thenable<azdata.nb.IShellMessage | undefined> {
		return this._executeCompletion.then(() => {
			return undefined;
		}).finally(() => {
			this._inProgress = false;
		});
	}

	setReplyHandler(handler: azdata.nb.MessageHandler<azdata.nb.IShellMessage>): void {
		// No-op
	}

	setStdInHandler(handler: azdata.nb.MessageHandler<azdata.nb.IStdinMessage>): void {
		// No-op
	}

	setIOPubHandler(handler: azdata.nb.MessageHandler<azdata.nb.IIOPubMessage>): void {
		// No-op
	}

	registerMessageHook(hook: (msg: azdata.nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// No-op
	}

	removeMessageHook(hook: (msg: azdata.nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// No-op
	}

	sendInputReply(content: azdata.nb.IInputReply): void {
		// No-op
	}
}

class VSCodeKernel implements azdata.nb.IKernel {
	protected static kernelId = 0;
	private readonly _id: string;
	private readonly _name: string;
	private readonly _info: azdata.nb.IInfoReply;
	private readonly _kernelSpec: azdata.nb.IKernelSpec;

	constructor(private readonly _controller: ADSNotebookController, private readonly _options: azdata.nb.ISessionOptions, language: string) {
		this._id = this._options.kernelId ?? (VSCodeKernel.kernelId++).toString();
		this._name = this._options.kernelName ?? this._controller.notebookType;
		this._info = {
			protocol_version: '',
			implementation: '',
			implementation_version: '',
			language_info: {
				name: language,
				version: '',
			},
			banner: '',
			help_links: [{
				text: '',
				url: ''
			}]
		};
		this._kernelSpec = {
			name: this._name,
			language: language,
			display_name: this._name
		};
	}

	public get id(): string {
		return this._id;
	}

	public get name(): string {
		return this._name;
	}

	public get supportsIntellisense(): boolean {
		return true;
	}

	public get requiresConnection(): boolean | undefined {
		return false;
	}

	public get isReady(): boolean {
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get info(): azdata.nb.IInfoReply | null {
		return this._info;
	}

	getSpec(): Thenable<azdata.nb.IKernelSpec> {
		return Promise.resolve(this._kernelSpec);
	}

	requestExecute(content: azdata.nb.IExecuteRequest, disposeOnDone?: boolean): azdata.nb.IFuture {
		let executePromise: Promise<void>;
		if (this._controller.executeHandler) {
			let cell = convertToVSCodeNotebookCell(content.code, content.cellIndex, content.notebookUri, this._kernelSpec.language);
			executePromise = Promise.resolve(this._controller.executeHandler([cell], cell.notebook, this._controller));
		}
		else {
			executePromise = Promise.resolve();
		}

		return new VSCodeFuture(executePromise);
	}

	requestComplete(content: azdata.nb.ICompleteRequest): Thenable<azdata.nb.ICompleteReplyMsg> {
		let response: Partial<azdata.nb.ICompleteReplyMsg> = {};
		return Promise.resolve(response as azdata.nb.ICompleteReplyMsg);
	}

	public async interrupt(): Promise<void> {
		return;
	}
}

class VSCodeSession implements azdata.nb.ISession {
	private _kernel: VSCodeKernel;
	private _defaultKernelLoaded = false;
	constructor(controller: ADSNotebookController, private readonly _options: azdata.nb.ISessionOptions, language: string) {
		this._kernel = new VSCodeKernel(controller, this._options, language);
	}

	public set defaultKernelLoaded(value) {
		this._defaultKernelLoaded = value;
	}

	public get defaultKernelLoaded(): boolean {
		return this._defaultKernelLoaded;
	}

	public get canChangeKernels(): boolean {
		return true;
	}

	public get id(): string {
		return this._options.kernelId || this._kernel ? this._kernel.id : '';
	}

	public get path(): string {
		return this._options.path;
	}

	public get name(): string {
		return this._options.name || '';
	}

	public get type(): string {
		return this._options.type || '';
	}

	public get status(): azdata.nb.KernelStatus {
		return 'connected';
	}

	public get kernel(): azdata.nb.IKernel {
		return this._kernel;
	}

	changeKernel(kernelInfo: azdata.nb.IKernelSpec): Thenable<azdata.nb.IKernel> {
		return Promise.resolve(this._kernel);
	}

	configureKernel(kernelInfo: azdata.nb.IKernelSpec): Thenable<void> {
		return Promise.resolve();
	}

	configureConnection(connection: azdata.IConnectionProfile): Thenable<void> {
		return Promise.resolve();
	}
}

class VSCodeSessionManager implements azdata.nb.SessionManager {
	private _sessions: azdata.nb.ISession[] = [];

	constructor(private readonly _controller: ADSNotebookController) {
	}

	public get isReady(): boolean {
		return this._controller.supportedLanguages?.length > 0 && this._controller.executeHandler !== undefined;
	}

	public get ready(): Thenable<void> {
		return Promise.all([this._controller.languagesAdded, this._controller.executionHandlerAdded]).then();
	}

	public get specs(): azdata.nb.IAllKernels {
		let languages = this._controller.supportedLanguages?.length > 0 ? this._controller.supportedLanguages : [this._controller.label];
		return {
			defaultKernel: languages[0],
			kernels: languages.map<azdata.nb.IKernelSpec>(language => {
				return {
					name: language,
					language: language,
					display_name: language
				};
			})
		};
	}

	public async startNew(options: azdata.nb.ISessionOptions): Promise<azdata.nb.ISession> {
		if (!this.isReady) {
			return Promise.reject(new Error(nls.localize('errorStartBeforeReady', "Cannot start a session, the manager is not yet initialized")));
		}

		let session: azdata.nb.ISession = new VSCodeSession(this._controller, options, this.specs.defaultKernel);
		let index = this._sessions.findIndex(session => session.path === options.path);
		if (index > -1) {
			this._sessions.splice(index);
		}
		this._sessions.push(session);
		return Promise.resolve(session);
	}

	public shutdown(id: string): Thenable<void> {
		let index = this._sessions.findIndex(session => session.id === id);
		if (index > -1) {
			this._sessions.splice(index);
		}
		return Promise.resolve();
	}

	public shutdownAll(): Thenable<void> {
		return Promise.all(this._sessions.map(session => {
			return this.shutdown(session.id);
		})).then();
	}

	public dispose(): void {
		// No-op
	}
}

class VSCodeExecuteManager implements azdata.nb.ExecuteManager {
	public readonly providerId: string;
	private readonly _sessionManager: azdata.nb.SessionManager;

	constructor(controller: ADSNotebookController) {
		this.providerId = controller.notebookType;
		this._sessionManager = new VSCodeSessionManager(controller);
	}

	public get sessionManager(): azdata.nb.SessionManager {
		return this._sessionManager;
	}

	public get serverManager(): azdata.nb.ServerManager | undefined {
		return undefined;
	}
}

/**
 * A Notebook Execute Provider that is used to convert VS Code notebook extension APIs into ADS equivalents.
 */
export class VSCodeExecuteProvider implements azdata.nb.NotebookExecuteProvider {
	public readonly providerId: string;
	private readonly _executeManager: azdata.nb.ExecuteManager;

	constructor(controller: ADSNotebookController) {
		this._executeManager = new VSCodeExecuteManager(controller);
		this.providerId = controller.notebookType;
	}

	public getExecuteManager(notebookUri: vscode.Uri): Thenable<azdata.nb.ExecuteManager> {
		return Promise.resolve(this._executeManager);
	}

	public handleNotebookClosed(notebookUri: vscode.Uri): void {
		// No-op
	}
}

export function convertToVSCodeNotebookCell(cellSource: string | string[], index: number, uri: URI, language: string): vscode.NotebookCell {
	return <vscode.NotebookCell>{
		index: index,
		document: <vscode.TextDocument>{
			uri: uri,
			languageId: language,
			getText: () => Array.isArray(cellSource) ? cellSource.join('') : cellSource,
		},
		notebook: <vscode.NotebookDocument>{
			uri: uri
		}
	};
}
