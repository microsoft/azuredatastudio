/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
	createMainContextProxyIdentifier as createMainId,
	createExtHostContextProxyIdentifier as createExtId,
	ProxyIdentifier, IThreadService
} from 'vs/workbench/services/thread/common/threadService';

import * as data from 'data';

import { TPromise } from 'vs/base/common/winjs.base';
import { IDisposable } from 'vs/base/common/lifecycle';
export abstract class ExtHostAccountManagementShape {
	$autoOAuthCancelled(handle: number): Thenable<void> { throw ni(); }
	$clear(handle: number, accountKey: data.AccountKey): Thenable<void> { throw ni(); }
	$getSecurityToken(handle: number, account: data.Account): Thenable<{}> { throw ni(); }
	$initialize(handle: number, restoredAccounts: data.Account[]): Thenable<data.Account[]> { throw ni(); }
	$prompt(handle: number): Thenable<data.Account> { throw ni(); }
	$refresh(handle: number, account: data.Account): Thenable<data.Account> { throw ni(); }
}

export abstract class ExtHostConnectionManagementShape { }

export abstract class ExtHostDataProtocolShape {

	/**
	 * Establish a connection to a data source using the provided ConnectionInfo instance.
	 */
	$connect(handle: number, connectionUri: string, connection: data.ConnectionInfo): Thenable<boolean> { throw ni(); }

	/**
	 * Disconnect from a data source using the provided connectionUri string.
	 */
	$disconnect(handle: number, connectionUri: string): Thenable<boolean> { throw ni(); }

	/**
	 * Cancel a connection to a data source using the provided connectionUri string.
	 */
	$cancelConnect(handle: number, connectionUri: string): Thenable<boolean> { throw ni(); }

	/**
	 * Change the database for the connection.
	 */
	$changeDatabase(handle: number, connectionUri: string, newDatabase: string): Thenable<boolean> { throw ni(); }

	/**
	 * List databases for a data source using the provided connectionUri string.
	 * @param handle the handle to use when looking up a provider
	 * @param connectionUri URI identifying a connected resource
	 */
	$listDatabases(handle: number, connectionUri: string): Thenable<data.ListDatabasesResult> { throw ni(); }

	/**
	 * Notifies all listeners on the Extension Host side that a language change occurred
	 * for a dataprotocol language. The sub-flavor is the specific implementation used for query
	 * and other events
	 * @param params information on what URI was changed and the new language
	 */
	$languageFlavorChanged(params: data.DidChangeLanguageFlavorParams): void { throw ni(); }

	/**
	 * Callback when a connection request has completed
	 */
	$onConnectComplete(handle: number, connectionInfoSummary: data.ConnectionInfoSummary): void { throw ni(); }

	/**
	 * Callback when a IntelliSense cache has been built
	 */
	$onIntelliSenseCacheComplete(handle: number, connectionUri: string): void { throw ni(); }

	$getServerCapabilities(handle: number, client: data.DataProtocolClientCapabilities): Thenable<data.DataProtocolServerCapabilities> { throw ni(); }

	/**
	 * Metadata service methods
	 *
	 */
	$getMetadata(handle: number, connectionUri: string): Thenable<data.ProviderMetadata> { throw ni(); }

	$getDatabases(handle: number, connectionUri: string): Thenable<string[]> { throw ni(); }

	$getTableInfo(handle: number, connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> { throw ni(); }

	$getViewInfo(handle: number, connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> { throw ni(); }

	/**
	 * Object Explorer
	 */
	$createObjectExplorerSession(handle: number, connInfo: data.ConnectionInfo): Thenable<data.ObjectExplorerSessionResponse> { throw ni(); }

	$expandObjectExplorerNode(handle: number, nodeInfo: data.ExpandNodeInfo): Thenable<boolean> { throw ni(); }

	$refreshObjectExplorerNode(handle: number, nodeInfo: data.ExpandNodeInfo): Thenable<boolean> { throw ni(); }

	$closeObjectExplorerSession(handle: number, closeSessionInfo: data.ObjectExplorerCloseSessionInfo): Thenable<data.ObjectExplorerCloseSessionResponse> { throw ni(); }

	/**
	 * Tasks
	 */
	$getAllTasks(handle: number, listTasksParams: data.ListTasksParams): Thenable<data.ListTasksResponse> { throw ni(); }
	$cancelTask(handle: number, cancelTaskParams: data.CancelTaskParams): Thenable<boolean> { throw ni(); }

	/**
	 * Scripting methods
	 */
	$scriptAsOperation(handle: number, connectionUri: string, operation: data.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): Thenable<data.ScriptingResult> { throw ni(); }

	/**
	 * Cancels the currently running query for a URI
	 */
	$cancelQuery(handle: number, ownerUri: string): Thenable<data.QueryCancelResult> { throw ni(); }

	/**
	 * Runs a query for a text selection inside a document
	 */
	$runQuery(handle: number, ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void> { throw ni(); }
	/**
	 * Runs the current SQL statement query for a text document
	 */
	$runQueryStatement(handle: number, ownerUri: string, line: number, column: number): Thenable<void> { throw ni(); }
	/**
	 * Runs a query for a provided query
	 */
	$runQueryString(handle: number, ownerUri: string, queryString: string): Thenable<void> { throw ni(); }
	/**
	 * Runs a query for a provided query and returns result
	 */
	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult> { throw ni(); }
	/**
	 * Gets a subset of rows in a result set in order to display in the UI
	 */
	$getQueryRows(handle: number, rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult> { throw ni(); }

	/**
	 * Disposes the cached information regarding a query
	 */
	$disposeQuery(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Refreshes the IntelliSense cache
	 */
	$rebuildIntelliSenseCache(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Callback when a query has completed
	 */
	$onQueryComplete(handle: number, result: data.QueryExecuteCompleteNotificationResult): void { throw ni(); }
	/**
	 * Callback when a batch has started. This enables the UI to display when batch execution has started
	 */
	$onBatchStart(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void { throw ni(); }
	/**
	 * Callback when a batch is complete. This includes updated information on result sets, time to execute, and
	 * other relevant batch information
	 */
	$onBatchComplete(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void { throw ni(); }
	/**
	 * Callback when a result set has been returned from query execution and can be displayed
	 */
	$onResultSetComplete(handle: number, resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams): void { throw ni(); }
	/**
	 * Callback when a message generated during query execution is issued
	 */
	$onQueryMessage(handle: number, message: data.QueryExecuteMessageParams): void { throw ni(); }

	/**
	 * Requests saving of the results from a result set into a specific format (CSV, JSON, Excel)
	 */
	$saveResults(handle: number, requestParams: data.SaveResultsRequestParams): Thenable<data.SaveResultRequestResult> { throw ni(); }

	/**
	 * Commits all pending edits in an edit session
	 */
	$commitEdit(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Creates a new row in the edit session
	 */
	$createRow(handle: number, ownerUri: string): Thenable<data.EditCreateRowResult> { throw ni(); }

	/**
	 * Marks the selected row for deletion in the edit session
	 */
	$deleteRow(handle: number, ownerUri: string, rowId: number): Thenable<void> { throw ni(); }

	/**
	 * Initializes a new edit data session for the requested table/view
	 */
	$initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> { throw ni(); }

	/**
	 * Reverts any pending changes for the requested cell and returns the original value
	 */
	$revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult> { throw ni(); }

	/**
	 * Reverts any pending changes for the requested row
	 */
	$revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> { throw ni(); }

	/**
	 * Updates a cell value in the requested row. Returns if there are any corrections to the value
	 */
	$updateCell(handle: number, ownerUri: string, rowId: number, columId: number, newValue: string): Thenable<data.EditUpdateCellResult> { throw ni(); }

	/**
	 * Gets a subset of rows in a result set, merging pending edit changes in order to display in the UI
	 */
	$getEditRows(handle: number, rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult> { throw ni(); }

	/**
	 * Diposes an initialized edit session and cleans up pending edits
	 */
	$disposeEdit(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Create a new database on the provided connection
	 */
	$createDatabase(handle: number, connectionUri: string, database: data.DatabaseInfo): Thenable<data.CreateDatabaseResponse> { throw ni(); }

	/**
	 * Get the default database prototype
	 */
	$getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<data.DatabaseInfo> { throw ni(); }

	/**
	 * Get the database info
	 */
	$getDatabaseInfo(handle: number, connectionUri: string): Thenable<data.DatabaseInfo> { throw ni(); }

	/**
	 * Create a new login on the provided connection
	 */
	$createLogin(handle: number, connectionUri: string, login: data.LoginInfo): Thenable<data.CreateLoginResponse> { throw ni(); }

	/**
	 * Backup a database
	 */
	$backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: data.TaskExecutionMode): Thenable<data.BackupResponse> { throw ni(); }

	/**
	 * Get the extended database prototype
	 */
	$getBackupConfigInfo(handle: number, connectionUri: string): Thenable<data.BackupConfigInfo> { throw ni(); }

	/**
	 * Restores a database
	 */
	$restore(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestoreResponse> { throw ni(); }

	/**
	 * Gets a plan for restoring a database
	 */
	$getRestorePlan(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestorePlanResponse> { throw ni(); }

	/**
	 * Cancels a plan
	 */
	$cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<boolean> { throw ni(); }

	/**
	 * Gets restore config Info
	 */
	$getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<data.RestoreConfigInfo> { throw ni(); }


	/**
	 * Open a file browser
	 */
	$openFileBrowser(handle: number, ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> { throw ni(); }


	/**
	 * Expand a folder node
	 */
	$expandFolderNode(handle: number, ownerUri: string, expandPath: string): Thenable<boolean> { throw ni(); }

	/**
	 * Validate selected file paths
	 */
	$validateFilePaths(handle: number, ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> { throw ni(); }

	/**
	 * Close file browser
	 */
	$closeFileBrowser(handle: number, ownerUri: string): Thenable<data.FileBrowserCloseResponse> { throw ni(); }

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Start a profiler session
	 */
	$startSession(handle: number, sessionId: string): Thenable<boolean> { throw ni(); }

	/**
	 * Stop a profiler session
	 */
	$stopSession(handle: number, sessionId: string): Thenable<boolean> { throw ni(); }
}


/**
 * ResourceProvider extension host class.
 */
export abstract class ExtHostResourceProviderShape {
	/**
	 * Create a firewall rule
	 */
	$createFirewallRule(handle: number, account: data.Account, firewallRuleInfo: data.FirewallRuleInfo): Thenable<data.CreateFirewallRuleResponse> { throw ni(); }

	/**
	 * Handle firewall rule
	 */
	$handleFirewallRule(handle: number, errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<data.HandleFirewallRuleResponse> { throw ni(); }

}

/**
 * Credential Management extension host class.
 */
export abstract class ExtHostCredentialManagementShape {
	$saveCredential(credentialId: string, password: string): Thenable<boolean> { throw ni(); }

	$readCredential(credentialId: string): Thenable<data.Credential> { throw ni(); }

	$deleteCredential(credentialId: string): Thenable<boolean> { throw ni(); }
}

/**
 * Serialization provider extension host class.
 */
export abstract class ExtHostSerializationProviderShape {
	$saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<data.SaveResultRequestResult> { throw ni(); }
}

export interface MainThreadAccountManagementShape extends IDisposable {
	$registerAccountProvider(providerMetadata: data.AccountProviderMetadata, handle: number): Thenable<any>;
	$unregisterAccountProvider(handle: number): Thenable<any>;

	$beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;
	$endAutoOAuthDeviceCode(): void;

	$accountUpdated(updatedAccount: data.Account): void;
}

export interface MainThreadResourceProviderShape extends IDisposable {
	$registerResourceProvider(providerMetadata: data.ResourceProviderMetadata, handle: number): Thenable<any>;
	$unregisterResourceProvider(handle: number): Thenable<any>;
}

export interface MainThreadDataProtocolShape extends IDisposable {
	$registerConnectionProvider(providerId: string, handle: number): TPromise<any>;
	$registerBackupProvider(providerId: string, handle: number): TPromise<any>;
	$registerRestoreProvider(providerId: string, handle: number): TPromise<any>;
	$registerScriptingProvider(providerId: string, handle: number): TPromise<any>;
	$registerQueryProvider(providerId: string, handle: number): TPromise<any>;
	$registerProfilerProvider(providerId: string, handle: number): TPromise<any>;
	$registerObjectExplorerProvider(providerId: string, handle: number): TPromise<any>;
	$registerMetadataProvider(providerId: string, handle: number): TPromise<any>;
	$registerTaskServicesProvider(providerId: string, handle: number): TPromise<any>;
	$registerFileBrowserProvider(providerId: string, handle: number): TPromise<any>;
	$registerCapabilitiesServiceProvider(providerId: string, handle: number): TPromise<any>;
	$registerAdminServicesProvider(providerId: string, handle: number): TPromise<any>;
	$unregisterProvider(handle: number): TPromise<any>;
	$onConnectionComplete(handle: number, connectionInfoSummary: data.ConnectionInfoSummary): void;
	$onIntelliSenseCacheComplete(handle: number, connectionUri: string): void;
	$onConnectionChangeNotification(handle: number, changedConnInfo: data.ChangedConnectionInfo): void;
	$onQueryComplete(handle: number, result: data.QueryExecuteCompleteNotificationResult): void;
	$onBatchStart(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void;
	$onBatchComplete(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void;
	$onResultSetComplete(handle: number, resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams): void;
	$onQueryMessage(handle: number, message: data.QueryExecuteMessageParams): void;
	$onObjectExplorerSessionCreated(handle: number, message: data.ObjectExplorerSession): void;
	$onObjectExplorerNodeExpanded(handle: number, message: data.ObjectExplorerExpandInfo): void;
	$onTaskCreated(handle: number, sessionResponse: data.TaskInfo): void;
	$onTaskStatusChanged(handle: number, sessionResponse: data.TaskProgressInfo): void;
	$onFileBrowserOpened(handle: number, response: data.FileBrowserOpenedParams): void;
	$onFolderNodeExpanded(handle: number, response: data.FileBrowserExpandedParams): void;
	$onFilePathsValidated(handle: number, response: data.FileBrowserValidatedParams): void;
	$onScriptingComplete(handle: number, message: data.ScriptingCompleteResult): void;
	$onSessionEventsAvailable(handle: number, response: data.ProfilerSessionEvents): void;

	/**
	 * Callback when a session has completed initialization
	 */
	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string);
}

export interface MainThreadConnectionManagementShape extends IDisposable {
	$getActiveConnections(): Thenable<data.connection.Connection[]>;
	$getCurrentConnection(): Thenable<data.connection.Connection>;
	$getCredentials(connectionId: string): Thenable<{ [name: string]: string }>;
}

export interface MainThreadCredentialManagementShape extends IDisposable {
	$registerCredentialProvider(handle: number): TPromise<any>;
	$unregisterCredentialProvider(handle: number): TPromise<any>;
}

export interface MainThreadSerializationProviderShape extends IDisposable {
	$registerSerializationProvider(handle: number): TPromise<any>;
	$unregisterSerializationProvider(handle: number): TPromise<any>;
}

function ni() { return new Error('Not implemented'); }

// --- proxy identifiers

export const SqlMainContext = {
	// SQL entries
	MainThreadAccountManagement: createMainId<MainThreadAccountManagementShape>('MainThreadAccountManagement'),
	MainThreadConnectionManagement: createMainId<MainThreadConnectionManagementShape>('MainThreadConnectionManagement'),
	MainThreadCredentialManagement: createMainId<MainThreadCredentialManagementShape>('MainThreadCredentialManagement'),
	MainThreadDataProtocol: createMainId<MainThreadDataProtocolShape>('MainThreadDataProtocol'),
	MainThreadSerializationProvider: createMainId<MainThreadSerializationProviderShape>('MainThreadSerializationProvider'),
	MainThreadResourceProvider: createMainId<MainThreadResourceProviderShape>('MainThreadResourceProvider'),
	MainThreadModalDialog: createMainId<MainThreadModalDialogShape>('MainThreadModalDialog'),
};

export const SqlExtHostContext = {
	ExtHostAccountManagement: createExtId<ExtHostAccountManagementShape>('ExtHostAccountManagement'),
	ExtHostConnectionManagement: createExtId<ExtHostConnectionManagementShape>('ExtHostConnectionManagement'),
	ExtHostCredentialManagement: createExtId<ExtHostCredentialManagementShape>('ExtHostCredentialManagement'),
	ExtHostDataProtocol: createExtId<ExtHostDataProtocolShape>('ExtHostDataProtocol'),
	ExtHostSerializationProvider: createExtId<ExtHostSerializationProviderShape>('ExtHostSerializationProvider'),
	ExtHostResourceProvider: createExtId<ExtHostResourceProviderShape>('ExtHostResourceProvider'),
	ExtHostModalDialogs: createExtId<ExtHostModalDialogsShape>('ExtHostModalDialogs')
};

export interface MainThreadModalDialogShape extends IDisposable {
	$createDialog(handle: number): void;
	$disposeDialog(handle: number): void;
	$show(handle: number): void;
	$setTitle(handle: number, value: string): void;
	$setHtml(handle: number, value: string): void;
	$sendMessage(handle: number, value: any): Thenable<boolean>;
}
export interface ExtHostModalDialogsShape {
	$onMessage(handle: number, message: any): void;
	$onClosed(handle: number): void;
}