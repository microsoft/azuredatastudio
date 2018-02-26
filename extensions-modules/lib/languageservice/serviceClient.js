/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const dataprotocol_client_1 = require("dataprotocol-client");
const vscode_languageclient_1 = require("vscode-languageclient");
const vscodeWrapper_1 = require("../controllers/vscodeWrapper");
const telemetry_1 = require("../models/telemetry");
const utils_1 = require("../models/utils");
const contracts_1 = require("../models/contracts/contracts");
const logger_1 = require("../models/logger");
const server_1 = require("./server");
const serviceDownloadProvider_1 = require("./serviceDownloadProvider");
const decompressProvider_1 = require("./decompressProvider");
const httpClient_1 = require("./httpClient");
const extConfig_1 = require("../configurations/extConfig");
const platform_1 = require("../models/platform");
const serverStatus_1 = require("./serverStatus");
const statusView_1 = require("../views/statusView");
const LanguageServiceContracts = require("../models/contracts/languageService");
const constants_1 = require("../models/constants");
const serviceStatus_1 = require("./serviceStatus");
const opener = require('opener');
const path = require('path');
let _channel = undefined;
/**
 * Handle Language Service client errors
 * @class LanguageClientErrorHandler
 */
class LanguageClientErrorHandler {
    /**
     * Creates an instance of LanguageClientErrorHandler.
     * @memberOf LanguageClientErrorHandler
     */
    constructor(constants) {
        if (!this.vscodeWrapper) {
            this.vscodeWrapper = new vscodeWrapper_1.VscodeWrapper(constants);
        }
        telemetry_1.Telemetry.getRuntimeId = this.vscodeWrapper.constants.getRuntimeId;
    }
    /**
     * Show an error message prompt with a link to known issues wiki page
     * @memberOf LanguageClientErrorHandler
     */
    showOnErrorPrompt() {
        let extensionConstants = this.vscodeWrapper.constants;
        telemetry_1.Telemetry.sendTelemetryEvent(extensionConstants.serviceName + 'Crash');
        this.vscodeWrapper.showErrorMessage(extensionConstants.serviceCrashMessage, constants_1.Constants.serviceCrashButton).then(action => {
            if (action && action === constants_1.Constants.serviceCrashButton) {
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
    error(error, message, count) {
        this.showOnErrorPrompt();
        // we don't retry running the service since crashes leave the extension
        // in a bad, unrecovered state
        return vscode_languageclient_1.ErrorAction.Shutdown;
    }
    /**
     * Callback for language service client closed
     *
     * @returns {CloseAction}
     *
     * @memberOf LanguageClientErrorHandler
     */
    closed() {
        this.showOnErrorPrompt();
        // we don't retry running the service since crashes leave the extension
        // in a bad, unrecovered state
        return vscode_languageclient_1.CloseAction.DoNotRestart;
    }
}
// The Service Client class handles communication with the VS Code LanguageClient
class SqlToolsServiceClient {
    constructor(_server, _logger, _statusView, _config) {
        this._server = _server;
        this._logger = _logger;
        this._statusView = _statusView;
        this._config = _config;
        // VS Code Language Client
        this._client = undefined;
        this._languageClientStartTime = undefined;
        this._installationTime = undefined;
        this._downloadProvider = _server.downloadProvider;
        if (!this._vscodeWrapper) {
            this._vscodeWrapper = new vscodeWrapper_1.VscodeWrapper(SqlToolsServiceClient.constants);
        }
        this._serviceStatus = new serviceStatus_1.default(SqlToolsServiceClient._constants.serviceName);
    }
    static get constants() {
        return this._constants;
    }
    static set constants(constantsObject) {
        this._constants = constantsObject;
        telemetry_1.Telemetry.getRuntimeId = this._constants.getRuntimeId;
    }
    static get helper() {
        return this._helper;
    }
    static set helper(helperObject) {
        this._helper = helperObject;
    }
    // getter method for the Language Client
    get client() {
        return this._client;
    }
    set client(client) {
        this._client = client;
    }
    // gets or creates the singleton service client instance
    static getInstance(path) {
        if (this._instance === undefined) {
            let constants = this._constants;
            let config = new extConfig_1.default(constants.extensionConfigSectionName, undefined, path);
            _channel = vscode_1.window.createOutputChannel(constants.serviceInitializingOutputChannelName);
            let logger = new logger_1.Logger(text => _channel.append(text), constants);
            let serverStatusView = new serverStatus_1.ServerStatusView(constants);
            let httpClient = new httpClient_1.default();
            let decompressProvider = new decompressProvider_1.default();
            let downloadProvider = new serviceDownloadProvider_1.default(config, logger, serverStatusView, httpClient, decompressProvider, constants, false);
            let serviceProvider = new server_1.default(downloadProvider, config, serverStatusView, constants.extensionConfigSectionName);
            let statusView = new statusView_1.default();
            this._instance = new SqlToolsServiceClient(serviceProvider, logger, statusView, config);
        }
        return this._instance;
    }
    // initialize the Service Client instance by launching
    // out-of-proc server through the LanguageClient
    initialize(context) {
        this._logger.appendLine(SqlToolsServiceClient._constants.serviceInitializing);
        this._languageClientStartTime = Date.now();
        return platform_1.PlatformInformation.getCurrent(SqlToolsServiceClient._constants.getRuntimeId, SqlToolsServiceClient._constants.extensionName).then(platformInfo => {
            return this.initializeForPlatform(platformInfo, context);
        }).catch(err => {
            this._vscodeWrapper.showErrorMessage(err);
        });
    }
    initializeForPlatform(platformInfo, context) {
        return new Promise((resolve, reject) => {
            this._logger.appendLine(SqlToolsServiceClient._constants.commandsNotAvailableWhileInstallingTheService);
            this._logger.appendLine();
            this._logger.append(`Platform: ${platformInfo.toString()}`);
            if (!platformInfo.isValidRuntime()) {
                // if it's an unknown Linux distro then try generic Linux x64 and give a warning to the user
                if (platformInfo.isLinux()) {
                    this._logger.appendLine(constants_1.Constants.usingDefaultPlatformMessage);
                    platformInfo.runtimeId = platform_1.Runtime.Linux_64;
                }
                let ignoreWarning = this._config.getWorkspaceConfig(constants_1.Constants.ignorePlatformWarning, false);
                if (!ignoreWarning) {
                    this._vscodeWrapper.showErrorMessage(constants_1.Constants.unsupportedPlatformErrorMessage, constants_1.Constants.neverShowAgain)
                        .then(action => {
                        if (action === constants_1.Constants.neverShowAgain) {
                            this._config.updateWorkspaceConfig(constants_1.Constants.ignorePlatformWarning, true);
                        }
                    });
                }
                telemetry_1.Telemetry.sendTelemetryEvent('UnsupportedPlatform', { platform: platformInfo.toString() });
            }
            if (platformInfo.runtimeId) {
                this._logger.appendLine(` (${platformInfo.getRuntimeDisplayName()})`);
            }
            else {
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
                        resolve(new serverStatus_1.ServerInitializationResult(true, true, installedServerPath));
                    }).catch(downloadErr => {
                        reject(downloadErr);
                    });
                }
                else {
                    this.initializeLanguageClient(serverPath, context, platformInfo.runtimeId);
                    resolve(new serverStatus_1.ServerInitializationResult(false, true, serverPath));
                }
            }).catch(err => {
                utils_1.Utils.logDebug(SqlToolsServiceClient._constants.serviceLoadingFailed + ' ' + err, SqlToolsServiceClient._constants.extensionConfigSectionName);
                utils_1.Utils.showErrorMsg(SqlToolsServiceClient._constants.serviceLoadingFailed, SqlToolsServiceClient._constants.extensionName);
                telemetry_1.Telemetry.sendTelemetryEvent('ServiceInitializingFailed');
                reject(err);
            });
        });
    }
    /**
     * Initializes the SQL language configuration
     *
     * @memberOf SqlToolsServiceClient
     */
    initializeLanguageConfiguration() {
        vscode_1.languages.setLanguageConfiguration('sql', {
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
    initializeLanguageClient(serverPath, context, runtimeId) {
        if (serverPath === undefined) {
            utils_1.Utils.logDebug(SqlToolsServiceClient._constants.invalidServiceFilePath, SqlToolsServiceClient._constants.extensionConfigSectionName);
            throw new Error(SqlToolsServiceClient._constants.invalidServiceFilePath);
        }
        else {
            let self = this;
            if (SqlToolsServiceClient._constants.languageId === 'sql') {
                self.initializeLanguageConfiguration();
            }
            // Use default createServerOptions if one isn't specified
            let serverOptions = SqlToolsServiceClient._helper ?
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
    createClient(context, runtimeId, languageClientHelper, executableFiles) {
        return new Promise((resolve, reject) => {
            let client;
            this._server.findServerPath(this.installDirectory, executableFiles).then(serverPath => {
                if (serverPath === undefined) {
                    reject(new Error(SqlToolsServiceClient._constants.invalidServiceFilePath));
                }
                else {
                    let serverOptions = languageClientHelper ?
                        languageClientHelper.createServerOptions(serverPath, runtimeId) : this.createServerOptions(serverPath);
                    // Options to control the language client
                    let clientOptions = {
                        documentSelector: [SqlToolsServiceClient._constants.languageId],
                        providerId: '',
                        synchronize: {
                            configurationSection: SqlToolsServiceClient._constants.extensionConfigSectionName
                        },
                        errorHandler: new LanguageClientErrorHandler(SqlToolsServiceClient._constants),
                        serverConnectionMetadata: this._config.getConfigValue(constants_1.Constants.serverConnectionMetadata),
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
                    client = new dataprotocol_client_1.SqlOpsDataClient(SqlToolsServiceClient._constants.serviceName, serverOptions, clientOptions);
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
    createServerOptions(servicePath) {
        let serverArgs = [];
        let serverCommand = servicePath;
        if (servicePath.endsWith('.dll')) {
            serverArgs = [servicePath];
            serverCommand = 'dotnet';
        }
        // Enable diagnostic logging in the service if it is configured
        let config = vscode_1.workspace.getConfiguration(SqlToolsServiceClient._constants.extensionConfigSectionName);
        if (config) {
            let logDebugInfo = config[constants_1.Constants.configLogDebugInfo];
            if (logDebugInfo) {
                serverArgs.push('--enable-logging');
            }
        }
        serverArgs.push('--log-dir');
        let logFileLocation = path.join(utils_1.Utils.getDefaultLogLocation(), SqlToolsServiceClient.constants.extensionName);
        serverArgs.push(logFileLocation);
        // run the service host using dotnet.exe from the path
        let serverOptions = { command: serverCommand, args: serverArgs, transport: vscode_languageclient_1.TransportKind.stdio };
        return serverOptions;
    }
    createLanguageClient(serverOptions) {
        // Options to control the language client
        let clientOptions = {
            documentSelector: [SqlToolsServiceClient._constants.languageId],
            providerId: SqlToolsServiceClient._constants.providerId,
            synchronize: {
                configurationSection: SqlToolsServiceClient._constants.extensionConfigSectionName
            },
            errorHandler: new LanguageClientErrorHandler(SqlToolsServiceClient._constants),
            serverConnectionMetadata: this._config.getConfigValue(constants_1.Constants.serverConnectionMetadata),
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
        let client = new dataprotocol_client_1.SqlOpsDataClient(SqlToolsServiceClient._constants.serviceName, serverOptions, clientOptions);
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
            telemetry_1.Telemetry.sendTelemetryEvent('startup/LanguageClientStarted', {
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
    handleLanguageServiceTelemetryNotification() {
        return (event) => {
            telemetry_1.Telemetry.sendTelemetryEvent(event.params.eventName, event.params.properties, event.params.measures);
        };
    }
    /**
     * Public for testing purposes only.
     */
    handleLanguageServiceStatusNotification() {
        return (event) => {
            this._statusView.languageServiceStatusChanged(event.ownerUri, event.status);
        };
    }
    /**
     * Send a request to the service client
     * @param type The of the request to make
     * @param params The params to pass with the request
     * @returns A thenable object for when the request receives a response
     */
    sendRequest(type, params, client = undefined) {
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
    onNotification(type, handler, client = undefined) {
        if (client === undefined) {
            client = this._client;
        }
        if (client !== undefined) {
            return client.onNotification(type, handler);
        }
    }
    checkServiceCompatibility() {
        return new Promise((resolve, reject) => {
            this._client.sendRequest(contracts_1.VersionRequest.type, undefined).then((result) => {
                utils_1.Utils.logDebug(SqlToolsServiceClient._constants.extensionName + ' service client version: ' + result, SqlToolsServiceClient._constants.extensionConfigSectionName);
                if (result === undefined || !result.startsWith(SqlToolsServiceClient._constants.serviceCompatibleVersion)) {
                    utils_1.Utils.showErrorMsg(constants_1.Constants.serviceNotCompatibleError, SqlToolsServiceClient._constants.extensionName);
                    utils_1.Utils.logDebug(constants_1.Constants.serviceNotCompatibleError, SqlToolsServiceClient._constants.extensionConfigSectionName);
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    }
}
// singleton instance
SqlToolsServiceClient._instance = undefined;
SqlToolsServiceClient._constants = undefined;
SqlToolsServiceClient._helper = undefined;
exports.SqlToolsServiceClient = SqlToolsServiceClient;
//# sourceMappingURL=serviceClient.js.map