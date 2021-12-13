/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { SqlOpsDataClient, ClientOptions, SqlOpsFeature } from 'dataprotocol-client';
import { IConfig } from '@microsoft/ads-service-downloader';
import { ClientCapabilities, RPCMessageType, ServerCapabilities, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as Constants from './constants';
import * as Utils from '../utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
//import { SqlCredentialService } from './sqlCredentialService';
import { AppContext } from '../appContext';
import { DeleteCredentialRequest, ReadCredentialRequest, SaveCredentialRequest } from './contracts';
import { Disposable } from 'vscode';
import { SqlCredentialService } from './sqlCredentialService';

/**
 * Implements a credential storage for Windows, Mac (darwin), or Linux.
 *
 * Allows a single credential to be stored per service (that is, one username per service);
 */
export class CredentialStore {
	private _client: SqlOpsDataClient;
	private _config: IConfig;
	private _logPath: string;

	constructor(
		private context: AppContext,
		baseConfig: IConfig
	) {
		if (baseConfig) {
			this._config = JSON.parse(JSON.stringify(baseConfig));
			this._config.executableFiles = ['MicrosoftSqlToolsCredentials.exe', 'MicrosoftSqlToolsCredentials'];
		}
		this.context = context;
		this._logPath = this.context.extensionContext.logPath;
	}

	public async start(): Promise<void> {
		let clientOptions: ClientOptions = {
			providerId: Constants.providerId,
			features: [SqlCredentialService.asFeature(this.context)]
		};
		const serverPath = await Utils.getOrDownloadServer(this._config);
		const serverOptions = this.generateServerOptions(serverPath);
		this._client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		this._client.start();
	}

	async dispose(): Promise<void> {
		if (this._client) {
			await this._client.stop();
		}
	}

	private generateServerOptions(executablePath: string): ServerOptions {
		let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles(this._logPath, 'credentialstore.log', executablePath);
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}

// class CredentialsFeature extends SqlOpsFeature<any> {

// 	private static readonly messagesTypes: RPCMessageType[] = [
// 		DeleteCredentialRequest.type,
// 		SaveCredentialRequest.type,
// 		ReadCredentialRequest.type
// 	];

// 	constructor(client: SqlOpsDataClient) {
// 		super(client, CredentialsFeature.messagesTypes);
// 	}

// 	fillClientCapabilities(capabilities: ClientCapabilities): void {
// 		Utils.ensure(Utils.ensure(capabilities, 'credentials')!, 'credentials')!.dynamicRegistration = true;
// 	}

// 	initialize(capabilities: ServerCapabilities): void {
// 		this.register(this.messages, {
// 			id: UUID.generateUuid(),
// 			registerOptions: undefined
// 		});
// 	}

// 	protected registerProvider(options: any): Disposable {
// 		const client = this._client;

// 		let readCredential = (credentialId: string): Thenable<azdata.Credential> => {
// 			return client.sendRequest(ReadCredentialRequest.type, { credentialId, password: undefined });
// 		};

// 		let saveCredential = (credentialId: string, password: string): Thenable<boolean> => {
// 			return client.sendRequest(SaveCredentialRequest.type, { credentialId, password });
// 		};

// 		let deleteCredential = (credentialId: string): Thenable<boolean> => {
// 			return client.sendRequest(DeleteCredentialRequest.type, { credentialId, password: undefined });
// 		};

// 		return azdata.credentials.registerProvider({
// 			deleteCredential,
// 			readCredential,
// 			saveCredential,
// 			handle: 0
// 		});
// 	}
// }
