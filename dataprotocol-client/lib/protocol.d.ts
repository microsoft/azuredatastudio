import { ClientCapabilities as VSClientCapabilities, RequestType, NotificationType } from 'vscode-languageclient';
import * as types from './types';
import * as data from 'data';
export interface ConnectionClientCapabilities {
    connection?: {
        /**
         * Whether the connection support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    backup?: {
        /**
         * Whether the backup support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    restore?: {
        /**
         * Whether the restore support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    query?: {
        /**
         * Whether the query support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    objectExplorer?: {
        /**
         * Whether the object explorer support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    scripting?: {
        /**
         * Whether the scripting support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    taskServices?: {
        /**
         * Whether the task services support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    fileBrowser?: {
        /**
         * Whether the file browser support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    profiler?: {
        /**
         * Whether the profiler support dynamic registration
         */
        dynamicRegistration?: boolean;
    };
    capabilities?: {
        /**
         *
         */
        dynamicRegistration?: boolean;
    };
    metadata?: {
        /**
         *
         */
        dynamicRegistration?: boolean;
    };
    adminServices?: {
        /**
         *
         */
        dynamicRegistration?: boolean;
    };
}
export interface ClientCapabilities extends VSClientCapabilities {
    connection?: ConnectionClientCapabilities;
}
/**
 * Notification sent when the an IntelliSense cache invalidation is requested
 */
export declare namespace RebuildIntelliSenseNotification {
    const type: NotificationType<RebuildIntelliSenseParams, void>;
}
/**
 * Rebuild IntelliSense notification parameters
 */
export declare class RebuildIntelliSenseParams {
    /**
     * URI identifying the text document
     */
    ownerUri: string;
}
/**
 * Connection request message format
 */
export interface ConnectParams {
    /**
     * URI identifying the owner of the connection
     */
    ownerUri: string;
    /**
     * Details for creating the connection
     */
    connection: types.ConnectionDetails;
}
export declare namespace ConnectionRequest {
    const type: RequestType<ConnectParams, boolean, void, void>;
}
export declare namespace ConnectionCompleteNotification {
    const type: NotificationType<types.ConnectionCompleteParams, void>;
}
/**
 * Parameters for the ConnectionChanged notification.
 */
export declare class ConnectionChangedParams {
    /**
     * Owner URI of the connection that changed.
     */
    ownerUri: string;
    /**
     * Summary of details containing any connection changes.
     */
    connection: types.ConnectionSummary;
}
/**
 * Connection changed event callback declaration.
 */
export declare namespace ConnectionChangedNotification {
    const type: NotificationType<ConnectionChangedParams, void>;
}
export declare class DisconnectParams {
    ownerUri: string;
}
export declare type DisconnectResult = boolean;
export declare namespace DisconnectRequest {
    const type: RequestType<DisconnectParams, boolean, void, void>;
}
export declare class CancelConnectParams {
    /**
     * URI identifying the owner of the connection
     */
    ownerUri: string;
}
export declare type CancelConnectResult = boolean;
export declare namespace CancelConnectRequest {
    const type: RequestType<CancelConnectParams, boolean, void, void>;
}
export declare class ChangeDatabaseParams {
    ownerUri: string;
    newDatabase: string;
}
export declare namespace ChangeDatabaseRequest {
    const type: RequestType<ChangeDatabaseParams, boolean, void, void>;
}
export declare class ListDatabasesParams {
    ownerUri: string;
}
export declare namespace ListDatabasesRequest {
    const type: RequestType<ListDatabasesParams, data.ListDatabasesResult, void, void>;
}
/**
 * Parameters to provide when sending a language flavor changed notification
 */
export interface DidChangeLanguageFlavorParams {
    uri: string;
    language: string;
    flavor: string;
}
export declare namespace LanguageFlavorChangedNotification {
    const type: NotificationType<DidChangeLanguageFlavorParams, void>;
}
export declare class TableMetadataParams {
    ownerUri: string;
    schema: string;
    objectName: string;
}
export declare class TableMetadataResult {
    columns: data.ColumnMetadata[];
}
export declare namespace TableMetadataRequest {
    const type: RequestType<TableMetadataParams, TableMetadataResult, void, void>;
}
export declare namespace ViewMetadataRequest {
    const type: RequestType<TableMetadataParams, TableMetadataResult, void, void>;
}
/**
 * Event sent when the language service is finished updating after a connection
 */
export declare namespace IntelliSenseReadyNotification {
    const type: NotificationType<types.IntelliSenseReadyParams, void>;
}
export declare class CapabiltiesDiscoveryParams {
    hostName: string;
    hostVersion: string;
}
export declare namespace CapabiltiesDiscoveryRequest {
    const type: RequestType<CapabiltiesDiscoveryParams, types.CapabiltiesDiscoveryResult, void, void>;
}
export declare namespace QueryCancelRequest {
    const type: RequestType<QueryCancelParams, data.QueryCancelResult, void, void>;
}
export interface QueryCancelParams {
    ownerUri: string;
}
export declare namespace QueryDisposeRequest {
    const type: RequestType<QueryDisposeParams, QueryDisposeResult, void, void>;
}
/**
 * Parameters to provide when disposing of a query
 */
export interface QueryDisposeParams {
    ownerUri: string;
}
/**
 * Result received upon successful disposal of a query
 */
export interface QueryDisposeResult {
}
export declare namespace QueryExecuteCompleteNotification {
    const type: NotificationType<data.QueryExecuteCompleteNotificationResult, void>;
}
export declare namespace QueryExecuteBatchStartNotification {
    const type: NotificationType<data.QueryExecuteBatchNotificationParams, void>;
}
export declare namespace QueryExecuteBatchCompleteNotification {
    const type: NotificationType<data.QueryExecuteBatchNotificationParams, void>;
}
export declare namespace QueryExecuteResultSetCompleteNotification {
    const type: NotificationType<data.QueryExecuteResultSetCompleteNotificationParams, void>;
}
export declare namespace QueryExecuteMessageNotification {
    const type: NotificationType<data.QueryExecuteMessageParams, void>;
}
export declare namespace QueryExecuteRequest {
    const type: RequestType<types.QueryExecuteParams, QueryExecuteResult, void, void>;
}
export interface QueryExecuteResult {
}
export declare namespace QueryExecuteSubsetRequest {
    const type: RequestType<data.QueryExecuteSubsetParams, data.QueryExecuteSubsetResult, void, void>;
}
export interface ResultSetSubset {
    rowCount: number;
    rows: data.DbCellValue[][];
}
export interface QueryExecuteStatementParams {
    ownerUri: string;
    line: number;
    column: number;
}
export declare namespace QueryExecuteStatementRequest {
    const type: RequestType<QueryExecuteStatementParams, QueryExecuteResult, void, void>;
}
export declare namespace SaveResultsAsCsvRequest {
    const type: RequestType<data.SaveResultsRequestParams, data.SaveResultRequestResult, void, void>;
}
export declare namespace SaveResultsAsJsonRequest {
    const type: RequestType<data.SaveResultsRequestParams, data.SaveResultRequestResult, void, void>;
}
export declare namespace SaveResultsAsExcelRequest {
    const type: RequestType<data.SaveResultsRequestParams, data.SaveResultRequestResult, void, void>;
}
export declare namespace SimpleExecuteRequest {
    const type: RequestType<data.SimpleExecuteParams, data.SimpleExecuteResult, void, void>;
}
export interface QueryExecuteStringParams {
    query: string;
    ownerUri: string;
}
export declare namespace QueryExecuteStringRequest {
    const type: RequestType<QueryExecuteStringParams, QueryExecuteResult, void, void>;
}
export declare namespace MetadataQueryRequest {
    const type: RequestType<types.MetadataQueryParams, types.MetadataQueryResult, void, void>;
}
export declare namespace ScriptingRequest {
    const type: RequestType<types.ScriptingParams, data.ScriptingResult, void, void>;
}
export declare namespace ScriptingCompleteNotification {
    const type: NotificationType<types.ScriptingCompleteParams, void>;
}
export interface EditSessionOperationParams {
    ownerUri: string;
}
export interface EditRowOperationParams extends EditSessionOperationParams {
    rowId: number;
}
export interface EditCellResult {
    cell: data.EditCell;
    isRowDirty: boolean;
}
export declare namespace EditCommitRequest {
    const type: RequestType<data.EditCommitParams, EditCommitResult, void, void>;
}
export interface EditCommitResult {
}
export declare namespace EditCreateRowRequest {
    const type: RequestType<data.EditCreateRowParams, data.EditCreateRowResult, void, void>;
}
export declare namespace EditDeleteRowRequest {
    const type: RequestType<data.EditDeleteRowParams, EditDeleteRowResult, void, void>;
}
export interface EditDeleteRowResult {
}
export declare namespace EditDisposeRequest {
    const type: RequestType<data.EditDisposeParams, EditDisposeResult, void, void>;
}
export interface EditDisposeResult {
}
export declare namespace EditInitializeRequest {
    const type: RequestType<data.EditInitializeParams, EditInitializeResult, void, void>;
}
export interface EditInitializeResult {
}
export declare namespace EditRevertCellRequest {
    const type: RequestType<data.EditRevertCellParams, data.EditRevertCellResult, void, void>;
}
export declare namespace EditRevertRowRequest {
    const type: RequestType<data.EditRevertRowParams, EditRevertRowResult, void, void>;
}
export interface EditRevertRowResult {
}
export declare namespace EditSessionReadyNotification {
    const type: NotificationType<data.EditSessionReadyParams, void>;
}
export declare namespace EditUpdateCellRequest {
    const type: RequestType<data.EditUpdateCellParams, data.EditUpdateCellResult, void, void>;
}
export declare namespace EditSubsetRequest {
    const type: RequestType<data.EditSubsetParams, data.EditSubsetResult, void, void>;
}
export declare namespace ObjectExplorerCreateSessionRequest {
    const type: RequestType<types.ConnectionDetails, types.CreateSessionResponse, void, void>;
}
export declare namespace ObjectExplorerExpandRequest {
    const type: RequestType<types.ExpandParams, boolean, void, void>;
}
export declare namespace ObjectExplorerRefreshRequest {
    const type: RequestType<types.ExpandParams, boolean, void, void>;
}
export declare namespace ObjectExplorerCloseSessionRequest {
    const type: RequestType<types.CloseSessionParams, types.CloseSessionResponse, void, void>;
}
export declare namespace ObjectExplorerCreateSessionCompleteNotification {
    const type: NotificationType<types.SessionCreatedParameters, void>;
}
export declare namespace ObjectExplorerExpandCompleteNotification {
    const type: NotificationType<types.ExpandResponse, void>;
}
export declare namespace ListTasksRequest {
    const type: RequestType<data.ListTasksParams, data.ListTasksResponse, void, void>;
}
export declare namespace CancelTaskRequest {
    const type: RequestType<data.CancelTaskParams, boolean, void, void>;
}
export declare namespace TaskStatusChangedNotification {
    const type: NotificationType<data.TaskProgressInfo, void>;
}
export declare namespace TaskCreatedNotification {
    const type: NotificationType<data.TaskInfo, void>;
}
export declare namespace CreateDatabaseRequest {
    const type: RequestType<types.CreateDatabaseParams, data.CreateDatabaseResponse, void, void>;
}
export declare namespace DefaultDatabaseInfoRequest {
    const type: RequestType<types.DefaultDatabaseInfoParams, types.DefaultDatabaseInfoResponse, void, void>;
}
export declare namespace CreateLoginRequest {
    const type: RequestType<types.CreateLoginParams, data.CreateLoginResponse, void, void>;
}
export declare namespace GetDatabaseInfoRequest {
    const type: RequestType<types.GetDatabaseInfoParams, types.GetDatabaseInfoResponse, void, void>;
}
export declare namespace BackupRequest {
    const type: RequestType<types.BackupParams, data.BackupResponse, void, void>;
}
export declare namespace BackupConfigInfoRequest {
    const type: RequestType<types.DefaultDatabaseInfoParams, types.BackupConfigInfoResponse, void, void>;
}
export declare namespace RestoreRequest {
    const type: RequestType<types.RestoreParams, data.RestoreResponse, void, void>;
}
export declare namespace RestorePlanRequest {
    const type: RequestType<types.RestoreParams, data.RestorePlanResponse, void, void>;
}
export declare namespace CancelRestorePlanRequest {
    const type: RequestType<types.RestoreParams, boolean, void, void>;
}
export declare namespace RestoreConfigInfoRequest {
    const type: RequestType<types.RestoreConfigInfoRequestParams, types.RestoreConfigInfoResponse, void, void>;
}
export declare namespace FileBrowserOpenRequest {
    const type: RequestType<types.FileBrowserOpenParams, boolean, void, void>;
}
export declare namespace FileBrowserOpenedNotification {
    const type: NotificationType<data.FileBrowserOpenedParams, void>;
}
export declare namespace FileBrowserExpandRequest {
    const type: RequestType<types.FileBrowserExpandParams, boolean, void, void>;
}
export declare namespace FileBrowserExpandedNotification {
    const type: NotificationType<data.FileBrowserExpandedParams, void>;
}
export declare namespace FileBrowserValidateRequest {
    const type: RequestType<types.FileBrowserValidateParams, boolean, void, void>;
}
export declare namespace FileBrowserValidatedNotification {
    const type: NotificationType<data.FileBrowserValidatedParams, void>;
}
export declare namespace FileBrowserCloseRequest {
    const type: RequestType<types.FileBrowserCloseParams, data.FileBrowserCloseResponse, void, void>;
}
export declare namespace StartProfilingRequest {
    const type: RequestType<types.StartProfilingParams, types.StartProfilingResponse, void, void>;
}
export declare namespace StopProfilingRequest {
    const type: RequestType<types.StopProfilingParams, types.StopProfilingResponse, void, void>;
}
export declare namespace ProfilerEventsAvailableNotification {
    const type: NotificationType<types.ProfilerEventsAvailableParams, void>;
}
