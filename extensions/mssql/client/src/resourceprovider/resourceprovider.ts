/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as Contracts from '../models/contracts';
import { SqlToolsServiceClient } from 'extensions-modules';
import { LanguageClient } from 'dataprotocol-client';
import * as data from 'data';
import * as path from 'path';


/**
 * Implements a credential storage for Windows, Mac (darwin), or Linux.
 *
 * Allows a single credential to be stored per service (that is, one username per service);
 */
export class AzureResourceProvider implements data.ResourceProvider {

	public languageClient: LanguageClient;

	constructor(private _client?: SqlToolsServiceClient, langClient?: LanguageClient) {
		if (!this._client) {
			this._client = SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json'));
		}
		this.languageClient = langClient;
	}

	public createFirewallRule(account: data.Account, firewallruleInfo: data.FirewallRuleInfo): Thenable<data.CreateFirewallRuleResponse> {
		let self = this;
		return new Promise<data.CreateFirewallRuleResponse>((resolve, reject) => {
			self._client.
				sendRequest(Contracts.CreateFirewallRuleRequest.type, self.asCreateFirewallRuleParams(account, firewallruleInfo), self.languageClient)
				.then(response => {
					resolve(response);
				}, err => reject(err));
		});
	}

	public handleFirewallRule(errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<data.HandleFirewallRuleResponse> {
		let self = this;
		return new Promise<data.HandleFirewallRuleResponse>((resolve, reject) => {
			let params: Contracts.HandleFirewallRuleParams = { errorCode: errorCode, errorMessage: errorMessage, connectionTypeId: connectionTypeId };

			self._client.
				sendRequest(Contracts.HandleFirewallRuleRequest.type, params, self.languageClient)
				.then(response => {
					resolve(response);
				}, err => reject(err));
		});
	}

	private asCreateFirewallRuleParams(account: data.Account, params: data.FirewallRuleInfo): Contracts.CreateFirewallRuleParams {
		return {
			account: account,
			serverName: params.serverName,
			startIpAddress: params.startIpAddress,
			endIpAddress: params.endIpAddress,
			securityTokenMappings: params.securityTokenMappings
		};
	}
}

