/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { ILogger, IConfig, ServerProvider } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import * as Utils from './utils';
import { Telemetry, LanguageClientErrorHandler } from './telemetry';

const baseConfig = require('./config.json');

export function activate(context: vscode.ExtensionContext) {
	let outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
	outputChannel.show();
	let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
	config.installDirectory = path.join(__dirname, config.installDirectory);
	config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
	config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

	const credentialsStore = new CredentialStore(config, outputChannel);
	const resourceProvider = new AzureResourceProvider(config, outputChannel);
	let languageClient: SqlOpsDataClient;

	const serverdownloader = new ServerProvider(config, outputChannel);
	let clientOptions: ClientOptions = {
		providerId: Constants.providerId,
		errorHandler: new LanguageClientErrorHandler(),
		serverConnectionMetadata: undefined
	};

	const installationStart = Date.now();
	serverdownloader.getOrDownloadServer().then(e => {
		const installationComplete = Date.now();
		// at this point we know they will be downloaded so we can start the other services
		let serverOptions = generateServerOptions(e);
		languageClient = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		const processStart = Date.now();
		languageClient.onReady().then(() => {
			const processEnd = Date.now();
			Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
				installationTime: String(installationComplete - installationStart),
				processStartupTime: String(processEnd - processStart),
				totalTime: String(processEnd - installationStart),
				beginningTimestamp: String(installationStart)
			});
		});
		languageClient.start();
		credentialsStore.start();
		resourceProvider.start();
	}, e => {
		Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
	});

	let contextProvider = new ContextProvider();
	context.subscriptions.push(contextProvider);
	context.subscriptions.push(credentialsStore);
	context.subscriptions.push(resourceProvider);
	context.subscriptions.push({ dispose: () => languageClient.stop() });
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
