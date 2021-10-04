/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as contracts from './contracts';
import * as azdata from 'azdata';
import * as Utils from '../utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

export class SerializationFeature extends SqlOpsFeature<undefined> {
	private static readonly messageTypes: RPCMessageType[] = [
		contracts.SerializeDataStartRequest.type,
		contracts.SerializeDataContinueRequest.type,
	];

	constructor(client: SqlOpsDataClient) {
		super(client, SerializationFeature.messageTypes);
	}

	public fillClientCapabilities(_capabilities: ClientCapabilities): void {
	}

	public initialize(_capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(_options: undefined): Disposable {
		const client = this._client;

		let startSerialization = (requestParams: azdata.SerializeDataStartRequestParams): Thenable<azdata.SerializeDataResult> => {
			return client.sendRequest(contracts.SerializeDataStartRequest.type, requestParams).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SerializeDataStartRequest.type, e);
					return Promise.resolve(<azdata.SerializeDataResult>{
						succeeded: false,
						messages: Utils.getErrorMessage(e)
					});
				}
			);
		};

		let continueSerialization = (requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> => {
			return client.sendRequest(contracts.SerializeDataContinueRequest.type, requestParams).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SerializeDataContinueRequest.type, e);
					return Promise.resolve(<azdata.SerializeDataResult>{
						succeeded: false,
						messages: Utils.getErrorMessage(e)
					});
				}
			);
		};

		return azdata.dataprotocol.registerSerializationProvider({
			providerId: client.providerId,
			startSerialization,
			continueSerialization
		});
	}
}
