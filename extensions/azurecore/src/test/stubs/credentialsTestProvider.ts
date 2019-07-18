/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * Mock CredentialsProvider to be used for testing
 */
export class CredentialsTestProvider implements azdata.CredentialProvider {
	handle: number;

	public storedCredentials: { [K: string]: azdata.Credential } = {};

	saveCredential(credentialId: string, password: string): Thenable<boolean> {
		this.storedCredentials[credentialId] = {
			credentialId: credentialId,
			password: password
		};
		return Promise.resolve(true);
	}

	readCredential(credentialId: string): Thenable<azdata.Credential> {
		return Promise.resolve(this.storedCredentials[credentialId]);
	}

	deleteCredential(credentialId: string): Thenable<boolean> {
		let exists = this.storedCredentials[credentialId] !== undefined;
		delete this.storedCredentials[credentialId];
		return Promise.resolve(exists);
	}
}
