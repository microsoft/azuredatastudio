/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ServerCapabilities, ClientCapabilities, RPCMessageType } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as Contracts from './contracts';
import * as azdata from 'azdata';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { DiagnosticsParameters, DiagnosticsRequest } from './contracts';
import * as Utils from '../utils';


export class DiagnosticsFeature extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		DiagnosticsRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, DiagnosticsFeature.messagesTypes);
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(Utils.ensure(capabilities, 'diagnostics')!, 'diagnostics')!.dynamicRegistration = true;
	}

	initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: any): Disposable {
		const client = this._client;

		let handleErrorCode = (errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.diagnostics.ErrorCodes> => {
			return client.sendRequest(DiagnosticsRequest.type, asDiagnosticsParams(errorCode, errorMessage, connectionTypeId));
		};

		return azdata.diagnostics.registerDiagnostics({
			displayName: 'Azure SQL Diagnostics', // TODO Localize
			id: 'Microsoft.Azure.SQL.Diagnostics',
			settings: {

			}
		}, {
			handleErrorCode
		});
	}

	getErrorDiagnosticStatus(errorCode: number, errorMessage: string, providerName: string, ownerUri: string): Thenable<azdata.diagnostics.ErrorCodes> {
		const client = this._client;
		let params: Contracts.DiagnosticsParameters = { errorCode: errorCode, errorMessage: errorMessage, providerName: providerName, ownerUri: ownerUri };
		return client.sendRequest(Contracts.DiagnosticsRequest.type, params).then(
			r => {
				return undefined;
			},
			e => {
				client.logFailedRequest(Contracts.DiagnosticsRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}
}

function asDiagnosticsParams(errorCode: number, errorMessage: string, connectionTypeId: string): DiagnosticsParameters {
	return {
		errorCode: errorCode,
		errorMessage: errorMessage,
		providerName: connectionTypeId,
		ownerUri: ''
	};
}
