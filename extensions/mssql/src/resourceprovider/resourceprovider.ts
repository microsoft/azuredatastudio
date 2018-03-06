/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import { ILogger, IConfig } from 'service-downloader/out/interfaces';
import { SqlOpsDataClient, SqlOpsFeature, ClientOptions } from 'dataprotocol-client';
import { ServerCapabilities, ClientCapabilities, RPCMessageType, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import ServerProvider from 'service-downloader';
import ServiceDownloadProvider from 'service-downloader/out/serviceDownloadProvider';

import * as sqlops from 'sqlops';
import { Disposable } from 'vscode';

import { CreateFirewallRuleRequest, HandleFirewallRuleRequest, CreateFirewallRuleParams, HandleFirewallRuleParams } from './contracts';
import * as Constants from './constants';
import * as Utils from '../utils';

function ensure(target: object, key: string): any {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
}

class FireWallFeature extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		CreateFirewallRuleRequest.type,
		HandleFirewallRuleRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, FireWallFeature.messagesTypes);
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		ensure(ensure(capabilities, 'firewall')!, 'firwall')!.dynamicRegistration = true;
	}

	initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: any): Disposable {
		const client = this._client;

		let createFirewallRule = (account: sqlops.Account, firewallruleInfo: sqlops.FirewallRuleInfo): Thenable<sqlops.CreateFirewallRuleResponse> => {
			return client.sendRequest(CreateFirewallRuleRequest.type, asCreateFirewallRuleParams(account, firewallruleInfo));
		};

		let handleFirewallRule = (errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> => {
			let params: HandleFirewallRuleParams = { errorCode: errorCode, errorMessage: errorMessage, connectionTypeId: connectionTypeId };
			return client.sendRequest(HandleFirewallRuleRequest.type, params);
		};

		return sqlops.resources.registerResourceProvider({
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

function asCreateFirewallRuleParams(account: sqlops.Account, params: sqlops.FirewallRuleInfo): CreateFirewallRuleParams {
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

	constructor(baseConfig: IConfig, private logger: ILogger) {
		if (baseConfig) {
			this._config = JSON.parse(JSON.stringify(baseConfig));
			this._config.executableFiles = ['SqlToolsResourceProviderService.exe', 'SqlToolsResourceProviderService'];
		}
	}

	public start() {
		let serverdownloader = new ServerProvider(this._config, this.logger);
		let clientOptions: ClientOptions = {
			providerId: Constants.providerId,
			features: [FireWallFeature],
			serverConnectionMetadata: undefined
		};
		serverdownloader.getOrDownloadServer().then(e => {
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
		let launchArgs = [];
		launchArgs.push('--log-dir');
		let logFileLocation = path.join(Utils.getDefaultLogLocation(), 'mssql');
		launchArgs.push(logFileLocation);

		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}
