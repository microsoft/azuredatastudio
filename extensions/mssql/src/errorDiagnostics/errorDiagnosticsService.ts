/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ISqlOpsFeature, SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
//import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ServerCapabilities, ClientCapabilities, RPCMessageType } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as ErrorDiagnosticsConstants from './errorDiagnosticsConstants';

export const diagnosticsId = 'azurediagnostics'
export const serviceName = 'AzureDiagnostics';

export class ErrorDiagnosticsService extends SqlOpsFeature<any> {
	//No contracts for now, but can be added later.
	private static readonly messagesTypes: RPCMessageType[] = [];

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
				let handleErrorCode = (errorCode: number, errorMessage: string): Thenable<boolean> => {
					if (errorCode = ErrorDiagnosticsConstants.MssqlPasswordResetCode) {
						return azdata.connection.getConnectionProfileFromError().then(profile => {
							azdata.connection.openChangePasswordDialog(profile);
							return Promise.resolve(true);
						});
					}
					else {
						return Promise.resolve(false);
					}
				}

				return azdata.diagnostics.registerDiagnostics({
					displayName: 'Azure SQL Diagnostics for MSSQL',
					id: 'MSSQL',
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
