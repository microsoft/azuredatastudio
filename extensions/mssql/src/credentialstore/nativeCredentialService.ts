/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature, SqlOpsFeature } from 'dataprotocol-client';
import * as Utils from '../utils';
import { ClientCapabilities, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import * as Contracts from './contracts';
import { Disposable, SecretStorage, workspace } from 'vscode';
import * as azdata from 'azdata';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

export class NativeCredentialService extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		Contracts.DeleteCredentialRequest.type,
		Contracts.SaveCredentialRequest.type,
		Contracts.ReadCredentialRequest.type
	];

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends NativeCredentialService {
			private _secretStorage: SecretStorage;
			private _useNativeCredentialService: boolean;
			private _passwordsMigrated: boolean;

			constructor(client: SqlOpsDataClient) {
				super(context, client);
				this._secretStorage = context.extensionContext.secrets;
				this._passwordsMigrated = context.extensionContext.globalState.get(Utils.configPasswordsMigrated);
				this._useNativeCredentialService = workspace.getConfiguration('workbench').get(Utils.configUseNativeCredentials);
			}

			override fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(Utils.ensure(capabilities, 'credentials')!, 'credentials')!.dynamicRegistration = true;
			}

			override initialize(capabilities: ServerCapabilities): void {
				this.register(this.messages, {
					id: UUID.generateUuid(),
					registerOptions: undefined
				});
			}

			/**
			 * Removes a credential for a given connection profile from sqltoolsservice
			 * and adds it to keytar
			 */
			private async cleanCredential(conn: azdata.connection.ConnectionProfile): Promise<boolean> {
				const credentialId = Utils.formatCredentialId(conn);
				// read password from every saved password connection
				const credential = await this._client.sendRequest(Contracts.ReadCredentialRequest.type, { credentialId, password: undefined });
				if (credential.password) {
					const password = credential.password;
					// save it in keychain
					await this._secretStorage.store(credentialId, password);
					// check if it's saved
					const savedPassword = await this._secretStorage.get(credentialId);
					if (savedPassword === password) {
						// delete from tools service
						const result = await this._client.sendRequest(Contracts.DeleteCredentialRequest.type,
							{ credentialId, password: undefined });
						return result;
					} else {
						return false;
					}
				} else {
					return false;
				}
			}

			/**
			 *
			 * @returns Migrates all saved credentials to the new credential system
			 */
			private async migratePasswords(): Promise<boolean> {
				const connections = await azdata.connection.getConnections(false);
				const savedPasswordConnections = connections.filter(conn => conn.savePassword === true);
				for (let i = 0; i < savedPasswordConnections.length; i++) {
					let conn = savedPasswordConnections[i];
					await this.cleanCredential(conn);
				}
				await Utils.removeCredentialFile();
				return true;
			}

			private registerNativeCredentialProvider(): Disposable {

				let readCredential = async (credentialId: string): Promise<azdata.Credential> => {
					if (this._useNativeCredentialService) {
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
					if (this._useNativeCredentialService) {
						await this._secretStorage.store(credentialId, password);
						return password === await this._secretStorage.get(credentialId);
					} else {
						return this._client.sendRequest(Contracts.SaveCredentialRequest.type, { credentialId, password });
					}
				};

				let deleteCredential = async (credentialId: string): Promise<boolean> => {
					if (this._useNativeCredentialService) {
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

			protected override registerProvider(options: any): Disposable {
				if (this._useNativeCredentialService && !this._passwordsMigrated) {
					this.migratePasswords().then(async (success) => {
						if (success) {
							await context.extensionContext.globalState.update(Utils.configPasswordsMigrated, true);
						}
					}).catch((e) => { throw e; });
					return this.registerNativeCredentialProvider();
				} else {
					return this.registerNativeCredentialProvider();
				}
			}
		};
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(capabilities: ServerCapabilities): void { }

	protected registerProvider(options: any): Disposable { return undefined; }

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, NativeCredentialService.messagesTypes);
	}

}
