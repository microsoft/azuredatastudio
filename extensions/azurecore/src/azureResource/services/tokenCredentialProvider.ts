/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as coreAuth from '@azure/core-auth';
import * as azdata from 'azdata';

/**
 * Implements TokenCredential to provide access token on demand.
 */
export class TokenCredentialProvider implements coreAuth.TokenCredential {

	constructor(private account: azdata.Account,
		private tenantId: string) { }

	async getToken(scopes: string | string[], options?: coreAuth.GetTokenOptions | undefined): Promise<coreAuth.AccessToken | null> {
		let token = await azdata.accounts.getAccountSecurityToken(this.account, this.tenantId, azdata.AzureResource.ResourceManagement);
		return token && token.expiresOn ? {
			token: token.token,
			expiresOnTimestamp: token.expiresOn!
		} : null;
	}

}
