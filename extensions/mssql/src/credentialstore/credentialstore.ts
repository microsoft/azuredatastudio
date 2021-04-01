/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, ClientOptions, SqlOpsFeature } from 'dataprotocol-client';
import { IConfig, ServerProvider } from 'service-downloader';
import { ServerOptions, RPCMessageType, ClientCapabilities, ServerCapabilities, TransportKind } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as azdata from 'azdata';

import * as Contracts from './contracts';
import * as Constants from './constants';
import * as Utils from '../utils';
import { Keychain } from './keychain';

class CredentialsFeature extends SqlOpsFeature<any> {

	private keychain: Keychain;

	private static readonly messagesTypes: RPCMessageType[] = [
		Contracts.DeleteCredentialRequest.type,
		Contracts.SaveCredentialRequest.type,
		Contracts.ReadCredentialRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, CredentialsFeature.messagesTypes);
		this.keychain = new Keychain();
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

	private migrateCredentials(): Thenable<boolean> {
		return azdata.connection.getConnections(false).then((connections) => {
			const savedPasswordConnections = connections.filter(conn => conn.savePassword === true);
			return new Promise((resolve, reject) => {
				savedPasswordConnections.forEach(async (conn) => {
					const credentialId = Utils.formatCredentialId(conn);
					// read password from every saved password connection
					this._client.sendRequest(Contracts.ReadCredentialRequest.type, { credentialId, password: undefined }).then((credential) => {
						if (credential) {
							const password = credential.password;
							// save it in keychain
							this.keychain.setPassword(credentialId, password).then(() => {
								// check if it's saved
								this.keychain.getPassword(credentialId).then((savedPassword) => {
									if (savedPassword === password) {
										// delete from tools service
										this._client.sendRequest(Contracts.DeleteCredentialRequest.type,
											{ credentialId, password: undefined }).then((result) => resolve(result));
									} else {
										reject('Password couldn\'t be saved');
									}
								});
							});
						}
					});
				});
			});
		});
	}

	private registerKeytarProvider(options: any): Disposable {

		let readCredential = (credentialId: string): Thenable<azdata.Credential> => {
			return this.keychain.getPassword(credentialId).then((password) => {
				if (password) {
					const credential: azdata.Credential = {
						credentialId: credentialId,
						password: password
					};
					return credential;
				}
				return undefined;
			});
		};

		let saveCredential = (credentialId: string, password: string): Thenable<boolean> => {
			return this.keychain.setPassword(credentialId, password).then(() => {
				return this.keychain.getPassword(credentialId).then((savedPassword) => {
					return savedPassword === password;
				});
			});
		};

		let deleteCredential = (credentialId: string): Thenable<boolean> => {
			return this.keychain.deletePassword(credentialId);
		};

		return azdata.credentials.registerProvider({
			deleteCredential,
			readCredential,
			saveCredential,
			handle: 0
		});
	}

	private registerToolsServiceProvider(options: any): Disposable {
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

	protected registerProvider(options: any): Disposable {
		if (Utils.keytarCredentialsEnabled() && !Utils.migrateLinuxCredentials()) {
			return this.registerKeytarProvider(options);
		} else if (Utils.keytarCredentialsEnabled() && Utils.migrateLinuxCredentials()) {
			this.migrateCredentials().then((result) => {
				if (result) {
					Utils.disableCredentialMigration();
				}
			});
			return this.registerKeytarProvider(options);
		} else {
			return this.registerToolsServiceProvider(options);
		}
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

	public start() {
		let serverdownloader = new ServerProvider(this._config);
		let clientOptions: ClientOptions = {
			providerId: Constants.providerId,
			features: [CredentialsFeature]
		};
		return serverdownloader.getOrDownloadServer().then(e => {
			let serverOptions = this.generateServerOptions(e);
			this._client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
			this._client.start();
		});
	}

	dispose() {
		if (this._client) {
			this._client.stop();
		}
	}

	private generateServerOptions(executablePath: string): ServerOptions {
		let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles(this.logPath, 'credentialstore.log', executablePath);
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}
