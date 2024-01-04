/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature, SqlOpsFeature } from 'dataprotocol-client';
import * as Utils from '../utils';
import { ClientCapabilities, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import * as Contracts from './contracts';
import { Disposable, SecretStorage } from 'vscode';
import * as azdata from 'azdata';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

export class SqlCredentialService extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		Contracts.DeleteCredentialRequest.type,
		Contracts.SaveCredentialRequest.type,
		Contracts.ReadCredentialRequest.type
	];

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends SqlCredentialService {
			private _secretStorage: SecretStorage;

			constructor(client: SqlOpsDataClient) {
				super(context, client);
				this._secretStorage = context.extensionContext.secrets;
			}

			override fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(Utils.ensure(capabilities, 'credentials')!, 'credentials')!.dynamicRegistration = true;
			}

			override async initialize(capabilities: ServerCapabilities): Promise<void> {
				this.register(this.messages, {
					id: UUID.generateUuid(),
					registerOptions: undefined
				});
			}


			protected override registerProvider(options: any): Disposable {
				let readCredential = async (credentialId: string): Promise<azdata.Credential> => {
					if (Utils.isLinux) {
						const password = await this._secretStorage.get(credentialId);
						return {
							credentialId: credentialId,
							password: password || ''
						};
					}
					return this._client.sendRequest(Contracts.ReadCredentialRequest.type, { credentialId });
				};

				let saveCredential = async (credentialId: string, password: string): Promise<boolean> => {
					if (Utils.isLinux) {
						await this._secretStorage.store(credentialId, password);
						return true;
					}
					return this._client.sendRequest(Contracts.SaveCredentialRequest.type, { credentialId, password });
				};

				let deleteCredential = async (credentialId: string): Promise<boolean> => {
					if (Utils.isLinux) {
						try {
							await this._secretStorage.delete(credentialId);
							return true;
						} catch (e) {
							console.log('credential does not exist in native secret store');
						}
					}
					return this._client.sendRequest(Contracts.DeleteCredentialRequest.type, { credentialId });
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

	protected registerProvider(options: any): Disposable {
		return {
			dispose: () => { }
		}
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, SqlCredentialService.messagesTypes);
	}

}
