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
import { localize } from './localize';
import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { TelemetryFeature, AgentServicesFeature, SerializationFeature } from './features';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import { SchemaCompareService } from './schemaCompare/schemaCompareService';
import { AppContext } from './appContext';
import { DacFxService } from './dacfx/dacFxService';
import { CmsService } from './cms/cmsService';

const baseConfig = require('./config.json');

const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

export class SqlToolsServer {

	private client: SqlOpsDataClient;
	private config: IConfig;
	private disposables = new Array<{ dispose: () => void }>();

	public async start(context: AppContext): Promise<SqlOpsDataClient> {
		try {
			const installationStart = Date.now();
			const path = await this.download();
			const installationComplete = Date.now();
			let serverOptions = generateServerOptions(path);
			let clientOptions = getClientOptions(context);
			this.client = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
			const processStart = Date.now();
			this.client.onReady().then(() => {
				const processEnd = Date.now();
				statusView.text = 'Service Started';
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
			statusView.text = 'Starting service';
			this.client.start();
			await this.activateFeatures();
			return this.client;
		} catch (e) {
			Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
			vscode.window.showErrorMessage('Failed to start Sql tools service');
			throw e;
		}
	}

	private download() {
		this.config = JSON.parse(JSON.stringify(baseConfig));
		this.config.installDirectory = path.join(__dirname, this.config.installDirectory);
		this.config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
		this.config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

		const serverdownloader = new ServerProvider(this.config);
		serverdownloader.eventEmitter.onAny(generateHandleServerProviderEvent());
		return serverdownloader.getOrDownloadServer();
	}

	private activateFeatures(): Promise<void> {
		const credsStore = new CredentialStore(this.config);
		const resourceProvider = new AzureResourceProvider(this.config);
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

function generateServerOptions(executablePath: string): ServerOptions {
	const launchArgs = getCommonLaunchArgsAndCleanupOldLogFiles('sqltools', executablePath);
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function generateHandleServerProviderEvent() {
	let dots = 0;
	return (e: string, ...args: any[]) => {
		switch (e) {
			case Events.INSTALL_START:
				outputChannel.show(true);
				statusView.show();
				outputChannel.appendLine(localize('installingServiceChannelMsg', 'Installing {0} service to {1}', Constants.serviceName, args[0]));
				statusView.text = localize('installingServiceStatusMsg', 'Installing Service');
				break;
			case Events.INSTALL_END:
				outputChannel.appendLine(localize('installedServiceChannelMsg', 'Installed'));
				break;
			case Events.DOWNLOAD_START:
				outputChannel.appendLine(localize('downloadingServiceChannelMsg', 'Downloading {0}', args[0]));
				outputChannel.append(localize('downloadingServiceSizeChannelMsg', '({0} KB)', Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)));
				statusView.text = localize('downloadingServiceStatusMsg', 'Downloading Service');
				break;
			case Events.DOWNLOAD_PROGRESS:
				let newDots = Math.ceil(args[0] / 5);
				if (newDots > dots) {
					outputChannel.append('.'.repeat(newDots - dots));
					dots = newDots;
				}
				break;
			case Events.DOWNLOAD_END:
				outputChannel.appendLine(localize('downloadServiceDoneChannelMsg', 'Done!'));
				break;
			default:
				console.error(`Unknown event from Server Provider ${e}`);
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
			AgentServicesFeature,
			SerializationFeature,
			SchemaCompareService.asFeature(context),
			DacFxService.asFeature(context),
			CmsService.asFeature(context)
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
