/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import axios, { AxiosRequestConfig } from 'axios';

/**
 * Class includes method for making http request
 */
export class HttpClient {
	private static cache: Map<string, any> = new Map();

	/**
	 * Makes http GET request to the given url. If useCache is set to true, returns the result from cache if exists
	 * @param url url to make http GET request against
	 * @param useCache if true and result is already cached the cached value will be returned
	 * @returns result if http GET request
	 */
	public static async getRequest(url: string, useCache = false): Promise<any> {

		if (useCache) {
			if (HttpClient.cache.has(url)) {
				return HttpClient.cache.get(url);
			}
		}

		const config: AxiosRequestConfig = {
			headers: {
				'Content-Type': 'application/json'
			},
			validateStatus: () => true // Never throw
		};
		const response = await axios.get(url, config);
		if (response.status !== 200) {
			let errorMessage: string[] = [];
			errorMessage.push(response.status.toString());
			errorMessage.push(response.statusText);
			if (response.data?.error) {
				errorMessage.push(`${response.data?.error?.code} : ${response.data?.error?.message}`);
			}
			throw new Error(errorMessage.join(os.EOL));
		}

		if (useCache) {
			HttpClient.cache.set(url, response.data);
		}
		return response.data;
	}
}
