/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as kerberos from 'ads-kerberos';
import * as vscode from 'vscode';

export enum AuthType {
	Integrated = 'integrated',
	Basic = 'basic'
}

export async function authenticateKerberos(hostname: string): Promise<string> {
	const service = 'HTTP' + (process.platform === 'win32' ? '/' : '@') + hostname;
	const mechOID = kerberos.GSS_MECH_OID_KRB5;
	let client = await kerberos.initializeClient(service, { mechOID });
	let response = await client.step('');
	return response;
}

const bdcConfigSectionName = 'bigDataCluster';
const ignoreSslConfigName = 'ignoreSslVerification';

/**
 * Retrieves the current setting for whether to ignore SSL verification errors
 */
export function getIgnoreSslVerificationConfigSetting(): boolean {
	try {
		const config = vscode.workspace.getConfiguration(bdcConfigSectionName);
		return config.get<boolean>(ignoreSslConfigName, true);
	} catch (error) {
		console.error(`Unexpected error retrieving ${bdcConfigSectionName}.${ignoreSslConfigName} setting : ${error}`);
	}
	return true;
}

