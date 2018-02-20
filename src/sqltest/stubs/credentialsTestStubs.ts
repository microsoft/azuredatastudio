/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { TPromise } from 'vs/base/common/winjs.base';
import { CredentialManagementEvents, ICredentialsService } from 'sql/services/credentials/credentialsService';
import { IDisposable } from 'vs/base/common/lifecycle';

export class CredentialsTestProvider implements sqlops.CredentialProvider {
	handle: number;

	public storedCredentials: { [K: string]: sqlops.Credential } = {};

	saveCredential(credentialId: string, password: string): Thenable<boolean> {
		this.storedCredentials[credentialId] = {
			credentialId: credentialId,
			password: password
		};
		return TPromise.as(true);
	}

	readCredential(credentialId: string): Thenable<sqlops.Credential> {
		return TPromise.as(this.storedCredentials[credentialId]);
	}

	deleteCredential(credentialId: string): Thenable<boolean> {
		let exists = this.storedCredentials[credentialId] !== undefined;
		delete this.storedCredentials[credentialId];
		return TPromise.as(exists);
	}
}

export class CredentialsTestService implements ICredentialsService {
	_serviceBrand: any;

	saveCredential(credentialId: string, password: string): Thenable<boolean> {
		return undefined;
	}

	readCredential(credentialId: string): Thenable<sqlops.Credential> {
		return undefined;
	}

	deleteCredential(credentialId: string): Thenable<boolean> {
		return undefined;
	}

	addEventListener(handle: number, events: CredentialManagementEvents): IDisposable {
		return undefined;
	}

}