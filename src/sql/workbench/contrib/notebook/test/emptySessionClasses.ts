/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { localize } from 'vs/nls';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import type { FutureInternal } from 'sql/workbench/services/notebook/browser/interfaces';
import { noKernel } from 'sql/workbench/contrib/notebook/browser/notebookActions';

const runNotebookDisabled = localize('runNotebookDisabled', "Cannot run cells as no kernel has been configured");

let noKernelSpec: nb.IKernelSpec = ({
	name: noKernel,
	language: 'python',
	display_name: noKernel
});

export class SessionManager implements nb.SessionManager {
	public get isReady(): boolean {
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get specs(): nb.IAllKernels {
		let allKernels: nb.IAllKernels = {
			defaultKernel: noKernel,
			kernels: [noKernelSpec]
		};
		return allKernels;
	}

	startNew(options: nb.ISessionOptions): Thenable<nb.ISession> {
		let session = new EmptySession(options);
		return Promise.resolve(session);
	}

	shutdown(id: string): Thenable<void> {
		return Promise.resolve();
	}
}

export class EmptySession implements nb.ISession {
	private _kernel: EmptyKernel;
	private _defaultKernelLoaded = false;

	public set defaultKernelLoaded(value) {
		this._defaultKernelLoaded = value;
	}

	public get defaultKernelLoaded(): boolean {
		return this._defaultKernelLoaded;
	}

	constructor(private options: nb.ISessionOptions) {
		this._kernel = new EmptyKernel();
	}

	public get canChangeKernels(): boolean {
		return true;
	}

	public get id(): string {
		return this.options.kernelId || '';
	}

	public get path(): string {
		return this.options.path;
	}

	public get name(): string {
		return this.options.name || '';
	}

	public get type(): string {
		return this.options.type || '';
	}

	public get status(): nb.KernelStatus {
		return 'connected';
	}

	public get kernel(): nb.IKernel {
		return this._kernel;
	}

	changeKernel(kernelInfo: nb.IKernelSpec): Thenable<nb.IKernel> {
		return Promise.resolve(this.kernel);
	}

	// No kernel config necessary for empty session
	configureKernel(kernelInfo: nb.IKernelSpec): Thenable<void> {
		return Promise.resolve();
	}

	configureConnection(connection: ConnectionProfile): Thenable<void> {
		return Promise.resolve();
	}
}

class EmptyKernel implements nb.IKernel {
	public get id(): string {
		return '-1';
	}

	public get name(): string {
		return noKernel;
	}

	public get supportsIntellisense(): boolean {
		return false;
	}

	public get requiresConnection(): boolean {
		return false;
	}

	public get isReady(): boolean {
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get info(): nb.IInfoReply {
		let info: nb.IInfoReply = {
			protocol_version: '',
			implementation: '',
			implementation_version: '',
			language_info: {
				name: '',
				version: '',
			},
			banner: '',
			help_links: [{
				text: '',
				url: ''
			}]
		};

		return info;
	}
	getSpec(): Thenable<nb.IKernelSpec> {
		return Promise.resolve(noKernelSpec);
	}

	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean): nb.IFuture {
		return new EmptyFuture();
	}

	requestComplete(content: nb.ICompleteRequest): Thenable<nb.ICompleteReplyMsg> {
		let response: Partial<nb.ICompleteReplyMsg> = {};
		return Promise.resolve(response as nb.ICompleteReplyMsg);
	}

	interrupt(): Thenable<void> {
		return Promise.resolve(undefined);
	}
}

export class EmptyFuture implements FutureInternal {


	get inProgress(): boolean {
		return false;
	}

	get msg(): nb.IMessage {
		return undefined;
	}

	get done(): Thenable<nb.IShellMessage> {
		let msg: nb.IShellMessage = {
			channel: 'shell',
			type: 'shell',
			content: runNotebookDisabled,
			header: undefined,
			metadata: undefined,
			parent_header: undefined
		};

		return Promise.resolve(msg);
	}

	sendInputReply(content: nb.IInputReply): void {
		// no-op
	}
	dispose() {
		// No-op
	}

	setReplyHandler(handler: nb.MessageHandler<nb.IShellMessage>): void {
		// no-op
	}
	setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void {
		// no-op
	}
	setIOPubHandler(handler: nb.MessageHandler<nb.IIOPubMessage>): void {
		setTimeout(() => {
			let msg: nb.IIOPubMessage = {
				channel: 'iopub',
				type: 'iopub',
				header: <nb.IHeader>{
					msg_id: '0',
					msg_type: 'error'
				},
				content: <nb.IErrorResult>{
					ename: localize('errorName', "Error"),
					evalue: runNotebookDisabled,
					output_type: 'error'
				},
				metadata: undefined,
				parent_header: undefined
			};
			handler.handle(msg);
		}, 10);
	}
	registerMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// no-op
	}
	removeMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// no-op
	}
}
