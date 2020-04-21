/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kerberos from 'ads-kerberos';
import * as vscode from 'vscode';

export async function authenticateKerberos(hostname: string): Promise<string> {
	const service = 'HTTP' + (process.platform === 'win32' ? '/' : '@') + hostname;
	const mechOID = kerberos.GSS_MECH_OID_KRB5;
	let client = await kerberos.initializeClient(service, { mechOID });
	let response = await client.step('');
	return response;
}


type HostAndIp = { host: string, port: string };

export function getHostAndPortFromEndpoint(endpoint: string): HostAndIp {
	let authority = vscode.Uri.parse(endpoint).authority;
	let hostAndPortRegex = /^(.*)([,:](\d+))/g;
	let match = hostAndPortRegex.exec(authority);
	if (match) {
		return {
			host: match[1],
			port: match[3]
		};
	}
	return {
		host: authority,
		port: undefined
	};
}
