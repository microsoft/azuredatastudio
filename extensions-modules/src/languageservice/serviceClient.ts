/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ExtensionContext, workspace, window, OutputChannel, languages } from 'vscode';
import { SqlOpsDataClient, LanguageClientOptions } from 'dataprotocol-client';
import { CloseAction, ErrorAction, ServerOptions, NotificationHandler, NotificationType, RequestType, TransportKind } from 'vscode-languageclient';

import { VscodeWrapper } from '../controllers/vscodeWrapper';
import { Telemetry } from '../models/telemetry';
import { Utils } from '../models/utils';
import { VersionRequest, IExtensionConstants } from '../models/contracts/contracts';
import { Logger } from '../models/logger';
import ServerProvider from './server';
import ServiceDownloadProvider from './serviceDownloadProvider';
import DecompressProvider from './decompressProvider';
import HttpClient from './httpClient';
import ExtConfig from '../configurations/extConfig';
import { PlatformInformation, Runtime } from '../models/platform';
import { ServerInitializationResult, ServerStatusView } from './serverStatus';
import StatusView from '../views/statusView';
import * as LanguageServiceContracts from '../models/contracts/languageService';
import { Constants } from '../models/constants';
import ServiceStatus from './serviceStatus';

const opener = require('opener');
const path = require('path');
let _channel: OutputChannel = undefined;

/**
 * @interface IMessage
 */
interface IMessage {
	jsonrpc: string;
}

/**
 * Handle Language Service client errors
 * @class LanguageClientErrorHandler
 */
class LanguageClientErrorHandler {

	private vscodeWrapper: VscodeWrapper;

	/**
	 * Creates an instance of LanguageClientErrorHandler.
	 * @memberOf LanguageClientErrorHandler
	 */
	constructor(constants: IExtensionConstants) {
		if (!this.vscodeWrapper) {
			this.vscodeWrapper = new VscodeWrapper(constants);
		}
		Telemetry.getRuntimeId = this.vscodeWrapper.constants.getRuntimeId;
	}

	/**
	 * Show an error message prompt with a link to known issues wiki page
	 * @memberOf LanguageClientErrorHandler
	 */
	showOnErrorPrompt(): void {
		let extensionConstants = this.vscodeWrapper.constants;
		Telemetry.sendTelemetryEvent(extensionConstants.serviceName + 'Crash');
		this.vscodeWrapper.showErrorMessage(
			extensionConstants.serviceCrashMessage,
			Constants.serviceCrashButton).then(action => {
				if (action && action === Constants.serviceCrashButton) {
					opener(extensionConstants.serviceCrashLink);
				}
			});
	}

	/**
	 * Callback for language service client error
	 *
	 * @param {Error} error
	 * @param {Message} message
	 * @param {number} count
	 * @returns {ErrorAction}
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	error(error: Error, message: IMessage, count: number): ErrorAction {
		this.showOnErrorPrompt();

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return ErrorAction.Shutdown;
	}

	/**
	 * Callback for language service client closed
	 *
	 * @returns {CloseAction}
	 *
	 * @memberOf LanguageClientErrorHandler
	 */
	closed(): CloseAction {
		this.showOnErrorPrompt();

		// we don't retry running the service since crashes leave the extension
		// in a bad, unrecovered state
		return CloseAction.DoNotRestart;
	}
}

// The Service Client class handles communication with the VS Code LanguageClient
export class SqlToolsServiceClient {
	// singleton instance
	private static _instance: SqlToolsServiceClient = undefined;

	private static _constants: IExtensionConstants = undefined;

	public static get constants(): IExtensionConstants {
		return this._constants;
	}

	public static set constants(constantsObject: IExtensionConstants) {
		this._constants = constantsObject;
		Telemetry.getRuntimeId = this._constants.getRuntimeId;
	}

	private static _helper: LanguageServiceContracts.ILanguageClientHelper = undefined;

	public static get helper(): LanguageServiceContracts.ILanguageClientHelper {
		return this._helper;
	}

	public static set helper(helperObject: LanguageServiceContracts.ILanguageClientHelper) {
		this._helper = helperObject;
	}

	// VS Code Language Client
	private _client: SqlOpsDataClient = undefined;

	// getter method for the Language Client
	private get client(): SqlOpsDataClient {
		return this._client;
	}

	private set client(client: SqlOpsDataClient) {
		this._client = client;
	}

	public installDirectory: string;
	private _downloadProvider: ServiceDownloadProvider;
	private _vscodeWrapper: VscodeWrapper;

	private _serviceStatus: ServiceStatus;

	private _languageClientStartTime: number = undefined;
	private _installationTime: number = undefined;

	constructor(
		private _server: ServerProvider,
		private _logger: Logger,
		private _statusView: StatusView,
		private _config: ExtConfig) {
		this._downloadProvider = _server.downloadProvider;
		if (!this._vscodeWrapper) {
			this._vscodeWrapper = new VscodeWrapper(SqlToolsServiceClient.constants);
		}
		this._serviceStatus = new ServiceStatus(SqlToolsServiceClient._constants.serviceName);
	}

	// gets or creates the singleton service client instance
	public static getInstance(path: string): SqlToolsServiceClient {
		if (this._instance === undefined) {
			let constants = this._constants;
			let config = new ExtConfig(constants.extensionConfigSectionName, undefined, path);
			_channel = window.createOutputChannel(constants.serviceInitializingOutputChannelName);
			let logger = new Logger(text => _channel.append(text), constants);
			let serverStatusView = new ServerStatusView(constants);
			let httpClient = new HttpClient();
			let decompressProvider = new DecompressProvider();
			let downloadProvider = new ServiceDownloadProvider(config, logger, serverStatusView, httpClient,
				decompressProvider, constants, false);
			let serviceProvider = new ServerProvider(downloadProvider, config, serverStatusView, constants.extensionConfigSectionName);
			let statusView = new StatusView();
			this._instance = new SqlToolsServiceClient(serviceProvider, logger, statusView, config);
		}
		return this._instance;
	}

	// initialize the Service Client instance by launching
	// out-of-proc server through the LanguageClient
	public initialize(context: ExtensionContext): Promise<any> {
		this._logger.appendLine(SqlToolsServiceClient._constants.serviceInitializing);
		this._languageClientStartTime = Date.now();
		return PlatformInformation.getCurrent(SqlToolsServiceClient._constants.getRuntimeId, SqlToolsServiceClient._constants.extensionName).then(platformInfo => {
			return this.initializeForPlatform(platformInfo, context);
		}).catch(err => {
			this._vscodeWrapper.showErrorMessage(err);
		});
	}

	public initializeForPlatform(platformInfo: PlatformInformation, context: ExtensionContext): Promise<ServerInitializationResult> {
		return new Promise<ServerInitializationResult>((resolve, reject) => {
			this._logger.appendLine(SqlToolsServiceClient._constants.commandsNotAvailableWhileInstallingTheService);
			this._logger.appendLine();
			this._logger.append(`Platform: ${platformInfo.toString()}`);

			if (!platformInfo.isValidRuntime()) {
				// if it's an unknown Linux distro then try generic Linux x64 and give a warning to the user
				if (platformInfo.isLinux()) {
					this._logger.appendLine(Constants.usingDefaultPlatformMessage);
					platformInfo.runtimeId = Runtime.Linux_64;
				}

				let ignoreWarning: boolean = this._config.getWorkspaceConfig(Constants.ignorePlatformWarning, false);
				if (!ignoreWarning) {
					this._vscodeWrapper.showErrorMessage(
						Constants.unsupportedPlatformErrorMessage,
						Constants.neverShowAgain)
						.then(action => {
							if (action === Constants.neverShowAgain) {
								this._config.updateWorkspaceConfig(Constants.ignorePlatformWarning, true);
							}
						});
				}

				Telemetry.sendTelemetryEvent('UnsupportedPlatform', { platform: platformInfo.toString() });
			}

			if (platformInfo.runtimeId) {
				this._logger.appendLine(` (${platformInfo.getRuntimeDisplayName()})`);
			} else {
				this._logger.appendLine();
			}

			this._logger.appendLine();

			this._server.getServerPath(platformInfo.runtimeId).then(serverPath => {
				if (serverPath === undefined) {
					// Check if the service already installed and if not open the output channel to show the logs
					if (_channel !== undefined) {
						_channel.show();
					}
					let installationStartTime = Date.now();
					this._server.downloadServerFiles(platformInfo.runtimeId).then(installedServerPath => {
						this._installationTime = Date.now() - installationStartTime;
						this.initializeLanguageClient(installedServerPath, context, platformInfo.runtimeId);
						resolve(new ServerInitializationResult(true, true, installedServerPath));
					}).catch(downloadErr => {
						reject(downloadErr);
					});
				} else {
					this.initializeLanguageClient(serverPath, context, platformInfo.runtimeId);
					resolve(new ServerInitializationResult(false, true, serverPath));
				}
			}).catch(err => {
				Utils.logDebug(SqlToolsServiceClient._constants.serviceLoadingFailed + ' ' + err, SqlToolsServiceClient._constants.extensionConfigSectionName);
				Utils.showErrorMsg(SqlToolsServiceClient._constants.serviceLoadingFailed, SqlToolsServiceClient._constants.extensionName);
				Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
				reject(err);
			});
		});
	}

	/**
	 * Initializes the SQL language configuration
	 *
	 * @memberOf SqlToolsServiceClient
	 */
	private initializeLanguageConfiguration(): void {
		languages.setLanguageConfiguration('sql', {
			comments: {
				lineComment: '--',
				blockComment: ['/*', '*/']
			},

			brackets: [
				['{', '}'],
				['[', ']'],
				['(', ')']
			],

			__characterPairSupport: {
				autoClosingPairs: [
					{ open: '{', close: '}' },
					{ open: '[', close: ']' },
					{ open: '(', close: ')' },
					{ open: '"', close: '"', notIn: ['string'] },
					{ open: '\'', close: '\'', notIn: ['string', 'comment'] }
				]
			}
		});
	}

	private initializeLanguageClient(serverPath: string, context: ExtensionContext, runtimeId: Runtime): void {
		if (serverPath === undefined) {
			Utils.logDebug(SqlToolsServiceClient._constants.invalidServiceFilePath, SqlToolsServiceClient._constants.extensionConfigSectionName);
			throw new Error(SqlToolsServiceClient._constants.invalidServiceFilePath);
		} else {
			let self = this;

			if (SqlToolsServiceClient._constants.languageId === 'sql') {
				self.initializeLanguageConfiguration();
			}

			// Use default createServerOptions if one isn't specified
			let serverOptions: ServerOptions = SqlToolsServiceClient._helper ?
				SqlToolsServiceClient._helper.createServerOptions(serverPath, runtimeId) : self.createServerOptions(serverPath);
			this.client = this.createLanguageClient(serverOptions);
			this.installDirectory = this._downloadProvider.getInstallDirectory(runtimeId, SqlToolsServiceClient._constants.extensionConfigSectionName);

			if (context !== undefined) {
				// Create the language client and start the client.
				let disposable = this.client.start();

				// Push the disposable to the context's subscriptions so that the
				// client can be deactivated on extension deactivation

				context.subscriptions.push(disposable);
			}
		}
	}

	public createClient(context: ExtensionContext, runtimeId: Runtime, languageClientHelper: LanguageServiceContracts.ILanguageClientHelper, executableFiles: string[]): Promise<SqlOpsDataClient> {
		return new Promise<SqlOpsDataClient>((resolve, reject) => {
			let client: SqlOpsDataClient;
			this._server.findServerPath(this.installDirectory, executableFiles).then(serverPath => {
				if (serverPath === undefined) {
					reject(new Error(SqlToolsServiceClient._constants.invalidServiceFilePath));
				} else {

					let serverOptions: ServerOptions = languageClientHelper ?
						languageClientHelper.createServerOptions(serverPath, runtimeId) : this.createServerOptions(serverPath);

					// Options to control the language client
					let clientOptions: LanguageClientOptions = {
						documentSelector: [SqlToolsServiceClient._constants.languageId],
						providerId: '',
						synchronize: {
							configurationSection: SqlToolsServiceClient._constants.extensionConfigSectionName
						},
						errorHandler: new LanguageClientErrorHandler(SqlToolsServiceClient._constants),
						serverConnectionMetadata: this._config.getConfigValue(Constants.serverConnectionMetadata),
						outputChannel: {
							append: () => {
							},
							appendLine: () => {
							},
							dispose: () => {
							},
							clear: () => {
							},
							hide: () => {
							},
							name: '',
							show: () => {
							}
						}
					};

					this._serviceStatus.showServiceLoading();
					// cache the client instance for later use
					client = new SqlOpsDataClient(SqlToolsServiceClient._constants.serviceName, serverOptions, clientOptions);

					if (context !== undefined) {
						// Create the language client and start the client.
						let disposable = client.start();

						// Push the disposable to the context's subscriptions so that the
						// client can be deactivated on extension deactivation

						context.subscriptions.push(disposable);
					}
					client.onReady().then(this._serviceStatus.showServiceLoaded);

					resolve(client);
				}
			}, error => {
				reject(error);
			});
		});

	}

	private createServerOptions(servicePath): ServerOptions {
		let serverArgs = [];
		let serverCommand: string = servicePath;
		if (servicePath.endsWith('.dll')) {
			serverArgs = [servicePath];
			serverCommand = 'dotnet';
		}

		// Enable diagnostic logging in the service if it is configured
		let config = workspace.getConfiguration(SqlToolsServiceClient._constants.extensionConfigSectionName);
		if (config) {
			let logDebugInfo = config[Constants.configLogDebugInfo];
			if (logDebugInfo) {
				serverArgs.push('--enable-logging');
			}
		}
		serverArgs.push('--log-dir');
		let logFileLocation = path.join(Utils.getDefaultLogLocation(), SqlToolsServiceClient.constants.extensionName);
		serverArgs.push(logFileLocation);

		// run the service host using dotnet.exe from the path
		let serverOptions: ServerOptions = { command: serverCommand, args: serverArgs, transport: TransportKind.stdio };
		return serverOptions;
	}

	private createLanguageClient(serverOptions: ServerOptions): SqlOpsDataClient {
		// Options to control the language client
		let clientOptions: LanguageClientOptions = {
			documentSelector: [SqlToolsServiceClient._constants.languageId],
			providerId: SqlToolsServiceClient._constants.providerId,
			synchronize: {
				configurationSection: SqlToolsServiceClient._constants.extensionConfigSectionName
			},
			errorHandler: new LanguageClientErrorHandler(SqlToolsServiceClient._constants),
			serverConnectionMetadata: this._config.getConfigValue(Constants.serverConnectionMetadata),
			outputChannel: {
				append: () => {
				},
				appendLine: () => {
				},
				dispose: () => {
				},
				clear: () => {
				},
				hide: () => {
				},
				name: '',
				show: () => {
				}
			}
		};

		this._serviceStatus.showServiceLoading();
		// cache the client instance for later use
		let client = new SqlOpsDataClient(SqlToolsServiceClient._constants.serviceName, serverOptions, clientOptions);
		client.onReady().then(() => {
			this.checkServiceCompatibility();
			this._serviceStatus.showServiceLoaded();
			client.onNotification(LanguageServiceContracts.TelemetryNotification.type, this.handleLanguageServiceTelemetryNotification());
			client.onNotification(LanguageServiceContracts.StatusChangedNotification.type, this.handleLanguageServiceStatusNotification());

			// Report the language client startup time
			let endTime = Date.now();
			let installationTime = this._installationTime || 0;
			let totalTime = endTime - this._languageClientStartTime;
			let processStartupTime = totalTime - installationTime;
			Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
				installationTime: String(installationTime),
				processStartupTime: String(processStartupTime),
				totalTime: String(totalTime),
				beginningTimestamp: String(this._languageClientStartTime)
			});
			this._languageClientStartTime = undefined;
			this._installationTime = undefined;
		});

		return client;
	}

	private handleLanguageServiceTelemetryNotification(): NotificationHandler<LanguageServiceContracts.TelemetryParams> {
		return (event: LanguageServiceContracts.TelemetryParams): void => {
			Telemetry.sendTelemetryEvent(event.params.eventName, event.params.properties, event.params.measures);
		};
	}

	/**
	 * Public for testing purposes only.
	 */
	public handleLanguageServiceStatusNotification(): NotificationHandler<LanguageServiceContracts.StatusChangeParams> {
		return (event: LanguageServiceContracts.StatusChangeParams): void => {
			this._statusView.languageServiceStatusChanged(event.ownerUri, event.status);
		};
	}

	/**
	 * Send a request to the service client
	 * @param type The of the request to make
	 * @param params The params to pass with the request
	 * @returns A thenable object for when the request receives a response
	 */
	public sendRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, params?: P, client: SqlOpsDataClient = undefined): Thenable<R> {
		if (client === undefined) {
			client = this._client;
		}
		if (client !== undefined) {
			return client.sendRequest(type, params);
		}
	}

	/**
	 * Register a handler for a notification type
	 * @param type The notification type to register the handler for
	 * @param handler The handler to register
	 */
	public onNotification<P, RO>(type: NotificationType<P, RO>, handler: NotificationHandler<P>, client: SqlOpsDataClient = undefined): void {
		if (client === undefined) {
			client = this._client;
		}
		if (client !== undefined) {
			return client.onNotification(type, handler);
		}
	}

	public checkServiceCompatibility(): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this._client.sendRequest(VersionRequest.type, undefined).then((result) => {
				Utils.logDebug(SqlToolsServiceClient._constants.extensionName + ' service client version: ' + result, SqlToolsServiceClient._constants.extensionConfigSectionName);

				if (result === undefined || !result.startsWith(SqlToolsServiceClient._constants.serviceCompatibleVersion)) {
					Utils.showErrorMsg(Constants.serviceNotCompatibleError, SqlToolsServiceClient._constants.extensionName);
					Utils.logDebug(Constants.serviceNotCompatibleError, SqlToolsServiceClient._constants.extensionConfigSectionName);
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	}
}
