"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageclient_1 = require("vscode-languageclient");
const is = require("vscode-languageclient/lib/utils/is");
const UUID = require("vscode-languageclient/lib/utils/uuid");
const data = require("data");
const codeConverter_1 = require("./codeConverter");
const protocol = require("./protocol");
const protocolConverter_1 = require("./protocolConverter");
function ensure(target, key) {
    if (target[key] === void 0) {
        target[key] = {};
    }
    return target[key];
}
/**
 *
 */
class SqlOpsFeature {
    constructor(_client, _message) {
        this._client = _client;
        this._message = _message;
        this._providers = new Map();
    }
    get messages() {
        return this._message;
    }
    register(messages, data) {
        // Error catching
        if (is.array(this.messages) && is.array(messages)) {
            let valid = messages.every(v => !!this.messages.find(i => i.method === v.method));
            if (!valid) {
                throw new Error(`Register called on wrong feature.`);
            }
        }
        else if (is.array(this.messages) && !is.array(messages)) {
            if (!this.messages.find(i => i.method === messages.method)) {
                throw new Error(`Register called on wrong feature.`);
            }
        }
        else if (!is.array(this.messages) && !is.array(messages)) {
            if (this.messages.method !== messages.method) {
                throw new Error(`Register called on wrong feature. Requested ${messages.method} but reached feature ${this.messages.method}`);
            }
        }
        let provider = this.registerProvider(data.registerOptions);
        if (provider) {
            this._providers.set(data.id, provider);
        }
    }
    unregister(id) {
        let provider = this._providers.get(id);
        if (provider) {
            provider.dispose();
        }
    }
    dispose() {
        this._providers.forEach((value) => {
            value.dispose();
        });
    }
}
exports.SqlOpsFeature = SqlOpsFeature;
class CapabilitiesFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, CapabilitiesFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'capabilities').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let getServerCapabilities = (cap) => {
            return client.sendRequest(protocol.CapabiltiesDiscoveryRequest.type, cap).then(client.sqlp2c.asServerCapabilities, e => {
                client.logFailedRequest(protocol.CapabiltiesDiscoveryRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return data.dataprotocol.registerCapabilitiesServiceProvider({
            providerId: client.providerId,
            getServerCapabilities
        });
    }
}
CapabilitiesFeature.messagesTypes = [
    protocol.CapabiltiesDiscoveryRequest.type
];
class ConnectionFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, ConnectionFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'connection').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let connect = (connUri, connInfo) => {
            return client.sendRequest(protocol.ConnectionRequest.type, client.sqlc2p.asConnectionParams(connUri, connInfo)).then(r => r, e => {
                client.logFailedRequest(protocol.ConnectionRequest.type, e);
                return Promise.resolve(false);
            });
        };
        let disconnect = (ownerUri) => {
            let params = {
                ownerUri
            };
            return client.sendRequest(protocol.DisconnectRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.DisconnectRequest.type, e);
                return Promise.resolve(false);
            });
        };
        let cancelConnect = (ownerUri) => {
            let params = {
                ownerUri
            };
            return client.sendRequest(protocol.CancelConnectRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.CancelConnectRequest.type, e);
                return Promise.resolve(false);
            });
        };
        let changeDatabase = (ownerUri, newDatabase) => {
            let params = {
                ownerUri,
                newDatabase
            };
            return client.sendRequest(protocol.ChangeDatabaseRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.ChangeDatabaseRequest.type, e);
                return Promise.resolve(false);
            });
        };
        let listDatabases = (ownerUri) => {
            let params = {
                ownerUri
            };
            return client.sendRequest(protocol.ListDatabasesRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.ListDatabasesRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let rebuildIntelliSenseCache = (ownerUri) => {
            let params = {
                ownerUri
            };
            client.sendNotification(protocol.RebuildIntelliSenseNotification.type, params);
            return Promise.resolve();
        };
        let registerOnConnectionComplete = (handler) => {
            client.onNotification(protocol.ConnectionCompleteNotification.type, handler);
        };
        let registerOnIntelliSenseCacheComplete = (handler) => {
            client.onNotification(protocol.IntelliSenseReadyNotification.type, (params) => {
                handler(params.ownerUri);
            });
        };
        let registerOnConnectionChanged = (handler) => {
            client.onNotification(protocol.ConnectionChangedNotification.type, (params) => {
                handler({
                    connectionUri: params.ownerUri,
                    connection: params.connection
                });
            });
        };
        return data.dataprotocol.registerConnectionProvider({
            providerId: client.providerId,
            connect,
            disconnect,
            cancelConnect,
            changeDatabase,
            listDatabases,
            rebuildIntelliSenseCache,
            registerOnConnectionChanged,
            registerOnIntelliSenseCacheComplete,
            registerOnConnectionComplete
        });
    }
}
ConnectionFeature.messagesTypes = [
    protocol.ConnectionRequest.type,
    protocol.ConnectionCompleteNotification.type,
    protocol.ConnectionChangedNotification.type,
    protocol.DisconnectRequest.type,
    protocol.CancelConnectRequest.type,
    protocol.ChangeDatabaseRequest.type,
    protocol.ListDatabasesRequest.type,
    protocol.LanguageFlavorChangedNotification.type
];
class QueryFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, QueryFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'query').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let runQuery = (ownerUri, querySelection, executionPlanOptions) => {
            let params = {
                ownerUri,
                querySelection,
                executionPlanOptions: client.sqlc2p.asExecutionPlanOptions(executionPlanOptions)
            };
            return client.sendRequest(protocol.QueryExecuteRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.QueryExecuteRequest.type, e);
                return Promise.reject(e);
            });
        };
        let cancelQuery = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.QueryCancelRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.QueryCancelRequest.type, e);
                return Promise.reject(e);
            });
        };
        let runQueryStatement = (ownerUri, line, column) => {
            let params = {
                ownerUri,
                line,
                column
            };
            return client.sendRequest(protocol.QueryExecuteStatementRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.QueryExecuteStatementRequest.type, e);
                return Promise.reject(e);
            });
        };
        let runQueryString = (ownerUri, query) => {
            let params = { ownerUri, query };
            return client.sendRequest(protocol.QueryExecuteStringRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.QueryExecuteStringRequest.type, e);
                return Promise.reject(e);
            });
        };
        let runQueryAndReturn = (ownerUri, queryString) => {
            let params = { ownerUri, queryString };
            return client.sendRequest(protocol.SimpleExecuteRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.SimpleExecuteRequest.type, e);
                return Promise.reject(e);
            });
        };
        let getQueryRows = (rowData) => {
            return client.sendRequest(protocol.QueryExecuteSubsetRequest.type, rowData).then(r => r, e => {
                client.logFailedRequest(protocol.QueryExecuteSubsetRequest.type, e);
                return Promise.reject(e);
            });
        };
        let disposeQuery = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.QueryDisposeRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.QueryDisposeRequest.type, e);
                return Promise.reject(e);
            });
        };
        let registerOnQueryComplete = (handler) => {
            client.onNotification(protocol.QueryExecuteCompleteNotification.type, handler);
        };
        let registerOnBatchStart = (handler) => {
            client.onNotification(protocol.QueryExecuteBatchStartNotification.type, handler);
        };
        let registerOnBatchComplete = (handler) => {
            client.onNotification(protocol.QueryExecuteBatchCompleteNotification.type, handler);
        };
        let registerOnResultSetComplete = (handler) => {
            client.onNotification(protocol.QueryExecuteResultSetCompleteNotification.type, handler);
        };
        let registerOnMessage = (handler) => {
            client.onNotification(protocol.QueryExecuteMessageNotification.type, handler);
        };
        let saveResults = (requestParams) => {
            switch (requestParams.resultFormat) {
                case 'csv':
                    return client.sendRequest(protocol.SaveResultsAsCsvRequest.type, requestParams).then(undefined, e => {
                        client.logFailedRequest(protocol.SaveResultsAsCsvRequest.type, e);
                        return Promise.reject(e);
                    });
                case 'json':
                    return client.sendRequest(protocol.SaveResultsAsJsonRequest.type, requestParams).then(undefined, e => {
                        client.logFailedRequest(protocol.SaveResultsAsJsonRequest.type, e);
                        return Promise.reject(e);
                    });
                case 'excel':
                    return client.sendRequest(protocol.SaveResultsAsExcelRequest.type, requestParams).then(undefined, e => {
                        client.logFailedRequest(protocol.SaveResultsAsExcelRequest.type, e);
                        return Promise.reject(e);
                    });
                default:
                    return Promise.reject('unsupported format');
            }
        };
        // Edit Data Requests
        let commitEdit = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.EditCommitRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.EditCommitRequest.type, e);
                return Promise.reject(e);
            });
        };
        let createRow = (ownerUri) => {
            let params = { ownerUri: ownerUri };
            return client.sendRequest(protocol.EditCreateRowRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.EditCreateRowRequest.type, e);
                return Promise.reject(e);
            });
        };
        let deleteRow = (ownerUri, rowId) => {
            let params = { ownerUri, rowId };
            return client.sendRequest(protocol.EditDeleteRowRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.EditDeleteRowRequest.type, e);
                return Promise.reject(e);
            });
        };
        let disposeEdit = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.EditDisposeRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.EditDisposeRequest.type, e);
                return Promise.reject(e);
            });
        };
        let initializeEdit = (ownerUri, schemaName, objectName, objectType, LimitResults) => {
            let filters = { LimitResults };
            let params = { ownerUri, schemaName, objectName, objectType, filters };
            return client.sendRequest(protocol.EditInitializeRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.EditInitializeRequest.type, e);
                return Promise.reject(e);
            });
        };
        let revertCell = (ownerUri, rowId, columnId) => {
            let params = { ownerUri, rowId, columnId };
            return client.sendRequest(protocol.EditRevertCellRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.EditRevertCellRequest.type, e);
                return Promise.reject(e);
            });
        };
        let revertRow = (ownerUri, rowId) => {
            let params = { ownerUri, rowId };
            return client.sendRequest(protocol.EditRevertRowRequest.type, params).then(r => undefined, e => {
                client.logFailedRequest(protocol.EditRevertRowRequest.type, e);
                return Promise.reject(e);
            });
        };
        let updateCell = (ownerUri, rowId, columnId, newValue) => {
            let params = { ownerUri, rowId, columnId, newValue };
            return client.sendRequest(protocol.EditUpdateCellRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.EditUpdateCellRequest.type, e);
                return Promise.reject(e);
            });
        };
        let getEditRows = (rowData) => {
            return client.sendRequest(protocol.EditSubsetRequest.type, rowData).then(r => r, e => {
                client.logFailedRequest(protocol.EditSubsetRequest.type, e);
                return Promise.reject(e);
            });
        };
        // Edit Data Event Handlers
        let registerOnEditSessionReady = (handler) => {
            client.onNotification(protocol.EditSessionReadyNotification.type, (params) => {
                handler(params.ownerUri, params.success, params.message);
            });
        };
        return data.dataprotocol.registerQueryProvider({
            providerId: client.providerId,
            cancelQuery,
            commitEdit,
            createRow,
            deleteRow,
            disposeEdit,
            disposeQuery,
            getEditRows,
            getQueryRows,
            initializeEdit,
            registerOnBatchComplete,
            registerOnBatchStart,
            registerOnEditSessionReady,
            registerOnMessage,
            registerOnQueryComplete,
            registerOnResultSetComplete,
            revertCell,
            revertRow,
            runQuery,
            runQueryAndReturn,
            runQueryStatement,
            runQueryString,
            saveResults,
            updateCell
        });
    }
}
QueryFeature.messagesTypes = [
    protocol.QueryExecuteRequest.type,
    protocol.QueryCancelRequest.type,
    protocol.QueryExecuteStatementRequest.type,
    protocol.QueryExecuteStringRequest.type,
    protocol.SimpleExecuteRequest.type,
    protocol.QueryExecuteSubsetRequest.type,
    protocol.QueryDisposeRequest.type,
    protocol.QueryExecuteCompleteNotification.type,
    protocol.QueryExecuteBatchStartNotification.type,
    protocol.QueryExecuteBatchCompleteNotification.type,
    protocol.QueryExecuteResultSetCompleteNotification.type,
    protocol.QueryExecuteMessageNotification.type,
    protocol.SaveResultsAsCsvRequest.type,
    protocol.SaveResultsAsJsonRequest.type,
    protocol.SaveResultsAsExcelRequest.type,
    protocol.EditCommitRequest.type,
    protocol.EditCreateRowRequest.type,
    protocol.EditDeleteRowRequest.type,
    protocol.EditDisposeRequest.type,
    protocol.EditInitializeRequest.type,
    protocol.EditRevertCellRequest.type,
    protocol.EditRevertRowRequest.type,
    protocol.EditUpdateCellRequest.type,
    protocol.EditSubsetRequest.type,
    protocol.EditSessionReadyNotification.type
];
class MetadataFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, MetadataFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'metadata').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let getMetadata = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.MetadataQueryRequest.type, params).then(client.sqlp2c.asProviderMetadata, e => {
                client.logFailedRequest(protocol.MetadataQueryRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getDatabases = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.ListDatabasesRequest.type, params).then(r => r.databaseNames, e => {
                client.logFailedRequest(protocol.ListDatabasesRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getTableInfo = (ownerUri, metadata) => {
            let params = { objectName: metadata.name, ownerUri, schema: metadata.schema };
            return client.sendRequest(protocol.TableMetadataRequest.type, params).then(r => r.columns, e => {
                client.logFailedRequest(protocol.TableMetadataRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getViewInfo = (ownerUri, metadata) => {
            let params = { objectName: metadata.name, ownerUri, schema: metadata.schema };
            return client.sendRequest(protocol.ViewMetadataRequest.type, params).then(r => r.columns, e => {
                client.logFailedRequest(protocol.ViewMetadataRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return data.dataprotocol.registerMetadataProvider({
            providerId: client.providerId,
            getDatabases,
            getMetadata,
            getTableInfo,
            getViewInfo
        });
    }
}
MetadataFeature.messagesTypes = [
    protocol.MetadataQueryRequest.type,
    protocol.ListDatabasesRequest.type,
    protocol.TableMetadataRequest.type,
    protocol.ViewMetadataRequest.type
];
class AdminServicesFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, AdminServicesFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'adminServices').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let createDatabase = (ownerUri, databaseInfo) => {
            let params = { ownerUri, databaseInfo };
            return client.sendRequest(protocol.CreateDatabaseRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.CreateDatabaseRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getDefaultDatabaseInfo = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.DefaultDatabaseInfoRequest.type, params).then(r => r.defaultDatabaseInfo, e => {
                client.logFailedRequest(protocol.DefaultDatabaseInfoRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getDatabaseInfo = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.GetDatabaseInfoRequest.type, params).then(r => r.databaseInfo, e => {
                client.logFailedRequest(protocol.GetDatabaseInfoRequest.type, e);
                return Promise.reject(e);
            });
        };
        let createLogin = (ownerUri, loginInfo) => {
            let params = { ownerUri, loginInfo };
            return client.sendRequest(protocol.CreateLoginRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.CreateLoginRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return data.dataprotocol.registerAdminServicesProvider({
            providerId: client.providerId,
            createDatabase,
            createLogin,
            getDatabaseInfo,
            getDefaultDatabaseInfo
        });
    }
}
AdminServicesFeature.messagesTypes = [
    protocol.CreateDatabaseRequest.type,
    protocol.DefaultDatabaseInfoRequest.type,
    protocol.GetDatabaseInfoRequest.type,
    protocol.CreateLoginRequest.type
];
class BackupFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, BackupFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'backup').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let backup = (ownerUri, backupInfo, taskExecutionMode) => {
            let params = { ownerUri, backupInfo, taskExecutionMode };
            return client.sendRequest(protocol.BackupRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.BackupRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getBackupConfigInfo = (connectionUri) => {
            let params = { ownerUri: connectionUri };
            return client.sendRequest(protocol.BackupConfigInfoRequest.type, params).then(r => r.backupConfigInfo, e => {
                client.logFailedRequest(protocol.BackupConfigInfoRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return data.dataprotocol.registerBackupProvider({
            providerId: client.providerId,
            backup,
            getBackupConfigInfo
        });
    }
}
BackupFeature.messagesTypes = [
    protocol.BackupRequest.type,
    protocol.BackupConfigInfoRequest.type
];
class RestoreFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, RestoreFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'restore').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let getRestorePlan = (ownerUri, restoreInfo) => {
            let params = { options: restoreInfo.options, ownerUri, taskExecutionMode: restoreInfo.taskExecutionMode };
            return client.sendRequest(protocol.RestorePlanRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.RestorePlanRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let restore = (ownerUri, restoreInfo) => {
            let params = { options: restoreInfo.options, ownerUri, taskExecutionMode: restoreInfo.taskExecutionMode };
            return client.sendRequest(protocol.RestoreRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.RestoreRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getRestoreConfigInfo = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.RestoreConfigInfoRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.RestoreConfigInfoRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let cancelRestorePlan = (ownerUri, restoreInfo) => {
            let params = { options: restoreInfo.options, ownerUri, taskExecutionMode: restoreInfo.taskExecutionMode };
            return client.sendRequest(protocol.CancelRestorePlanRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.CancelRestorePlanRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return data.dataprotocol.registerRestoreProvider({
            providerId: client.providerId,
            cancelRestorePlan,
            getRestoreConfigInfo,
            getRestorePlan,
            restore
        });
    }
}
RestoreFeature.messagesTypes = [
    protocol.RestorePlanRequest.type,
    protocol.RestoreRequest.type,
    protocol.RestoreConfigInfoRequest.type,
    protocol.CancelRestorePlanRequest.type
];
class ObjectExplorerFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, ObjectExplorerFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'objectExplorer').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let createNewSession = (connInfo) => {
            return client.sendRequest(protocol.ObjectExplorerCreateSessionRequest.type, connInfo).then(r => r, e => {
                client.logFailedRequest(protocol.ObjectExplorerCreateSessionRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let expandNode = (nodeInfo) => {
            return client.sendRequest(protocol.ObjectExplorerExpandRequest.type, nodeInfo).then(r => r, e => {
                client.logFailedRequest(protocol.ObjectExplorerExpandRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let refreshNode = (nodeInfo) => {
            return client.sendRequest(protocol.ObjectExplorerRefreshRequest.type, nodeInfo).then(r => r, e => {
                client.logFailedRequest(protocol.ObjectExplorerRefreshRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let closeSession = (closeSessionInfo) => {
            return client.sendRequest(protocol.ObjectExplorerCloseSessionRequest.type, closeSessionInfo).then(r => r, e => {
                client.logFailedRequest(protocol.ObjectExplorerCloseSessionRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let registerOnSessionCreated = (handler) => {
            client.onNotification(protocol.ObjectExplorerCreateSessionCompleteNotification.type, handler);
        };
        let registerOnExpandCompleted = (handler) => {
            client.onNotification(protocol.ObjectExplorerExpandCompleteNotification.type, handler);
        };
        return data.dataprotocol.registerObjectExplorerProvider({
            providerId: client.providerId,
            closeSession,
            createNewSession,
            expandNode,
            refreshNode,
            registerOnExpandCompleted,
            registerOnSessionCreated
        });
    }
}
ObjectExplorerFeature.messagesTypes = [
    protocol.ObjectExplorerCreateSessionRequest.type,
    protocol.ObjectExplorerExpandRequest.type,
    protocol.ObjectExplorerRefreshRequest.type,
    protocol.ObjectExplorerCloseSessionRequest.type,
    protocol.ObjectExplorerCreateSessionCompleteNotification.type,
    protocol.ObjectExplorerExpandCompleteNotification.type
];
class ScriptingFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, ScriptingFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'scripting').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let scriptAsOperation = (connectionUri, operation, metadata, paramDetails) => {
            return client.sendRequest(protocol.ScriptingRequest.type, client.sqlc2p.asScriptingParams(connectionUri, operation, metadata, paramDetails)).then(r => r, e => {
                client.logFailedRequest(protocol.ScriptingRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let registerOnScriptingComplete = (handler) => {
            client.onNotification(protocol.ScriptingCompleteNotification.type, handler);
        };
        return data.dataprotocol.registerScriptingProvider({
            providerId: client.providerId,
            registerOnScriptingComplete,
            scriptAsOperation
        });
    }
}
ScriptingFeature.messagesTypes = [
    protocol.ScriptingRequest.type,
    protocol.ScriptingCompleteNotification.type
];
class TaskServicesFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, TaskServicesFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'taskServices').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let getAllTasks = (listTasksParams) => {
            return client.sendRequest(protocol.ListTasksRequest.type, listTasksParams).then(r => r, e => {
                client.logFailedRequest(protocol.ListTasksRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let cancelTask = (cancelTaskParams) => {
            return client.sendRequest(protocol.CancelTaskRequest.type, cancelTaskParams).then(r => r, e => {
                client.logFailedRequest(protocol.CancelTaskRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let registerOnTaskCreated = (handler) => {
            client.onNotification(protocol.TaskCreatedNotification.type, handler);
        };
        let registerOnTaskStatusChanged = (handler) => {
            client.onNotification(protocol.TaskStatusChangedNotification.type, handler);
        };
        return data.dataprotocol.registerTaskServicesProvider({
            providerId: client.providerId,
            cancelTask,
            getAllTasks,
            registerOnTaskCreated,
            registerOnTaskStatusChanged
        });
    }
}
TaskServicesFeature.messagesTypes = [
    protocol.ListTasksRequest.type,
    protocol.CancelTaskRequest.type,
    protocol.TaskCreatedNotification.type,
    protocol.TaskStatusChangedNotification.type
];
class FileBrowserFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, FileBrowserFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'fileBrowser').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let openFileBrowser = (ownerUri, expandPath, fileFilters, changeFilter) => {
            let params = { ownerUri, expandPath, fileFilters, changeFilter };
            return client.sendRequest(protocol.FileBrowserOpenRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.FileBrowserOpenRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let registerOnFileBrowserOpened = (handler) => {
            client.onNotification(protocol.FileBrowserOpenedNotification.type, handler);
        };
        let expandFolderNode = (ownerUri, expandPath) => {
            let params = { ownerUri, expandPath };
            return client.sendRequest(protocol.FileBrowserExpandRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.FileBrowserExpandRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let registerOnFolderNodeExpanded = (handler) => {
            client.onNotification(protocol.FileBrowserExpandedNotification.type, handler);
        };
        let validateFilePaths = (ownerUri, serviceType, selectedFiles) => {
            let params = { ownerUri, serviceType, selectedFiles };
            return client.sendRequest(protocol.FileBrowserValidateRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.FileBrowserValidateRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let registerOnFilePathsValidated = (handler) => {
            client.onNotification(protocol.FileBrowserValidatedNotification.type, handler);
        };
        let closeFileBrowser = (ownerUri) => {
            let params = { ownerUri };
            return client.sendRequest(protocol.FileBrowserCloseRequest.type, params).then(r => r, e => {
                client.logFailedRequest(protocol.FileBrowserCloseRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return data.dataprotocol.registerFileBrowserProvider({
            providerId: client.providerId,
            closeFileBrowser,
            expandFolderNode,
            openFileBrowser,
            registerOnFileBrowserOpened,
            registerOnFilePathsValidated,
            registerOnFolderNodeExpanded,
            validateFilePaths
        });
    }
}
FileBrowserFeature.messagesTypes = [
    protocol.FileBrowserOpenRequest.type,
    protocol.FileBrowserOpenedNotification.type,
    protocol.FileBrowserExpandRequest.type,
    protocol.FileBrowserExpandedNotification.type,
    protocol.FileBrowserValidateRequest.type,
    protocol.FileBrowserValidatedNotification.type,
    protocol.FileBrowserCloseRequest.type
];
class ProfilerFeature extends SqlOpsFeature {
    constructor(client) {
        super(client, ProfilerFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        ensure(ensure(capabilities, 'connection'), 'profiler').dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let startSession = (ownerUri) => {
            let params = {
                ownerUri,
                options: {}
            };
            return client.sendRequest(protocol.StartProfilingRequest.type, params).then(r => true, e => {
                client.logFailedRequest(protocol.StartProfilingRequest.type, e);
                return Promise.reject(e);
            });
        };
        let stopSession = (ownerUri) => {
            let params = {
                ownerUri
            };
            return client.sendRequest(protocol.StopProfilingRequest.type, params).then(r => true, e => {
                client.logFailedRequest(protocol.StopProfilingRequest.type, e);
                return Promise.reject(e);
            });
        };
        let pauseSession = (sessionId) => {
            return undefined;
        };
        let connectSession = (sessionId) => {
            return undefined;
        };
        let disconnectSession = (sessionId) => {
            return undefined;
        };
        let registerOnSessionEventsAvailable = (handler) => {
            client.onNotification(protocol.ProfilerEventsAvailableNotification.type, (params) => {
                handler({
                    sessionId: params.ownerUri,
                    events: params.events
                });
            });
        };
        return data.dataprotocol.registerProfilerProvider({
            providerId: client.providerId,
            connectSession,
            disconnectSession,
            pauseSession,
            registerOnSessionEventsAvailable,
            startSession,
            stopSession
        });
    }
}
ProfilerFeature.messagesTypes = [
    protocol.StartProfilingRequest.type,
    protocol.StopProfilingRequest.type,
    protocol.ProfilerEventsAvailableNotification.type
];
/**
 *
 */
class SqlOpsDataClient extends vscode_languageclient_1.LanguageClient {
    get sqlc2p() {
        return this._sqlc2p;
    }
    get sqlp2c() {
        return this._sqlp2c;
    }
    get providerId() {
        return this._providerId;
    }
    constructor(arg1, arg2, arg3, arg4, arg5) {
        if (is.string(arg2)) {
            super(arg1, arg2, arg3, arg4, arg5);
            this._providerId = arg4.providerId;
        }
        else {
            super(arg1, arg2, arg3, arg4);
            this._providerId = arg3.providerId;
        }
        this._sqlc2p = codeConverter_1.c2p;
        this._sqlp2c = protocolConverter_1.p2c;
        this.registerDataFeatures();
    }
    registerDataFeatures() {
        this.registerFeature(new ConnectionFeature(this));
        this.registerFeature(new CapabilitiesFeature(this));
        this.registerFeature(new QueryFeature(this));
        this.registerFeature(new MetadataFeature(this));
        this.registerFeature(new AdminServicesFeature(this));
        this.registerFeature(new BackupFeature(this));
        this.registerFeature(new RestoreFeature(this));
        this.registerFeature(new ObjectExplorerFeature(this));
        this.registerFeature(new ScriptingFeature(this));
        this.registerFeature(new TaskServicesFeature(this));
        this.registerFeature(new FileBrowserFeature(this));
        this.registerFeature(new ProfilerFeature(this));
    }
}
exports.SqlOpsDataClient = SqlOpsDataClient;
