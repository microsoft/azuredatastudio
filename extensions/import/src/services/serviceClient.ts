/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { ServerProvider, Events } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as path from 'path';
import { EventAndListener } from 'eventemitter2';

import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import * as Constants from '../common/constants';
import { TelemetryFeature, FlatFileImportFeature } from './features';
import { promises as fs } from 'fs';

export class ServiceClient {
	private statusView: vscode.StatusBarItem;

	constructor(
		private outputChannel: vscode.OutputChannel,
	) {
		this.statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	}

	public async startService(context: vscode.ExtensionContext): Promise<SqlOpsDataClient> {
		const rawConfig = await fs.readFile(path.join(context.extensionPath, 'config.json'));
		let clientOptions: ClientOptions = this.createClientOptions();
		try {
			const installationStart = Date.now();
			let client: SqlOpsDataClient;
			let serviceBinaries = await this.downloadBinaries(context, rawConfig);
			const installationComplete = Date.now();
			let serverOptions = this.generateServerOptions(serviceBinaries, context);
			client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
			const processStart = Date.now();
			client.onReady().then(() => {
				const processEnd = Date.now();
				this.statusView.text = localize('serviceStarted', "{0} Started", Constants.serviceName);
				setTimeout(() => {
					this.statusView.hide();
				}, 1500);
				Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
					installationTime: String(installationComplete - installationStart),
					processStartupTime: String(processEnd - processStart),
					totalTime: String(processEnd - installationStart),
					beginningTimestamp: String(installationStart)
				});
			});
			this.statusView.show();
			this.statusView.text = localize('serviceStarting', "Starting {0}", Constants.serviceName);
			let disposable = client.start();
			context.subscriptions.push(disposable);
			return client;
		}
		catch (error) {
			Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
			vscode.window.showErrorMessage(localize('flatFileImport.serviceStartFailed', "Failed to start {0}: {1}", Constants.serviceName, error));
			// Just resolve to avoid unhandled promise. We show the error to the user.
			return undefined;
		}
	}

	public async downloadBinaries(context: vscode.ExtensionContext, rawConfig: Buffer): Promise<string> {
		const config = JSON.parse(rawConfig.toString());
		config.installDirectory = path.join(context.extensionPath, config.installDirectory);
		config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
		config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;
		const serverdownloader = new ServerProvider(config);
		serverdownloader.eventEmitter.onAny(this.generateHandleServerProviderEvent());
		return serverdownloader.getOrDownloadServer();
	}

	private createClientOptions(): ClientOptions {
		return {
			providerId: Constants.providerId,
			errorHandler: new LanguageClientErrorHandler(),
			synchronize: {
				configurationSection: [Constants.extensionConfigSectionName, Constants.sqlConfigSectionName]
			},
			features: [
				// we only want to add new features
				TelemetryFeature,
				FlatFileImportFeature
			],
			outputChannel: new CustomOutputChannel()
		};
	}

	private generateServerOptions(executablePath: string, context: vscode.ExtensionContext): ServerOptions {
		let launchArgs = [];
		launchArgs.push('--log-dir');
		let logFileLocation = context.logPath;
		launchArgs.push(logFileLocation);
		let config = vscode.workspace.getConfiguration(Constants.extensionConfigSectionName);
		if (config) {
			let logDebugInfo = config[Constants.configLogDebugInfo];
			if (logDebugInfo) {
				launchArgs.push('--enable-logging');
			}
		}

		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}

	private generateHandleServerProviderEvent(): EventAndListener {
		let dots = 0;
		return (e: string, ...args: any[]) => {
			switch (e) {
				case Events.INSTALL_START:
					this.outputChannel.show(true);
					this.statusView.show();
					this.outputChannel.appendLine(localize('installingServiceDetailed', "Installing {0} to {1}", Constants.serviceName, args[0]));
					this.statusView.text = localize('installingService', "Installing {0} Service", Constants.serviceName);
					break;
				case Events.INSTALL_END:
					this.outputChannel.appendLine(localize('serviceInstalled', "Installed {0}", Constants.serviceName));
					break;
				case Events.DOWNLOAD_START:
					this.outputChannel.appendLine(localize('downloadingService', "Downloading {0}", args[0]));
					this.outputChannel.append(localize('downloadingServiceSize', "({0} KB)", Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)));
					this.statusView.text = localize('downloadingServiceStatus', "Downloading {0}", Constants.serviceName);
					break;
				case Events.DOWNLOAD_PROGRESS:
					let newDots = Math.ceil(args[0] / 5);
					if (newDots > dots) {
						this.outputChannel.append('.'.repeat(newDots - dots));
						dots = newDots;
					}
					break;
				case Events.DOWNLOAD_END:
					this.outputChannel.appendLine(localize('downloadingServiceComplete', "Done downloading {0}", Constants.serviceName));
					break;
				case Events.ENTRY_EXTRACTED:
					this.outputChannel.appendLine(localize('entryExtractedChannelMsg', "Extracted {0} ({1}/{2})", args[0], args[1], args[2]));
					break;
			}
		};
	}
}

class CustomOutputChannel implements vscode.OutputChannel {
	name: string;
	append(value: string): void {
	}
	appendLine(value: string): void {
	}
	// tslint:disable-next-line:no-empty
	clear(): void {
	}
	show(preserveFocus?: boolean): void;
	show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
	// tslint:disable-next-line:no-empty
	show(column?: any, preserveFocus?: any): void {
	}
	// tslint:disable-next-line:no-empty
	hide(): void {
	}
	// tslint:disable-next-line:no-empty
	dispose(): void {
	}
}
