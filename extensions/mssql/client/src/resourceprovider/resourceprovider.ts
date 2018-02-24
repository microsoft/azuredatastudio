/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as Contracts from '../models/contracts';
import { SqlToolsServiceClient } from 'extensions-modules';
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as sqlops from 'sqlops';
import * as path from 'path';


/**
 * Implements a credential storage for Windows, Mac (darwin), or Linux.
 *
 * Allows a single credential to be stored per service (that is, one username per service);
 */
export class AzureResourceProvider implements sqlops.ResourceProvider {

	public languageClient: SqlOpsDataClient;

	constructor(private _client?: SqlToolsServiceClient, langClient?: SqlOpsDataClient) {
		if (!this._client) {
			this._client = SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json'));
		}
		this.languageClient = langClient;
	}

	public createFirewallRule(account: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo): Thenable<sqlops.CreateFirewallRuleResponse> {
		let self = this;
		return new Promise<sqlops.CreateFirewallRuleResponse>((resolve, reject) => {
			self._client.
				sendRequest(Contracts.CreateFirewallRuleRequest.type, self.asCreateFirewallRuleParams(account, firewallruleInfo), self.languageClient)
				.then(response => {
					resolve(response);
				}, err => reject(err));
		});
	}

	public handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> {
		let self = this;
		return new Promise<sqlops.HandleFirewallRuleResponse>((resolve, reject) => {
			let params: Contracts.HandleFirewallRuleParams = { errorCode: errorCode, errorMessage: errorMessage, connectionTypeId: connectionTypeId };

			self._client.
				sendRequest(Contracts.HandleFirewallRuleRequest.type, params, self.languageClient)
				.then(response => {
					resolve(response);
				}, err => reject(err));
		});
	}

	private asCreateFirewallRuleParams(account: sqlops.Account, params: sqlops.FirewallRuleInfo): Contracts.CreateFirewallRuleParams {
		return {
			account: account,
			serverName: params.serverName,
			startIpAddress: params.startIpAddress,
			endIpAddress: params.endIpAddress,
			securityTokenMappings: params.securityTokenMappings
		};
	}
}

