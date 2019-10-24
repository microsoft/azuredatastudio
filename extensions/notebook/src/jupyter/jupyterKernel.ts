/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';
import { Kernel, KernelMessage } from '@jupyterlab/services';

function toShellMessage(msgImpl: KernelMessage.IShellMessage): nb.IShellMessage {
	return {
		channel: msgImpl.channel,
		type: msgImpl.channel,
		content: msgImpl.content,
		header: msgImpl.header,
		parent_header: msgImpl.parent_header,
		metadata: msgImpl.metadata
	};
}

function toStdInMessage(msgImpl: KernelMessage.IStdinMessage): nb.IStdinMessage {
	return {
		channel: msgImpl.channel,
		type: msgImpl.channel,
		content: <any>msgImpl.content,
		header: msgImpl.header,
		parent_header: msgImpl.parent_header,
		metadata: msgImpl.metadata
	};
}

function toIOPubMessage(msgImpl: KernelMessage.IIOPubMessage): nb.IIOPubMessage {
	return {
		channel: msgImpl.channel,
		type: msgImpl.channel,
		content: msgImpl.content,
		header: msgImpl.header,
		parent_header: msgImpl.parent_header,
		metadata: msgImpl.metadata
	};
}

function toIInputReply(content: nb.IInputReply): KernelMessage.IInputReply {
	return {
		value: content.value
	};
}
export class JupyterKernel implements nb.IKernel {
	constructor(private kernelImpl: Kernel.IKernelConnection) {
	}

	public get id(): string {
		return this.kernelImpl.id;
	}

	public get name(): string {
		return this.kernelImpl.name;
	}

	public get supportsIntellisense(): boolean {
		return true;
	}

	public get requiresConnection(): boolean {
		// TODO would be good to have a smarter way to do this.
		// for now only Spark kernels need a connection
		return !!(this.kernelImpl.name && this.kernelImpl.name.toLowerCase().indexOf('spark') > -1);
	}

	public get isReady(): boolean {
		return this.kernelImpl.isReady;
	}

	public get ready(): Promise<void> {
		return this.kernelImpl.ready;
	}

	public get info(): nb.IInfoReply {
		return this.kernelImpl.info as nb.IInfoReply;
	}

	public async getSpec(): Promise<nb.IKernelSpec> {
		let specImpl = await this.kernelImpl.getSpec();
		return {
			name: specImpl.name,
			display_name: specImpl.display_name
		};
	}

	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean): nb.IFuture {
		content.code = Array.isArray(content.code) ? content.code.join('') : content.code;
		content.code = content.code.replace(/\r+\n/gm, '\n'); // Remove \r (if it exists) from newlines
		let futureImpl = this.kernelImpl.requestExecute(content as KernelMessage.IExecuteRequest, disposeOnDone);
		return new JupyterFuture(futureImpl);
	}

	requestComplete(content: nb.ICompleteRequest): Promise<nb.ICompleteReplyMsg> {
		return this.kernelImpl.requestComplete({
			code: content.code,
			cursor_pos: content.cursor_pos
		}).then((completeMsg) => {
			// Complete msg matches shell message definition, but with clearer content body
			let msg: nb.ICompleteReplyMsg = toShellMessage(completeMsg);
			return msg;
		});
	}

	interrupt(): Promise<void> {
		return this.kernelImpl.interrupt();
	}
}

export class JupyterFuture implements nb.IFuture {

	private _inProgress: boolean;

	constructor(private futureImpl: Kernel.IFuture) {
		this._inProgress = true;
	}

	public get msg(): nb.IShellMessage {
		let msgImpl = this.futureImpl.msg;
		return toShellMessage(msgImpl);
	}

	public get done(): Promise<nb.IShellMessage> {
		// Convert on success, leave to throw original error on fail
		return this.futureImpl.done.then((msgImpl) => {
			this._inProgress = false;
			return toShellMessage(msgImpl);
		});
	}

	public get inProgress(): boolean {
		return this._inProgress;
	}

	public set inProgress(inProg: boolean) {
		this._inProgress = inProg;
	}

	setReplyHandler(handler: nb.MessageHandler<nb.IShellMessage>): void {
		this.futureImpl.onReply = (msg) => {
			let shellMsg = toShellMessage(msg);
			return handler.handle(shellMsg);
		};
	}

	setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void {
		this.futureImpl.onStdin = (msg) => {
			let shellMsg = toStdInMessage(msg);
			return handler.handle(shellMsg);
		};
	}

	setIOPubHandler(handler: nb.MessageHandler<nb.IIOPubMessage>): void {
		this.futureImpl.onIOPub = (msg) => {
			let shellMsg = toIOPubMessage(msg);
			return handler.handle(shellMsg);
		};
	}

	registerMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
		throw new Error('Method not implemented.');
	}

	removeMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
		throw new Error('Method not implemented.');
	}

	sendInputReply(content: nb.IInputReply): void {
		this.futureImpl.sendInputReply(toIInputReply(content));
	}

	dispose(): void {
		this.futureImpl.dispose();
	}
}
