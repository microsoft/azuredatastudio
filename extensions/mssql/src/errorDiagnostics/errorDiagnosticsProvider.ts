/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ISqlOpsFeature, SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { AppContext } from '../appContext';
import { ServerCapabilities, ClientCapabilities, RPCMessageType } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as CoreConstants from '../constants';
import * as ErrorDiagnosticsConstants from './errorDiagnosticsConstants';

export class ErrorDiagnosticsProvider extends SqlOpsFeature<any> {
	//No contracts for now, but can be added later.
	private static readonly messagesTypes: RPCMessageType[] = [];

	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ErrorDiagnosticsProvider {
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

			private convertToIConnectionProfile(profile: azdata.connection.ConnectionProfile): azdata.IConnectionProfile {
				return {
					providerName: profile.providerId,
					id: profile.connectionId,
					connectionName: profile.connectionName,
					serverName: profile.serverName,
					databaseName: profile.databaseName,
					userName: profile.userName,
					password: profile.password,
					authenticationType: profile.authenticationType,
					savePassword: profile.savePassword,
					groupFullName: profile.groupFullName,
					groupId: profile.groupId,
					saveProfile: profile.savePassword,
					azureTenantId: profile.azureTenantId,
					options: profile.options
				};
			}

			protected override registerProvider(options: any): Disposable {
				let handleConnectionError = async (errorCode: number, errorMessage: string, connection: azdata.connection.ConnectionProfile, options: azdata.IConnectionCompletionOptions): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> => {
					if (errorCode = ErrorDiagnosticsConstants.MssqlPasswordResetErrorCode) {
						// Need to convert inputed profile back to IConnectionProfile.
						let restoredProfile = this.convertToIConnectionProfile(connection);
						azdata.connection.openChangePasswordDialog(restoredProfile, options);
						return { success: true, connectNeeded: false };
					}
					else {
						return { success: false, connectNeeded: false };
					}
				}

				return azdata.diagnostics.registerDiagnosticsProvider({
					displayName: ErrorDiagnosticsConstants.MssqlDiagnosticsProviderDisplayName,
					id: CoreConstants.providerId,
				}, {
					handleConnectionError
				});
			}
		}
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(capabilities: ServerCapabilities): void { }

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, ErrorDiagnosticsProvider.messagesTypes);
	}

	protected registerProvider(options: any): Disposable { return undefined; }
}
