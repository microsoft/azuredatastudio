/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ISqlOpsFeature, SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { AppContext } from '../appContext';
import { ServerCapabilities, ClientCapabilities, RPCMessageType } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as CoreConstants from '../constants';
import * as ErrorDiagnosticsConstants from './errorDiagnosticsConstants';
import { logDebug } from '../utils';

export class ErrorDiagnosticsProvider extends SqlOpsFeature<any> {
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
				let handleConnectionError = async (errorInfo: azdata.diagnostics.IErrorInformation, connection: azdata.connection.ConnectionProfile): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> => {
					let restoredProfile = this.convertToIConnectionProfile(connection);

					if (ErrorDiagnosticsConstants.MssqlPasswordResetErrorCode.includes(errorInfo.errorCode)) {
						logDebug(`ErrorDiagnosticsProvider: Error Code ${errorInfo.errorCode} requires user to change their password, launching change password dialog.`);
						return await this.handleChangePassword(restoredProfile);
					}
					else if (errorInfo.errorCode === ErrorDiagnosticsConstants.MssqlCertValidationFailedErrorCode) {
						logDebug(`ErrorDiagnosticsProvider: Error Code ${errorInfo.errorCode} indicates certificate validation has failed, launching error dialog with instructionText.`);
						return await this.showCertValidationDialog(restoredProfile, errorInfo.errorMessage, errorInfo.messageDetails);
					}
					logDebug(`ErrorDiagnosticsProvider: No error handler found for errorCode ${errorInfo.errorCode}.`);
					return { handled: false };
				}

				return azdata.diagnostics.registerDiagnosticsProvider({
					targetProviderId: CoreConstants.providerId,
				}, {
					handleConnectionError
				});
			}

			private async showCertValidationDialog(connection: azdata.IConnectionProfile, errorMessage: string, callStack: string): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> {
				try {
					let actions: azdata.window.IDialogAction[] = [];
					let trustServerCertAction: azdata.window.IDialogAction = {
						id: ErrorDiagnosticsConstants.TSC_ActionId,
						label: ErrorDiagnosticsConstants.TSC_EnableTrustServerCert,
						isPrimary: true
					};

					actions.push(trustServerCertAction);
					const result = await azdata.window.openCustomErrorDialog(
						{
							severity: azdata.window.MessageLevel.Error,
							headerTitle: ErrorDiagnosticsConstants.ConnectionErrorDialogTitle,
							message: errorMessage,
							messageDetails: callStack,
							telemetryView: ErrorDiagnosticsConstants.MssqlConnectionTelemetryView,
							instructionText: ErrorDiagnosticsConstants.TSC_InstructionText,
							readMoreLink: ErrorDiagnosticsConstants.TSC_ReadMoreLink,
							actions: actions
						}
					);

					// Result represents id of action taken by user.
					if (result === ErrorDiagnosticsConstants.TSC_ActionId) {
						connection.options[ErrorDiagnosticsConstants.TSC_OptionName] = true;
						return { handled: true, reconnect: true, options: connection.options };
					} else {
						return { handled: true, reconnect: false };
					}
				}
				catch (e) {
					console.error(`Unexpected exception occurred when showing certificate validation custom dialog: ${e}`);
				}
				return { handled: false };
			}

			private async handleChangePassword(connection: azdata.IConnectionProfile): Promise<azdata.diagnostics.ConnectionDiagnosticsResult> {
				try {
					const result = await azdata.connection.openChangePasswordDialog(connection);
					// result will be undefined if password change was closed or cancelled.
					if (result) {
						// MSSQL uses 'password' as the option key for connection profile.
						connection.options['password'] = result;
						return { handled: true, reconnect: true, options: connection.options };
					}
				}
				catch (e) {
					console.error(`Change password failed unexpectedly with error: ${e}`);
				}
				return { handled: false };
			}
		}
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(capabilities: ServerCapabilities): void { }

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		super(client, ErrorDiagnosticsProvider.messagesTypes);
	}

	protected registerProvider(options: any): Disposable {
		return {
			dispose: () => { }
		}
	}
}
