/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IConfig } from '@microsoft/ads-service-downloader';
import { SqlOpsDataClient, SqlOpsFeature, ClientOptions } from 'dataprotocol-client';
import { ServerCapabilities, ClientCapabilities, RPCMessageType, ServerOptions, TransportKind } from 'vscode-languageclient';
import { Disposable } from 'vscode';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { DiagnosticsParameters, DiagnosticsRequest } from './contracts';
import * as Utils from '../utils';

export const diagnosticsId = 'azurediagnostics'
export const serviceName = 'AzureDiagnostics';

export class DiagnosticsFeature extends SqlOpsFeature<any> {

	private static readonly messagesTypes: RPCMessageType[] = [
		DiagnosticsRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, DiagnosticsFeature.messagesTypes);
	}

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(Utils.ensure(capabilities, 'diagnostics')!, 'diagnostics')!.dynamicRegistration = true;
	}

	initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: any): Disposable {
		const client = this._client;

		let handleErrorCode = (errorCode: number, errorMessage: string, providerId: string): Thenable<azdata.diagnostics.ErrorCodes> => {
			return client.sendRequest(DiagnosticsRequest.type, asDiagnosticsParams(errorCode, errorMessage, providerId));
		};

		return azdata.diagnostics.registerDiagnostics({
			displayName: 'Azure SQL Diagnostics', // TODO Localize
			id: 'Microsoft.Azure.SQL.Diagnostics',
			settings: {

			}
		}, {
			handleErrorCode
		});
	}
}

export class AzureDiagnostics {
	private _client: SqlOpsDataClient;
	private _config: IConfig;

	constructor(private logPath: string, baseConfig: IConfig) {
		if (baseConfig) {
			this._config = JSON.parse(JSON.stringify(baseConfig));
			this._config.executableFiles = ['SqlToolsResourceProviderService.exe', 'SqlToolsResourceProviderService'];
		}
	}

	public async start(): Promise<void> {
		let clientOptions: ClientOptions = {
			providerId: diagnosticsId,
			features: [DiagnosticsFeature]
		};
		const serverPath = await Utils.getOrDownloadServer(this._config);
		let serverOptions = this.generateServerOptions(serverPath);
		this._client = new SqlOpsDataClient(serviceName, serverOptions, clientOptions);
		this._client.start();
	}

	public async dispose(): Promise<void> {
		if (this._client) {
			await this._client.stop();
		}
	}

	private generateServerOptions(executablePath: string): ServerOptions {
		let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles(this.logPath, 'diagnostics.log', executablePath);
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}


function asDiagnosticsParams(errorCode: number, errorMessage: string, providerId: string): DiagnosticsParameters {
	return {
		errorCode: errorCode,
		errorMessage: errorMessage,
		providerName: providerId,
	};
}
