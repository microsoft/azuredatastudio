/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ProviderBase } from './providerBase';
import * as constants from './constants';
import * as utils from './utils';
import { IFileSource, HdfsFileSource, IHdfsOptions, IRequestParams, FileSourceFactory } from './fileSources';

function appendIfExists(uri: string, propName: string, propValue: string): string {
    if (propValue) {
        uri = `${uri};${propName}=${propValue}`;
    }
    return uri;
}

export class HadoopConnectionProvider extends ProviderBase implements sqlops.ConnectionProvider {
    private connectionMap: Map<string, Connection>;
    private connectionCompleteEmitter = new vscode.EventEmitter<sqlops.ConnectionInfoSummary>();
    constructor(private fileSourceFactory?: FileSourceFactory) {
        super();
        if (!this.fileSourceFactory) {
            this.fileSourceFactory = FileSourceFactory.instance;
        }
        this.connectionMap = new Map();
    }

    // Connection Provider methods ----------------------
    connect(connectionUri: string, connectionInfo: sqlops.ConnectionInfo): Thenable<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            // Verify basic parameters
            let connection = new Connection(connectionInfo, connectionUri);
            let validationResult = connection.validateParams();
            if (!validationResult.isValid) {
                reject(new Error(validationResult.errors));
            }

            // Add to the map, kick off connection and return
            this.connectionMap.set(connectionUri, connection);

            setTimeout(async () => {
                // Use a timeout to ensure we report success/failure after responding
                // that the request has been queued
                try {
                    let summary = await connection.tryConnect(this.fileSourceFactory);
                    if (!summary || !summary.connectionId) {
                        // Error occurred, remove from map
                        this.handleConnectionFailed(summary);
                    } else {
                        this.sendConnectionComplete(summary);
                    }
                } catch (error) {
                    this.handleConnectionFailed(this.createErrorSummary(connectionUri, error));
                }
            }, 1);

            // Return the result
            resolve(true);
        });
    }

    private createErrorSummary(connectionUri: string, error: any): sqlops.ConnectionInfoSummary {
        return {
            ownerUri: connectionUri,
            connectionId: undefined,
            connectionSummary: undefined,
            errorMessage: error,
            errorNumber: undefined,
            messages: undefined,
            serverInfo: undefined
        };
    }

    private handleConnectionFailed(connectionSummary: sqlops.ConnectionInfoSummary): void {
        this.connectionMap.delete(connectionSummary.ownerUri);
        this.sendConnectionComplete(connectionSummary);
    }

    private sendConnectionComplete(connectionSummary: sqlops.ConnectionInfoSummary): void {
        this.connectionCompleteEmitter.fire(connectionSummary);
    }

    disconnect(connectionUri: string): Thenable<boolean> {
        // TODO handle this better?
        return Promise.resolve(this.connectionMap.delete(connectionUri));
    }
    cancelConnect(connectionUri: string): Thenable<boolean> {
        // TODO: avoid sending success notification in this case
        return Promise.resolve(true);
    }
    listDatabases(connectionUri: string): Thenable<sqlops.ListDatabasesResult> {
        return Promise.resolve(<sqlops.ListDatabasesResult>{
            databaseNames: []
        });
    }
    changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
        // Return default value to avoid crashing the dashboard
        return Promise.resolve(true);
    }
    rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
        return Promise.resolve();
    }
    registerOnConnectionComplete(handler: (connSummary: sqlops.ConnectionInfoSummary) => any): void {
        this.connectionCompleteEmitter.event(handler);
    }
    registerOnIntelliSenseCacheComplete(handler: (connectionUri: string) => any): void {
        // No-op
    }
    registerOnConnectionChanged(handler: (changedConnInfo: sqlops.ChangedConnectionInfo) => any): void {
        // No-op
    }
    getConnectionString(connectionUri: string, includePassword: boolean): Thenable<string> {
        throw new Error('Method not implemented.');
    }

    // Inter-service methods methods ----------------------
}

interface IValidationResult {
    isValid: boolean;
    errors: string;
}

export class Connection {
    private _host: string;
    private _knoxPort: string;

    constructor(private connectionInfo: sqlops.ConnectionInfo, private connectionUri?: string, private _connectionId?: string) {
        if (!this.connectionInfo) {
            throw new Error(localize('connectionInfoMissing', 'connectionInfo is required'));
        }

        if (!this._connectionId) {
            this._connectionId = UUID.generateUuid();
        }
    }

    public get uri(): string {
        return this.connectionUri;
    }

    public saveUriWithPrefix(prefix: string): string {
        let uri = `${prefix}${this.host}`;
        uri = appendIfExists(uri, constants.knoxPortPropName, this.knoxport);
        uri = appendIfExists(uri, constants.userPropName, this.user);
        uri = appendIfExists(uri, constants.groupIdPropName, this.connectionInfo.options[constants.groupIdPropName]);
        this.connectionUri = uri;
        return this.connectionUri;
    }

    public validateParams(): IValidationResult {
        // TODO verify required params?
        return {
            isValid: true,
            errors: undefined
        };
    }

    public async tryConnect(factory?: FileSourceFactory): Promise<sqlops.ConnectionInfoSummary> {
        let fileSource = this.createHdfsFileSource(factory, {
            timeout: this.connecttimeout
        });
        let summary: sqlops.ConnectionInfoSummary = undefined;
        try {
            await fileSource.enumerateFiles(constants.hdfsRootPath);
            summary = {
                ownerUri: this.connectionUri,
                connectionId: this.connectionId,
                connectionSummary: {
                    serverName: this.host,
                    databaseName: undefined,
                    userName: this.user
                },
                errorMessage: undefined,
                errorNumber: undefined,
                messages: undefined,
                serverInfo: this.getEmptyServerInfo()
            };
        } catch (error) {
            summary = {
                ownerUri: this.connectionUri,
                connectionId: undefined,
                connectionSummary: undefined,
                errorMessage: this.getConnectError(error),
                errorNumber: undefined,
                messages: undefined,
                serverInfo: undefined
            };
        }
        return summary;
    }

    private getConnectError(error: string | Error): string {
        let errorMsg = utils.getErrorMessage(error);
        if (errorMsg.indexOf('ETIMEDOUT') > -1) {
            errorMsg = localize('connectionTimeout', 'connection timed out. Host name or port may be incorrect');
        } else if (errorMsg.indexOf('ENOTFOUND') > -1) {
            errorMsg = localize('connectionTimeout', 'Host name or port may be incorrect');
        }
        return localize('connectError', 'Connection failed with error: {0}', errorMsg);
    }

    private getEmptyServerInfo(): sqlops.ServerInfo {
        let info: sqlops.ServerInfo = {
            serverMajorVersion: 0,
            serverMinorVersion: 0,
            serverReleaseVersion: 0,
            engineEditionId: 0,
            serverVersion: '',
            serverLevel: '',
            serverEdition: '',
            isCloud: false,
            azureVersion: 0,
            osVersion: '',
            options: { isBigDataCluster: false, bigDataClusterEndpoints: [] }
        };
        return info;
    }

    public get connectionId(): string {
        return this._connectionId;
    }

    public get host(): string {
        if (!this._host) {
            this.ensureHostAndPort();
        }
        return this._host;
    }

    /**
     * Sets host and port values, using any ',' or ':' delimited port in the hostname in
     * preference to the built in port.
     */
    private ensureHostAndPort(): void {
        this._host = this.connectionInfo.options[constants.hostPropName];
        this._knoxPort = Connection.getKnoxPortOrDefault(this.connectionInfo);
        // determine whether the host has either a ',' or ':' in it
        this.setHostAndPort(',');
        this.setHostAndPort(':');
    }

    // set port and host correctly after we've identified that a delimiter exists in the host name
    private setHostAndPort(delimeter: string): void {
        let originalHost = this._host;
        let index = originalHost.indexOf(delimeter);
        if (index > -1) {
            this._host = originalHost.slice(0, index);
            this._knoxPort = originalHost.slice(index + 1);
        }
    }

    public get user(): string {
        return this.connectionInfo.options[constants.userPropName];
    }

    public get password(): string {
        return this.connectionInfo.options[constants.passwordPropName];
    }

    public get knoxport(): string {
        if (!this._knoxPort) {
            this.ensureHostAndPort();
        }
        return this._knoxPort;
    }

    private static getKnoxPortOrDefault(connInfo: sqlops.ConnectionInfo): string {
        let port = connInfo.options[constants.knoxPortPropName];
        if (!port) {
            port = constants.defaultKnoxPort;
        }
        return port;
    }

    public get connecttimeout(): number {
        let timeoutSeconds: number = this.connectionInfo.options['connecttimeout'];
        if (!timeoutSeconds) {
            timeoutSeconds = constants.hadoopConnectionTimeoutSeconds;
        }
        // connect timeout is in milliseconds
        return timeoutSeconds * 1000;
    }

    public get sslverification(): string {
        return this.connectionInfo.options['sslverification'];
    }

    public get groupId(): string {
        return this.connectionInfo.options[constants.groupIdName];
    }

    public isMatch(connectionInfo: sqlops.ConnectionInfo): boolean {
        if (!connectionInfo) {
            return false;
        }
        let otherConnection = new Connection(connectionInfo);
        return otherConnection.groupId === this.groupId
            && otherConnection.host === this.host
            && otherConnection.knoxport === this.knoxport
            && otherConnection.user === this.user;
    }

    public createHdfsFileSource(factory?: FileSourceFactory, additionalRequestParams?: IRequestParams): IFileSource {
        factory = factory || FileSourceFactory.instance;
        let options: IHdfsOptions = {
            protocol: 'https',
            host: this.host,
            port: this.knoxport,
            user: this.user,
            path: 'gateway/default/webhdfs/v1',
            requestParams: {
                auth: {
                    user: this.user,
                    pass: this.password
                }
            }
        };
        if (additionalRequestParams) {
            options.requestParams = Object.assign(options.requestParams, additionalRequestParams);
        }
        return factory.createHdfsFileSource(options);
    }

    public async getCredential(): Promise<void> {
        try {
            let credentials = await sqlops.connection.getCredentials(this.connectionId);
            if (credentials) {
                this.connectionInfo.options = Object.assign(this.connectionInfo.options, credentials);
            } else {
                // TODO should pop the connectionDialog like click Manage contextmenu.
            }
        } catch (error) {
            let another = error;
            // swallow this as either it was integrated auth or we will fail later with login failed,
            // which is a good error that makes sense to the user
        }
    }
}
