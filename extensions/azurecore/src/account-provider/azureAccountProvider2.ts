/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import {
	AzureAccountProviderMetadata,
} from './interfaces';

import TokenCache from './tokenCache';

export class AzureAccountProvider implements azdata.AccountProvider, vscode.UriHandler {
	constructor(private metadata: AzureAccountProviderMetadata, private tokenCache: TokenCache) {
		console.log(this.metadata, this.tokenCache);

		vscode.window.registerUriHandler(this);
	}

	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._initialize(storedAccounts);
	}

	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this._getSecurityToken(account, resource);
	}
	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}
	refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._refresh(account);
	}
	clear(accountKey: azdata.AccountKey): Thenable<void> {
		return this._clear(accountKey);
	}
	autoOAuthCancelled(): Thenable<void> {
		return this._autoOAuthCancelled();
	}

	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		console.log(uri);
	}

	private async _initialize(storedAccounts: azdata.Account[]): Promise<azdata.Account[]> {
		return storedAccounts;
	}

	private async _getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<{}> {
		throw new Error('Method not implemented.');
	}

	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		const redirectUri = await vscode.env.createAppUri({
			payload: { path: 'authenticated' }
		});

		const authUrl = this.createAuthUrl(this.metadata.settings.host, redirectUri.toString(), this.metadata.settings.clientId, this.metadata.settings.signInResourceId, 'common');
		console.log(authUrl);

		vscode.env.openExternal(vscode.Uri.parse(authUrl));

		throw new Error('Method not implemented.');
	}

	private async _refresh(account: azdata.Account): Promise<azdata.Account | azdata.PromptFailedResult> {
		throw new Error('Method not implemented.');
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		throw new Error('Method not implemented.');
	}

	private async _autoOAuthCancelled(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	private createAuthUrl(baseHost: string, redirectUri: string, clientId: string, resource: string, tenant: string): string {
		// TODO do this properly.
		return `${baseHost}${tenant}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=token&resource=${resource}`;

	}
}
