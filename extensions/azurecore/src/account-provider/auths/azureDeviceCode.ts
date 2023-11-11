/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import {
	AzureAuth
} from './azureAuth';
import {
	AzureAccountProviderMetadata,
	AzureAuthType,
	Tenant,
	Resource
} from 'azurecore';
import { Deferred } from '../interfaces';
import { AuthenticationResult, DeviceCodeRequest, PublicClientApplication } from '@azure/msal-node';
import { Logger } from '../../utils/Logger';
import { MsalCachePluginProvider } from '../utils/msalCachePlugin';

const localize = nls.loadMessageBundle();

export class AzureDeviceCode extends AzureAuth {
	private static readonly USER_FRIENDLY_NAME: string = localize('azure.azureDeviceCodeAuth', "Azure Device Code");
	private readonly pageTitle: string;
	constructor(
		metadata: AzureAccountProviderMetadata,
		msalCacheProvider: MsalCachePluginProvider,
		context: vscode.ExtensionContext,
		uriEventEmitter: vscode.EventEmitter<vscode.Uri>,
		clientApplication: PublicClientApplication
	) {
		super(metadata, msalCacheProvider, context, clientApplication, uriEventEmitter, AzureAuthType.DeviceCode, AzureDeviceCode.USER_FRIENDLY_NAME);
		this.pageTitle = localize('addAccount', "Add {0} account", this.metadata.displayName);
	}

	protected async login(tenant: Tenant, resource: Resource): Promise<{ response: AuthenticationResult | null, authComplete: Deferred<void, Error> }> {
		let authCompleteDeferred: Deferred<void, Error>;
		let authCompletePromise = new Promise<void>((resolve, reject) => authCompleteDeferred = { resolve, reject });

		const deviceCodeRequest: DeviceCodeRequest = {
			scopes: this.scopes,
			authority: `${this.loginEndpointUrl}${tenant.id}`,
			deviceCodeCallback: async (response) => {
				await azdata.accounts.beginAutoOAuthDeviceCode(this.metadata.id, this.pageTitle, response.message, response.userCode, response.verificationUri);
			}
		};
		const authResult = await this.clientApplication.acquireTokenByDeviceCode(deviceCodeRequest);
		this.closeOnceComplete(authCompletePromise).catch(Logger.error);

		return {
			response: authResult,
			authComplete: authCompleteDeferred!
		};
	}

	private async closeOnceComplete(promise: Promise<void>): Promise<void> {
		await promise;
		azdata.accounts.endAutoOAuthDeviceCode();
	}

	public override async autoOAuthCancelled(): Promise<void> {
		return azdata.accounts.endAutoOAuthDeviceCode();
	}
}
