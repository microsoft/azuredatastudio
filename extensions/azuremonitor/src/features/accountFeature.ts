/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { SqlOpsDataClient } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature } from 'vscode-languageclient';
import { window } from 'vscode';
import * as contracts from './contracts';
import * as azdata from 'azdata';

const localize = nls.loadMessageBundle();

export class AccountFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(_capabilities: ClientCapabilities): void { }

	initialize(): void {
		this._client.onRequest(contracts.SecurityTokenRequest.type, async (request): Promise<contracts.RequestSecurityTokenResponse | undefined> => {
			return this.getToken(request);
		});
	}

	protected async getToken(request: contracts.RequestSecurityTokenParams): Promise<contracts.RequestSecurityTokenResponse | undefined> {
		const accountList = await azdata.accounts.getAllAccounts();
		let account: azdata.Account | undefined;

		if (accountList.length < 1) {
			// TODO: Prompt user to add account
			window.showErrorMessage(localize('kusto.missingLinkedAzureAccount', "Azure Data Studio needs to contact Azure Key Vault to access a column master key for Always Encrypted, but no linked Azure account is available. Please add a linked Azure account and retry the query."));
			return undefined;
		} else {
			account = accountList.find(a => a.key.accountId === request.accountId);
		}

		if (!account) {
			window.showErrorMessage(localize('kusto.accountDoesNotExist', "Account does not exist."));
			return undefined;
		}

		const unauthorizedMessage = localize('kusto.insufficientlyPrivelagedAzureAccount', "The configured Azure account for {0} does not have sufficient permissions for Azure Key Vault to access a column master key for Always Encrypted.", account.key.accountId);

		let tenantId: string = '';
		if (request.provider !== 'dstsAuth') {
			const tenant = account.properties.tenants.find((t: { [key: string]: string }) => request.authority.includes(t.id));
			if (!tenant) {
				window.showErrorMessage(unauthorizedMessage);
				return undefined;
			}
			tenantId = tenant.id;
		}

		const securityToken = await azdata.accounts.getAccountSecurityToken(account, tenantId, azdata.AzureResource.Sql);

		if (!securityToken?.token) {
			window.showErrorMessage(unauthorizedMessage);
			return undefined;
		}

		let params: contracts.RequestSecurityTokenResponse = {
			accountKey: JSON.stringify(account.key),
			token: securityToken.token
		};

		return params;
	}
}
