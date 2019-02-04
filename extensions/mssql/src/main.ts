/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import * as path from 'path';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { IConfig, ServerProvider, Events } from 'service-downloader';
import { ServerOptions, TransportKind } from 'vscode-languageclient';

import * as Constants from './constants';
import ContextProvider from './contextProvider';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import * as Utils from './utils';
import { Telemetry, LanguageClientErrorHandler } from './telemetry';
import { TelemetryFeature, AgentServicesFeature, DacFxServicesFeature } from './features';
import { AppContext } from './appContext';
import { ApiWrapper } from './apiWrapper';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider/objectExplorerNodeProvider';
import { UploadFilesCommand, MkDirCommand, SaveFileCommand, PreviewFileCommand, CopyPathCommand, DeleteFilesCommand } from './objectExplorerNodeProvider/hdfsCommands';
import { IPrompter } from './prompts/question';
import CodeAdapter from './prompts/adapter';

const baseConfig = require('./config.json');
const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

export async function activate(context: vscode.ExtensionContext): Promise<sqlops.IMssqlExtensionApi> {
	// lets make sure we support this platform first
	let supported = await Utils.verifyPlatform();

	if (!supported) {
		vscode.window.showErrorMessage('Unsupported platform');
		return;
	}

	let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
	config.installDirectory = path.join(__dirname, config.installDirectory);
	config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
	config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL') || true;

	const credentialsStore = new CredentialStore(config);
	const resourceProvider = new AzureResourceProvider(config);
	let languageClient: SqlOpsDataClient;

	const serverdownloader = new ServerProvider(config);

	serverdownloader.eventEmitter.onAny(generateHandleServerProviderEvent());

	let clientOptions: ClientOptions = {
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
			DacFxServicesFeature,
		],
		outputChannel: new CustomOutputChannel()
	};

	let prompter: IPrompter = new CodeAdapter();
	let appContext = new AppContext(context, new ApiWrapper());

	const installationStart = Date.now();
	serverdownloader.getOrDownloadServer().then(e => {
		const installationComplete = Date.now();
		let serverOptions = generateServerOptions(e);
		languageClient = new SqlOpsDataClient(Constants.serviceName, serverOptions, clientOptions);
		const processStart = Date.now();
		languageClient.onReady().then(() => {
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
		languageClient.start();
		credentialsStore.start();
		resourceProvider.start();
		let nodeProvider = new MssqlObjectExplorerNodeProvider(appContext);
		sqlops.dataprotocol.registerObjectExplorerNodeProvider(nodeProvider);
	}, e => {
		Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
		vscode.window.showErrorMessage('Failed to start Sql tools service');
	});

	let contextProvider = new ContextProvider();
	context.subscriptions.push(contextProvider);
	context.subscriptions.push(credentialsStore);
	context.subscriptions.push(resourceProvider);
	context.subscriptions.push(new UploadFilesCommand(prompter, appContext));
	context.subscriptions.push(new MkDirCommand(prompter, appContext));
	context.subscriptions.push(new SaveFileCommand(prompter, appContext));
	context.subscriptions.push(new PreviewFileCommand(prompter, appContext));
	context.subscriptions.push(new CopyPathCommand(appContext));
	context.subscriptions.push(new DeleteFilesCommand(prompter, appContext));
	context.subscriptions.push({ dispose: () => languageClient.stop() });

	let api: sqlops.IMssqlExtensionApi = {
		getMssqlObjectExplorerBrowser(): sqlops.IMssqlObjectExplorerBrowser {
			return {
				getNode: (context: sqlops.ObjectExplorerContext) => {
					let oeProvider = appContext.getService<MssqlObjectExplorerNodeProvider>(Constants.ObjectExplorerService);
					return <any>oeProvider.findNodeForContext(context);
				}
			};
		}
	};
	return api;
}

function generateServerOptions(executablePath: string): ServerOptions {
	let launchArgs = Utils.getCommonLaunchArgsAndCleanupOldLogFiles('sqltools', executablePath);
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function generateHandleServerProviderEvent() {
	let dots = 0;
	return (e: string, ...args: any[]) => {
		outputChannel.show();
		statusView.show();
		switch (e) {
			case Events.INSTALL_START:
				outputChannel.appendLine(`Installing ${Constants.serviceName} service to ${args[0]}`);
				statusView.text = 'Installing Service';
				break;
			case Events.INSTALL_END:
				outputChannel.appendLine('Installed');
				break;
			case Events.DOWNLOAD_START:
				outputChannel.appendLine(`Downloading ${args[0]}`);
				outputChannel.append(`(${Math.ceil(args[1] / 1024)} KB)`);
				statusView.text = 'Downloading Service';
				break;
			case Events.DOWNLOAD_PROGRESS:
				let newDots = Math.ceil(args[0] / 5);
				if (newDots > dots) {
					outputChannel.append('.'.repeat(newDots - dots));
					dots = newDots;
				}
				break;
			case Events.DOWNLOAD_END:
				outputChannel.appendLine('Done!');
				break;
		}
	};
}

// this method is called when your extension is deactivated
export function deactivate(): void {
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
