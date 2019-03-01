/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

import { IServerInstance } from '../jupyter/common';
import { Session, Kernel, KernelMessage, ServerConnection } from '@jupyterlab/services';
import { ISignal } from '@phosphor/signaling';

export class JupyterServerInstanceStub implements IServerInstance {
	public get port(): string {
		return undefined;
	}

	public get uri(): vscode.Uri {
		return undefined;
	}

	public configure(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	public start(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	stop(): Promise<void> {
		throw new Error('Method not implemented.');
	}
}


//#region sesion and kernel stubs (long)
export class SessionStub implements Session.ISession {
	public get terminated(): ISignal<this, void> {
		throw new Error('Method not implemented.');
	}
	public get kernelChanged(): ISignal<this, Session.IKernelChangedArgs> {
		throw new Error('Method not implemented.');
	}
	public get statusChanged(): ISignal<this, Kernel.Status> {
		throw new Error('Method not implemented.');
	}
	public get propertyChanged(): ISignal<this, 'path' | 'name' | 'type'> {
		throw new Error('Method not implemented.');
	}
	public get iopubMessage(): ISignal<this, KernelMessage.IIOPubMessage> {
		throw new Error('Method not implemented.');
	}
	public get unhandledMessage(): ISignal<this, KernelMessage.IMessage> {
		throw new Error('Method not implemented.');
	}
	public get anyMessage(): ISignal<this, Kernel.IAnyMessageArgs> {
		throw new Error('Method not implemented.');
	}
	public get id(): string {
		throw new Error('Method not implemented.');
	}
	public get path(): string {
		throw new Error('Method not implemented.');
	}
	public get name(): string {
		throw new Error('Method not implemented.');
	}
	public get type(): string {
		throw new Error('Method not implemented.');
	}
	public get serverSettings(): ServerConnection.ISettings {
		throw new Error('Method not implemented.');
	}
	public get model(): Session.IModel {
		throw new Error('Method not implemented.');
	}
	public get kernel(): Kernel.IKernelConnection {
		throw new Error('Method not implemented.');
	}
	public get status(): Kernel.Status {
		throw new Error('Method not implemented.');
	}
	public get isDisposed(): boolean {
		throw new Error('Method not implemented.');
	}
	setPath(path: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	setName(name: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	setType(type: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	changeKernel(options: Partial<Kernel.IModel>): Promise<Kernel.IKernelConnection> {
		throw new Error('Method not implemented.');
	}
	shutdown(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}
}

export class KernelStub implements Kernel.IKernel {
	get terminated(): ISignal<this, void> {
		throw new Error('Method not implemented.');
	}
	get statusChanged(): ISignal<this, Kernel.Status> {
		throw new Error('Method not implemented.');
	}
	get iopubMessage(): ISignal<this, KernelMessage.IIOPubMessage> {
		throw new Error('Method not implemented.');
	}
	get unhandledMessage(): ISignal<this, KernelMessage.IMessage> {
		throw new Error('Method not implemented.');
	}
	get anyMessage(): ISignal<this, Kernel.IAnyMessageArgs> {
		throw new Error('Method not implemented.');
	}
	get serverSettings(): ServerConnection.ISettings {
		throw new Error('Method not implemented.');
	}
	get id(): string {
		throw new Error('Method not implemented.');
	}
	get name(): string {
		throw new Error('Method not implemented.');
	}
	get model(): Kernel.IModel {
		throw new Error('Method not implemented.');
	}
	get username(): string {
		throw new Error('Method not implemented.');
	}
	get clientId(): string {
		throw new Error('Method not implemented.');
	}
	get status(): Kernel.Status {
		throw new Error('Method not implemented.');
	}
	get info(): KernelMessage.IInfoReply {
		throw new Error('Method not implemented.');
	}
	get isReady(): boolean {
		throw new Error('Method not implemented.');
	}
	get ready(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	get isDisposed(): boolean {
		throw new Error('Method not implemented.');
	}
	shutdown(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	getSpec(): Promise<Kernel.ISpecModel> {
		throw new Error('Method not implemented.');
	}
	sendShellMessage(msg: KernelMessage.IShellMessage, expectReply?: boolean, disposeOnDone?: boolean): Kernel.IFuture {
		throw new Error('Method not implemented.');
	}
	reconnect(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	interrupt(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	restart(): Promise<void> {
		throw new Error('Method not implemented.');
	}
	requestKernelInfo(): Promise<KernelMessage.IInfoReplyMsg> {
		throw new Error('Method not implemented.');
	}
	requestComplete(content: KernelMessage.ICompleteRequest): Promise<KernelMessage.ICompleteReplyMsg> {
		throw new Error('Method not implemented.');
	}
	requestInspect(content: KernelMessage.IInspectRequest): Promise<KernelMessage.IInspectReplyMsg> {
		throw new Error('Method not implemented.');
	}
	requestHistory(content: KernelMessage.IHistoryRequest): Promise<KernelMessage.IHistoryReplyMsg> {
		throw new Error('Method not implemented.');
	}
	requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean): Kernel.IFuture {
		throw new Error('Method not implemented.');
	}
	requestIsComplete(content: KernelMessage.IIsCompleteRequest): Promise<KernelMessage.IIsCompleteReplyMsg> {
		throw new Error('Method not implemented.');
	}
	requestCommInfo(content: KernelMessage.ICommInfoRequest): Promise<KernelMessage.ICommInfoReplyMsg> {
		throw new Error('Method not implemented.');
	}
	sendInputReply(content: KernelMessage.IInputReply): void {
		throw new Error('Method not implemented.');
	}
	connectToComm(targetName: string, commId?: string): Kernel.IComm {
		throw new Error('Method not implemented.');
	}
	registerCommTarget(targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>): void {
		throw new Error('Method not implemented.');
	}
	removeCommTarget(targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void | PromiseLike<void>): void {
		throw new Error('Method not implemented.');
	}
	registerMessageHook(msgId: string, hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
		throw new Error('Method not implemented.');
	}
	removeMessageHook(msgId: string, hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}
}

export class FutureStub implements Kernel.IFuture {
	get msg(): KernelMessage.IShellMessage {
		throw new Error('Method not implemented.');
	}
	get done(): Promise<KernelMessage.IShellMessage> {
		throw new Error('Method not implemented.');
	}
	get isDisposed(): boolean {
		throw new Error('Method not implemented.');
	}
	get onReply(): (msg: KernelMessage.IShellMessage) => void | PromiseLike<void> {
		throw new Error('Method not implemented.');
	}
	set onReply(handler: (msg: KernelMessage.IShellMessage) => void | PromiseLike<void>) {
		throw new Error('Method not implemented.');
	}
	get onStdin(): (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void> {
		throw new Error('Method not implemented.');
	}
	set onStdin(handler: (msg: KernelMessage.IStdinMessage) => void | PromiseLike<void>) {
		throw new Error('Method not implemented.');
	}
	get onIOPub(): (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void> {
		throw new Error('Method not implemented.');
	}
	set onIOPub(handler: (msg: KernelMessage.IIOPubMessage) => void | PromiseLike<void>) {
		throw new Error('Method not implemented.');
	}
	registerMessageHook(hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
		throw new Error('Method not implemented.');
	}
	removeMessageHook(hook: (msg: KernelMessage.IIOPubMessage) => boolean | PromiseLike<boolean>): void {
		throw new Error('Method not implemented.');
	}
	sendInputReply(content: KernelMessage.IInputReply): void {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}
}
//#endregion
