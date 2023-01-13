/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as mssql from 'mssql';
import { ISqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import * as constants from '../constants';
import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ClientCapabilities } from 'vscode-languageclient';

export const diagnosticsId = 'azurediagnostics'
export const serviceName = 'AzureDiagnostics';

export class ErrorDiagnosticsService implements mssql.IErrorDiagnosticsService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ErrorDiagnosticsService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
			}
		};
	}

	public constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.ErrorDiagnosticsService, this);
	}

	async handleErrorCode(errorCode: number, errorMessage: string): Promise<mssql.ErrorDiagnosticsResponse> {
		const params: contracts.ErrorDiagnosticsParameters = { errorCode, errorMessage };
		return this.client.sendRequest(contracts.DiagnosticsRequest.type, params).then(
			undefined,
			e => {
				this.client.logFailedRequest(contracts.DiagnosticsRequest.type, e);
				return Promise.resolve(undefined);
			}
		)
	}

	// private async registerDiagnosticProvider(provider: ProviderSettings): Promise<void> {
	// 	const isSaw: boolean = vscode.env.appName.toLowerCase().indexOf(Constants.Saw) > 0;
	// 	const noSystemKeychain = vscode.workspace.getConfiguration(Constants.AzureSection).get<boolean>(Constants.NoSystemKeyChainSection);
	// 	const tokenCacheKey = `azureTokenCache-${provider.metadata.id}`;
	// 	const tokenCacheKeyMsal = `azureTokenCacheMsal-${provider.metadata.id}`;
	// 	try {
	// 		if (!this._credentialProvider) {
	// 			throw new Error('Credential provider not registered');
	// 		}

	// 		// ADAL Token Cache
	// 		let simpleTokenCache = new SimpleTokenCache(tokenCacheKey, this._userStoragePath, noSystemKeychain, this._credentialProvider);
	// 		await simpleTokenCache.init();

	// 		// MSAL Cache Plugin
	// 		this._cachePluginProvider = new MsalCachePluginProvider(tokenCacheKeyMsal, this._userStoragePath);

	// 		const msalConfiguration: Configuration = {
	// 			auth: {
	// 				clientId: provider.metadata.settings.clientId,
	// 				authority: 'https://login.windows.net/common'
	// 			},
	// 			system: {
	// 				loggerOptions: {
	// 					loggerCallback: this.getLoggerCallback(),
	// 					logLevel: MsalLogLevel.Trace,
	// 					piiLoggingEnabled: true,
	// 				},
	// 			},
	// 			cache: {
	// 				cachePlugin: this._cachePluginProvider?.getCachePlugin()
	// 			}
	// 		}

	// 		this.clientApplication = new PublicClientApplication(msalConfiguration);
	// 		let accountProvider = new AzureAccountProvider(provider.metadata as AzureAccountProviderMetadata,
	// 			simpleTokenCache, this._context, this.clientApplication, this._uriEventHandler, this._authLibrary, isSaw);
	// 		this._accountProviders[provider.metadata.id] = accountProvider;
	// 		this._accountDisposals[provider.metadata.id] = azdata.accounts.registerAccountProvider(provider.metadata, accountProvider);
	// 	} catch (e) {
	// 		console.error(`Failed to register account provider, isSaw: ${isSaw}: ${e}`);
	// 	}
	// }
}
