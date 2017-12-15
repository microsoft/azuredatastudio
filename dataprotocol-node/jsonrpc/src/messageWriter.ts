/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { ChildProcess } from 'child_process';

import { Message } from './messages';
import { Event, Emitter } from './events';
import * as is from './is';

let ContentLength: string = 'Content-Length: ';
let CRLF = '\r\n';

export interface MessageWriter {
	onError: Event<[Error, Message, number]>;
	onClose: Event<void>;
	write(msg: Message): void;
}

export abstract class AbstractMessageWriter {

	private errorEmitter: Emitter<[Error, Message, number]>;
	private closeEmitter: Emitter<void>;

	constructor() {
		this.errorEmitter = new Emitter<[Error, Message, number]>();
		this.closeEmitter = new Emitter<void>();
	}

	public get onError(): Event<[Error, Message, number]> {
		return this.errorEmitter.event;
	}

	protected fireError(error: any, message?: Message, count?: number): void {
		this.errorEmitter.fire([this.asError(error), message, count]);
	}

	public get onClose(): Event<void> {
		return this.closeEmitter.event;
	}

	protected fireClose(): void {
		this.closeEmitter.fire(undefined);
	}

	private asError(error: any): Error {
		if (error instanceof Error) {
			return error;
		} else {
			return new Error(`Writer recevied error. Reason: ${is.string(error.message) ? error.message : 'unknown'}`);
		}
	}
}

export class StreamMessageWriter extends AbstractMessageWriter implements MessageWriter {

	private writable: NodeJS.WritableStream;
	private encoding: string;
	private errorCount: number;

	public constructor(writable: NodeJS.WritableStream, encoding: string = 'utf8') {
		super();
		this.writable = writable;
		this.encoding = encoding;
		this.errorCount = 0;
		this.writable.on('error', (error) => this.fireError(error));
		this.writable.on('close', () => this.fireClose());
	}

	public write(msg: Message): void {
		let json = JSON.stringify(msg);
		let contentLength = Buffer.byteLength(json, this.encoding);

		let headers: string[] = [
			ContentLength, contentLength.toString(), CRLF,
			CRLF
		];
		try {
			// Header must be written in ASCII encoding
			this.writable.write(headers.join(''), 'ascii');

			// Now write the content. This can be written in any encoding
			this.writable.write(json, this.encoding);
			this.errorCount = 0;
		} catch (error) {
			this.errorCount++;
			this.fireError(error, msg, this.errorCount);
		}
	}
}

export class IPCMessageWriter extends AbstractMessageWriter implements MessageWriter {

	private process: NodeJS.Process | ChildProcess;
	private errorCount: number;

	public constructor(process: NodeJS.Process | ChildProcess) {
		super();
		this.process = process;
		this.errorCount = 0;

		let eventEmitter: NodeJS.EventEmitter = <NodeJS.EventEmitter>this.process;
		eventEmitter.on('error', (error) => this.fireError(error));
		eventEmitter.on('close', () => this.fireClose);
	}

	public write(msg: Message): void {
		try {
			(this.process.send as Function)(msg);
			this.errorCount = 0;
		} catch (error) {
			this.errorCount++;
			this.fireError(error, msg, this.errorCount);
		}
	}
}