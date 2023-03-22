/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfig, Events, LogLevel } from '@microsoft/ads-service-downloader';
import { RevealOutputChannelOn, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as Constants from './constants';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as path from 'path';
import * as azurecore from 'azurecore';
import { getAzureAuthenticationLibraryConfig, getCommonLaunchArgsAndCleanupOldLogFiles, getConfigTracingLevel, getEnableSqlAuthenticationProviderConfig, getOrDownloadServer, getParallelMessageProcessingConfig, TracingLevel } from './utils';
import { TelemetryReporter, LanguageClientErrorHandler } from './telemetry';
import { SqlOpsDataClient, ClientOptions } from 'dataprotocol-client';
import { TelemetryFeature, AgentServicesFeature, SerializationFeature, AccountFeature, SqlAssessmentServicesFeature, ProfilerFeature, TableDesignerFeature, ExecutionPlanServiceFeature } from './features';
import { CredentialStore } from './credentialstore/credentialstore';
import { AzureResourceProvider } from './resourceProvider/resourceProvider';
import { SchemaCompareService } from './schemaCompare/schemaCompareService';
import { AppContext } from './appContext';
import { DacFxService } from './dacfx/dacFxService';
import { CmsService } from './cms/cmsService';
import { CompletionExtensionParams, CompletionExtLoadRequest, DidChangeEncryptionIVKeyParams, EncryptionKeysChangedNotification } from './contracts';
import { promises as fs } from 'fs';
import * as nls from 'vscode-nls';
import { LanguageExtensionService } from './languageExtension/languageExtensionService';
import { SqlAssessmentService } from './sqlAssessment/sqlAssessmentService';
import { NotebookConvertService } from './notebookConvert/notebookConvertService';
import { SqlCredentialService } from './credentialstore/sqlCredentialService';
import { AzureBlobService } from './azureBlob/azureBlobService';
import { ErrorDiagnosticsProvider } from './errorDiagnostics/errorDiagnosticsProvider';
import { SqlProjectsService } from './sqlProjects/sqlProjectsService';
import { ObjectManagementService } from './objectManagement/objectManagementService';

const localize = nls.loadMessageBundle();
const outputChannel = vscode.window.createOutputChannel(Constants.serviceName);
const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

// The mapping between MSSQL log level and the service downloader log level.
const LogLevelMapping: { [key: string]: number } = {
	[TracingLevel.All]: LogLevel.Verbose,
	[TracingLevel.Critical]: LogLevel.Critical,
	[TracingLevel.Error]: LogLevel.Error,
	[TracingLevel.Information]: LogLevel.Information,
	[TracingLevel.Verbose]: LogLevel.Verbose,
	[TracingLevel.Warning]: LogLevel.Warning
};

export class SqlToolsServer {

	private client: SqlOpsDataClient;
	private config: IConfig;
	private disposables = new Array<{ dispose: () => void }>();
	public installDirectory: string | undefined = undefined;

	public async start(context: AppContext): Promise<SqlOpsDataClient> {
		try {
			const installationStart = Date.now();
			const serverPath = await this.download(context);
			this.installDirectory = path.dirname(serverPath);
			const installationComplete = Date.now();
			let serverOptions = generateServerOptions(context.extensionContext.logPath, serverPath);
			let clientOptions = getClientOptions(context);
			this.client = new SqlOpsDataClient('mssql', Constants.serviceName, serverOptions, clientOptions);
			const processStart = Date.now();
			const clientReadyPromise = this.client.onReady().then(() => {
				const processEnd = Date.now();
				statusView.text = localize('serviceStartedStatusMsg', "{0} Started", Constants.serviceName);
				setTimeout(() => {
					statusView.hide();
				}, 1500);
				vscode.commands.registerCommand('mssql.loadCompletionExtension', (params: CompletionExtensionParams) => {
					return this.client.sendRequest(CompletionExtLoadRequest.type, params);
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
			await Promise.all([this.activateFeatures(context), clientReadyPromise]);
			await this.handleEncryptionKeyEventNotification(this.client);
			return this.client;
		} catch (e) {
			TelemetryReporter.sendTelemetryEvent('ServiceInitializingFailed');
			void vscode.window.showErrorMessage(localize('failedToStartServiceErrorMsg', "Failed to start {0}", Constants.serviceName));
			throw e;
		}
	}

	/**
	 * This is a hop notification handler to send Encryption Key and Iv information from Azure Core extension to backend
	 * SqlToolsService. This notification is needed for Azure authentication flows to be able to read/write into
	 * shared MSAL cache.
	 * @param client SqlOpsDataClient instance
	 */
	private async handleEncryptionKeyEventNotification(client: SqlOpsDataClient) {
		if (getAzureAuthenticationLibraryConfig() === 'MSAL' && getEnableSqlAuthenticationProviderConfig()) {
			let onDidEncryptionKeysChanged = (await this.getAzureCoreAPI()).onEncryptionKeysUpdated;
			// Register event listener from Azure Core extension
			onDidEncryptionKeysChanged((keys: azurecore.CacheEncryptionKeys) => {
				// Send client notification for updated encryption keys
				client.sendNotification(EncryptionKeysChangedNotification.type,
					<DidChangeEncryptionIVKeyParams>{
						key: keys.key,
						iv: keys.iv
					});
			});
		}
	}

	private async getAzureCoreAPI(): Promise<azurecore.IExtension> {
		const api = (await vscode.extensions.getExtension(azurecore.extension.name)?.activate()) as azurecore.IExtension;
		if (!api) {
			throw new Error('Azure core extension could not be activated.');
		}
		return api;
	}

	private async download(context: AppContext): Promise<string> {
		const configDir = context.extensionContext.extensionPath;
		const rawConfig = await fs.readFile(path.join(configDir, 'config.json'));
		this.config = JSON.parse(rawConfig.toString());
		this.config.installDirectory = path.join(configDir, this.config.installDirectory);
		this.config.proxy = vscode.workspace.getConfiguration('http').get('proxy');
		this.config.strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL', true);
		return getOrDownloadServer(this.config, handleServerProviderEvent);
	}

	private activateFeatures(context: AppContext): Promise<void> {
		const credsStore = new CredentialStore(context, this.config);
		const resourceProvider = new AzureResourceProvider(context.extensionContext.logPath, this.config);
		this.disposables.push(credsStore);
		this.disposables.push(resourceProvider);
		context.registerService(Constants.AzureBlobService, new AzureBlobService(this.client));
		return Promise.all([credsStore.start(), resourceProvider.start()]).then();
	}

	async dispose(): Promise<void> {
		this.disposables.forEach(d => d.dispose());
		if (this.client) {
			await this.client.stop();
		}
	}
}

function generateServerOptions(logPath: string, executablePath: string): ServerOptions {
	const launchArgs = getCommonLaunchArgsAndCleanupOldLogFiles(logPath, 'sqltools.log', executablePath);
	const enableAsyncMessageProcessing = getParallelMessageProcessingConfig();
	if (enableAsyncMessageProcessing) {
		launchArgs.push('--parallel-message-processing');
	}
	const enableSqlAuthenticationProvider = getEnableSqlAuthenticationProviderConfig();
	const azureAuthLibrary = getAzureAuthenticationLibraryConfig();
	if (azureAuthLibrary === 'MSAL' && enableSqlAuthenticationProvider === true) {
		launchArgs.push('--enable-sql-authentication-provider');
	}
	return { command: executablePath, args: launchArgs, transport: TransportKind.stdio };
}

function handleServerProviderEvent(e: string, ...args: any[]): void {
	let dots = 0;
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
			SqlProjectsService.asFeature(context),
			CmsService.asFeature(context),
			SqlAssessmentService.asFeature(context),
			NotebookConvertService.asFeature(context),
			ProfilerFeature,
			SqlCredentialService.asFeature(context),
			TableDesignerFeature,
			ExecutionPlanServiceFeature,
			ErrorDiagnosticsProvider.asFeature(context),
			ObjectManagementService.asFeature(context)
		],
		outputChannel: outputChannel,
		// Automatically reveal the output channel only in dev mode, so that the users are not impacted and issues can still be caught during development.
		revealOutputChannelOn: azdata.env.quality === azdata.env.AppQuality.dev ? RevealOutputChannelOn.Error : RevealOutputChannelOn.Never
	};
}
