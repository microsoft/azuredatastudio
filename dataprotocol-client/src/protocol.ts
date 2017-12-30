import { ClientCapabilities as VSClientCapabilities, RequestType, NotificationType } from 'vscode-languageclient';

import {
	ConnectionDetails, ConnectionCompleteParams, ConnectionSummary, ColumnMetadata, IntelliSenseReadyParams,
	CapabiltiesDiscoveryResult, BatchSummary, QueryExecuteBatchNotificationParams, ResultSetSummary,
	IResultMessage, ISelectionData, DbCellValue, IDbColumn, MetadataQueryParams, MetadataQueryResult,
	ScriptingParams, ScriptingResult, ScriptingCompleteParams, EditCell, EditRow, CreateSessionResponse,
	ExpandParams, CloseSessionParams, CloseSessionResponse, SessionCreatedParameters, ExpandResponse,
	ListTasksParams, ListTasksResponse, CancelTaskParams, TaskProgressInfo, TaskInfo, CreateDatabaseParams,
	CreateDatabaseResponse, DefaultDatabaseInfoParams, DefaultDatabaseInfoResponse, CreateLoginParams,
	CreateLoginResponse, GetDatabaseInfoParams, GetDatabaseInfoResponse, BackupParams, BackupResponse,
	BackupConfigInfoResponse, RestoreParams, RestoreResponse, RestorePlanResponse, RestoreConfigInfoRequestParams,
	RestoreConfigInfoResponse, FileBrowserOpenParams, FileBrowserOpenedParams, FileBrowserExpandParams,
	FileBrowserExpandedParams, FileBrowserValidateParams, FileBrowserValidatedParams, FileBrowserCloseParams,
	FileBrowserCloseResponse, StartProfilingParams, StartProfilingResponse, StopProfilingResponse, StopProfilingParams,
	ProfilerEventsAvailableParams
} from './types';

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
	}
}

export interface ClientCapabilities extends VSClientCapabilities {
	connection?: ConnectionClientCapabilities;
}

//---- Refresh IntelliSense ----------------------------------------

/**
 * Notification sent when the an IntelliSense cache invalidation is requested
 */
export namespace RebuildIntelliSenseNotification {
	export const type = new NotificationType<RebuildIntelliSenseParams, void>('textDocument/rebuildIntelliSense');
}

/**
 * Rebuild IntelliSense notification parameters
 */
export class RebuildIntelliSenseParams {
	/**
	 * URI identifying the text document
	 */
	public ownerUri: string;
}


// ------------------------------- < Connect Request > ----------------------------------------------

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
	connection: ConnectionDetails;
}


// Connection request message callback declaration
export namespace ConnectionRequest {
	export const type = new RequestType<ConnectParams, boolean, void, void>('connection/connect');
}

// ------------------------------- < Connection Complete Event > ------------------------------------


export namespace ConnectionCompleteNotification {
	export const type = new NotificationType<ConnectionCompleteParams, void>('connection/complete');
}

// ------------------------------- < Connection Changed Event > -------------------------------------

/**
 * Parameters for the ConnectionChanged notification.
 */
export class ConnectionChangedParams {
	/**
	 * Owner URI of the connection that changed.
	 */
	public ownerUri: string;

	/**
	 * Summary of details containing any connection changes.
	 */
	public connection: ConnectionSummary;
}

/**
 * Connection changed event callback declaration.
 */
export namespace ConnectionChangedNotification {
	export const type = new NotificationType<ConnectionChangedParams, void>('connection/connectionchanged');
}

// ------------------------------- < Disconnect Request > -------------------------------------------

// Disconnect request message format
export class DisconnectParams {
	// URI identifying the owner of the connection
	public ownerUri: string;
}

// Disconnect response format
export type DisconnectResult = boolean;

// Disconnect request message callback declaration
export namespace DisconnectRequest {
	export const type = new RequestType<DisconnectParams, DisconnectResult, void, void>('connection/disconnect');
}

// ------------------------------- < Cancel Connect Request > ---------------------------------------


// Cancel connect request message format
export class CancelConnectParams {
    /**
     * URI identifying the owner of the connection
     */
	public ownerUri: string;
}

// Cancel connect response format.
export type CancelConnectResult = boolean;

// Cancel connect request message callback declaration
export namespace CancelConnectRequest {
	export const type = new RequestType<CancelConnectParams, CancelConnectResult, void, void>('connection/cancelconnect');
}

// ------------------------------- < Change Database Request > -------------------------------------

export class ChangeDatabaseParams {
	public ownerUri: string;
	public newDatabase: string;
}

export namespace ChangeDatabaseRequest {
	export const type = new RequestType<ChangeDatabaseParams, boolean, void, void>('connection/changedatabase');
}

// ------------------------------- < List Databases Request > ---------------------------------------

// List databases request format
export class ListDatabasesParams {
	// Connection information to use for querying master
	public ownerUri: string;
}

// List databases response format
export class ListDatabasesResult {
	public databaseNames: Array<string>;
}

// List databases request callback declaration
export namespace ListDatabasesRequest {
	export const type = new RequestType<ListDatabasesParams, ListDatabasesResult, void, void>('connection/listdatabases');
}

// Language Flavor Changed ================================================================================

/**
 * Parameters to provide when sending a language flavor changed notification
 */
export interface DidChangeLanguageFlavorParams {
	uri: string;
	language: string;
	flavor: string;
}

// ------------------------------- < Language Flavor Changed Notification > ---------------------------------------
export namespace LanguageFlavorChangedNotification {
	export const type = new NotificationType<DidChangeLanguageFlavorParams, void>('connection/languageflavorchanged');
}

// ------------------------------- < Table Metadata Request > ---------------------------------------

// Table metadata request format
export class TableMetadataParams {
	// Connection information to use for querying master
	public ownerUri: string;

	public schema: string;

	public objectName: string;
}

// Table metadata response format
export class TableMetadataResult {
	public columns: ColumnMetadata[];
}

// Table metadata request callback declaration
export namespace TableMetadataRequest {
	export const type = new RequestType<TableMetadataParams, TableMetadataResult, void, void>('metadata/table');
}

// ------------------------------- < View Metadata Request > ---------------------------------------

// Table metadata request callback declaration
export namespace ViewMetadataRequest {
	export const type = new RequestType<TableMetadataParams, TableMetadataResult, void, void>('metadata/view');
}

/**
 * Event sent when the language service is finished updating after a connection
 */
export namespace IntelliSenseReadyNotification {
	export const type = new NotificationType<IntelliSenseReadyParams, void>('textDocument/intelliSenseReady');
}

// ------------------------------- < Capabilties Discovery Event > ------------------------------------

export class CapabiltiesDiscoveryParams {
	public hostName: string;

	public hostVersion: string;
}

export namespace CapabiltiesDiscoveryRequest {
	export const type = new RequestType<CapabiltiesDiscoveryParams, CapabiltiesDiscoveryResult, void, void>('capabilities/list');
}

// Query Execution ================================================================================
// ------------------------------- < Query Cancellation Request > ------------------------------------
export namespace QueryCancelRequest {
	export const type = new RequestType<QueryCancelParams, QueryCancelResult, void, void>('query/cancel');
}

export interface QueryCancelParams {
	ownerUri: string;
}

export interface QueryCancelResult {
	messages: string;
}

// ------------------------------- < Query Dispose Request > ------------------------------------

export namespace QueryDisposeRequest {
	export const type = new RequestType<QueryDisposeParams, QueryDisposeResult, void, void>('query/dispose');
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

// ------------------------------- < Query Execution Complete Notification > ------------------------------------
export namespace QueryExecuteCompleteNotification {
	export const type = new NotificationType<QueryExecuteCompleteNotificationResult, void>('query/complete');
}

/**
 * Result received upon successful execution of a query
 */
export interface QueryExecuteCompleteNotificationResult {
	ownerUri: string;
	batchSummaries: BatchSummary[];
}

// ------------------------------- < Query Batch Start  Notification > ------------------------------------
export namespace QueryExecuteBatchStartNotification {
	export const type = new NotificationType<QueryExecuteBatchNotificationParams, void>('query/batchStart');
}

// ------------------------------- < Query Batch Complete Notification > ------------------------------------
export namespace QueryExecuteBatchCompleteNotification {
	export const type = new NotificationType<QueryExecuteBatchNotificationParams, void>('query/batchComplete');
}

// ------------------------------- < Query ResultSet Complete Notification > ------------------------------------
export namespace QueryExecuteResultSetCompleteNotification {
	export const type = new NotificationType<QueryExecuteResultSetCompleteNotificationParams, void>('query/resultSetComplete');
}

export interface QueryExecuteResultSetCompleteNotificationParams {
	resultSetSummary: ResultSetSummary;
	ownerUri: string;
}

// ------------------------------- < Query Message Notification > ------------------------------------
export namespace QueryExecuteMessageNotification {
	export const type = new NotificationType<QueryExecuteMessageParams, void>('query/message');
}

export class QueryExecuteMessageParams {
	message: IResultMessage;
	ownerUri: string;
}

// ------------------------------- < Query Execution Request > ------------------------------------
export namespace QueryExecuteRequest {
	export const type = new RequestType<QueryExecuteParams, QueryExecuteResult, void, void>('query/executeDocumentSelection');
}

export interface ExecutionPlanOptions {
	includeEstimatedExecutionPlanXml?: boolean;
	includeActualExecutionPlanXml?: boolean;
}

export interface QueryExecuteParams {
	ownerUri: string;
	querySelection: ISelectionData;
	executionPlanOptions?: ExecutionPlanOptions;
}

export interface QueryExecuteResult { }

// ------------------------------- < Query Results Request > ------------------------------------
export namespace QueryExecuteSubsetRequest {
	export const type = new RequestType<QueryExecuteSubsetParams, QueryExecuteSubsetResult, void, void>('query/subset');
}

export interface QueryExecuteSubsetParams {
	ownerUri: string;
	batchIndex: number;
	resultSetIndex: number;
	rowsStartIndex: number;
	rowsCount: number;
}

export interface ResultSetSubset {
	rowCount: number;
	rows: DbCellValue[][];
}

export interface QueryExecuteSubsetResult {
	message: string;
	resultSubset: ResultSetSubset;
}

// ------------------------------- < Execute Statement > ------------------------------------
export interface QueryExecuteStatementParams {
	ownerUri: string;
	line: number;
	column: number;
}

export namespace QueryExecuteStatementRequest {
	export const type = new RequestType<QueryExecuteStatementParams, QueryExecuteResult, void, void>('query/executedocumentstatement');
}

// --------------------------------- < Save Results as CSV Request > ------------------------------------------
export interface SaveResultsRequestParams {
	ownerUri: string;
	filePath: string;
	batchIndex: number;
	resultSetIndex: number;
	rowStartIndex: number;
	rowEndIndex: number;
	columnStartIndex: number;
	columnEndIndex: number;
	includeHeaders?: boolean;
}

export class SaveResultRequestResult {
	messages: string;
}
// save results in csv format
export namespace SaveResultsAsCsvRequest {
	export const type = new RequestType<SaveResultsRequestParams, SaveResultRequestResult, void, void>('query/saveCsv');
}
// --------------------------------- </ Save Results as CSV Request > ------------------------------------------

// --------------------------------- < Save Results as JSON Request > ------------------------------------------
// save results in json format
export namespace SaveResultsAsJsonRequest {
	export const type = new RequestType<SaveResultsRequestParams, SaveResultRequestResult, void, void>('query/saveJson');
}
// --------------------------------- </ Save Results as JSON Request > ------------------------------------------

// --------------------------------- < Save Results as Excel Request > ------------------------------------------
// save results in Excel format
export namespace SaveResultsAsExcelRequest {
	export const type = new RequestType<SaveResultsRequestParams, SaveResultRequestResult, void, void>('query/saveExcel');
}
// --------------------------------- </ Save Results as Excel Request > ------------------------------------------

// ------------------------------- < Execute and Return > -----------------------------------

export interface SimpleExecuteParams {
	queryString: string;
	ownerUri: string;
}

export interface SimpleExecuteResult {
	rowCount: number;
	columnInfo: IDbColumn[];
	rows: DbCellValue[][];
}

export namespace SimpleExecuteRequest {
	export const type = new RequestType<SimpleExecuteParams, SimpleExecuteResult, void, void>('query/simpleexecute');
}

// ------------------------------- < Execute String > ------------------------------------
export interface QueryExecuteStringParams {
	query: string;
	ownerUri: string;
}

export namespace QueryExecuteStringRequest {
	export const type = new RequestType<QueryExecuteStringParams, QueryExecuteResult, void, void>('query/executeString');
}

// ------------------------------- < Metadata Events > ------------------------------------

export namespace MetadataQueryRequest {
	export const type = new RequestType<MetadataQueryParams, MetadataQueryResult, void, void>('metadata/list');
}

// ------------------------------- < Scripting Events > ------------------------------------

export namespace ScriptingRequest {
	export const type = new RequestType<ScriptingParams, ScriptingResult, void, void>('scripting/script');
}

// ------------------------------- < Scripting Complete Event > ------------------------------------

export namespace ScriptingCompleteNotification {
	export const type = new NotificationType<ScriptingCompleteParams, void>('scripting/scriptComplete');
}


// Edit Data ======================================================================================
// Shared Interfaces --------------------------------------------------------------------------
export interface EditSessionOperationParams {
	ownerUri: string;
}

export interface EditRowOperationParams extends EditSessionOperationParams {
	rowId: number;
}

export interface EditCellResult {
	cell: EditCell;
	isRowDirty: boolean;
}

// edit/commit --------------------------------------------------------------------------------
export namespace EditCommitRequest {
	export const type = new RequestType<EditCommitParams, EditCommitResult, void, void>('edit/commit');
}

export interface EditCommitParams extends EditSessionOperationParams { }

export interface EditCommitResult { }

// edit/createRow -----------------------------------------------------------------------------
export namespace EditCreateRowRequest {
	export const type = new RequestType<EditCreateRowParams, EditCreateRowResult, void, void>('edit/createRow');
}

export interface EditCreateRowParams extends EditSessionOperationParams { }

export interface EditCreateRowResult {
	defaultValues: string[];
	newRowId: number;
}

// edit/deleteRow -----------------------------------------------------------------------------
export namespace EditDeleteRowRequest {
	export const type = new RequestType<EditDeleteRowParams, EditDeleteRowResult, void, void>('edit/deleteRow');
}
export interface EditDeleteRowParams extends EditRowOperationParams { }

export interface EditDeleteRowResult { }

// edit/dispose -------------------------------------------------------------------------------
export namespace EditDisposeRequest {
	export const type = new RequestType<EditDisposeParams, EditDisposeResult, void, void>('edit/dispose');
}

export interface EditDisposeParams extends EditSessionOperationParams { }

export interface EditDisposeResult { }

// edit/initialize ----------------------------------------------------------------------------
export namespace EditInitializeRequest {
	export const type = new RequestType<EditInitializeParams, EditInitializeResult, void, void>('edit/initialize');
}

export interface EditInitializeFiltering {
	LimitResults?: number;
}

export interface EditInitializeParams extends EditSessionOperationParams {
	filters: EditInitializeFiltering;
	objectName: string;
	schemaName: string;
	objectType: string;
}

export interface EditInitializeResult { }

// edit/revertCell --------------------------------------------------------------------------------
export namespace EditRevertCellRequest {
	export const type = new RequestType<EditRevertCellParams, EditRevertCellResult, void, void>('edit/revertCell');
}

export interface EditRevertCellParams extends EditRowOperationParams {
	columnId: number;
}

export interface EditRevertCellResult extends EditCellResult {
}

// edit/revertRow -----------------------------------------------------------------------------
export namespace EditRevertRowRequest {
	export const type = new RequestType<EditRevertRowParams, EditRevertRowResult, void, void>('edit/revertRow');
}

export interface EditRevertRowParams extends EditRowOperationParams { }

export interface EditRevertRowResult { }

// edit/sessionReady Event --------------------------------------------------------------------
export namespace EditSessionReadyNotification {
	export const type = new NotificationType<EditSessionReadyParams, void>('edit/sessionReady');
}

export interface EditSessionReadyParams {
	ownerUri: string;
	success: boolean;
	message: string;
}

// edit/updateCell ----------------------------------------------------------------------------
export namespace EditUpdateCellRequest {
	export const type = new RequestType<EditUpdateCellParams, EditUpdateCellResult, void, void>('edit/updateCell');
}

export interface EditUpdateCellParams extends EditRowOperationParams {
	columnId: number;
	newValue: string;
}

export interface EditUpdateCellResult extends EditCellResult { }

// edit/subset ------------------------------------------------------------------------------------
export namespace EditSubsetRequest {
	export const type = new RequestType<EditSubsetParams, EditSubsetResult, void, void>('edit/subset');
}

export interface EditSubsetParams extends EditSessionOperationParams {
	rowStartIndex: number;
	rowCount: number;
}

export interface EditSubsetResult {
	rowCount: number;
	subset: EditRow[];
}

// ------------------------------- < Object Explorer Events > ------------------------------------

export namespace ObjectExplorerCreateSessionRequest {
	export const type = new RequestType<ConnectionDetails, CreateSessionResponse, void, void>('objectexplorer/createsession');
}

export namespace ObjectExplorerExpandRequest {
	export const type = new RequestType<ExpandParams, boolean, void, void>('objectexplorer/expand');
}

export namespace ObjectExplorerRefreshRequest {
	export const type = new RequestType<ExpandParams, boolean, void, void>('objectexplorer/refresh');
}

export namespace ObjectExplorerCloseSessionRequest {
	export const type = new RequestType<CloseSessionParams, CloseSessionResponse, void, void>('objectexplorer/closesession');
}

// ------------------------------- < Object Explorer Events > ------------------------------------


export namespace ObjectExplorerCreateSessionCompleteNotification {
	export const type = new NotificationType<SessionCreatedParameters, void>('objectexplorer/sessioncreated');
}

export namespace ObjectExplorerExpandCompleteNotification {
	export const type = new NotificationType<ExpandResponse, void>('objectexplorer/expandCompleted');
}

// ------------------------------- < Task Service Events > ------------------------------------

export namespace ListTasksRequest {
	export const type = new RequestType<ListTasksParams, ListTasksResponse, void, void>('tasks/listtasks');
}

export namespace CancelTaskRequest {
	export const type = new RequestType<CancelTaskParams, boolean, void, void>('tasks/canceltask');
}

// ------------------------------- < Task Service Events > ------------------------------------


export namespace TaskStatusChangedNotification {
	export const type = new NotificationType<TaskProgressInfo, void>('tasks/statuschanged');
}

export namespace TaskCreatedNotification {
	export const type = new NotificationType<TaskInfo, void>('tasks/newtaskcreated');
}

// ------------------------------- < Admin Service Events > ------------------------------------

export namespace CreateDatabaseRequest {
	export const type = new RequestType<CreateDatabaseParams, CreateDatabaseResponse, void, void>('admin/createdatabase');
}

export namespace DefaultDatabaseInfoRequest {
	export const type = new RequestType<DefaultDatabaseInfoParams, DefaultDatabaseInfoResponse, void, void>('admin/defaultdatabaseinfo');
}

export namespace CreateLoginRequest {
	export const type = new RequestType<CreateLoginParams, CreateLoginResponse, void, void>('admin/createlogin');
}

export namespace GetDatabaseInfoRequest {
	export const type = new RequestType<GetDatabaseInfoParams, GetDatabaseInfoResponse, void, void>('admin/getdatabaseinfo');
}

// ------------------------------- < Disaster Recovery Events > ------------------------------------

export namespace BackupRequest {
	export const type = new RequestType<BackupParams, BackupResponse, void, void>('backup/backup');
}

export namespace BackupConfigInfoRequest {
	export const type = new RequestType<DefaultDatabaseInfoParams, BackupConfigInfoResponse, void, void>('backup/backupconfiginfo');
}

export namespace RestoreRequest {
	export const type = new RequestType<RestoreParams, RestoreResponse, void, void>('restore/restore');
}

export namespace RestorePlanRequest {
	export const type = new RequestType<RestoreParams, RestorePlanResponse, void, void>('restore/restoreplan');
}

export namespace CancelRestorePlanRequest {
	export const type = new RequestType<RestoreParams, boolean, void, void>('restore/cancelrestoreplan');
}

export namespace RestoreConfigInfoRequest {
	export const type = new RequestType<RestoreConfigInfoRequestParams, RestoreConfigInfoResponse, void, void>('restore/restoreconfiginfo');
}

// ------------------------------- < File Browser Events > ------------------------------------

export namespace FileBrowserOpenRequest {
	export const type = new RequestType<FileBrowserOpenParams, boolean, void, void>('filebrowser/open');
}

export namespace FileBrowserOpenedNotification {
	export const type = new NotificationType<FileBrowserOpenedParams, void>('filebrowser/opencomplete');
}

export namespace FileBrowserExpandRequest {
	export const type = new RequestType<FileBrowserExpandParams, boolean, void, void>('filebrowser/expand');
}

export namespace FileBrowserExpandedNotification {
	export const type = new NotificationType<FileBrowserExpandedParams, void>('filebrowser/expandcomplete');
}

export namespace FileBrowserValidateRequest {
	export const type = new RequestType<FileBrowserValidateParams, boolean, void, void>('filebrowser/validate');
}

export namespace FileBrowserValidatedNotification {
	export const type = new NotificationType<FileBrowserValidatedParams, void>('filebrowser/validatecomplete');
}

export namespace FileBrowserCloseRequest {
	export const type = new RequestType<FileBrowserCloseParams, FileBrowserCloseResponse, void, void>('filebrowser/close');
}


// ------------------------------- < Profiler Events > ------------------------------------

export namespace StartProfilingRequest {
	export const type = new RequestType<StartProfilingParams, StartProfilingResponse, void, void>('profiler/start');
}

export namespace StopProfilingRequest {
	export const type = new RequestType<StopProfilingParams, StopProfilingResponse, void, void>('profiler/stop');
}

export namespace ProfilerEventsAvailableNotification {
	export const type = new NotificationType<ProfilerEventsAvailableParams, void>('profiler/eventsavailable');
}
