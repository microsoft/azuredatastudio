/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NetworkResponse } from '@azure/msal-common';
export class NetworkUtils {
	static getNetworkResponse<Body>(headers: Record<string, string>, body: Body, statusCode: number): NetworkResponse<Body> {
		return {
			headers: headers,
			body: body,
			status: statusCode
		};
	}
}

