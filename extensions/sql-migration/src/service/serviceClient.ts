/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { ServerProvider, Events, LogLevel, IConfig } from '@microsoft/ads-service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import * as path from 'path';
import { EventAndListener } from 'eventemitter2';
import { SqlMigrationService } from './features';
import { promises as fs } from 'fs';
import * as constants from '../constants/strings';
import { IMessage } from './contracts';
import { ErrorAction, CloseAction } from 'vscode-languageclient';
import { env } from 'process';
import { exists } from './utils';
import { logError, TelemetryViews } from '../telemetry';

export class ServiceClient {
	private statusView: vscode.StatusBarItem;

	constructor(
		private outputChannel: vscode.OutputChannel,
	) {
		this.statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	}

	public async startService(context: vscode.ExtensionContext): Promise<SqlOpsDataClient | undefined> {
		const rawConfig = await fs.readFile(path.join(context.extensionPath, 'config.json'));
		let clientOptions: ClientOptions = this.createClientOptions();
		try {
			let client: SqlOpsDataClient;
			let serviceBinary: string = '';
			let downloadBinary = true;
			if (env['ADS_MIGRATIONSERVICE']) {
				const config = <IConfig>JSON.parse(rawConfig.toString());
				for (let executableFile of config.executableFiles) {
					const executableFilePath = path.join(env['ADS_MIGRATIONSERVICE'], executableFile);
					if (await exists(executableFilePath)) {
						downloadBinary = false;
						serviceBinary = executableFilePath;
					}
				}
				if (!downloadBinary) {
					vscode.window.showInformationMessage('Using Migration service found at: ' + serviceBinary).then((v) => { }, (r) => { });
				} else {
					vscode.window.showErrorMessage('Failed to find migration service binary falling back to downloaded binary').then((v) => { }, (r) => { });
				}
			}
			if (downloadBinary) {
				serviceBinary = await this.downloadBinaries(context, rawConfig);
			}
			let serverOptions = this.generateServerOptions(serviceBinary, context);
			client = new SqlOpsDataClient(constants.serviceName, serverOptions, clientOptions);
			client.onReady().then(() => {
				this.statusView.text = localize('serviceStarted', "{0} Started", constants.serviceName);
				setTimeout(() => {
					this.statusView.hide();
				}, 1500);
			}).catch(e => {
				console.error(e);
			});
			this.statusView.show();
			this.statusView.text = localize('serviceStarting', "Starting {0}", constants.serviceName);
			let disposable = client.start();
			context.subscriptions.push(disposable);
			return client;
		}
		catch (error) {
			await vscode.window.showErrorMessage(localize('flatFileImport.serviceStartFailed', "Failed to start {0}: {1}", constants.serviceName, error.stack.toString()));
			logError(TelemetryViews.SqlServerDashboard, error.stack.toString(), error);
			return undefined;
		}
	}

	public async downloadBinaries(context: vscode.ExtensionContext, rawConfig: Buffer): Promise<string> {
		try {
			const config = JSON.parse(rawConfig.toString());
			config.installDirectory = path.join(context.extensionPath, config.installDirectory);
			config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
			config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL', true);
			const serverdownloader = new ServerProvider(config);
			serverdownloader.eventEmitter.onAny(this.generateHandleServerProviderEvent());
			return serverdownloader.getOrDownloadServer();
		}
		catch (error) {
			const errorStr = localize('downloadingServiceFailed', "Failed to download binaries for {0}. Use the following link to troubleshoot: {1}", constants.serviceName, "https://aka.ms/dms-migrations-troubleshooting#azure-data-studio-limitations");
			const errorStrWithLink = localize('downloadingServiceFailedWithLinkMarkup', "Failed to download binaries for {0}. Use this [link to troubleshoot]({1}).", constants.serviceName, "https://aka.ms/dms-migrations-troubleshooting#azure-data-studio-limitations");
			this.outputChannel.appendLine(errorStr);
			void vscode.window.showErrorMessage(errorStrWithLink);
			logError(TelemetryViews.SqlServerDashboard, errorStr, error);
			throw error;
		}
	}

	private createClientOptions(): ClientOptions {
		return {
			providerId: constants.providerId,
			errorHandler: new LanguageClientErrorHandler(),
			synchronize: {
				configurationSection: [constants.extensionConfigSectionName, constants.sqlConfigSectionName]
			},
			features: [
				// we only want to add new features
				SqlMigrationService,
			],
			outputChannel: this.outputChannel
		};
	}

	private generateServerOptions(executablePath: string, context: vscode.ExtensionContext): ServerOptions {
		let launchArgs = [];
		launchArgs.push(`--locale`, vscode.env.language);
		launchArgs.push('--log-file', path.join(context.logUri.fsPath));
		launchArgs.push('--tracing-level', this.getConfigTracingLevel());
		launchArgs.push('--autoflush-log');
		return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
	}

	private getConfigTracingLevel(): TracingLevel {
		let config = vscode.workspace.getConfiguration('mssql');
		if (config) {
			return config['tracingLevel'];
		} else {
			return TracingLevel.Critical;
		}
	}

	private generateHandleServerProviderEvent(): EventAndListener {
		let dots = 0;
		return (e: string | string[], ...args: any[]) => {
			switch (e) {
				case Events.INSTALL_START:
					this.outputChannel.show(true);
					this.statusView.show();
					this.outputChannel.appendLine(localize('installingServiceDetailed', "Installing {0} to {1}", constants.serviceName, args[0]));
					this.statusView.text = localize('installingService', "Installing {0} Service", constants.serviceName);
					break;
				case Events.INSTALL_END:
					this.outputChannel.appendLine(localize('serviceInstalled', "Installed {0}", constants.serviceName));
					break;
				case Events.DOWNLOAD_START:
					this.outputChannel.appendLine(localize('downloadingService', "Downloading {0}", args[0]));
					this.outputChannel.append(localize('downloadingServiceSize', "({0} KB)", Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)));
					this.statusView.text = localize('downloadingServiceStatus', "Downloading {0}", constants.serviceName);
					break;
				case Events.DOWNLOAD_PROGRESS:
					let newDots = Math.ceil(args[0] / 5);
					if (newDots > dots) {
						this.outputChannel.append('.'.repeat(newDots - dots));
						dots = newDots;
					}
					break;
				case Events.DOWNLOAD_END:
					this.outputChannel.appendLine(localize('downloadingServiceComplete', "Done downloading {0}", constants.serviceName));
					break;
				case Events.ENTRY_EXTRACTED:
					this.outputChannel.appendLine(localize('entryExtractedChannelMsg', "Extracted {0} ({1}/{2})", args[0], args[1], args[2]));
					break;
				case Events.LOG_EMITTED:
					if (args[0] >= LogLevel.Warning) {
						this.outputChannel.appendLine(args[1]);
					}
					break;
				default:
					break;
			}
		};
	}
}

/**
 * Handle Language Service client errors
 */
class LanguageClientErrorHandler {

	/**
	 * Creates an instance of LanguageClientErrorHandler.
	 * @memberOf LanguageClientErrorHandler
	 */
	constructor() {

	}

	/**
	 * Show an error message prompt with a link to known issues wiki page
	 * @memberOf LanguageClientErrorHandler
	 */
	showOnErrorPrompt(error: Error): void {
		// TODO add telemetry
		// Telemetry.sendTelemetryEvent('SqlToolsServiceCrash');
		console.log(error);
		vscode.window.showErrorMessage(
			constants.serviceCrashMessage(error.message),
		).then(() => { }, () => { });
	}

	/**
	 * Callback for language service client error
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	error(error: Error, message: IMessage, count: number): ErrorAction {
		this.showOnErrorPrompt(error);

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return ErrorAction.Shutdown;
	}

	/**
	 * Callback for language service client closed
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	closed(): CloseAction {
		this.showOnErrorPrompt({ name: 'Service crashed', message: constants.serviceCrashed });

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return CloseAction.DoNotRestart;
	}
}

/**
 * The tracing level defined in the package.json
 */
enum TracingLevel {
	All = 'All',
	Off = 'Off',
	Critical = 'Critical',
	Error = 'Error',
	Warning = 'Warning',
	Information = 'Information',
	Verbose = 'Verbose'
}
