/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { IConfig, ServerProvider } from 'service-downloader';
import { SqlOpsDataClient, SqlOpsFeature, ClientOptions } from 'dataprotocol-client';
import { ServerCapabilities, ClientCapabilities, RPCMessageType, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Disposable } from 'vscode';
import { CreateFirewallRuleRequest, HandleFirewallRuleRequest, CreateFirewallRuleParams, HandleFirewallRuleParams } from './contracts';
import * as Constants from './constants';
import * as Utils from '../utils';

class FireWallFeature extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		CreateFirewallRuleRequest.type,
		HandleFirewallRuleRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, FireWallFeature.messagesTypes);
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(Utils.ensure(capabilities, 'firewall')!, 'firwall')!.dynamicRegistration = true;
	}

	initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: any): Disposable {
		const client = this._client;

		let createFirewallRule = (account: azdata.Account, firewallruleInfo: azdata.FirewallRuleInfo): Thenable<azdata.CreateFirewallRuleResponse> => {
			return client.sendRequest(CreateFirewallRuleRequest.type, asCreateFirewallRuleParams(account, firewallruleInfo));
		};

		let handleFirewallRule = (errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.HandleFirewallRuleResponse> => {
			let params: HandleFirewallRuleParams = { errorCode: errorCode, errorMessage: errorMessage, connectionTypeId: connectionTypeId };
			return client.sendRequest(HandleFirewallRuleRequest.type, params);
		};

		return azdata.resources.registerResourceProvider({
			displayName: 'Azure SQL Resource Provider', // TODO Localize
			id: 'Microsoft.Azure.SQL.ResourceProvider',
			settings: {

			}
		}, {
			handleFirewallRule,
			createFirewallRule
		});
	}
}

function asCreateFirewallRuleParams(account: azdata.Account, params: azdata.FirewallRuleInfo): CreateFirewallRuleParams {
	return {
		account: account,
		serverName: params.serverName,
		startIpAddress: params.startIpAddress,
		endIpAddress: params.endIpAddress,
		securityTokenMappings: params.securityTokenMappings
	};
}

export class AzureResourceProvider {
	private _client: SqlOpsDataClient;
	private _config: IConfig;

	constructor(private logPath: string, baseConfig: IConfig) {
		if (baseConfig) {
			this._config = JSON.parse(JSON.stringify(baseConfig));
			this._config.executableFiles = ['SqlToolsResourceProviderService.exe', 'SqlToolsResourceProviderService'];
		}
	}

	public start() {
		let serverdownloader = new ServerProvider(this._config);
		let clientOptions: ClientOptions = {
			providerId: Constants.providerId,
			features: [FireWallFeature]
		};
		return serverdownloader.getOrDownloadServer().then(e => {
			let serverOptions = this.generateServerOptions(e);
			this._client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
			this._client.start();
		});
	}

	public dispose() {
		if (this._client) {
			this._client.stop();
		}
	}

	private generateServerOptions(executablePath: string): ServerOptions {
		let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles(this.logPath, 'resourceprovider.log', executablePath);
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}
