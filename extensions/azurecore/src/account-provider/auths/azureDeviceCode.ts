/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import {
	AzureAuth,
	OAuthTokenResponse,
	DeviceCodeStartPostData,
	DeviceCodeCheckPostData,

} from './azureAuth';

import {
	AzureAccountProviderMetadata,
	AzureAuthType,
	Tenant,
	Resource,
	Deferred,
	// Tenant,
	// Subscription
} from '../interfaces';

import { SimpleTokenCache } from '../simpleTokenCache';
import { Logger } from '../../utils/Logger';
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
	protected async login(tenant: Tenant, resource: Resource): Promise<{ response: OAuthTokenResponse, authComplete: Deferred<void, Error> }> {
		let authCompleteDeferred: Deferred<void, Error>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });

		const uri = `${this.loginEndpointUrl}/${this.commonTenant.id}/oauth2/devicecode`;
		const postData: DeviceCodeStartPostData = {
			client_id: this.clientId,
			resource: resource.endpoint
		};

		const postResult = await this.makePostRequest(uri, postData);

		const initialDeviceLogin: DeviceCodeLogin = postResult.data;

		await azdata.accounts.beginAutoOAuthDeviceCode(this.metadata.id, this.pageTitle, initialDeviceLogin.message, initialDeviceLogin.user_code, initialDeviceLogin.verification_url);

		const finalDeviceLogin = await this.setupPolling(initialDeviceLogin);

		const accessTokenString = finalDeviceLogin.access_token;
		const refreshTokenString = finalDeviceLogin.refresh_token;

		const currentTime = new Date().getTime() / 1000;
		const expiresOn = `${currentTime + finalDeviceLogin.expires_in}`;

		const result = await this.getTokenHelper(tenant, resource, accessTokenString, refreshTokenString, expiresOn);
		this.closeOnceComplete(authCompletePromise).catch(Logger.error);

		return {
			response: result,
			authComplete: authCompleteDeferred
		};
	}

	private async closeOnceComplete(promise: Promise<void>): Promise<void> {
		await promise;
		azdata.accounts.endAutoOAuthDeviceCode();
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
			const postData: DeviceCodeCheckPostData = {
				grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
				client_id: this.clientId,
				tenant: this.commonTenant.id,
				code: info.device_code
			};

			const postResult = await this.makePostRequest(uri, postData);

			const result: DeviceCodeLoginResult = postResult.data;

			return result;
		} catch (ex) {
			console.log(ex);
			console.log('Unexpected error making Azure auth request', 'azureCore.checkForResult', JSON.stringify(ex?.response?.data, undefined, 2));
			throw new Error(msg);
		}
	}


	public async autoOAuthCancelled(): Promise<void> {
		return azdata.accounts.endAutoOAuthDeviceCode();
	}
}
