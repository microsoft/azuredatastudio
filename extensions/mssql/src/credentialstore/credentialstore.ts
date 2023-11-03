/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { IConfig } from '@microsoft/ads-service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import * as Constants from './constants';
import * as Utils from '../utils';
import { SqlCredentialService } from './sqlCredentialService';
import { AppContext } from '../appContext';

/**
 * Implements a credential storage for Windows, Mac (darwin), or Linux.
 *
 * Allows a single credential to be stored per service (that is, one username per service);
 */
export class CredentialStore {
	private _client: SqlOpsDataClient;
	private _config: IConfig;
	private _logPath: string;

	constructor(
		private context: AppContext,
		baseConfig: IConfig
	) {
		if (baseConfig) {
			this._config = JSON.parse(JSON.stringify(baseConfig)) as IConfig;
			this._config.executableFiles = ['MicrosoftSqlToolsCredentials.exe', 'MicrosoftSqlToolsCredentials'];
		}
		this.context = context;
		this._logPath = this.context.extensionContext.logUri.fsPath;
	}

	public async start(): Promise<void> {
		let clientOptions: ClientOptions = {
			providerId: Constants.providerId,
			features: [SqlCredentialService.asFeature(this.context)]
		};
		const serverPath = await Utils.getOrDownloadServer(this._config);
		const serverOptions = this.generateServerOptions(serverPath);
		this._client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		this._client.start();
	}

	async dispose(): Promise<void> {
		if (this._client) {
			await this._client.stop();
		}
	}

	private generateServerOptions(executablePath: string): ServerOptions {
		let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles(this._logPath, 'credentialstore.log', executablePath);
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}
}
