/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, ClientOptions, SqlOpsFeature } from 'dataprotocol-client';
import { IConfig } from '@microsoft/ads-service-downloader';
import { ServerOptions, RPCMessageType, ClientCapabilities, ServerCapabilities, TransportKind } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as azdata from 'azdata';

import * as Contracts from './contracts';
import * as Constants from './constants';
import * as Utils from '../utils';

class CredentialsFeature extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		Contracts.DeleteCredentialRequest.type,
		Contracts.SaveCredentialRequest.type,
		Contracts.ReadCredentialRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, CredentialsFeature.messagesTypes);
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(Utils.ensure(capabilities, 'credentials')!, 'credentials')!.dynamicRegistration = true;
	}

	initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: any): Disposable {
		const client = this._client;

		let readCredential = (credentialId: string): Thenable<azdata.Credential> => {
			return client.sendRequest(Contracts.ReadCredentialRequest.type, { credentialId, password: undefined });
		};

		let saveCredential = (credentialId: string, password: string): Thenable<boolean> => {
			return client.sendRequest(Contracts.SaveCredentialRequest.type, { credentialId, password });
		};

		let deleteCredential = (credentialId: string): Thenable<boolean> => {
			return client.sendRequest(Contracts.DeleteCredentialRequest.type, { credentialId, password: undefined });
		};

		return azdata.credentials.registerProvider({
			deleteCredential,
			readCredential,
			saveCredential,
			handle: 0
		});
	}
}

/**
 * Implements a credential storage for Windows, Mac (darwin), or Linux.
 *
 * Allows a single credential to be stored per service (that is, one username per service);
 */
export class CredentialStore {
	private _client: SqlOpsDataClient;
	private _config: IConfig;

	constructor(private logPath: string, baseConfig: IConfig) {
		if (baseConfig) {
			this._config = JSON.parse(JSON.stringify(baseConfig));
			this._config.executableFiles = ['MicrosoftSqlToolsCredentials.exe', 'MicrosoftSqlToolsCredentials'];
		}
	}

	public async start(): Promise<void> {
		let clientOptions: ClientOptions = {
			providerId: Constants.providerId,
			features: [CredentialsFeature]
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
		let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles(this.logPath, 'credentialstore.log', executablePath);
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}
