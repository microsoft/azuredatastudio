/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageClient, ServerOptions, TransportKind, LanguageClientOptions as VSLanguageClientOptions } from 'vscode-languageclient';
import { Events } from '@microsoft/ads-service-downloader';
import * as vscode from 'vscode';
import * as path from 'path';
import { getCommonLaunchArgsAndCleanupOldLogFiles, getParallelMessageProcessingConfig, getOrDownloadServer, AvailableServices, ServerServiceName } from './serverUtils';
import * as nls from 'vscode-nls';
import { DemoService } from '../services/demo/demoService';
import { LanguageClientErrorHandler, Telemetry } from './telemetry';
import { IBackendServices } from '../services/IBackendServices';

const localize = nls.loadMessageBundle();
const outputChannel = vscode.window.createOutputChannel(ServerServiceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

export class SqlMigrationsServer {

	private client: LanguageClient | undefined;
	private disposables = new Array<{ dispose: () => void }>();
	public installDirectory: string | undefined = undefined;

	public async start(context: vscode.ExtensionContext): Promise<IBackendServices> {
		const registeredClients = new Map<string, LanguageClient>();
		var configFilePath = path.join(context.extensionPath, 'config.json');
		const configurations = require(configFilePath);

		try {

			for (const serviceConfigName in configurations) {
				const serviceConfig = configurations[serviceConfigName];

				const createdClient = await this.buildClient(serviceConfigName, serviceConfig, context);
				registeredClients.set(serviceConfigName, createdClient);
			}

			return this.buildBackendServices(registeredClients);

		} catch (e) {
			Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
			void vscode.window.showErrorMessage(localize('failedToStartServiceErrorMsg', "Failed to start {0}", ServerServiceName));
			throw e;
		}
	}

	private buildBackendServices(registeredClients: Map<string, LanguageClient>): IBackendServices {
		return {
			DemoService: new DemoService(registeredClients.get(AvailableServices.DemoService)!)
		};
	}

	private async buildClient(serviceConfigName: string, config: any, context: vscode.ExtensionContext): Promise<LanguageClient> {
		const installationStart = Date.now();
		const serverPath = await this.download(config, context);
		this.installDirectory = path.dirname(serverPath);
		const installationComplete = Date.now();

		let serverOptions = await generateServerOptions(serviceConfigName, context.logPath, serverPath);
		let clientOptions = getClientOptions(serviceConfigName, context);
		this.client = new LanguageClient(ServerServiceName, serverOptions, clientOptions);
		const processStart = Date.now();
		const clientReadyPromise = this.client.onReady().then(() => {
			const processEnd = Date.now();
			statusView.text = localize('serviceStartedStatusMsg', "{0} service  - {1} Started", ServerServiceName, serviceConfigName);

			setTimeout(() => {
				statusView.hide();
			}, 1500);

			Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
				installationTime: String(installationComplete - installationStart),
				processStartupTime: String(processEnd - processStart),
				totalTime: String(processEnd - installationStart),
				beginningTimestamp: String(installationStart)
			});
		});

		statusView.show();
		statusView.text = localize('startingServiceStatusMsg', "Starting {0} service  - {1}", ServerServiceName, serviceConfigName);
		this.client.start();
		await clientReadyPromise;

		return this.client;
	}


	private async download(config: any, context: vscode.ExtensionContext): Promise<string> {
		config.installDirectory = path.join(context.extensionPath, config.installDirectory);
		config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
		config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;
		return getOrDownloadServer(config, handleServerProviderEvent);
	}

	async dispose(): Promise<void> {
		this.disposables.forEach(d => d.dispose());
		if (this.client) {
			await this.client.stop();
		}
	}
}

async function generateServerOptions(serviceConfigName: string, logPath: string, executablePath: string): Promise<ServerOptions> {
	const launchArgs = getCommonLaunchArgsAndCleanupOldLogFiles(logPath, 'SqlMigrationExteion-' + serviceConfigName + '.log', executablePath);
	const enableAsyncMessageProcessing = await getParallelMessageProcessingConfig();
	if (enableAsyncMessageProcessing) {
		launchArgs.push('--parallel-message-processing');
	}
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function handleServerProviderEvent(e: string | string[], ...args: any[]): void {
	let dots = 0;
	switch (e) {
		case Events.INSTALL_START:
			outputChannel.show(true);
			statusView.show();
			outputChannel.appendLine(localize('installingServiceChannelMsg', "Installing {0} to {1}", ServerServiceName, args[0]));
			statusView.text = localize('installingServiceStatusMsg', "Installing {0}", ServerServiceName);
			break;
		case Events.INSTALL_END:
			outputChannel.appendLine(localize('installedServiceChannelMsg', "Installed {0}", ServerServiceName));
			break;
		case Events.DOWNLOAD_START:
			outputChannel.appendLine(localize('downloadingServiceChannelMsg', "Downloading {0}", args[0]));
			outputChannel.append(localize('downloadingServiceSizeChannelMsg', "({0} KB)", Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)));
			statusView.text = localize('downloadingServiceStatusMsg', "Downloading {0}", ServerServiceName);
			break;
		case Events.DOWNLOAD_PROGRESS:
			let newDots = Math.ceil(args[0] / 5);
			if (newDots > dots) {
				outputChannel.append('.'.repeat(newDots - dots));
				dots = newDots;
			}
			break;
		case Events.DOWNLOAD_END:
			outputChannel.appendLine(localize('downloadServiceDoneChannelMsg', "Done installing {0}", ServerServiceName));
			break;
		case Events.ENTRY_EXTRACTED:
			outputChannel.appendLine(localize('entryExtractedChannelMsg', "Extracted {0} ({1}/{2})", args[0], args[1], args[2]));
			break;
	}
}

function getClientOptions(serviceConfigName: string, context: vscode.ExtensionContext): VSLanguageClientOptions {
	return {
		errorHandler: new LanguageClientErrorHandler(serviceConfigName),
		outputChannel: new CustomOutputChannel(serviceConfigName)
	};

}


class CustomOutputChannel implements vscode.OutputChannel {
	constructor(serviceConfigName: string) {
		this.name = 'CustomOutputChannel-' + serviceConfigName;
	}
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
	replace(value: string): void {

	}
}

