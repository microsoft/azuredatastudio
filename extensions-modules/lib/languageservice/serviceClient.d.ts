import { ExtensionContext } from 'vscode';
import { SqlOpsDataClient } from 'dataprotocol-client';
import { NotificationHandler, NotificationType, RequestType } from 'vscode-languageclient';
import { IExtensionConstants } from '../models/contracts/contracts';
import { Logger } from '../models/logger';
import ServerProvider from './server';
import ExtConfig from '../configurations/extConfig';
import { PlatformInformation, Runtime } from '../models/platform';
import { ServerInitializationResult } from './serverStatus';
import StatusView from '../views/statusView';
import * as LanguageServiceContracts from '../models/contracts/languageService';
export declare class SqlToolsServiceClient {
    private _server;
    private _logger;
    private _statusView;
    private _config;
    private static _instance;
    private static _constants;
    static constants: IExtensionConstants;
    private static _helper;
    static helper: LanguageServiceContracts.ILanguageClientHelper;
    private _client;
    private client;
    installDirectory: string;
    private _downloadProvider;
    private _vscodeWrapper;
    private _serviceStatus;
    private _languageClientStartTime;
    private _installationTime;
    constructor(_server: ServerProvider, _logger: Logger, _statusView: StatusView, _config: ExtConfig);
    static getInstance(path: string): SqlToolsServiceClient;
    initialize(context: ExtensionContext): Promise<any>;
    initializeForPlatform(platformInfo: PlatformInformation, context: ExtensionContext): Promise<ServerInitializationResult>;
    /**
     * Initializes the SQL language configuration
     *
     * @memberOf SqlToolsServiceClient
     */
    private initializeLanguageConfiguration();
    private initializeLanguageClient(serverPath, context, runtimeId);
    createClient(context: ExtensionContext, runtimeId: Runtime, languageClientHelper: LanguageServiceContracts.ILanguageClientHelper, executableFiles: string[]): Promise<SqlOpsDataClient>;
    private createServerOptions(servicePath);
    private createLanguageClient(serverOptions);
    private handleLanguageServiceTelemetryNotification();
    /**
     * Public for testing purposes only.
     */
    handleLanguageServiceStatusNotification(): NotificationHandler<LanguageServiceContracts.StatusChangeParams>;
    /**
     * Send a request to the service client
     * @param type The of the request to make
     * @param params The params to pass with the request
     * @returns A thenable object for when the request receives a response
     */
    sendRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, params?: P, client?: SqlOpsDataClient): Thenable<R>;
    /**
     * Register a handler for a notification type
     * @param type The notification type to register the handler for
     * @param handler The handler to register
     */
    onNotification<P, RO>(type: NotificationType<P, RO>, handler: NotificationHandler<P>, client?: SqlOpsDataClient): void;
    checkServiceCompatibility(): Promise<boolean>;
}
