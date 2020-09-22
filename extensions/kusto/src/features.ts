/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import { Disposable, window, QuickPickOptions, QuickPickItem } from 'vscode';
import { Telemetry } from './telemetry';
import * as contracts from './contracts';
import * as azdata from 'azdata';
import * as Utils from './utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { localize } from './localize';

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

export class AccountFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(): void {
		this._client.onRequest(contracts.SecurityTokenRequest.type, async (request): Promise<contracts.RequestSecurityTokenResponse | undefined> => {
			return this.getToken(request);
		});
	}

	protected async getToken(request: contracts.RequestSecurityTokenParams): Promise<contracts.RequestSecurityTokenResponse | undefined> {
		const accountList = await azdata.accounts.getAllAccounts();
		let account: azdata.Account;

		if (accountList.length < 1) {
			// TODO: Prompt user to add account
			window.showErrorMessage(localize('mssql.missingLinkedAzureAccount', "Azure Data Studio needs to contact Azure Key Vault to access a column master key for Always Encrypted, but no linked Azure account is available. Please add a linked Azure account and retry the query."));
			return undefined;
		} else if (accountList.length > 1) {
			let options: QuickPickOptions = {
				ignoreFocusOut: true,
				placeHolder: localize('mssql.chooseLinkedAzureAccount', "Please select a linked Azure account:")
			};
			let items = accountList.map(a => new AccountFeature.AccountQuickPickItem(a));
			let selectedItem = await window.showQuickPick(items, options);
			if (!selectedItem) { // The user canceled the selection.
				window.showErrorMessage(localize('mssql.canceledLinkedAzureAccountSelection', "Azure Data Studio needs to contact Azure Key Vault to access a column master key for Always Encrypted, but no linked Azure account was selected. Please retry the query and select a linked Azure account when prompted."));
				return undefined;
			}
			account = selectedItem.account;
		} else {
			account = accountList[0];
		}

		const tenant = account.properties.tenants.find((t: { [key: string]: string }) => request.authority.includes(t.id));
		const unauthorizedMessage = localize('mssql.insufficientlyPrivelagedAzureAccount', "The configured Azure account for {0} does not have sufficient permissions for Azure Key Vault to access a column master key for Always Encrypted.", account.key.accountId);
		if (!tenant) {
			window.showErrorMessage(unauthorizedMessage);
			return undefined;
		}
		try {
			const securityToken = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.Sql);

			if (!securityToken?.token) {
				window.showErrorMessage(unauthorizedMessage);
				return undefined;
			}

			let params: contracts.RequestSecurityTokenResponse = {
				accountKey: JSON.stringify(account.key),
				token: securityToken.token
			};

			return params;
		} catch (ex) {
			console.log(ex);
			return undefined;
		}
	}

	static AccountQuickPickItem = class implements QuickPickItem {
		account: azdata.Account;
		label: string;
		description?: string;
		detail?: string;
		picked?: boolean;
		alwaysShow?: boolean;

		constructor(account: azdata.Account) {
			this.account = account;
			this.label = account.displayInfo.displayName;
		}
	};
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
