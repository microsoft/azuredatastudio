/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

import {
	AzureAccountProviderMetadata,
	AzureAuthType,
	Deferred
} from './interfaces';

import { SimpleTokenCache } from './simpleTokenCache';
import { AzureAuth, TokenResponse } from './auths/azureAuth';
import { AzureAuthCodeGrant } from './auths/azureAuthCodeGrant';
import { AzureDeviceCode } from './auths/azureDeviceCode';

const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements azdata.AccountProvider {
	private static readonly CONFIGURATION_SECTION = 'accounts.azure.auth';
	private readonly authMappings = new Map<AzureAuthType, AzureAuth>();
	private initComplete: Deferred<void>;
	private initCompletePromise: Promise<void> = new Promise<void>((resolve, reject) => this.initComplete = { resolve, reject });

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext
	) {
		vscode.workspace.onDidChangeConfiguration((changeEvent) => {
			const impact = changeEvent.affectsConfiguration(AzureAccountProvider.CONFIGURATION_SECTION);
			if (impact === true) {
				this.handleAuthMapping(metadata, tokenCache, context);
			}
		});
		this.handleAuthMapping(metadata, tokenCache, context);

	}

	clearTokenCache(): Thenable<void> {
		throw new Error('Method not implemented.');
	}

	private handleAuthMapping(metadata: AzureAccountProviderMetadata, tokenCache: SimpleTokenCache, context: vscode.ExtensionContext) {
		this.authMappings.clear();
		const configuration = vscode.workspace.getConfiguration(AzureAccountProvider.CONFIGURATION_SECTION);

		const codeGrantMethod: boolean = configuration.get('codeGrant');
		const deviceCodeMethod: boolean = configuration.get('deviceCode');

		if (codeGrantMethod === true) {
			this.authMappings.set(AzureAuthType.AuthCodeGrant, new AzureAuthCodeGrant(metadata, tokenCache, context));
		}
		if (deviceCodeMethod === true) {
			this.authMappings.set(AzureAuthType.DeviceCode, new AzureDeviceCode(metadata, tokenCache, context));
		}
	}

	private getAuthMethod(account?: azdata.Account): AzureAuth {
		if (this.authMappings.size === 1) {
			return this.authMappings.values().next().value;
		}

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
			if (!azureAuth) {
				account.isStale = true;
				accounts.push(account);
			} else {
				accounts.push(await azureAuth.refreshAccess(account));
			}
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
		return azureAuth?.getSecurityToken(account, resource);
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

		if (this.authMappings.size === 0) {
			const msg = localize('azure.NoAuthMethod', "No azure auth method selected");
			console.log('noAuthMethodSelected');
			await vscode.window.showErrorMessage(msg);
			return { canceled: false };
		}

		if (this.authMappings.size === 1) {
			return this.getAuthMethod(undefined).login();
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
		await this.getAuthMethod(undefined)?.clearCredentials(accountKey);
	}

	autoOAuthCancelled(): Thenable<void> {
		this.authMappings.forEach(val => val.autoOAuthCancelled());
		return undefined;
	}
}
