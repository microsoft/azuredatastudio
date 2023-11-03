/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServerProvider, IConfig, Events, LogLevel } from '@microsoft/ads-service-downloader';
import { RevealOutputChannelOn, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as Constants from './constants';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as path from 'path';
import { TracingLevel, getCommonLaunchArgsAndCleanupOldLogFiles, getConfigTracingLevel } from './utils';
import { TelemetryReporter, LanguageClientErrorHandler } from './telemetry';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { TelemetryFeature, SerializationFeature, AccountFeature } from './features';
import { AppContext } from './appContext';
import { CompletionExtensionParams, CompletionExtLoadRequest } from './contracts';
import { promises as fs } from 'fs';

const localize = nls.loadMessageBundle();

const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

// The mapping between KQL log level and the service downloader log level.
const LogLevelMapping: { [key: string]: number } = {
	[TracingLevel.All]: LogLevel.Verbose,
	[TracingLevel.Critical]: LogLevel.Critical,
	[TracingLevel.Error]: LogLevel.Error,
	[TracingLevel.Information]: LogLevel.Information,
	[TracingLevel.Verbose]: LogLevel.Verbose,
	[TracingLevel.Warning]: LogLevel.Warning
};
export class KustoServer {

	private client!: SqlOpsDataClient;
	private config!: IConfig;
	private disposables: vscode.Disposable[] = [];

	public async start(context: AppContext): Promise<SqlOpsDataClient> {
		try {
			const installationStart = Date.now();
			const path = await this.download(context);
			const installationComplete = Date.now();
			let serverOptions = generateServerOptions(context.extensionContext.logUri.fsPath, path);
			let clientOptions = getClientOptions(context);
			// IMPORTANT: 'kusto' must match the prefix name of configuration: 'kusto.tracingServer'.
			this.client = new SqlOpsDataClient('kusto', Constants.serviceName, serverOptions, clientOptions);
			const processStart = Date.now();
			const clientReadyPromise = this.client.onReady().then(() => {
				const processEnd = Date.now();
				statusView.text = localize('serviceStartedStatusMsg', "{0} Started", Constants.serviceName);
				setTimeout(() => {
					statusView.hide();
				}, 1500);
				vscode.commands.registerCommand('kusto.loadCompletionExtension', (params: CompletionExtensionParams) => {
					this.client.sendRequest(CompletionExtLoadRequest.type, params);
				});
				TelemetryReporter.sendTelemetryEvent('startup/LanguageClientStarted', {
					installationTime: String(installationComplete - installationStart),
					processStartupTime: String(processEnd - processStart),
					totalTime: String(processEnd - installationStart),
					beginningTimestamp: String(installationStart)
				});
			});
			statusView.show();
			statusView.text = localize('startingServiceStatusMsg', "Starting {0}", Constants.serviceName);
			this.client.start();
			await Promise.all([clientReadyPromise]);
			return this.client;
		} catch (e) {
			TelemetryReporter.sendTelemetryEvent('ServiceInitializingFailed');
			vscode.window.showErrorMessage(localize('failedToStartServiceErrorMsg', "Failed to start {0}", Constants.serviceName));
			throw e;
		}
	}

	private async download(context: AppContext): Promise<string> {
		const configDir = context.extensionContext.extensionPath;
		const rawConfig = await fs.readFile(path.join(configDir, 'config.json'));
		this.config = JSON.parse(rawConfig.toString())!;
		this.config.installDirectory = path.join(__dirname, this.config.installDirectory);
		this.config.proxy = vscode.workspace.getConfiguration('http').get<string>('proxy')!;
		this.config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL', true);

		const serverdownloader = new ServerProvider(this.config);
		serverdownloader.eventEmitter.onAny(generateHandleServerProviderEvent());
		return serverdownloader.getOrDownloadServer();
	}

	dispose() {
		this.disposables.forEach(d => d.dispose());
		if (this.client) {
			this.client.stop();
		}
	}
}

function generateServerOptions(logPath: string, executablePath: string): ServerOptions {
	const launchArgs = getCommonLaunchArgsAndCleanupOldLogFiles(logPath, 'kustoService.log', executablePath);
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function generateHandleServerProviderEvent() {
	let dots = 0;
	return (e: string | string[], ...args: any[]) => {
		switch (e) {
			case Events.INSTALL_START:
				outputChannel.show(true);
				statusView.show();
				outputChannel.appendLine(localize('installingServiceChannelMsg', "Installing {0} to {1}", Constants.serviceName, args[0]));
				statusView.text = localize('installingServiceStatusMsg', "Installing {0}", Constants.serviceName);
				break;
			case Events.INSTALL_END:
				outputChannel.appendLine(localize('installedServiceChannelMsg', "Installed {0}", Constants.serviceName));
				break;
			case Events.DOWNLOAD_START:
				outputChannel.appendLine(localize('downloadingServiceChannelMsg', "Downloading {0}", args[0]));
				outputChannel.append(localize('downloadingServiceSizeChannelMsg', "({0} KB)", Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)));
				statusView.text = localize('downloadingServiceStatusMsg', "Downloading {0}", Constants.serviceName);
				break;
			case Events.DOWNLOAD_PROGRESS:
				let newDots = Math.ceil(args[0] / 5);
				if (newDots > dots) {
					outputChannel.append('.'.repeat(newDots - dots));
					dots = newDots;
				}
				break;
			case Events.DOWNLOAD_END:
				// Start a new line to end the dots from the DOWNLOAD_PROGRESS event.
				outputChannel.appendLine('');
				outputChannel.appendLine(localize('downloadServiceDoneChannelMsg', "Downloaded {0}", Constants.serviceName));
				break;
			case Events.ENTRY_EXTRACTED:
				outputChannel.appendLine(localize('entryExtractedChannelMsg', "Extracted {0} ({1}/{2})", args[0], args[1], args[2]));
				break;
			case Events.LOG_EMITTED:
				const configuredLevel: number | undefined = LogLevelMapping[getConfigTracingLevel()];
				const logLevel = args[0] as LogLevel;
				const message = args[1] as string;
				if (configuredLevel !== undefined && logLevel >= configuredLevel) {
					outputChannel.appendLine(message);
				}
				break;
		}
	};
}

function getClientOptions(context: AppContext): ClientOptions {
	return {
		documentSelector: ['kusto'],
		synchronize: {
			configurationSection: Constants.extensionConfigSectionName
		},
		providerId: Constants.providerId,
		errorHandler: new LanguageClientErrorHandler(),
		features: [
			// we only want to add new features
			...SqlOpsDataClient.defaultFeatures,
			TelemetryFeature,
			AccountFeature,
			SerializationFeature
		],
		outputChannel: outputChannel,
		// Automatically reveal the output channel only in dev mode, so that the users are not impacted and issues can still be caught during development.
		revealOutputChannelOn: azdata.env.quality === azdata.env.AppQuality.dev ? RevealOutputChannelOn.Error : RevealOutputChannelOn.Never
	};
}
