/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import {
	AzureAuth,
	TokenClaims,
	AccessToken,
	RefreshToken

} from './azureAuth';

import {
	AzureAccountProviderMetadata,
	AzureAccount,
	AzureAuthType,
	// Tenant,
	// Subscription
} from '../interfaces';

import { SimpleTokenCache } from '../simpleTokenCache';
const localize = nls.loadMessageBundle();

interface DeviceCodeLogin { // https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code
	device_code: string,
	expires_in: number;
	interval: number;
	message: string;
	user_code: string;
	verification_url: string
}

interface DeviceCodeLoginResult {
	token_type: string,
	scope: string,
	expires_in: number,
	access_token: string,
	refresh_token: string,
}

export class AzureDeviceCode extends AzureAuth {

	private static readonly USER_FRIENDLY_NAME: string = localize('azure.azureDeviceCodeAuth', "Azure Device Code");
	private readonly pageTitle: string;
	constructor(
		metadata: AzureAccountProviderMetadata,
		tokenCache: SimpleTokenCache,
		context: vscode.ExtensionContext,
		uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
	) {
		super(metadata, tokenCache, context, uriEventEmitter, AzureAuthType.AuthCodeGrant, AzureDeviceCode.USER_FRIENDLY_NAME);
		this.pageTitle = localize('addAccount', "Add {0} account", this.metadata.displayName);

	}

	public async login(): Promise<AzureAccount | azdata.PromptFailedResult> {
		try {
			const uri = `${this.loginEndpointUrl}/${this.commonTenant}/oauth2/devicecode`;
			const postResult = await this.makePostRequest(uri, {
				client_id: this.clientId,
				resource: this.metadata.settings.signInResourceId
			});

			const initialDeviceLogin: DeviceCodeLogin = postResult.data;

			await azdata.accounts.beginAutoOAuthDeviceCode(this.metadata.id, this.pageTitle, initialDeviceLogin.message, initialDeviceLogin.user_code, initialDeviceLogin.verification_url);

			const finalDeviceLogin = await this.setupPolling(initialDeviceLogin);

			let tokenClaims: TokenClaims;
			let accessToken: AccessToken;
			let refreshToken: RefreshToken;
			// let tenants: Tenant[];
			// let subscriptions: Subscription[];

			tokenClaims = this.getTokenClaims(finalDeviceLogin.access_token);

			accessToken = {
				token: finalDeviceLogin.access_token,
				key: tokenClaims.email || tokenClaims.unique_name || tokenClaims.name,
			};

			refreshToken = {
				token: finalDeviceLogin.refresh_token,
				key: accessToken.key,
			};

			await this.setCachedToken({ accountId: accessToken.key, providerId: this.metadata.id }, accessToken, refreshToken);

			const tenants = await this.getTenants(accessToken);
			const account = this.createAccount(tokenClaims, accessToken.key, tenants);
			const subscriptions = await this.getSubscriptions(account);
			account.properties.subscriptions = subscriptions;
			return account;
		} catch (ex) {
			console.log(ex);
			if (ex.msg) {
				vscode.window.showErrorMessage(ex.msg);
			}
			return { canceled: false };
		} finally {
			azdata.accounts.endAutoOAuthDeviceCode();
		}
	}


	private setupPolling(info: DeviceCodeLogin): Promise<DeviceCodeLoginResult> {
		const timeoutMessage = localize('azure.timeoutDeviceCode', 'Timed out when waiting for device code login.');
		const fiveMinutes = 5 * 60 * 1000;

		return new Promise<DeviceCodeLoginResult | undefined>((resolve, reject) => {
			let timeout: NodeJS.Timer;

			const timer = setInterval(async () => {
				const x = await this.checkForResult(info);
				if (!x.access_token) {
					return;
				}
				clearTimeout(timeout);
				clearInterval(timer);
				resolve(x);
			}, info.interval * 1000);

			timeout = setTimeout(() => {
				clearInterval(timer);
				reject(new Error(timeoutMessage));
			}, fiveMinutes);
		});
	}

	private async checkForResult(info: DeviceCodeLogin): Promise<DeviceCodeLoginResult> {
		const msg = localize('azure.deviceCodeCheckFail', "Error encountered when trying to check for login results");
		try {
			const uri = `${this.loginEndpointUrl}/${this.commonTenant}/oauth2/token`;
			const postData = {
				grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
				client_id: this.clientId,
				tenant: this.commonTenant,
				code: info.device_code
			};

			const postResult = await this.makePostRequest(uri, postData, true);

			const result: DeviceCodeLoginResult = postResult.data;

			return result;
		} catch (ex) {
			console.log(ex);
			throw new Error(msg);
		}
	}


	public async autoOAuthCancelled(): Promise<void> {
		return azdata.accounts.endAutoOAuthDeviceCode();
	}

}
