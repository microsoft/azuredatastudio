/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { ILogger, IConfig } from 'service-downloader/out/interfaces';
import ServerProvider from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import * as Utils from './utils';

const baseConfig = require('./config.json');

export function activate(context: vscode.ExtensionContext) {
	let contextProvider = new ContextProvider();
	context.subscriptions.push(contextProvider);

	let logger: ILogger = {
		append: () => { },
		appendLine: () => { }
	};
	let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
	delete config['serverConnectionMetadata'];
	config.installDirectory = path.join(__dirname, config.installDirectory);
	config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
	config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

	let credentialsStore = new CredentialStore(config);
	let resourceProvider = new AzureResourceProvider(config);

	let serverdownloader = new ServerProvider(config, logger);
	let clientOptions: ClientOptions = {
		providerId: Constants.providerId,
		serverConnectionMetadata: undefined
	};
	serverdownloader.getOrDownloadServer().then(e => {
		// at this point we know they will be downloaded so we can start the other services
		let serverOptions = generateServerOptions(e);
		this._client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		this._client.start();
		credentialsStore.start();
		resourceProvider.start();
	});

	context.subscriptions.push(credentialsStore);
	context.subscriptions.push(resourceProvider);
}

function generateServerOptions(executablePath: string): ServerOptions {
	let launchArgs = [];
	launchArgs.push('--log-dir');
	let logFileLocation = path.join(Utils.getDefaultLogLocation(), 'mssql');
	launchArgs.push(logFileLocation);

	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

// this method is called when your extension is deactivated
export function deactivate(): void {
}
