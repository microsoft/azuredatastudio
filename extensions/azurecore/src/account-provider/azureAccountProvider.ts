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
	Deferred,
	AzureAccount
} from './interfaces';

import { SimpleTokenCache } from './simpleTokenCache';
import { Logger } from '../utils/Logger';
import { MultiTenantTokenResponse, Token, AzureAuth } from './auths/azureAuth';
import { AzureAuthCodeGrant } from './auths/azureAuthCodeGrant';
import { AzureDeviceCode } from './auths/azureDeviceCode';

const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements azdata.AccountProvider, vscode.Disposable {
	private static readonly CONFIGURATION_SECTION = 'accounts.azure.auth';
	private readonly authMappings = new Map<AzureAuthType, AzureAuth>();
	private initComplete: Deferred<void, Error>;
	private initCompletePromise: Promise<void> = new Promise<void>((resolve, reject) => this.initComplete = { resolve, reject });

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		uriEventHandler: vscode.EventEmitter<vscode.Uri>,
		private readonly forceDeviceCode: boolean = false
	) {
		vscode.workspace.onDidChangeConfiguration((changeEvent) => {
			const impact = changeEvent.affectsConfiguration(AzureAccountProvider.CONFIGURATION_SECTION);
			if (impact === true) {
				this.handleAuthMapping(metadata, tokenCache, context, uriEventHandler);
			}
		});

		this.handleAuthMapping(metadata, tokenCache, context, uriEventHandler);
	}

	dispose() {
		this.authMappings.forEach(x => x.dispose());
	}

	clearTokenCache(): Thenable<void> {
		return this.getAuthMethod().deleteAllCache();
	}

	private handleAuthMapping(metadata: AzureAccountProviderMetadata, tokenCache: SimpleTokenCache, context: vscode.ExtensionContext, uriEventHandler: vscode.EventEmitter<vscode.Uri>) {
		this.authMappings.forEach(m => m.dispose());
		this.authMappings.clear();
		const configuration = vscode.workspace.getConfiguration(AzureAccountProvider.CONFIGURATION_SECTION);

		const codeGrantMethod: boolean = configuration.get('codeGrant');
		const deviceCodeMethod: boolean = configuration.get('deviceCode');

		if (codeGrantMethod === true && !this.forceDeviceCode) {
			this.authMappings.set(AzureAuthType.AuthCodeGrant, new AzureAuthCodeGrant(metadata, tokenCache, context, uriEventHandler));
		}
		if (deviceCodeMethod === true || this.forceDeviceCode) {
			this.authMappings.set(AzureAuthType.DeviceCode, new AzureDeviceCode(metadata, tokenCache, context, uriEventHandler));
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
			return this.authMappings.values().next().value;
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


	getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Thenable<MultiTenantTokenResponse | undefined> {
		return this._getSecurityToken(account, resource);
	}

	getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Thenable<Token | undefined> {
		return this._getAccountSecurityToken(account, tenant, resource);
	}

	private async _getAccountSecurityToken(account: azdata.Account, tenant: string, resource: azdata.AzureResource): Promise<Token | undefined> {
		await this.initCompletePromise;
		const azureAuth = this.getAuthMethod(undefined);
		return azureAuth?.getAccountSecurityToken(account, tenant, resource);
	}

	private async _getSecurityToken(account: azdata.Account, resource: azdata.AzureResource): Promise<MultiTenantTokenResponse | undefined> {
		vscode.window.showInformationMessage(localize('azure.deprecatedGetSecurityToken', "A call was made to azdata.accounts.getSecurityToken, this method is deprecated and will be removed in future releases. Please use getAccountSecurityToken instead."));
		const azureAccount = account as AzureAccount;
		const response: MultiTenantTokenResponse = {};
		for (const tenant of azureAccount.properties.tenants) {
			response[tenant.id] = await this._getAccountSecurityToken(account, tenant.id, resource);
		}

		return response;
	}

	prompt(): Thenable<azdata.Account | azdata.PromptFailedResult> {
		return this._prompt();
	}

	private async _prompt(): Promise<azdata.Account | azdata.PromptFailedResult> {
		const noAuthSelected = localize('azure.NoAuthMethod.Selected', "No Azure auth method selected. You must select what method of authentication you want to use.");
		const noAuthAvailable = localize('azure.NoAuthMethod.Available', "No Azure auth method available. You must enable the auth methods in ADS configuration.");

		await this.initCompletePromise;
		class Option implements vscode.QuickPickItem {
			public readonly label: string;
			constructor(public readonly azureAuth: AzureAuth) {
				this.label = azureAuth.userFriendlyName;
			}
		}

		if (this.authMappings.size === 0) {
			Logger.log('No auth method was enabled.');
			vscode.window.showErrorMessage(noAuthAvailable);
			return { canceled: true };
		}

		if (this.authMappings.size === 1) {
			return this.getAuthMethod(undefined).startLogin();
		}

		const options: Option[] = [];
		this.authMappings.forEach((azureAuth) => {
			options.push(new Option(azureAuth));
		});

		const pick = await vscode.window.showQuickPick(options, { canPickMany: false });

		if (!pick) {
			Logger.log('No auth method was selected.');
			vscode.window.showErrorMessage(noAuthSelected);
			return { canceled: true };
		}

		return pick.azureAuth.startLogin();
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
		return Promise.resolve();
	}
}
