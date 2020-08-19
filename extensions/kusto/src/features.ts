/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import { Telemetry } from './telemetry';
import * as contracts from './contracts';
import * as azdata from 'azdata';
import * as Utils from './utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';

export class TelemetryFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(capabilities, 'telemetry')!.telemetry = true;
	}

	initialize(): void {
		this._client.onNotification(contracts.TelemetryNotification.type, e => {
			Telemetry.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
		});
	}
}

export class SerializationFeature extends SqlOpsFeature<undefined> {
	private static readonly messageTypes: RPCMessageType[] = [
		contracts.SerializeDataStartRequest.type,
		contracts.SerializeDataContinueRequest.type,
	];

	constructor(client: SqlOpsDataClient) {
		super(client, SerializationFeature.messageTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
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
