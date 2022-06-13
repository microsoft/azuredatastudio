/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { ADSNotebookController } from 'sql/workbench/api/common/notebooks/adsNotebookController';
import * as nls from 'vs/nls';
import { addExternalInteractiveKernelMetadata, convertToVSCodeNotebookCell } from 'sql/workbench/api/common/notebooks/notebookUtils';
import { CellTypes } from 'sql/workbench/services/notebook/common/contracts';
import { VSCodeNotebookDocument } from 'sql/workbench/api/common/notebooks/vscodeNotebookDocument';
import { URI } from 'vs/base/common/uri';
import { notebookMultipleRequestsError } from 'sql/workbench/common/constants';

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
	private _activeRequest: azdata.nb.IExecuteRequest;

	constructor(private readonly _controller: ADSNotebookController, private readonly _options: azdata.nb.ISessionOptions) {
		this._id = this._options.kernelId ?? (VSCodeKernel.kernelId++).toString();
		this._kernelSpec = this._options.kernelSpec ?? {
			name: this._controller.notebookType,
			display_name: this._controller.label,
		};
		if (!this._kernelSpec.language) {
			this._kernelSpec.language = this._controller.supportedLanguages[0];
			this._kernelSpec.supportedLanguages = this._controller.supportedLanguages;
		}

		// Store external kernel names for .NET Interactive kernels for when notebook gets saved, so that notebook is usable outside of ADS
		addExternalInteractiveKernelMetadata(this._kernelSpec);

		this._name = this._kernelSpec.name;
		this._info = {
			protocol_version: '',
			implementation: '',
			implementation_version: '',
			language_info: {
				name: this._kernelSpec.language,
				oldName: this._kernelSpec.oldLanguage
			},
			banner: '',
			help_links: [{
				text: '',
				url: ''
			}]
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

	public get spec(): azdata.nb.IKernelSpec {
		return this._kernelSpec;
	}

	getSpec(): Thenable<azdata.nb.IKernelSpec> {
		return Promise.resolve(this.spec);
	}

	private cleanUpActiveExecution(cellUri: URI) {
		this._activeRequest = undefined;
		this._controller.removeCellExecution(cellUri);
	}

	requestExecute(content: azdata.nb.IExecuteRequest, disposeOnDone?: boolean): azdata.nb.IFuture {
		if (this._activeRequest) {
			throw new Error(notebookMultipleRequestsError);
		}
		let executePromise: Promise<void>;
		if (this._controller.executeHandler) {
			let cell = convertToVSCodeNotebookCell(CellTypes.Code, content.cellIndex, content.cellUri, content.notebookUri, content.language ?? this._kernelSpec.language, content.code);
			this._activeRequest = content;
			executePromise = Promise.resolve(this._controller.executeHandler([cell], cell.notebook, this._controller)).then(() => this.cleanUpActiveExecution(content.cellUri));
		} else {
			executePromise = Promise.resolve();
		}

		return new VSCodeFuture(executePromise);
	}

	requestComplete(content: azdata.nb.ICompleteRequest): Thenable<azdata.nb.ICompleteReplyMsg> {
		let response: Partial<azdata.nb.ICompleteReplyMsg> = {};
		return Promise.resolve(response as azdata.nb.ICompleteReplyMsg);
	}

	public async interrupt(): Promise<void> {
		if (this._activeRequest) {
			if (this._controller.interruptHandler) {
				let doc = this._controller.getNotebookDocument(this._activeRequest.notebookUri);
				await this._controller.interruptHandler.call(this._controller, new VSCodeNotebookDocument(doc));
			} else {
				let exec = this._controller.getCellExecution(this._activeRequest.cellUri);
				exec?.tokenSource.cancel();
			}
			this.cleanUpActiveExecution(this._activeRequest.cellUri);
		}
	}

	public async restart(): Promise<void> {
		return;
	}
}

class VSCodeSession implements azdata.nb.ISession {
	private _kernel: VSCodeKernel;
	private _defaultKernelLoaded = false;
	constructor(controller: ADSNotebookController, private readonly _options: azdata.nb.ISessionOptions) {
		this._kernel = new VSCodeKernel(controller, this._options);
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

	public get vsKernel(): VSCodeKernel {
		return this._kernel;
	}

	public get kernel(): azdata.nb.IKernel {
		return this.vsKernel;
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
	private _sessions: VSCodeSession[] = [];

	constructor(private readonly _controller: ADSNotebookController) {
	}

	public get isReady(): boolean {
		return this._controller.supportedLanguages?.length > 0 && this._controller.executeHandler !== undefined;
	}

	public get ready(): Thenable<void> {
		return Promise.all([this._controller.languagesAdded, this._controller.executionHandlerAdded]).then();
	}

	public get specs(): azdata.nb.IAllKernels {
		// Have to return the default kernel here, since the manager specs are accessed before kernels get added
		let defaultKernel: azdata.nb.IKernelSpec = {
			name: this._controller.notebookType,
			language: this._controller.supportedLanguages[0],
			display_name: this._controller.label,
			supportedLanguages: this._controller.supportedLanguages ?? []
		};
		return {
			defaultKernel: defaultKernel.name,
			kernels: [defaultKernel]
		};
	}

	public async startNew(options: azdata.nb.ISessionOptions): Promise<azdata.nb.ISession> {
		if (!this.isReady) {
			return Promise.reject(new Error(nls.localize('errorStartBeforeReady', "Cannot start a session, the manager is not yet initialized")));
		}
		let session = new VSCodeSession(this._controller, options);
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
