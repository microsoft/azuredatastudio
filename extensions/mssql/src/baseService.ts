/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestType } from 'vscode-languageclient';
import { SqlOpsDataClient } from 'dataprotocol-client';

/**
 * Base class containing shared code to reduce boilerplate for services
 */
export abstract class BaseService {
	constructor(protected readonly client: SqlOpsDataClient) { }

	/**
	 * Runs the specified request wrapped in the requisite try-catch
	 * @param type RequestType, typically in the format 'contracts.DoThingRequest.type'
	 * @param params parameters to be passed to the request
	 * @returns result from the request
	 */
	protected async runWithErrorHandling<P, R, E, RO>(type: RequestType<P, R, E, RO>, params: P): Promise<R> {
		try {
			const result = await this.client.sendRequest(type, params);
			return result;
		} catch (e) {
			this.client.logFailedRequest(type, e);
			throw e;
		}
	}
}
