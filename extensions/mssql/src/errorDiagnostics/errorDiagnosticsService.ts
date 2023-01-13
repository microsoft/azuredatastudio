/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as mssql from 'mssql';
import { ISqlOpsFeature, SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
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
			}

			protected override registerProvider(options: any): Disposable {

			}

			async handleErrorCode(errorCode: number, errorMessage: string): Promise<mssql.ErrorDiagnosticsResponse> {
				const params: contracts.ErrorDiagnosticsParameters = { errorCode, errorMessage };
				return this.client.sendRequest(contracts.DiagnosticsRequest.type, params).then(
					undefined,
					e => {
						this.client.logFailedRequest(contracts.DiagnosticsRequest.type, e);
						return Promise.resolve(undefined);
					}
				)
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
