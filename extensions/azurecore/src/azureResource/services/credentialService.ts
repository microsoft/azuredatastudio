/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { TokenCredentials, ServiceClientCredentials } from 'ms-rest';
import { ApiWrapper } from '../../apiWrapper';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { IAzureResourceCredentialService } from '../interfaces';
import { AzureResourceCredentialError } from '../errors';

export class AzureResourceCredentialService implements IAzureResourceCredentialService {
	public constructor(
		apiWrapper: ApiWrapper
	) {
		this._apiWrapper = apiWrapper;
	}

	public async getCredentials(account: sqlops.Account, resource: sqlops.AzureResource): Promise<ServiceClientCredentials[]> {
		try {
			let credentials: TokenCredentials[] = [];
			let tokens = await this._apiWrapper.getSecurityToken(account, resource);

			for (let tenant of account.properties.tenants) {
				let token = tokens[tenant.id].token;
				let tokenType = tokens[tenant.id].tokenType;

				credentials.push(new TokenCredentials(token, tokenType));
			}

			return credentials;
		} catch (error) {
			throw new AzureResourceCredentialError(localize('azureResource.services.credentialService.credentialError', 'Failed to get credential for account {0}. Please refresh the account.', account.key.accountId), error);
		}
	}

	private _apiWrapper: ApiWrapper = undefined;
}
