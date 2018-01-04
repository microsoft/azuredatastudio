/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the Source EULA. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as is from './is';

/**
 * A language server message
 */
export interface Message {
	jsonrpc: string;
}

/**
 * Request message
 */
export interface RequestMessage extends Message {

	/**
	 * The request id.
	 */
	id: number | string;

	/**
	 * The method to be invoked.
	 */
	method: string;

	/**
	 * The method's params.
	 */
	params?: any
}

/**
 * Predefined error codes.
 */
export namespace ErrorCodes {
	// Defined by JSON RPC
	export const ParseError: number = -32700;
	export const InvalidRequest: number = -32600;
	export const MethodNotFound: number = -32601;
	export const InvalidParams: number = -32602;
	export const InternalError: number = -32603;
	export const serverErrorStart: number = -32099
	export const serverErrorEnd: number = -32000;

	// Defined by VSCode.
	export const MessageWriteError: number = 1;
	export const MessageReadError: number = 2;
}

export interface ResponseErrorLiteral<D> {
	/**
	 * A number indicating the error type that occured.
	 */
	code: number;

	/**
	 * A string providing a short decription of the error.
	 */
	message: string;

	/**
	 * A Primitive or Structured value that contains additional
	 * information about the error. Can be omitted.
	 */
	data?: D;
}

/**
 * A error object return in a response in case a request
 * has failed.
 */
export class ResponseError<D> extends Error {

	public code: number;

	public message: string;

	public data: D;

	constructor(code: number, message: string, data?: D) {
		super(message);
		this.code = code;
		this.message = message;
		if (is.defined(data)) {
			this.data = data;
		}
	}

	public toJson(): ResponseErrorLiteral<D> {
		let result: ResponseErrorLiteral<D> = {
			code: this.code,
			message: this.message
		};
		if (is.defined(this.data)) {
			result.data = this.data
		};
		return result;
	}
}

/**
 * A response message.
 */
export interface ResponseMessage extends Message {
	/**
	 * The request id.
	 */
	id: number | string;

	/**
	 * The result of a request. This can be omitted in
	 * the case of an error.
	 */
	result?: any;

	/**
	 * The error object in case a request fails.
	 */
	error?: ResponseErrorLiteral<any>;
}

/**
 * A interface to type the request parameter / response pair
 */
export interface RequestType<P, R, E> {
	method: string;
}

/**
 * Notification Message
 */
export interface NotificationMessage extends Message {
	/**
	 * The method to be invoked.
	 */
	method: string;

	/**
	 * The notification's params.
	 */
	params?: any
}

export interface NotificationType<P> {
	method: string;
}

/**
 * Tests if the given message is a request message
 */
export function isRequestMessage(message: Message): message is RequestMessage {
	let candidate = <RequestMessage>message;
	return candidate && is.string(candidate.method) && (is.string(candidate.id) || is.number(candidate.id));
}

/**
 * Tests if the given message is a notification message
 */
export function isNotificationMessage(message: Message): message is NotificationMessage {
	let candidate = <NotificationMessage>message;
	return candidate && is.string(candidate.method) && is.undefined((<any>message).id);
}

/**
 * Tests if the given message is a response message
 */
export function isReponseMessage(message: Message): message is ResponseMessage {
	let candidate = <ResponseMessage>message;
	return candidate && (is.defined(candidate.result) || is.defined(candidate.error)) && (is.string(candidate.id) || is.number(candidate.id));
}