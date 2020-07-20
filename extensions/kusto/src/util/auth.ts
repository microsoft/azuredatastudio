/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kerberos from 'kerberos';

export async function authenticateKerberos(hostname: string): Promise<string> {
	const service = 'HTTP' + (process.platform === 'win32' ? '/' : '@') + hostname;
	const mechOID = kerberos.GSS_MECH_OID_KRB5;
	let client = await kerberos.initializeClient(service, { mechOID });
	let response = await client.step('');
	return response;
}
