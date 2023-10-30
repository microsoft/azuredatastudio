/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as https from 'https';

export declare type NetworkRequestOptions = {
	headers?: Record<string, string>;
	body?: string;
};

/*
 * Utility function that converts a URL object into an ordinary options object as expected by the
 * http.request and https.request APIs.
 */
export function urlToHttpOptions(url: URL): https.RequestOptions {
	const options: https.RequestOptions & Partial<Omit<URL, 'port'>> = {
		protocol: url.protocol,
		hostname: url.hostname && url.hostname.startsWith('[') ?
			url.hostname.slice(1, -1) :
			url.hostname,
		hash: url.hash,
		search: url.search,
		pathname: url.pathname,
		path: `${url.pathname || ''}${url.search || ''}`,
		href: url.href
	};
	if (url.port !== '') {
		options.port = Number(url.port);
	}
	if (url.username || url.password) {
		options.auth = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
	}
	return options;
}

/**
 * Takes an error and converts it into a PromptFailedResult object with data from the original error about the failure
 * @param err The error to convert into a PromptFailedResult
 * @returns The PromptFailedResult object
 */
export function errorToPromptFailedResult(err: any): azdata.PromptFailedResult {
	return {
		canceled: false,
		name: err.name as string,
		errorCode: err.errorCode as string,
		errorMessage: err.errorMessage as string || err.message as string
	};
}

