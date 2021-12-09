/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature, SqlOpsFeature } from 'dataprotocol-client';
import * as Utils from '../utils';
import { ClientCapabilities, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import * as Contracts from './contracts';
import { Disposable, SecretStorage } from 'vscode';
import * as azdata from 'azdata';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Deferred } from '../types';

export class SqlCredentialService extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		Contracts.DeleteCredentialRequest.type,
		Contracts.SaveCredentialRequest.type,
		Contracts.ReadCredentialRequest.type
	];

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SqlCredentialService {
			private _secretStorage: SecretStorage;
			private _useNativeCredentialService: boolean;
			private _passwordsMigrated: boolean;
			private _passwordsMigratedPromise: Deferred<void>;

			constructor(client: SqlOpsDataClient) {
				super(context, client);
				this._secretStorage = context.extensionContext.secrets;
				this._passwordsMigrated = context.extensionContext.globalState.get(Utils.configPasswordsMigrated);
				this._useNativeCredentialService = Utils.useNativeCredentialsEnabled();
				this._passwordsMigratedPromise = new Deferred();
			}

			override fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(Utils.ensure(capabilities, 'credentials')!, 'credentials')!.dynamicRegistration = true;
			}

			override async initialize(capabilities: ServerCapabilities): Promise<void> {
				this.register(this.messages, {
					id: UUID.generateUuid(),
					registerOptions: undefined
				});
				if (this._useNativeCredentialService && !this._passwordsMigrated) {
					await this.migratePasswords();
					this._passwordsMigrated = true;
					await context.extensionContext.globalState.update(Utils.configPasswordsMigrated, this._passwordsMigrated);
					this._passwordsMigratedPromise.resolve();
				}
			}

			/**
			 * Removes a credential for a given connection profile from sqltoolsservice
			 * and adds it to secret storage
			 */
			private async migrateCredential(conn: azdata.connection.ConnectionProfile): Promise<void> {
				const credentialId = Utils.formatCredentialId(conn);
				// read password from every saved password connection
				const credential = await this._client.sendRequest(Contracts.ReadCredentialRequest.type, { credentialId, password: undefined });
				if (credential.password) {
					const password = credential.password;
					// save it in secret store
					await this._secretStorage.store(credentialId, password);
					// check if it's saved
					const savedPassword = await this._secretStorage.get(credentialId);
					if (savedPassword === password) {
						// delete from tools service
						await this._client.sendRequest(Contracts.DeleteCredentialRequest.type,
							{ credentialId, password: undefined });
					}
				}
			}

			/**
			 *
			 * @returns Migrates all saved credentials to the native credential system
			 */
			private async migratePasswords(): Promise<void> {
				const connections = await azdata.connection.getConnections(false);
				const savedPasswordConnections = connections.filter(conn => conn.savePassword === true);
				for (let i = 0; i < savedPasswordConnections.length; i++) {
					let conn = savedPasswordConnections[i];
					try {
						await this.migrateCredential(conn);
					} catch (e) {
						console.log(`Migrate credential failed for connection ${conn.connectionName}`);
					}

				}
				await Utils.removeCredentialFile();
			}

			protected override registerProvider(options: any): Disposable {
				let readCredential = async (credentialId: string): Promise<azdata.Credential> => {
					if (this._useNativeCredentialService && this._passwordsMigrated) {
						await this._passwordsMigratedPromise;
						const password = await this._secretStorage.get(credentialId);
						const credential: azdata.Credential = {
							credentialId: credentialId,
							password: password
						};
						return credential;
					} else {
						// just use the existing, old credential service
						return this._client.sendRequest(Contracts.ReadCredentialRequest.type, { credentialId, password: undefined });
					}
				};

				let saveCredential = async (credentialId: string, password: string): Promise<boolean> => {
					if (this._useNativeCredentialService && this._passwordsMigrated) {
						await this._passwordsMigratedPromise;
						await this._secretStorage.store(credentialId, password);
						return password === await this._secretStorage.get(credentialId);
					} else {
						return this._client.sendRequest(Contracts.SaveCredentialRequest.type, { credentialId, password });
					}
				};

				let deleteCredential = async (credentialId: string): Promise<boolean> => {
					if (this._useNativeCredentialService && this._passwordsMigrated) {
						await this._passwordsMigratedPromise;
						await this._secretStorage.delete(credentialId);
					}
					return this._client.sendRequest(Contracts.DeleteCredentialRequest.type, { credentialId, password: undefined });
				};

				return azdata.credentials.registerProvider({
					deleteCredential,
					readCredential,
					saveCredential,
					handle: 0
				});
			}
		};
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(capabilities: ServerCapabilities): void { }

	protected registerProvider(options: any): Disposable { return undefined; }

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, SqlCredentialService.messagesTypes);
	}

}
