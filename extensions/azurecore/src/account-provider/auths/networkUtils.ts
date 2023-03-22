/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NetworkResponse } from '@azure/msal-common';
import * as https from 'https';

export class NetworkUtils {
	static getNetworkResponse<Body>(headers: Record<string, string>, body: Body, statusCode: number): NetworkResponse<Body> {
		return {
			headers: headers,
			body: body,
			status: statusCode
		};
	}

	/*
	 * Utility function that converts a URL object into an ordinary options object as expected by the
	 * http.request and https.request APIs.
	 */
	static urlToHttpOptions(url: URL): https.RequestOptions {
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
}

