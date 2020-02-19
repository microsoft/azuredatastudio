/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import {
	AzureAccountProviderMetadata,
	AzureAuthType
} from './interfaces';

import { SimpleTokenCache } from './simpleTokenCache';
import { AzureAuth, TokenResponse } from './auths/azureAuth';
import { AzureAuthCodeGrant } from './auths/azureAuthCodeGrant';
import { AzureDeviceCode } from './auths/azureDeviceCode';

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class AzureAccountProvider implements azdata.AccountProvider {
	private readonly authMappings = new Map<AzureAuthType, AzureAuth>();
	private initComplete: Deferred<void>;
	private initCompletePromise: Promise<void> = new Promise<void>((resolve, reject) => this.initComplete = { resolve, reject });

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext
	) {
		this.authMappings.set(AzureAuthType.AuthCodeGrant, new AzureAuthCodeGrant(metadata, tokenCache, context));
		this.authMappings.set(AzureAuthType.DeviceCode, new AzureDeviceCode(metadata, tokenCache, context));
	}

	private getAuthMethod(account?: azdata.Account): AzureAuth {
		const authType: AzureAuthType = account?.properties?.azureAuthType;
		if (authType) {
			return this.authMappings.get(authType);
		} else {
			return this.authMappings.get(AzureAuthType.AuthCodeGrant);
		}
	}

	initialize(storedAccounts: azdata.Account[]): Thenable<azdata.Account[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: azdata.Account[]): Promise<azdata.Account[]> {
		const accounts: azdata.Account[] = [];
		for (let account of storedAccounts) {
			const azureAuth = this.getAuthMethod(account);
			accounts.push(await azureAuth.refreshAccess(account));
		}
		this.initComplete.resolve();
		return accounts;
	}


	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<{}> {
		return this._getSecurityToken(account, resource);
	}

	private async _getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<TokenResponse> {
		await this.initCompletePromise;
		const azureAuth = this.getAuthMethod(undefined);
		return azureAuth.getSecurityToken(account, resource);
	}

	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}


	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		await this.initCompletePromise;
		class Option implements vscode.QuickPickItem {
			public readonly label: string;
			constructor(public readonly azureAuth: AzureAuth) {
				this.label = azureAuth.userFriendlyName;
			}
		}

		const options: Option[] = [];
		this.authMappings.forEach((azureAuth) => {
			options.push(new Option(azureAuth));
		});

		const pick = await vscode.window.showQuickPick(options, { canPickMany: false });

		return pick.azureAuth.login();
	}

	refresh(account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this.prompt();
	}

	clear(accountKey: azdata.AccountKey): Thenable<void> {
		return this._clear(accountKey);
	}

	private async _clear(accountKey: azdata.AccountKey): Promise<void> {
		await this.initCompletePromise;
		this.getAuthMethod(undefined).clearCredentials(accountKey);
	}

	autoOAuthCancelled(): Thenable<void> {
		this.authMappings.forEach(val => val.autoOAuthCancelled());
		return undefined;
	}

}
