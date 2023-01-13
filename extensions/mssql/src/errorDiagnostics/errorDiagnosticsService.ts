/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ISqlOpsFeature, SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ServerCapabilities, ClientCapabilities, RPCMessageType } from 'vscode-languageclient';
import { Disposable } from 'vscode';

export const diagnosticsId = 'azurediagnostics'
export const serviceName = 'AzureDiagnostics';

export class ErrorDiagnosticsService extends SqlOpsFeature<any> {
	private static readonly messagesTypes: RPCMessageType[] = [
		contracts.DiagnosticsRequest.type,
	];

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ErrorDiagnosticsService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			override fillClientCapabilities(capabilities: ClientCapabilities): void { }

			override initialize(): void {
				this.register(this.messages, {
					id: UUID.generateUuid(),
					registerOptions: undefined
				});
			}

			protected override registerProvider(options: any): Disposable {
				const client = this._client;

				let handleErrorCode = (errorCode: number, errorMessage: string): Thenable<azdata.diagnostics.ErrorDiagnosticsResponse> => {
					const params: contracts.ErrorDiagnosticsParameters = { errorCode, errorMessage };
					return client.sendRequest(contracts.DiagnosticsRequest.type, params);
				}

				return azdata.diagnostics.registerDiagnostics({
					displayName: 'Azure SQL Diagnostics',
					id: 'Microsoft.Azure.SQL.Diagnostics',
					settings: {

					}
				}, {
					handleErrorCode
				});
			}
		}
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(capabilities: ServerCapabilities): void { }

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, ErrorDiagnosticsService.messagesTypes);
	}

	protected registerProvider(options: any): Disposable { return undefined; }
}
