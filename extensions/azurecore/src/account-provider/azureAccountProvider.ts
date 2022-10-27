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
	AzureAccount
} from 'azurecore';
import { Deferred } from './interfaces';
import { PublicClientApplication } from '@azure/msal-node';
import { SimpleTokenCache } from './simpleTokenCache';
import { Logger } from '../utils/Logger';
import { MultiTenantTokenResponse, Token, AzureAuth, AuthLibrary } from './auths/azureAuth';
import { AzureAuthCodeGrant } from './auths/azureAuthCodeGrant';
import { AzureDeviceCode } from './auths/azureDeviceCode';

const localize = nls.loadMessageBundle();

export class AzureAccountProvider implements azdata.AccountProvider, vscode.Disposable {
	private static readonly CONFIGURATION_SECTION = 'accounts.azure.auth';
	private readonly authMappings = new Map<AzureAuthType, AzureAuth>();
	private initComplete!: Deferred<void, Error>;
	private initCompletePromise: Promise<void> = new Promise<void>((resolve, reject) => this.initComplete = { resolve, reject });
	public clientApplication: PublicClientApplication;
	public authLibrary: AuthLibrary;

	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		clientApplication: PublicClientApplication,
		uriEventHandler: vscode.EventEmitter<vscode.Uri>,
		private readonly forceDeviceCode: boolean = false
	) {
		this.clientApplication = clientApplication;
		this.authLibrary = vscode.workspace.getConfiguration('azure').get('authenticationLibrary');
		vscode.workspace.onDidChangeConfiguration((changeEvent) => {
			const impactProvider = changeEvent.affectsConfiguration(AzureAccountProvider.CONFIGURATION_SECTION);
			if (impactProvider === true) {
				this.handleAuthMapping(metadata, tokenCache, context, uriEventHandler);
			}
			const library = changeEvent.affectsConfiguration('authenticationLibrary');
			if (library === true) {
				this.authLibrary = vscode.workspace.getConfiguration('azure').get('authenticationLibrary');
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

		const codeGrantMethod: boolean = configuration.get<boolean>('codeGrant', false);
		const deviceCodeMethod: boolean = configuration.get<boolean>('deviceCode', false);

		if (codeGrantMethod === true && !this.forceDeviceCode) {
			this.authMappings.set(AzureAuthType.AuthCodeGrant, new AzureAuthCodeGrant(metadata, tokenCache, context, uriEventHandler, this.clientApplication));
		} else if (deviceCodeMethod === true || this.forceDeviceCode) {
			this.authMappings.set(AzureAuthType.DeviceCode, new AzureDeviceCode(metadata, tokenCache, context, uriEventHandler, this.clientApplication));
		} else {
			console.error('No authentication methods selected');
		}
	}

	private getAuthMethod(account?: AzureAccount): AzureAuth {
		if (this.authMappings.size === 1) {
			return this.authMappings.values().next().value;
		}

		const authType: AzureAuthType | undefined = account?.properties?.azureAuthType;
		if (authType) {
			const authMapping = this.authMappings.get(authType);
			if (authMapping) {
				return authMapping;
			}
		}
		if (this.authMappings.size === 0) {
			throw new Error('No authentication mappings selected');
		}
		return this.authMappings.values().next().value;
	}

	initialize(storedAccounts: AzureAccount[]): Thenable<AzureAccount[]> {
		return this._initialize(storedAccounts);
	}

	private async _initialize(storedAccounts: AzureAccount[]): Promise<AzureAccount[]> {
		const accounts: AzureAccount[] = [];
		console.log(`Initializing stored accounts ${JSON.stringify(accounts)}`);
		const authLibrary = vscode.workspace.getConfiguration('azure').get('authenticationLibrary');
		const updatedAccounts = storedAccounts.filter(account => account.key.authLibrary ?? 'ADAL' === authLibrary);
		for (let account of updatedAccounts) {
			if (this.authLibrary === 'ADAL') {
				const azureAuth = this.getAuthMethod(account);
				if (!azureAuth) {
					account.isStale = true;
					accounts.push(account);
				} else {
					accounts.push(await azureAuth.refreshAccess(account));
				}
			}
			else {
				//TODO: if msal: do this
				account.isStale = false;
				accounts.push(account);
			}
		}
		this.initComplete.resolve();
		return accounts;
	}


	getSecurityToken(account: AzureAccount, resource: azdata.AzureResource): Thenable<MultiTenantTokenResponse | undefined> {
		return this._getSecurityToken(account, resource);
	}

	getAccountSecurityToken(account: AzureAccount, tenantId: string, resource: azdata.AzureResource): Thenable<Token | undefined> {
		return this._getAccountSecurityToken(account, tenantId, resource);
	}

	private async _getAccountSecurityToken(account: AzureAccount, tenantId: string, resource: azdata.AzureResource): Promise<Token | undefined> {
		await this.initCompletePromise;
		const azureAuth = this.getAuthMethod(account);
		Logger.pii(`Getting account security token for ${JSON.stringify(account.key)} (tenant ${tenantId}). Auth Method = ${azureAuth.userFriendlyName}`, [], []);
		if (this.authLibrary === 'ADAL') {
			return azureAuth?.getAccountSecurityToken(account, tenantId, resource);
		} else {
			let authResult = await azureAuth?.getTokenMsal(account.key.accountId, resource);
			if (!authResult || !authResult.account || !authResult.account.idTokenClaims) {
				Logger.error(`MSAL: getToken call failed`);
				throw Error('Failed to get token');
			} else {
				const token: Token = {
					key: authResult.account.homeAccountId,
					token: authResult.accessToken,
					tokenType: authResult.tokenType,
					expiresOn: authResult.account.idTokenClaims.exp
				};
				return token;
			}
		}
	}

	private async _getSecurityToken(account: AzureAccount, resource: azdata.AzureResource): Promise<MultiTenantTokenResponse | undefined> {
		void vscode.window.showInformationMessage(localize('azure.deprecatedGetSecurityToken', "A call was made to azdata.accounts.getSecurityToken, this method is deprecated and will be removed in future releases. Please use getAccountSecurityToken instead."));
		const azureAccount = account as AzureAccount;
		const response: MultiTenantTokenResponse = {};
		for (const tenant of azureAccount.properties.tenants) {
			response[tenant.id] = await this._getAccountSecurityToken(account, tenant.id, resource);
		}

		return response;
	}

	prompt(): Thenable<AzureAccount | azdata.PromptFailedResult> {
		return this._prompt();
	}

	private async _prompt(): Promise<AzureAccount | azdata.PromptFailedResult> {
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
			Logger.error('No auth method was enabled.');
			void vscode.window.showErrorMessage(noAuthAvailable);
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
			Logger.error('No auth method was selected.');
			void vscode.window.showErrorMessage(noAuthSelected);
			return { canceled: true };
		}

		return pick.azureAuth.startLogin();
	}
	//TODO: might need to change refresh logic based on new msal library
	refresh(account: AzureAccount): Thenable<AzureAccount | azdata.PromptFailedResult> {
		return this._refresh(account);
	}

	private async _refresh(account: AzureAccount): Promise<AzureAccount | azdata.PromptFailedResult> {
		await this._clear(account.key);
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
