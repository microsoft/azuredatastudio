/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServerProvider, IConfig, Events } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import * as Constants from './constants';
import * as vscode from 'vscode';
import * as path from 'path';
import { getCommonLaunchArgsAndCleanupOldLogFiles } from './utils';
import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { TelemetryFeature, AgentServicesFeature, SerializationFeature, AccountFeature, SqlAssessmentServicesFeature } from './features';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import { SchemaCompareService } from './schemaCompare/schemaCompareService';
import { AppContext } from './appContext';
import { DacFxService } from './dacfx/dacFxService';
import { CmsService } from './cms/cmsService';
import { CompletionExtensionParams, CompletionExtLoadRequest } from './contracts';
import { promises as fs } from 'fs';
import * as nls from 'vscode-nls';
import { LanguageExtensionService } from './languageExtension/languageExtensionService';
import { SqlAssessmentService } from './sqlAssessment/sqlAssessmentService';
import { NotebookConvertService } from './notebookConvert/notebookConvertService';

const localize = nls.loadMessageBundle();
const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

export class SqlToolsServer {

	private client: SqlOpsDataClient;
	private config: IConfig;
	private disposables = new Array<{ dispose: () => void }>();

	public async start(context: AppContext): Promise<SqlOpsDataClient> {
		try {
			const installationStart = Date.now();
			const path = await this.download(context);
			const installationComplete = Date.now();
			let serverOptions = generateServerOptions(context.extensionContext.logPath, path);
			let clientOptions = getClientOptions(context);
			this.client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
			const processStart = Date.now();
			const clientReadyPromise = this.client.onReady().then(() => {
				const processEnd = Date.now();
				statusView.text = localize('serviceStartedStatusMsg', "{0} Started", Constants.serviceName);
				setTimeout(() => {
					statusView.hide();
				}, 1500);
				vscode.commands.registerCommand('mssql.loadCompletionExtension', (params: CompletionExtensionParams) => {
					this.client.sendRequest(CompletionExtLoadRequest.type, params);
				});
				Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
					installationTime: String(installationComplete - installationStart),
					processStartupTime: String(processEnd - processStart),
					totalTime: String(processEnd - installationStart),
					beginningTimestamp: String(installationStart)
				});
			});
			statusView.show();
			statusView.text = localize('startingServiceStatusMsg', "Starting {0}", Constants.serviceName);
			this.client.start();
			await Promise.all([this.activateFeatures(context), clientReadyPromise]);
			return this.client;
		} catch (e) {
			Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
			vscode.window.showErrorMessage(localize('failedToStartServiceErrorMsg', "Failed to start {0}", Constants.serviceName));
			throw e;
		}
	}

	private async download(context: AppContext): Promise<string> {
		const configDir = context.extensionContext.extensionPath;
		const rawConfig = await fs.readFile(path.join(configDir, 'config.json'));
		this.config = JSON.parse(rawConfig.toString());
		this.config.installDirectory = path.join(configDir, this.config.installDirectory);
		this.config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
		this.config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

		const serverdownloader = new ServerProvider(this.config);
		serverdownloader.eventEmitter.onAny(generateHandleServerProviderEvent());
		return serverdownloader.getOrDownloadServer();
	}

	private activateFeatures(context: AppContext): Promise<void> {
		const credsStore = new CredentialStore(context.extensionContext.logPath, this.config);
		const resourceProvider = new AzureResourceProvider(context.extensionContext.logPath, this.config);
		this.disposables.push(credsStore);
		this.disposables.push(resourceProvider);
		return Promise.all([credsStore.start(), resourceProvider.start()]).then();
	}

	dispose() {
		this.disposables.forEach(d => d.dispose());
		if (this.client) {
			this.client.stop();
		}
	}
}

function generateServerOptions(logPath: string, executablePath: string): ServerOptions {
	const launchArgs = getCommonLaunchArgsAndCleanupOldLogFiles(logPath, 'sqltools.log', executablePath);
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function generateHandleServerProviderEvent() {
	let dots = 0;
	return (e: string, ...args: any[]) => {
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
				outputChannel.appendLine(localize('downloadServiceDoneChannelMsg', "Done installing {0}", Constants.serviceName));
				break;
			case Events.ENTRY_EXTRACTED:
				outputChannel.appendLine(localize('entryExtractedChannelMsg', "Extracted {0} ({1}/{2})", args[0], args[1], args[2]));
				break;
		}
	};
}

function getClientOptions(context: AppContext): ClientOptions {
	return {
		documentSelector: ['sql'],
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
			AgentServicesFeature,
			SerializationFeature,
			SqlAssessmentServicesFeature,
			SchemaCompareService.asFeature(context),
			LanguageExtensionService.asFeature(context),
			DacFxService.asFeature(context),
			CmsService.asFeature(context),
			SqlAssessmentService.asFeature(context),
			NotebookConvertService.asFeature(context)
		],
		outputChannel: new CustomOutputChannel()
	};
}

class CustomOutputChannel implements vscode.OutputChannel {
	name: string;
	append(value: string): void {
		console.log(value);
	}
	appendLine(value: string): void {
		console.log(value);
	}
	clear(): void {
	}
	show(preserveFocus?: boolean): void;
	show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
	show(column?: any, preserveFocus?: any) {
	}
	hide(): void {
	}
	dispose(): void {
	}
}
