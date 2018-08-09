/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { IConfig, ServerProvider, Events } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as path from 'path';
import { EventAndListener } from 'eventemitter2';

import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import * as Constants from '../constants';
import { TelemetryFeature, FlatFileImportFeature } from './features';
import * as serviceUtils from './serviceUtils';

const baseConfig = require('./config.json');

export class ServiceClient {
	private statusView: vscode.StatusBarItem;

	constructor(private outputChannel: vscode.OutputChannel) {
		this.statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	}

	public startService(context: vscode.ExtensionContext): Promise<SqlOpsDataClient> {
		let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
		config.installDirectory = path.join(context.extensionPath, config.installDirectory);
		config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
		config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

		const serverdownloader = new ServerProvider(config);
		serverdownloader.eventEmitter.onAny(this.generateHandleServerProviderEvent());

		let clientOptions: ClientOptions = this.createClientOptions();

		const installationStart = Date.now();
		let client: SqlOpsDataClient;
		return new Promise((resolve, reject) => {
			serverdownloader.getOrDownloadServer().then(e => {
				const installationComplete = Date.now();
				let serverOptions = this.generateServerOptions(e);
				client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
				const processStart = Date.now();
				client.onReady().then(() => {
					const processEnd = Date.now();
					this.statusView.text = localize('serviceStarted', 'Service Started');
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
				this.statusView.text = localize('serviceStarting', 'Starting service');
				let disposable = client.start();
				context.subscriptions.push(disposable);
				resolve(client);
			}, e => {
				Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
				vscode.window.showErrorMessage(localize('flatFileImport.serviceStartFailed', 'Failed to start Import service{0}', e));
				// Just resolve to avoid unhandled promise. We show the error to the user.
				resolve(undefined);
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
				FlatFileImportFeature
			],
			outputChannel: new CustomOutputChannel()
		};
	}

	private generateServerOptions(executablePath: string): ServerOptions {
		let launchArgs = [];
		launchArgs.push('--log-dir');
		let logFileLocation = path.join(serviceUtils.getDefaultLogLocation(), 'flatfileimport');
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
			this.outputChannel.show();
			this.statusView.show();
			switch (e) {
				case Events.INSTALL_START:
					this.outputChannel.appendLine(localize('installingServiceDetailed', 'Installing {0} service to {1}', Constants.serviceName, args[0]));
					this.statusView.text = localize('installingService', 'Installing Service');
					break;
				case Events.INSTALL_END:
					this.outputChannel.appendLine(localize('serviceInstalled', 'Installed'));
					break;
				case Events.DOWNLOAD_START:
					this.outputChannel.appendLine(localize('downloadingService', 'Downloading {0}', args[0]));
					this.outputChannel.append(`(${Math.ceil(args[1] / 1024)} KB)`);
					this.statusView.text = localize('downloadingServiceStatus', 'Downloading Service');
					break;
				case Events.DOWNLOAD_PROGRESS:
					let newDots = Math.ceil(args[0] / 5);
					if (newDots > dots) {
						this.outputChannel.append('.'.repeat(newDots - dots));
						dots = newDots;
					}
					break;
				case Events.DOWNLOAD_END:
					this.outputChannel.appendLine(localize('downloadingServiceComplete', 'Done!'));
					break;
				default:
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

