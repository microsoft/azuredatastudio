/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kerberos from 'kerberos';

export async function authenticateKerberos(hostname: string): Promise<string> {
	const service = `HTTP@${hostname}`;

	let client = await kerberos.initializeClient(service, {});
	let response = await client.step('');
	let count = 2;
	while (!client.contextComplete && count > 0) {
		response = await client.step(response);
		count--;
	}
	if (!client.contextComplete) {
		throw new Error('Failed to authenticate, unclear why');
	}
	return response;
}
