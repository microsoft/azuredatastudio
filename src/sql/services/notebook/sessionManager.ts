'use strict';

import { nb } from 'sqlops';
import { localize } from 'vs/nls';

const noKernel: string = localize('noKernel', 'No Kernel');
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

class EmptySession implements nb.ISession {
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
		throw new Error('Method not implemented.');
	}

	requestComplete(content: nb.ICompleteRequest): Thenable<nb.ICompleteReplyMsg> {
		let response: Partial<nb.ICompleteReplyMsg> = { };
		return Promise.resolve(response as nb.ICompleteReplyMsg);
	}

}