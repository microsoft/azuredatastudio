/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { IConfig, ServerProvider, Events, LogLevel } from '@microsoft/ads-service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as path from 'path';
import { EventAndListener } from 'eventemitter2';

import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import { ApiWrapper } from '../apiWrapper';
import * as Constants from '../constants';
import { TelemetryFeature, DataSourceWizardFeature } from './features';
import { promises as fs } from 'fs';

export class ServiceClient {
	private statusView: vscode.StatusBarItem;

	constructor(private apiWrapper: ApiWrapper, private outputChannel: vscode.OutputChannel) {
		this.statusView = this.apiWrapper.createStatusBarItem(vscode.StatusBarAlignment.Left);
	}

	public async startService(context: vscode.ExtensionContext): Promise<void> {
		const rawConfig = await fs.readFile(path.join(context.extensionPath, 'config.json'));
		const config: IConfig = JSON.parse(rawConfig.toString());
		config.installDirectory = path.join(context.extensionPath, config.installDirectory);
		config.proxy = this.apiWrapper.getConfiguration('http').get('proxy');
		config.strictSSL = this.apiWrapper.getConfiguration('http').get('proxyStrictSSL') || true;

		const serverdownloader = new ServerProvider(config);
		serverdownloader.eventEmitter.onAny(this.generateHandleServerProviderEvent());

		let clientOptions: ClientOptions = this.createClientOptions();

		const installationStart = Date.now();
		let client: SqlOpsDataClient;
		return new Promise((resolve, reject) => {
			serverdownloader.getOrDownloadServer().then(e => {
				const installationComplete = Date.now();
				let serverOptions = this.generateServerOptions(e, context);
				client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
				const processStart = Date.now();
				client.onReady().then(() => {
					const processEnd = Date.now();
					this.statusView.text = localize('serviceStarted', '{0} started', Constants.serviceName);
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
				this.statusView.text = localize('serviceStarting', 'Starting {0}...', Constants.serviceName);
				let disposable = client.start();
				context.subscriptions.push(disposable);
				resolve();
			}, e => {
				Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
				this.apiWrapper.showErrorMessage(localize('serviceStartFailed', 'Failed to start {0}: {1}', Constants.serviceName, e));
				// Just resolve to avoid unhandled promise. We show the error to the user.
				resolve();
			});
		});
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
				DataSourceWizardFeature
			],
			outputChannel: new CustomOutputChannel()
		};
	}

	private generateServerOptions(executablePath: string, context: vscode.ExtensionContext): ServerOptions {
		let launchArgs = [];
		launchArgs.push('--log-dir');
		let logFileLocation = context['logPath'];
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
					this.statusView.text = localize('installingService', "Installing {0}", Constants.serviceName);
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
				case Events.LOG_EMITTED:
					if (args[0] >= LogLevel.Warning) {
						this.outputChannel.appendLine(args[1]);
					}
					break;
				default:
					console.error(`Unknown event from Server Provider ${e}`);
					break;
			}
		};
	}
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
	show(column?: any, preserveFocus?: any): void {
	}
	hide(): void {
	}
	dispose(): void {
	}
	replace(value: string): void {
		throw new Error('Method not implemented.');
	}
}

