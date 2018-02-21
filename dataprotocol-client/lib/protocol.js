"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageclient_1 = require("vscode-languageclient");
//---- Refresh IntelliSense ----------------------------------------
/**
 * Notification sent when the an IntelliSense cache invalidation is requested
 */
var RebuildIntelliSenseNotification;
(function (RebuildIntelliSenseNotification) {
    RebuildIntelliSenseNotification.type = new vscode_languageclient_1.NotificationType('textDocument/rebuildIntelliSense');
})(RebuildIntelliSenseNotification = exports.RebuildIntelliSenseNotification || (exports.RebuildIntelliSenseNotification = {}));
/**
 * Rebuild IntelliSense notification parameters
 */
class RebuildIntelliSenseParams {
}
exports.RebuildIntelliSenseParams = RebuildIntelliSenseParams;
// Connection request message callback declaration
var ConnectionRequest;
(function (ConnectionRequest) {
    ConnectionRequest.type = new vscode_languageclient_1.RequestType('connection/connect');
})(ConnectionRequest = exports.ConnectionRequest || (exports.ConnectionRequest = {}));
// ------------------------------- < Connection Complete Event > ------------------------------------
var ConnectionCompleteNotification;
(function (ConnectionCompleteNotification) {
    ConnectionCompleteNotification.type = new vscode_languageclient_1.NotificationType('connection/complete');
})(ConnectionCompleteNotification = exports.ConnectionCompleteNotification || (exports.ConnectionCompleteNotification = {}));
// ------------------------------- < Connection Changed Event > -------------------------------------
/**
 * Parameters for the ConnectionChanged notification.
 */
class ConnectionChangedParams {
}
exports.ConnectionChangedParams = ConnectionChangedParams;
/**
 * Connection changed event callback declaration.
 */
var ConnectionChangedNotification;
(function (ConnectionChangedNotification) {
    ConnectionChangedNotification.type = new vscode_languageclient_1.NotificationType('connection/connectionchanged');
})(ConnectionChangedNotification = exports.ConnectionChangedNotification || (exports.ConnectionChangedNotification = {}));
// ------------------------------- < Disconnect Request > -------------------------------------------
// Disconnect request message format
class DisconnectParams {
}
exports.DisconnectParams = DisconnectParams;
// Disconnect request message callback declaration
var DisconnectRequest;
(function (DisconnectRequest) {
    DisconnectRequest.type = new vscode_languageclient_1.RequestType('connection/disconnect');
})(DisconnectRequest = exports.DisconnectRequest || (exports.DisconnectRequest = {}));
// ------------------------------- < Cancel Connect Request > ---------------------------------------
// Cancel connect request message format
class CancelConnectParams {
}
exports.CancelConnectParams = CancelConnectParams;
// Cancel connect request message callback declaration
var CancelConnectRequest;
(function (CancelConnectRequest) {
    CancelConnectRequest.type = new vscode_languageclient_1.RequestType('connection/cancelconnect');
})(CancelConnectRequest = exports.CancelConnectRequest || (exports.CancelConnectRequest = {}));
// ------------------------------- < Change Database Request > -------------------------------------
class ChangeDatabaseParams {
}
exports.ChangeDatabaseParams = ChangeDatabaseParams;
var ChangeDatabaseRequest;
(function (ChangeDatabaseRequest) {
    ChangeDatabaseRequest.type = new vscode_languageclient_1.RequestType('connection/changedatabase');
})(ChangeDatabaseRequest = exports.ChangeDatabaseRequest || (exports.ChangeDatabaseRequest = {}));
// ------------------------------- < List Databases Request > ---------------------------------------
// List databases request format
class ListDatabasesParams {
}
exports.ListDatabasesParams = ListDatabasesParams;
// List databases request callback declaration
var ListDatabasesRequest;
(function (ListDatabasesRequest) {
    ListDatabasesRequest.type = new vscode_languageclient_1.RequestType('connection/listdatabases');
})(ListDatabasesRequest = exports.ListDatabasesRequest || (exports.ListDatabasesRequest = {}));
// ------------------------------- < Language Flavor Changed Notification > ---------------------------------------
var LanguageFlavorChangedNotification;
(function (LanguageFlavorChangedNotification) {
    LanguageFlavorChangedNotification.type = new vscode_languageclient_1.NotificationType('connection/languageflavorchanged');
})(LanguageFlavorChangedNotification = exports.LanguageFlavorChangedNotification || (exports.LanguageFlavorChangedNotification = {}));
// ------------------------------- < Table Metadata Request > ---------------------------------------
// Table metadata request format
class TableMetadataParams {
}
exports.TableMetadataParams = TableMetadataParams;
// Table metadata response format
class TableMetadataResult {
}
exports.TableMetadataResult = TableMetadataResult;
// Table metadata request callback declaration
var TableMetadataRequest;
(function (TableMetadataRequest) {
    TableMetadataRequest.type = new vscode_languageclient_1.RequestType('metadata/table');
})(TableMetadataRequest = exports.TableMetadataRequest || (exports.TableMetadataRequest = {}));
// ------------------------------- < View Metadata Request > ---------------------------------------
// Table metadata request callback declaration
var ViewMetadataRequest;
(function (ViewMetadataRequest) {
    ViewMetadataRequest.type = new vscode_languageclient_1.RequestType('metadata/view');
})(ViewMetadataRequest = exports.ViewMetadataRequest || (exports.ViewMetadataRequest = {}));
/**
 * Event sent when the language service is finished updating after a connection
 */
var IntelliSenseReadyNotification;
(function (IntelliSenseReadyNotification) {
    IntelliSenseReadyNotification.type = new vscode_languageclient_1.NotificationType('textDocument/intelliSenseReady');
})(IntelliSenseReadyNotification = exports.IntelliSenseReadyNotification || (exports.IntelliSenseReadyNotification = {}));
// ------------------------------- < Capabilties Discovery Event > ------------------------------------
class CapabiltiesDiscoveryParams {
}
exports.CapabiltiesDiscoveryParams = CapabiltiesDiscoveryParams;
var CapabiltiesDiscoveryRequest;
(function (CapabiltiesDiscoveryRequest) {
    CapabiltiesDiscoveryRequest.type = new vscode_languageclient_1.RequestType('capabilities/list');
})(CapabiltiesDiscoveryRequest = exports.CapabiltiesDiscoveryRequest || (exports.CapabiltiesDiscoveryRequest = {}));
// Query Execution ================================================================================
// ------------------------------- < Query Cancellation Request > ------------------------------------
var QueryCancelRequest;
(function (QueryCancelRequest) {
    QueryCancelRequest.type = new vscode_languageclient_1.RequestType('query/cancel');
})(QueryCancelRequest = exports.QueryCancelRequest || (exports.QueryCancelRequest = {}));
// ------------------------------- < Query Dispose Request > ------------------------------------
var QueryDisposeRequest;
(function (QueryDisposeRequest) {
    QueryDisposeRequest.type = new vscode_languageclient_1.RequestType('query/dispose');
})(QueryDisposeRequest = exports.QueryDisposeRequest || (exports.QueryDisposeRequest = {}));
// ------------------------------- < Query Execution Complete Notification > ------------------------------------
var QueryExecuteCompleteNotification;
(function (QueryExecuteCompleteNotification) {
    QueryExecuteCompleteNotification.type = new vscode_languageclient_1.NotificationType('query/complete');
})(QueryExecuteCompleteNotification = exports.QueryExecuteCompleteNotification || (exports.QueryExecuteCompleteNotification = {}));
// ------------------------------- < Query Batch Start  Notification > ------------------------------------
var QueryExecuteBatchStartNotification;
(function (QueryExecuteBatchStartNotification) {
    QueryExecuteBatchStartNotification.type = new vscode_languageclient_1.NotificationType('query/batchStart');
})(QueryExecuteBatchStartNotification = exports.QueryExecuteBatchStartNotification || (exports.QueryExecuteBatchStartNotification = {}));
// ------------------------------- < Query Batch Complete Notification > ------------------------------------
var QueryExecuteBatchCompleteNotification;
(function (QueryExecuteBatchCompleteNotification) {
    QueryExecuteBatchCompleteNotification.type = new vscode_languageclient_1.NotificationType('query/batchComplete');
})(QueryExecuteBatchCompleteNotification = exports.QueryExecuteBatchCompleteNotification || (exports.QueryExecuteBatchCompleteNotification = {}));
// ------------------------------- < Query ResultSet Complete Notification > ------------------------------------
var QueryExecuteResultSetCompleteNotification;
(function (QueryExecuteResultSetCompleteNotification) {
    QueryExecuteResultSetCompleteNotification.type = new vscode_languageclient_1.NotificationType('query/resultSetComplete');
})(QueryExecuteResultSetCompleteNotification = exports.QueryExecuteResultSetCompleteNotification || (exports.QueryExecuteResultSetCompleteNotification = {}));
// ------------------------------- < Query Message Notification > ------------------------------------
var QueryExecuteMessageNotification;
(function (QueryExecuteMessageNotification) {
    QueryExecuteMessageNotification.type = new vscode_languageclient_1.NotificationType('query/message');
})(QueryExecuteMessageNotification = exports.QueryExecuteMessageNotification || (exports.QueryExecuteMessageNotification = {}));
// ------------------------------- < Query Execution Request > ------------------------------------
var QueryExecuteRequest;
(function (QueryExecuteRequest) {
    QueryExecuteRequest.type = new vscode_languageclient_1.RequestType('query/executeDocumentSelection');
})(QueryExecuteRequest = exports.QueryExecuteRequest || (exports.QueryExecuteRequest = {}));
// ------------------------------- < Query Results Request > ------------------------------------
var QueryExecuteSubsetRequest;
(function (QueryExecuteSubsetRequest) {
    QueryExecuteSubsetRequest.type = new vscode_languageclient_1.RequestType('query/subset');
})(QueryExecuteSubsetRequest = exports.QueryExecuteSubsetRequest || (exports.QueryExecuteSubsetRequest = {}));
var QueryExecuteStatementRequest;
(function (QueryExecuteStatementRequest) {
    QueryExecuteStatementRequest.type = new vscode_languageclient_1.RequestType('query/executedocumentstatement');
})(QueryExecuteStatementRequest = exports.QueryExecuteStatementRequest || (exports.QueryExecuteStatementRequest = {}));
// --------------------------------- < Save Results as CSV Request > ------------------------------------------
// save results in csv format
var SaveResultsAsCsvRequest;
(function (SaveResultsAsCsvRequest) {
    SaveResultsAsCsvRequest.type = new vscode_languageclient_1.RequestType('query/saveCsv');
})(SaveResultsAsCsvRequest = exports.SaveResultsAsCsvRequest || (exports.SaveResultsAsCsvRequest = {}));
// --------------------------------- </ Save Results as CSV Request > ------------------------------------------
// --------------------------------- < Save Results as JSON Request > ------------------------------------------
// save results in json format
var SaveResultsAsJsonRequest;
(function (SaveResultsAsJsonRequest) {
    SaveResultsAsJsonRequest.type = new vscode_languageclient_1.RequestType('query/saveJson');
})(SaveResultsAsJsonRequest = exports.SaveResultsAsJsonRequest || (exports.SaveResultsAsJsonRequest = {}));
// --------------------------------- </ Save Results as JSON Request > ------------------------------------------
// --------------------------------- < Save Results as Excel Request > ------------------------------------------
// save results in Excel format
var SaveResultsAsExcelRequest;
(function (SaveResultsAsExcelRequest) {
    SaveResultsAsExcelRequest.type = new vscode_languageclient_1.RequestType('query/saveExcel');
})(SaveResultsAsExcelRequest = exports.SaveResultsAsExcelRequest || (exports.SaveResultsAsExcelRequest = {}));
// --------------------------------- </ Save Results as Excel Request > ------------------------------------------
// ------------------------------- < Execute and Return > -----------------------------------
var SimpleExecuteRequest;
(function (SimpleExecuteRequest) {
    SimpleExecuteRequest.type = new vscode_languageclient_1.RequestType('query/simpleexecute');
})(SimpleExecuteRequest = exports.SimpleExecuteRequest || (exports.SimpleExecuteRequest = {}));
var QueryExecuteStringRequest;
(function (QueryExecuteStringRequest) {
    QueryExecuteStringRequest.type = new vscode_languageclient_1.RequestType('query/executeString');
})(QueryExecuteStringRequest = exports.QueryExecuteStringRequest || (exports.QueryExecuteStringRequest = {}));
// ------------------------------- < Metadata Events > ------------------------------------
var MetadataQueryRequest;
(function (MetadataQueryRequest) {
    MetadataQueryRequest.type = new vscode_languageclient_1.RequestType('metadata/list');
})(MetadataQueryRequest = exports.MetadataQueryRequest || (exports.MetadataQueryRequest = {}));
// ------------------------------- < Scripting Events > ------------------------------------
var ScriptingRequest;
(function (ScriptingRequest) {
    ScriptingRequest.type = new vscode_languageclient_1.RequestType('scripting/script');
})(ScriptingRequest = exports.ScriptingRequest || (exports.ScriptingRequest = {}));
// ------------------------------- < Scripting Complete Event > ------------------------------------
var ScriptingCompleteNotification;
(function (ScriptingCompleteNotification) {
    ScriptingCompleteNotification.type = new vscode_languageclient_1.NotificationType('scripting/scriptComplete');
})(ScriptingCompleteNotification = exports.ScriptingCompleteNotification || (exports.ScriptingCompleteNotification = {}));
// edit/commit --------------------------------------------------------------------------------
var EditCommitRequest;
(function (EditCommitRequest) {
    EditCommitRequest.type = new vscode_languageclient_1.RequestType('edit/commit');
})(EditCommitRequest = exports.EditCommitRequest || (exports.EditCommitRequest = {}));
// edit/createRow -----------------------------------------------------------------------------
var EditCreateRowRequest;
(function (EditCreateRowRequest) {
    EditCreateRowRequest.type = new vscode_languageclient_1.RequestType('edit/createRow');
})(EditCreateRowRequest = exports.EditCreateRowRequest || (exports.EditCreateRowRequest = {}));
// edit/deleteRow -----------------------------------------------------------------------------
var EditDeleteRowRequest;
(function (EditDeleteRowRequest) {
    EditDeleteRowRequest.type = new vscode_languageclient_1.RequestType('edit/deleteRow');
})(EditDeleteRowRequest = exports.EditDeleteRowRequest || (exports.EditDeleteRowRequest = {}));
// edit/dispose -------------------------------------------------------------------------------
var EditDisposeRequest;
(function (EditDisposeRequest) {
    EditDisposeRequest.type = new vscode_languageclient_1.RequestType('edit/dispose');
})(EditDisposeRequest = exports.EditDisposeRequest || (exports.EditDisposeRequest = {}));
// edit/initialize ----------------------------------------------------------------------------
var EditInitializeRequest;
(function (EditInitializeRequest) {
    EditInitializeRequest.type = new vscode_languageclient_1.RequestType('edit/initialize');
})(EditInitializeRequest = exports.EditInitializeRequest || (exports.EditInitializeRequest = {}));
// edit/revertCell --------------------------------------------------------------------------------
var EditRevertCellRequest;
(function (EditRevertCellRequest) {
    EditRevertCellRequest.type = new vscode_languageclient_1.RequestType('edit/revertCell');
})(EditRevertCellRequest = exports.EditRevertCellRequest || (exports.EditRevertCellRequest = {}));
// edit/revertRow -----------------------------------------------------------------------------
var EditRevertRowRequest;
(function (EditRevertRowRequest) {
    EditRevertRowRequest.type = new vscode_languageclient_1.RequestType('edit/revertRow');
})(EditRevertRowRequest = exports.EditRevertRowRequest || (exports.EditRevertRowRequest = {}));
// edit/sessionReady Event --------------------------------------------------------------------
var EditSessionReadyNotification;
(function (EditSessionReadyNotification) {
    EditSessionReadyNotification.type = new vscode_languageclient_1.NotificationType('edit/sessionReady');
})(EditSessionReadyNotification = exports.EditSessionReadyNotification || (exports.EditSessionReadyNotification = {}));
// edit/updateCell ----------------------------------------------------------------------------
var EditUpdateCellRequest;
(function (EditUpdateCellRequest) {
    EditUpdateCellRequest.type = new vscode_languageclient_1.RequestType('edit/updateCell');
})(EditUpdateCellRequest = exports.EditUpdateCellRequest || (exports.EditUpdateCellRequest = {}));
// edit/subset ------------------------------------------------------------------------------------
var EditSubsetRequest;
(function (EditSubsetRequest) {
    EditSubsetRequest.type = new vscode_languageclient_1.RequestType('edit/subset');
})(EditSubsetRequest = exports.EditSubsetRequest || (exports.EditSubsetRequest = {}));
// ------------------------------- < Object Explorer Events > ------------------------------------
var ObjectExplorerCreateSessionRequest;
(function (ObjectExplorerCreateSessionRequest) {
    ObjectExplorerCreateSessionRequest.type = new vscode_languageclient_1.RequestType('objectexplorer/createsession');
})(ObjectExplorerCreateSessionRequest = exports.ObjectExplorerCreateSessionRequest || (exports.ObjectExplorerCreateSessionRequest = {}));
var ObjectExplorerExpandRequest;
(function (ObjectExplorerExpandRequest) {
    ObjectExplorerExpandRequest.type = new vscode_languageclient_1.RequestType('objectexplorer/expand');
})(ObjectExplorerExpandRequest = exports.ObjectExplorerExpandRequest || (exports.ObjectExplorerExpandRequest = {}));
var ObjectExplorerRefreshRequest;
(function (ObjectExplorerRefreshRequest) {
    ObjectExplorerRefreshRequest.type = new vscode_languageclient_1.RequestType('objectexplorer/refresh');
})(ObjectExplorerRefreshRequest = exports.ObjectExplorerRefreshRequest || (exports.ObjectExplorerRefreshRequest = {}));
var ObjectExplorerCloseSessionRequest;
(function (ObjectExplorerCloseSessionRequest) {
    ObjectExplorerCloseSessionRequest.type = new vscode_languageclient_1.RequestType('objectexplorer/closesession');
})(ObjectExplorerCloseSessionRequest = exports.ObjectExplorerCloseSessionRequest || (exports.ObjectExplorerCloseSessionRequest = {}));
// ------------------------------- < Object Explorer Events > ------------------------------------
var ObjectExplorerCreateSessionCompleteNotification;
(function (ObjectExplorerCreateSessionCompleteNotification) {
    ObjectExplorerCreateSessionCompleteNotification.type = new vscode_languageclient_1.NotificationType('objectexplorer/sessioncreated');
})(ObjectExplorerCreateSessionCompleteNotification = exports.ObjectExplorerCreateSessionCompleteNotification || (exports.ObjectExplorerCreateSessionCompleteNotification = {}));
var ObjectExplorerExpandCompleteNotification;
(function (ObjectExplorerExpandCompleteNotification) {
    ObjectExplorerExpandCompleteNotification.type = new vscode_languageclient_1.NotificationType('objectexplorer/expandCompleted');
})(ObjectExplorerExpandCompleteNotification = exports.ObjectExplorerExpandCompleteNotification || (exports.ObjectExplorerExpandCompleteNotification = {}));
// ------------------------------- < Task Service Events > ------------------------------------
var ListTasksRequest;
(function (ListTasksRequest) {
    ListTasksRequest.type = new vscode_languageclient_1.RequestType('tasks/listtasks');
})(ListTasksRequest = exports.ListTasksRequest || (exports.ListTasksRequest = {}));
var CancelTaskRequest;
(function (CancelTaskRequest) {
    CancelTaskRequest.type = new vscode_languageclient_1.RequestType('tasks/canceltask');
})(CancelTaskRequest = exports.CancelTaskRequest || (exports.CancelTaskRequest = {}));
// ------------------------------- < Task Service Events > ------------------------------------
var TaskStatusChangedNotification;
(function (TaskStatusChangedNotification) {
    TaskStatusChangedNotification.type = new vscode_languageclient_1.NotificationType('tasks/statuschanged');
})(TaskStatusChangedNotification = exports.TaskStatusChangedNotification || (exports.TaskStatusChangedNotification = {}));
var TaskCreatedNotification;
(function (TaskCreatedNotification) {
    TaskCreatedNotification.type = new vscode_languageclient_1.NotificationType('tasks/newtaskcreated');
})(TaskCreatedNotification = exports.TaskCreatedNotification || (exports.TaskCreatedNotification = {}));
// ------------------------------- < Admin Service Events > ------------------------------------
var CreateDatabaseRequest;
(function (CreateDatabaseRequest) {
    CreateDatabaseRequest.type = new vscode_languageclient_1.RequestType('admin/createdatabase');
})(CreateDatabaseRequest = exports.CreateDatabaseRequest || (exports.CreateDatabaseRequest = {}));
var DefaultDatabaseInfoRequest;
(function (DefaultDatabaseInfoRequest) {
    DefaultDatabaseInfoRequest.type = new vscode_languageclient_1.RequestType('admin/defaultdatabaseinfo');
})(DefaultDatabaseInfoRequest = exports.DefaultDatabaseInfoRequest || (exports.DefaultDatabaseInfoRequest = {}));
var CreateLoginRequest;
(function (CreateLoginRequest) {
    CreateLoginRequest.type = new vscode_languageclient_1.RequestType('admin/createlogin');
})(CreateLoginRequest = exports.CreateLoginRequest || (exports.CreateLoginRequest = {}));
var GetDatabaseInfoRequest;
(function (GetDatabaseInfoRequest) {
    GetDatabaseInfoRequest.type = new vscode_languageclient_1.RequestType('admin/getdatabaseinfo');
})(GetDatabaseInfoRequest = exports.GetDatabaseInfoRequest || (exports.GetDatabaseInfoRequest = {}));
// ------------------------------- < Disaster Recovery Events > ------------------------------------
var BackupRequest;
(function (BackupRequest) {
    BackupRequest.type = new vscode_languageclient_1.RequestType('backup/backup');
})(BackupRequest = exports.BackupRequest || (exports.BackupRequest = {}));
var BackupConfigInfoRequest;
(function (BackupConfigInfoRequest) {
    BackupConfigInfoRequest.type = new vscode_languageclient_1.RequestType('backup/backupconfiginfo');
})(BackupConfigInfoRequest = exports.BackupConfigInfoRequest || (exports.BackupConfigInfoRequest = {}));
var RestoreRequest;
(function (RestoreRequest) {
    RestoreRequest.type = new vscode_languageclient_1.RequestType('restore/restore');
})(RestoreRequest = exports.RestoreRequest || (exports.RestoreRequest = {}));
var RestorePlanRequest;
(function (RestorePlanRequest) {
    RestorePlanRequest.type = new vscode_languageclient_1.RequestType('restore/restoreplan');
})(RestorePlanRequest = exports.RestorePlanRequest || (exports.RestorePlanRequest = {}));
var CancelRestorePlanRequest;
(function (CancelRestorePlanRequest) {
    CancelRestorePlanRequest.type = new vscode_languageclient_1.RequestType('restore/cancelrestoreplan');
})(CancelRestorePlanRequest = exports.CancelRestorePlanRequest || (exports.CancelRestorePlanRequest = {}));
var RestoreConfigInfoRequest;
(function (RestoreConfigInfoRequest) {
    RestoreConfigInfoRequest.type = new vscode_languageclient_1.RequestType('restore/restoreconfiginfo');
})(RestoreConfigInfoRequest = exports.RestoreConfigInfoRequest || (exports.RestoreConfigInfoRequest = {}));
// ------------------------------- < File Browser Events > ------------------------------------
var FileBrowserOpenRequest;
(function (FileBrowserOpenRequest) {
    FileBrowserOpenRequest.type = new vscode_languageclient_1.RequestType('filebrowser/open');
})(FileBrowserOpenRequest = exports.FileBrowserOpenRequest || (exports.FileBrowserOpenRequest = {}));
var FileBrowserOpenedNotification;
(function (FileBrowserOpenedNotification) {
    FileBrowserOpenedNotification.type = new vscode_languageclient_1.NotificationType('filebrowser/opencomplete');
})(FileBrowserOpenedNotification = exports.FileBrowserOpenedNotification || (exports.FileBrowserOpenedNotification = {}));
var FileBrowserExpandRequest;
(function (FileBrowserExpandRequest) {
    FileBrowserExpandRequest.type = new vscode_languageclient_1.RequestType('filebrowser/expand');
})(FileBrowserExpandRequest = exports.FileBrowserExpandRequest || (exports.FileBrowserExpandRequest = {}));
var FileBrowserExpandedNotification;
(function (FileBrowserExpandedNotification) {
    FileBrowserExpandedNotification.type = new vscode_languageclient_1.NotificationType('filebrowser/expandcomplete');
})(FileBrowserExpandedNotification = exports.FileBrowserExpandedNotification || (exports.FileBrowserExpandedNotification = {}));
var FileBrowserValidateRequest;
(function (FileBrowserValidateRequest) {
    FileBrowserValidateRequest.type = new vscode_languageclient_1.RequestType('filebrowser/validate');
})(FileBrowserValidateRequest = exports.FileBrowserValidateRequest || (exports.FileBrowserValidateRequest = {}));
var FileBrowserValidatedNotification;
(function (FileBrowserValidatedNotification) {
    FileBrowserValidatedNotification.type = new vscode_languageclient_1.NotificationType('filebrowser/validatecomplete');
})(FileBrowserValidatedNotification = exports.FileBrowserValidatedNotification || (exports.FileBrowserValidatedNotification = {}));
var FileBrowserCloseRequest;
(function (FileBrowserCloseRequest) {
    FileBrowserCloseRequest.type = new vscode_languageclient_1.RequestType('filebrowser/close');
})(FileBrowserCloseRequest = exports.FileBrowserCloseRequest || (exports.FileBrowserCloseRequest = {}));
// ------------------------------- < Profiler Events > ------------------------------------
var StartProfilingRequest;
(function (StartProfilingRequest) {
    StartProfilingRequest.type = new vscode_languageclient_1.RequestType('profiler/start');
})(StartProfilingRequest = exports.StartProfilingRequest || (exports.StartProfilingRequest = {}));
var StopProfilingRequest;
(function (StopProfilingRequest) {
    StopProfilingRequest.type = new vscode_languageclient_1.RequestType('profiler/stop');
})(StopProfilingRequest = exports.StopProfilingRequest || (exports.StopProfilingRequest = {}));
var ProfilerEventsAvailableNotification;
(function (ProfilerEventsAvailableNotification) {
    ProfilerEventsAvailableNotification.type = new vscode_languageclient_1.NotificationType('profiler/eventsavailable');
})(ProfilerEventsAvailableNotification = exports.ProfilerEventsAvailableNotification || (exports.ProfilerEventsAvailableNotification = {}));
