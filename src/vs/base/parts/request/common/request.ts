/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBufferReadableStream } from 'vs/base/common/buffer';

const offlineName = 'Offline';

/**
 * Checks if the given error is offline error
 */
export function isOfflineError(error: any): boolean {
	if (error instanceof OfflineError) {
		return true;
	}
	return error instanceof Error && error.name === offlineName && error.message === offlineName;
}

export class OfflineError extends Error {
	constructor() {
		super(offlineName);
		this.name = this.message;
	}
}

export interface IHeaders {
	[header: string]: string;
}

export interface IRequestOptions {
	type?: string;
	url?: string;
	user?: string;
	password?: string;
	headers?: IHeaders;
	timeout?: number;
	data?: string;
	followRedirects?: number;
	proxyAuthorization?: string;
}

export interface IRequestContext {
	res: {
		headers: IHeaders;
		statusCode?: number;
	};
	stream: VSBufferReadableStream;
}
