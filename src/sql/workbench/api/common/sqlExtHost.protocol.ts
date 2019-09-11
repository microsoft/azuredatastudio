/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	createMainContextProxyIdentifier as createMainId,
	createExtHostContextProxyIdentifier as createExtId
} from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { UriComponents } from 'vs/base/common/uri';

import { IDisposable } from 'vs/base/common/lifecycle';

import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { ITreeComponentItem } from 'sql/workbench/common/views';
import { ITaskHandlerDescription } from 'sql/platform/tasks/common/tasks';
import {
	IItemConfig, IComponentShape, IModelViewDialogDetails, IModelViewTabDetails, IModelViewButtonDetails,
	IModelViewWizardDetails, IModelViewWizardPageDetails, INotebookManagerDetails, INotebookSessionDetails,
	INotebookKernelDetails, INotebookFutureDetails, FutureMessageType, INotebookFutureDone, ISingleNotebookEditOperation,
	NotebookChangeKind
} from 'sql/workbench/api/common/sqlExtHostTypes';
import { EditorViewColumn } from 'vs/workbench/api/common/shared/editor';
import { IUndoStopOptions } from 'vs/workbench/api/common/extHost.protocol';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IQueryEvent } from 'sql/platform/query/common/queryModel';

export abstract class ExtHostAccountManagementShape {
	$autoOAuthCancelled(handle: number): Thenable<void> { throw ni(); }
	$clear(handle: number, accountKey: azdata.AccountKey): Thenable<void> { throw ni(); }
	$getSecurityToken(account: azdata.Account, resource?: azdata.AzureResource): Thenable<{}> { throw ni(); }
	$initialize(handle: number, restoredAccounts: azdata.Account[]): Thenable<azdata.Account[]> { throw ni(); }
	$prompt(handle: number): Thenable<azdata.Account | azdata.PromptFailedResult> { throw ni(); }
	$refresh(handle: number, account: azdata.Account): Thenable<azdata.Account | azdata.PromptFailedResult> { throw ni(); }
	$accountsChanged(handle: number, accounts: azdata.Account[]): Thenable<void> { throw ni(); }
}

export abstract class ExtHostConnectionManagementShape {
	$onConnectionEvent(handle: number, type: azdata.connection.ConnectionEventType, ownerUri: string, profile: azdata.IConnectionProfile): void { throw ni(); }
}

export abstract class ExtHostDataProtocolShape {

	/**
	 * Establish a connection to a data source using the provided ConnectionInfo instance.
	 */
	$connect(handle: number, connectionUri: string, connection: azdata.ConnectionInfo): Thenable<boolean> { throw ni(); }

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
	$listDatabases(handle: number, connectionUri: string): Thenable<azdata.ListDatabasesResult> { throw ni(); }

	/**
	 * Get the connection string for the connection specified by connectionUri
	 * @param handle the handle to use when looking up a provider
	 * @param connectionUri URI identifying a connected resource
	 */
	$getConnectionString(handle: number, connectionUri: string, includePassword: boolean): Thenable<string> { throw ni(); }

	/**
	 * Serialize connection string
	 * @param handle the handle to use when looking up a provider
	 * @param connectionString the connection string to serialize
	 */
	$buildConnectionInfo(handle: number, connectionString: string): Thenable<azdata.ConnectionInfo> { throw ni(); }

	/**
	 * Notifies all listeners on the Extension Host side that a language change occurred
	 * for a dataprotocol language. The sub-flavor is the specific implementation used for query
	 * and other events
	 * @param params information on what URI was changed and the new language
	 */
	$languageFlavorChanged(params: azdata.DidChangeLanguageFlavorParams): void { throw ni(); }

	/**
	 * Callback when a connection request has completed
	 */
	$onConnectComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void { throw ni(); }

	/**
	 * Callback when a IntelliSense cache has been built
	 */
	$onIntelliSenseCacheComplete(handle: number, connectionUri: string): void { throw ni(); }

	$getServerCapabilities(handle: number, client: azdata.DataProtocolClientCapabilities): Thenable<azdata.DataProtocolServerCapabilities> { throw ni(); }

	$getConnectionIconId(handle: number, connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string> { throw ni(); }

	/**
	 * Metadata service methods
	 *
	 */
	$getMetadata(handle: number, connectionUri: string): Thenable<azdata.ProviderMetadata> { throw ni(); }

	$getDatabases(handle: number, connectionUri: string): Thenable<string[]> { throw ni(); }

	$getTableInfo(handle: number, connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[]> { throw ni(); }

	$getViewInfo(handle: number, connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[]> { throw ni(); }

	/**
	 * Object Explorer
	 */
	$createObjectExplorerSession(handle: number, connInfo: azdata.ConnectionInfo): Thenable<azdata.ObjectExplorerSessionResponse> { throw ni(); }

	$expandObjectExplorerNode(handle: number, nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> { throw ni(); }

	$refreshObjectExplorerNode(handle: number, nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> { throw ni(); }

	$closeObjectExplorerSession(handle: number, closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): Thenable<azdata.ObjectExplorerCloseSessionResponse> { throw ni(); }

	$findNodes(handle: number, findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> { throw ni(); }

	$createObjectExplorerNodeProviderSession(handle: number, sessionInfo: azdata.ObjectExplorerSession): Thenable<boolean> { throw ni(); }

	$handleSessionClose(handle: number, closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): void { throw ni(); }

	/**
	 * Tasks
	 */
	$getAllTasks(handle: number, listTasksParams: azdata.ListTasksParams): Thenable<azdata.ListTasksResponse> { throw ni(); }
	$cancelTask(handle: number, cancelTaskParams: azdata.CancelTaskParams): Thenable<boolean> { throw ni(); }

	/**
	 * Scripting methods
	 */
	$scriptAsOperation(handle: number, connectionUri: string, operation: azdata.ScriptOperation, metadata: azdata.ObjectMetadata, paramDetails: azdata.ScriptingParamDetails): Thenable<azdata.ScriptingResult> { throw ni(); }

	/**
	 * Cancels the currently running query for a URI
	 */
	$cancelQuery(handle: number, ownerUri: string): Thenable<azdata.QueryCancelResult> { throw ni(); }

	/**
	 * Runs a query for a text selection inside a document
	 */
	$runQuery(handle: number, ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> { throw ni(); }
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
	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> { throw ni(); }
	/**
	 * Parses a T-SQL string without actually executing it
	 */
	$parseSyntax(handle: number, ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> { throw ni(); }
	/**
	 * Gets a subset of rows in a result set in order to display in the UI
	 */
	$getQueryRows(handle: number, rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> { throw ni(); }
	/**
	 * Sets the query execution options for a query editor document
	 */
	$setQueryExecutionOptions(handle: number, ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> { throw ni(); }

	/**
	 * Connect the editor document to the given profile
	 */
	$connectWithProfile(handle: number, ownerUri: string, profile: azdata.connection.ConnectionProfile): Thenable<void> { throw ni(); }

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
	$onQueryComplete(handle: number, result: azdata.QueryExecuteCompleteNotificationResult): void { throw ni(); }
	/**
	 * Callback when a batch has started. This enables the UI to display when batch execution has started
	 */
	$onBatchStart(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void { throw ni(); }
	/**
	 * Callback when a batch is complete. This includes updated information on result sets, time to execute, and
	 * other relevant batch information
	 */
	$onBatchComplete(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void { throw ni(); }
	/**
	 * Callback when a result set has been returned from query execution and can be displayed
	 */
	$onResultSetAvailable(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void { throw ni(); }
	/**
	 * Callback when a result set has been returned from query execution and can be displayed
	 */
	$onResultSetUpdate(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void { throw ni(); }
	/**
	 * Callback when a message generated during query execution is issued
	 */
	$onQueryMessage(handle: number, message: azdata.QueryExecuteMessageParams): void { throw ni(); }

	/**
	 * Requests saving of the results from a result set into a specific format (CSV, JSON, Excel)
	 */
	$saveResults(handle: number, requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> { throw ni(); }

	/**
	 * Commits all pending edits in an edit session
	 */
	$commitEdit(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Creates a new row in the edit session
	 */
	$createRow(handle: number, ownerUri: string): Thenable<azdata.EditCreateRowResult> { throw ni(); }

	/**
	 * Marks the selected row for deletion in the edit session
	 */
	$deleteRow(handle: number, ownerUri: string, rowId: number): Thenable<void> { throw ni(); }

	/**
	 * Initializes a new edit data session for the requested table/view
	 */
	$initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> { throw ni(); }

	/**
	 * Reverts any pending changes for the requested cell and returns the original value
	 */
	$revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> { throw ni(); }

	/**
	 * Reverts any pending changes for the requested row
	 */
	$revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> { throw ni(); }

	/**
	 * Updates a cell value in the requested row. Returns if there are any corrections to the value
	 */
	$updateCell(handle: number, ownerUri: string, rowId: number, columId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> { throw ni(); }

	/**
	 * Gets a subset of rows in a result set, merging pending edit changes in order to display in the UI
	 */
	$getEditRows(handle: number, rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> { throw ni(); }

	/**
	 * Diposes an initialized edit session and cleans up pending edits
	 */
	$disposeEdit(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Create a new database on the provided connection
	 */
	$createDatabase(handle: number, connectionUri: string, database: azdata.DatabaseInfo): Thenable<azdata.CreateDatabaseResponse> { throw ni(); }

	/**
	 * Get the default database prototype
	 */
	$getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<azdata.DatabaseInfo> { throw ni(); }

	/**
	 * Get the database info
	 */
	$getDatabaseInfo(handle: number, connectionUri: string): Thenable<azdata.DatabaseInfo> { throw ni(); }

	/**
	 * Create a new login on the provided connection
	 */
	$createLogin(handle: number, connectionUri: string, login: azdata.LoginInfo): Thenable<azdata.CreateLoginResponse> { throw ni(); }

	/**
	 * Backup a database
	 */
	$backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.BackupResponse> { throw ni(); }

	/**
	 * Get the extended database prototype
	 */
	$getBackupConfigInfo(handle: number, connectionUri: string): Thenable<azdata.BackupConfigInfo> { throw ni(); }

	/**
	 * Restores a database
	 */
	$restore(handle: number, connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestoreResponse> { throw ni(); }

	/**
	 * Gets a plan for restoring a database
	 */
	$getRestorePlan(handle: number, connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestorePlanResponse> { throw ni(); }

	/**
	 * Cancels a plan
	 */
	$cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<boolean> { throw ni(); }

	/**
	 * Gets restore config Info
	 */
	$getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<azdata.RestoreConfigInfo> { throw ni(); }


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
	$closeFileBrowser(handle: number, ownerUri: string): Thenable<azdata.FileBrowserCloseResponse> { throw ni(); }

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Create a profiler session
	 */
	$createSession(handle: number, sessionId: string, createStatement: string, template: azdata.ProfilerSessionTemplate): Thenable<boolean> { throw ni(); }

	/**
	 * Start a profiler session
	 */
	$startSession(handle: number, sessionId: string, sessionName: string): Thenable<boolean> { throw ni(); }

	/**
	 * Stop a profiler session
	 */
	$stopSession(handle: number, sessionId: string): Thenable<boolean> { throw ni(); }

	/**
	 * Pause a profiler session
	 */
	$pauseSession(handle: number, sessionId: string): Thenable<boolean> { throw ni(); }

	/**
	 * Get list of running XEvent sessions on the profiler session's target server
	 */
	$getXEventSessions(handle: number, sessionId: string): Thenable<string[]> { throw ni(); }

	/**
	 * Disconnect a profiler session
	 */
	$disconnectSession(handle: number, sessionId: string): Thenable<boolean> { throw ni(); }

	/**
	 * Get Agent Job list
	 */
	$getJobs(handle: number, ownerUri: string): Thenable<azdata.AgentJobsResult> { throw ni(); }

	/**
	 * Get a Agent Job's history
	 */
	$getJobHistory(handle: number, ownerUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> { throw ni(); }

	/**
	 * Run an action on a Job
	 */
	$jobAction(handle: number, ownerUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Deletes a job
	 */
	$deleteJob(handle: number, ownerUri: string, job: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Deletes a job step
	 */
	$deleteJobStep(handle: number, ownerUri: string, step: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Notebook list
	 */
	$getNotebooks(handle: number, ownerUri: string): Thenable<azdata.AgentNotebooksResult> { throw ni(); }

	/**
	 * Get a Agent Notebook's history
	 */
	$getNotebookHistory(handle: number, ownerUri: string, jobID: string, jobName: string, targetDatabase: string): Thenable<azdata.AgentNotebookHistoryResult> { throw ni(); }

	/**
	 * Get a Agent materialized notebook
	 */
	$getMaterializedNotebook(handle: number, ownerUri: string, targetDatabase: string, notebookMaterializedId: number): Thenable<azdata.AgentNotebookMaterializedResult> { throw ni(); }

	/**
	 * Get a Agent Template notebook
	 */
	$getTemplateNotebook(handle: number, ownerUri: string, targetDatabase: string, jobId: string): Thenable<azdata.AgentNotebookTemplateResult> { throw ni(); }

	/**
	 * Deletes a notebook
	 */
	$deleteNotebook(handle: number, ownerUri: string, notebook: azdata.AgentNotebookInfo): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Update materialzied Notebook Name
	 */
	$updateNotebookMaterializedName(handle: number, ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, name: string): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Update materialzied Notebook Name
	 */
	$deleteMaterializedNotebook(handle: number, ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Update materialzied Notebook Pin
	 */
	$updateNotebookMaterializedPin(handle: number, ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, pin: boolean): Thenable<azdata.ResultStatus> { throw ni(); }


	/**
	 * Get Agent Alerts list
	 */
	$getAlerts(handle: number, connectionUri: string): Thenable<azdata.AgentAlertsResult> { throw ni(); }

	/**
	 * Deletes  an alert
	 */
	$deleteAlert(handle: number, connectionUri: string, alert: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Oeprators list
	 */
	$getOperators(handle: number, connectionUri: string): Thenable<azdata.AgentOperatorsResult> { throw ni(); }

	/**
	 * Deletes  an operator
	 */
	$deleteOperator(handle: number, connectionUri: string, operator: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Proxies list
	 */
	$getProxies(handle: number, connectionUri: string): Thenable<azdata.AgentProxiesResult> { throw ni(); }

	/**
	 * Deletes  a proxy
	 */
	$deleteProxy(handle: number, connectionUri: string, proxy: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Credentials list
	 */
	$getCredentials(handle: number, connectionUri: string): Thenable<azdata.GetCredentialsResult> { throw ni(); }

	/**
	 * Serialization start request
	 */
	$startSerialization(handle: number, requestParams: azdata.SerializeDataStartRequestParams): Thenable<azdata.SerializeDataResult> { throw ni(); }

	/**
	 * Serialization continuation request
	 */
	$continueSerialization(handle: number, requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> { throw ni(); }
}

/**
 * ResourceProvider extension host class.
 */
export abstract class ExtHostResourceProviderShape {
	/**
	 * Create a firewall rule
	 */
	$createFirewallRule(handle: number, account: azdata.Account, firewallRuleInfo: azdata.FirewallRuleInfo): Thenable<azdata.CreateFirewallRuleResponse> { throw ni(); }

	/**
	 * Handle firewall rule
	 */
	$handleFirewallRule(handle: number, errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<azdata.HandleFirewallRuleResponse> { throw ni(); }

}

/**
 * Credential Management extension host class.
 */
export abstract class ExtHostCredentialManagementShape {
	$saveCredential(credentialId: string, password: string): Thenable<boolean> { throw ni(); }

	$readCredential(credentialId: string): Thenable<azdata.Credential> { throw ni(); }

	$deleteCredential(credentialId: string): Thenable<boolean> { throw ni(); }
}

export interface MainThreadAccountManagementShape extends IDisposable {
	$registerAccountProvider(providerMetadata: azdata.AccountProviderMetadata, handle: number): Thenable<any>;
	$unregisterAccountProvider(handle: number): Thenable<any>;

	$beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;
	$endAutoOAuthDeviceCode(): void;

	$accountUpdated(updatedAccount: azdata.Account): void;

	$getAccountsForProvider(providerId: string): Thenable<azdata.Account[]>;
}

export interface MainThreadResourceProviderShape extends IDisposable {
	$registerResourceProvider(providerMetadata: azdata.ResourceProviderMetadata, handle: number): Thenable<any>;
	$unregisterResourceProvider(handle: number): Thenable<any>;
}

export interface MainThreadDataProtocolShape extends IDisposable {
	$registerConnectionProvider(providerId: string, handle: number): Promise<any>;
	$registerBackupProvider(providerId: string, handle: number): Promise<any>;
	$registerRestoreProvider(providerId: string, handle: number): Promise<any>;
	$registerScriptingProvider(providerId: string, handle: number): Promise<any>;
	$registerQueryProvider(providerId: string, handle: number): Promise<any>;
	$registerProfilerProvider(providerId: string, handle: number): Promise<any>;
	$registerObjectExplorerProvider(providerId: string, handle: number): Promise<any>;
	$registerObjectExplorerNodeProvider(providerId: string, supportedProviderId: string, group: string, handle: number): Promise<any>;
	$registerIconProvider(providerId: string, handle: number): Promise<any>;
	$registerMetadataProvider(providerId: string, handle: number): Promise<any>;
	$registerTaskServicesProvider(providerId: string, handle: number): Promise<any>;
	$registerFileBrowserProvider(providerId: string, handle: number): Promise<any>;
	$registerCapabilitiesServiceProvider(providerId: string, handle: number): Promise<any>;
	$registerAdminServicesProvider(providerId: string, handle: number): Promise<any>;
	$registerAgentServicesProvider(providerId: string, handle: number): Promise<any>;
	$registerSerializationProvider(providerId: string, handle: number): Promise<any>;
	$unregisterProvider(handle: number): Promise<any>;
	$onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void;
	$onIntelliSenseCacheComplete(handle: number, connectionUri: string): void;
	$onConnectionChangeNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void;
	$onQueryComplete(handle: number, result: azdata.QueryExecuteCompleteNotificationResult): void;
	$onBatchStart(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void;
	$onBatchComplete(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void;
	$onResultSetAvailable(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void;
	$onResultSetUpdated(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void;
	$onQueryMessage(handle: number, message: azdata.QueryExecuteMessageParams): void;
	$onObjectExplorerSessionCreated(handle: number, message: azdata.ObjectExplorerSession): void;
	$onObjectExplorerSessionDisconnected(handle: number, message: azdata.ObjectExplorerSession): void;
	$onObjectExplorerNodeExpanded(providerId: string, message: azdata.ObjectExplorerExpandInfo): void;
	$onTaskCreated(handle: number, sessionResponse: azdata.TaskInfo): void;
	$onTaskStatusChanged(handle: number, sessionResponse: azdata.TaskProgressInfo): void;
	$onFileBrowserOpened(handle: number, response: azdata.FileBrowserOpenedParams): void;
	$onFolderNodeExpanded(handle: number, response: azdata.FileBrowserExpandedParams): void;
	$onFilePathsValidated(handle: number, response: azdata.FileBrowserValidatedParams): void;
	$onScriptingComplete(handle: number, message: azdata.ScriptingCompleteResult): void;
	$onSessionEventsAvailable(handle: number, response: azdata.ProfilerSessionEvents): void;
	$onSessionStopped(handle: number, response: azdata.ProfilerSessionStoppedParams): void;
	$onProfilerSessionCreated(handle: number, response: azdata.ProfilerSessionCreatedParams): void;
	$onJobDataUpdated(handle: Number): void;

	/**
	 * Callback when a session has completed initialization
	 */
	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string);
}

export interface MainThreadConnectionManagementShape extends IDisposable {
	$registerConnectionEventListener(handle: number, providerId: string): void;
	$getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]>;
	$getConnection(uri: string): Thenable<azdata.connection.ConnectionProfile>;
	$getActiveConnections(): Thenable<azdata.connection.Connection[]>;
	$getCurrentConnection(): Thenable<azdata.connection.Connection>;
	$getCurrentConnectionProfile(): Thenable<azdata.connection.ConnectionProfile>;
	$getCredentials(connectionId: string): Thenable<{ [name: string]: string }>;
	$getServerInfo(connectedId: string): Thenable<azdata.ServerInfo>;
	$openConnectionDialog(providers: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection>;
	$listDatabases(connectionId: string): Thenable<string[]>;
	$getConnectionString(connectionId: string, includePassword: boolean): Thenable<string>;
	$getUriForConnection(connectionId: string): Thenable<string>;
	$connect(connectionProfile: azdata.IConnectionProfile, saveConnection: boolean, showDashboard: boolean): Thenable<azdata.ConnectionResult>;
}

export interface MainThreadCredentialManagementShape extends IDisposable {
	$registerCredentialProvider(handle: number): Promise<any>;
	$unregisterCredentialProvider(handle: number): Promise<any>;
}

function ni() { return new Error('Not implemented'); }

// --- proxy identifiers

export const SqlMainContext = {
	// SQL entries
	MainThreadAccountManagement: createMainId<MainThreadAccountManagementShape>('MainThreadAccountManagement'),
	MainThreadConnectionManagement: createMainId<MainThreadConnectionManagementShape>('MainThreadConnectionManagement'),
	MainThreadCredentialManagement: createMainId<MainThreadCredentialManagementShape>('MainThreadCredentialManagement'),
	MainThreadDataProtocol: createMainId<MainThreadDataProtocolShape>('MainThreadDataProtocol'),
	MainThreadObjectExplorer: createMainId<MainThreadObjectExplorerShape>('MainThreadObjectExplorer'),
	MainThreadBackgroundTaskManagement: createMainId<MainThreadBackgroundTaskManagementShape>('MainThreadBackgroundTaskManagement'),
	MainThreadResourceProvider: createMainId<MainThreadResourceProviderShape>('MainThreadResourceProvider'),
	MainThreadModalDialog: createMainId<MainThreadModalDialogShape>('MainThreadModalDialog'),
	MainThreadTasks: createMainId<MainThreadTasksShape>('MainThreadTasks'),
	MainThreadDashboardWebview: createMainId<MainThreadDashboardWebviewShape>('MainThreadDashboardWebview'),
	MainThreadModelView: createMainId<MainThreadModelViewShape>('MainThreadModelView'),
	MainThreadDashboard: createMainId<MainThreadDashboardShape>('MainThreadDashboard'),
	MainThreadModelViewDialog: createMainId<MainThreadModelViewDialogShape>('MainThreadModelViewDialog'),
	MainThreadQueryEditor: createMainId<MainThreadQueryEditorShape>('MainThreadQueryEditor'),
	MainThreadNotebook: createMainId<MainThreadNotebookShape>('MainThreadNotebook'),
	MainThreadNotebookDocumentsAndEditors: createMainId<MainThreadNotebookDocumentsAndEditorsShape>('MainThreadNotebookDocumentsAndEditors'),
	MainThreadExtensionManagement: createMainId<MainThreadExtensionManagementShape>('MainThreadExtensionManagement')
};

export const SqlExtHostContext = {
	ExtHostAccountManagement: createExtId<ExtHostAccountManagementShape>('ExtHostAccountManagement'),
	ExtHostConnectionManagement: createExtId<ExtHostConnectionManagementShape>('ExtHostConnectionManagement'),
	ExtHostCredentialManagement: createExtId<ExtHostCredentialManagementShape>('ExtHostCredentialManagement'),
	ExtHostDataProtocol: createExtId<ExtHostDataProtocolShape>('ExtHostDataProtocol'),
	ExtHostObjectExplorer: createExtId<ExtHostObjectExplorerShape>('ExtHostObjectExplorer'),
	ExtHostResourceProvider: createExtId<ExtHostResourceProviderShape>('ExtHostResourceProvider'),
	ExtHostModalDialogs: createExtId<ExtHostModalDialogsShape>('ExtHostModalDialogs'),
	ExtHostTasks: createExtId<ExtHostTasksShape>('ExtHostTasks'),
	ExtHostBackgroundTaskManagement: createExtId<ExtHostBackgroundTaskManagementShape>('ExtHostBackgroundTaskManagement'),
	ExtHostDashboardWebviews: createExtId<ExtHostDashboardWebviewsShape>('ExtHostDashboardWebviews'),
	ExtHostModelView: createExtId<ExtHostModelViewShape>('ExtHostModelView'),
	ExtHostModelViewTreeViews: createExtId<ExtHostModelViewTreeViewsShape>('ExtHostModelViewTreeViews'),
	ExtHostDashboard: createExtId<ExtHostDashboardShape>('ExtHostDashboard'),
	ExtHostModelViewDialog: createExtId<ExtHostModelViewDialogShape>('ExtHostModelViewDialog'),
	ExtHostQueryEditor: createExtId<ExtHostQueryEditorShape>('ExtHostQueryEditor'),
	ExtHostNotebook: createExtId<ExtHostNotebookShape>('ExtHostNotebook'),
	ExtHostNotebookDocumentsAndEditors: createExtId<ExtHostNotebookDocumentsAndEditorsShape>('ExtHostNotebookDocumentsAndEditors'),
	ExtHostExtensionManagement: createExtId<ExtHostExtensionManagementShape>('ExtHostExtensionManagement')
};

export interface MainThreadDashboardShape extends IDisposable {

}

export interface ExtHostDashboardShape {
	$onDidOpenDashboard(dashboard: azdata.DashboardDocument): void;
	$onDidChangeToDashboard(dashboard: azdata.DashboardDocument): void;
}

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

export interface ExtHostTasksShape {
	$executeContributedTask<T>(id: string, ...args: any[]): Thenable<T>;
	$getContributedTaskHandlerDescriptions(): Promise<{ [id: string]: string | ITaskHandlerDescription }>;
}

export interface MainThreadTasksShape extends IDisposable {
	$registerTask(id: string): Promise<any>;
	$unregisterTask(id: string): Promise<any>;
}

export interface ExtHostDashboardWebviewsShape {
	$registerProvider(widgetId: string, handler: (webview: azdata.DashboardWebview) => void): void;
	$onMessage(handle: number, message: any): void;
	$onClosed(handle: number): void;
	$registerWidget(handle: number, id: string, connection: azdata.connection.Connection, serverInfo: azdata.ServerInfo): void;
}

export interface MainThreadDashboardWebviewShape extends IDisposable {
	$sendMessage(handle: number, message: string);
	$registerProvider(widgetId: string);
	$setHtml(handle: number, value: string);
}

export interface ExtHostModelViewShape {
	$registerProvider(widgetId: string, handler: (webview: azdata.ModelView) => void, extension: IExtensionDescription): void;
	$onClosed(handle: number): void;
	$registerWidget(handle: number, id: string, connection: azdata.connection.Connection, serverInfo: azdata.ServerInfo): void;
	$handleEvent(handle: number, id: string, eventArgs: any);
	$runCustomValidations(handle: number, id: string): Thenable<boolean>;
}

export interface ExtHostModelViewTreeViewsShape {
	$getChildren(treeViewId: string, treeItemHandle?: string): Promise<ITreeComponentItem[]>;
	$createTreeView(handle: number, componentId: string, options: { treeDataProvider: vscode.TreeDataProvider<any> }, extension: IExtensionDescription): azdata.TreeComponentView<any>;
	$onNodeCheckedChanged(treeViewId: string, treeItemHandle?: string, checked?: boolean): void;
	$onNodeSelected(treeViewId: string, nodes: string[]): void;

	$setExpanded(treeViewId: string, treeItemHandle: string, expanded: boolean): void;
	$setSelection(treeViewId: string, treeItemHandles: string[]): void;
	$setVisible(treeViewId: string, visible: boolean): void;
}

export interface ExtHostBackgroundTaskManagementShape {
	$onTaskRegistered(operationId: string): void;
	$onTaskCanceled(operationId: string): void;
	$registerTask(operationInfo: azdata.BackgroundOperationInfo): void;
	$removeTask(operationId: string): void;
}

export interface MainThreadBackgroundTaskManagementShape extends IDisposable {
	$registerTask(taskInfo: azdata.TaskInfo): void;
	$updateTask(taskProgressInfo: azdata.TaskProgressInfo): void;
}

export interface MainThreadModelViewShape extends IDisposable {
	$registerProvider(id: string): void;
	$initializeModel(handle: number, rootComponent: IComponentShape): Thenable<void>;
	$clearContainer(handle: number, componentId: string): Thenable<void>;
	$addToContainer(handle: number, containerId: string, item: IItemConfig, index?: number): Thenable<void>;
	$removeFromContainer(handle: number, containerId: string, item: IItemConfig): Thenable<void>;
	$setLayout(handle: number, componentId: string, layout: any): Thenable<void>;
	$setProperties(handle: number, componentId: string, properties: { [key: string]: any }): Thenable<void>;
	$registerEvent(handle: number, componentId: string): Thenable<void>;
	$validate(handle: number, componentId: string): Thenable<boolean>;
	$setDataProvider(handle: number, componentId: string): Thenable<void>;
	$refreshDataProvider(handle: number, componentId: string, item?: any): Thenable<void>;
}

export interface ExtHostObjectExplorerShape {
}

export interface MainThreadObjectExplorerShape extends IDisposable {
	$getNode(connectionId: string, nodePath?: string): Thenable<azdata.NodeInfo>;
	$getActiveConnectionNodes(): Thenable<{ nodeInfo: azdata.NodeInfo, connectionId: string }[]>;
	$setExpandedState(connectionId: string, nodePath: string, expandedState: vscode.TreeItemCollapsibleState): Thenable<void>;
	$setSelected(connectionId: string, nodePath: string, selected: boolean, clearOtherSelections?: boolean): Thenable<void>;
	$getChildren(connectionId: string, nodePath: string): Thenable<azdata.NodeInfo[]>;
	$isExpanded(connectionId: string, nodePath: string): Thenable<boolean>;
	$findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<azdata.NodeInfo[]>;
	$refresh(connectionId: string, nodePath: string): Thenable<azdata.NodeInfo>;
	$getNodeActions(connectionId: string, nodePath: string): Thenable<string[]>;
	$getSessionConnectionProfile(sessionId: string): Thenable<azdata.IConnectionProfile>;
}

export interface ExtHostModelViewDialogShape {
	$onButtonClick(handle: number): void;
	$onPanelValidityChanged(handle: number, valid: boolean): void;
	$onWizardPageChanged(handle: number, info: azdata.window.WizardPageChangeInfo): void;
	$updateWizardPageInfo(handle: number, pageHandles: number[], currentPageIndex: number): void;
	$validateNavigation(handle: number, info: azdata.window.WizardPageChangeInfo): Thenable<boolean>;
	$validateDialogClose(handle: number): Thenable<boolean>;
	$handleSave(handle: number): Thenable<boolean>;
}

export interface MainThreadModelViewDialogShape extends IDisposable {
	$openEditor(handle: number, modelViewId: string, title: string, options?: azdata.ModelViewEditorOptions, position?: vscode.ViewColumn): Thenable<void>;
	$openDialog(handle: number, dialogName?: string): Thenable<void>;
	$closeDialog(handle: number): Thenable<void>;
	$setDialogDetails(handle: number, details: IModelViewDialogDetails): Thenable<void>;
	$setTabDetails(handle: number, details: IModelViewTabDetails): Thenable<void>;
	$setButtonDetails(handle: number, details: IModelViewButtonDetails): Thenable<void>;
	$openWizard(handle: number): Thenable<void>;
	$closeWizard(handle: number): Thenable<void>;
	$setWizardPageDetails(handle: number, details: IModelViewWizardPageDetails): Thenable<void>;
	$setWizardDetails(handle: number, details: IModelViewWizardDetails): Thenable<void>;
	$addWizardPage(wizardHandle: number, pageHandle: number, pageIndex: number): Thenable<void>;
	$removeWizardPage(wizardHandle: number, pageIndex: number): Thenable<void>;
	$setWizardPage(wizardHandle: number, pageIndex: number): Thenable<void>;
	$setDirty(handle: number, isDirty: boolean): void;
}
export interface ExtHostQueryEditorShape {
	$onQueryEvent(handle: number, fileUri: string, event: IQueryEvent): void;
}

export interface MainThreadQueryEditorShape extends IDisposable {
	$connect(fileUri: string, connectionId: string): Thenable<void>;
	$connectWithProfile(fileUri: string, connectionProfile: azdata.connection.ConnectionProfile): Thenable<void>;
	$runQuery(fileUri: string, runCurrentQuery?: boolean): void;
	$createQueryTab(fileUri: string, title: string, content: string): void;
	$setQueryExecutionOptions(fileUri: string, options: azdata.QueryExecutionOptions): Thenable<void>;
	$registerQueryInfoListener(handle: number, providerId: string): void;
}

export interface ExtHostNotebookShape {

	/**
	 * Looks up a notebook manager for a given notebook URI
	 * @returns handle of the manager to be used when sending
	 */
	$getNotebookManager(providerHandle: number, notebookUri: UriComponents): Thenable<INotebookManagerDetails>;
	$handleNotebookClosed(notebookUri: UriComponents): void;

	// Server Manager APIs
	$doStartServer(managerHandle: number): Thenable<void>;
	$doStopServer(managerHandle: number): Thenable<void>;

	// Content Manager APIs
	$getNotebookContents(managerHandle: number, notebookUri: UriComponents): Thenable<azdata.nb.INotebookContents>;
	$save(managerHandle: number, notebookUri: UriComponents, notebook: azdata.nb.INotebookContents): Thenable<azdata.nb.INotebookContents>;

	// Session Manager APIs
	$refreshSpecs(managerHandle: number): Thenable<azdata.nb.IAllKernels>;
	$startNewSession(managerHandle: number, options: azdata.nb.ISessionOptions): Thenable<INotebookSessionDetails>;
	$shutdownSession(managerHandle: number, sessionId: string): Thenable<void>;

	// Session APIs
	$changeKernel(sessionId: number, kernelInfo: azdata.nb.IKernelSpec): Thenable<INotebookKernelDetails>;
	$configureKernel(sessionId: number, kernelInfo: azdata.nb.IKernelSpec): Thenable<void>;
	$configureConnection(sessionId: number, connection: azdata.IConnectionProfile): Thenable<void>;

	// Kernel APIs
	$getKernelReadyStatus(kernelId: number): Thenable<azdata.nb.IInfoReply>;
	$getKernelSpec(kernelId: number): Thenable<azdata.nb.IKernelSpec>;
	$requestComplete(kernelId: number, content: azdata.nb.ICompleteRequest): Thenable<azdata.nb.ICompleteReplyMsg>;
	$requestExecute(kernelId: number, content: azdata.nb.IExecuteRequest, disposeOnDone?: boolean): Thenable<INotebookFutureDetails>;
	$interruptKernel(kernelId: number): Thenable<void>;

	// Future APIs
	$sendInputReply(futureId: number, content: azdata.nb.IInputReply): void;
	$disposeFuture(futureId: number): void;
}

export interface MainThreadNotebookShape extends IDisposable {
	$registerNotebookProvider(providerId: string, handle: number): void;
	$unregisterNotebookProvider(handle: number): void;
	$onFutureMessage(futureId: number, type: FutureMessageType, payload: azdata.nb.IMessage): void;
	$onFutureDone(futureId: number, done: INotebookFutureDone): void;
}

export interface INotebookDocumentsAndEditorsDelta {
	removedDocuments?: UriComponents[];
	addedDocuments?: INotebookModelAddedData[];
	removedEditors?: string[];
	addedEditors?: INotebookEditorAddData[];
	newActiveEditor?: string;
}

export interface INotebookModelAddedData {
	uri: UriComponents;
	providerId: string;
	providers: string[];
	isDirty: boolean;
	cells: azdata.nb.NotebookCell[];
}

export interface INotebookModelChangedData {
	uri: UriComponents;
	providerId: string;
	providers: string[];
	isDirty: boolean;
	cells: azdata.nb.NotebookCell[];
	kernelSpec: azdata.nb.IKernelSpec;
	changeKind: NotebookChangeKind;
}

export interface INotebookEditorAddData {
	id: string;
	documentUri: UriComponents;
	editorPosition: EditorViewColumn | undefined;
}

export interface INotebookShowOptions {
	position?: EditorViewColumn;
	preserveFocus?: boolean;
	preview?: boolean;
	providerId?: string;
	connectionProfile?: azdata.IConnectionProfile;
	defaultKernel?: azdata.nb.IKernelSpec;
	initialContent?: string;
	initialDirtyState?: boolean;
}

export interface ExtHostNotebookDocumentsAndEditorsShape {
	$acceptDocumentsAndEditorsDelta(delta: INotebookDocumentsAndEditorsDelta): void;
	$acceptModelChanged(strURL: UriComponents, e: INotebookModelChangedData);
	$getNavigation(handle: number, uri: vscode.Uri): Thenable<azdata.nb.NavigationResult>;
}

export interface MainThreadNotebookDocumentsAndEditorsShape extends IDisposable {
	$trySaveDocument(uri: UriComponents): Thenable<boolean>;
	$tryShowNotebookDocument(resource: UriComponents, options: INotebookShowOptions): Promise<string>;
	$tryApplyEdits(id: string, modelVersionId: number, edits: ISingleNotebookEditOperation[], opts: IUndoStopOptions): Promise<boolean>;
	$runCell(id: string, cellUri: UriComponents): Promise<boolean>;
	$runAllCells(id: string, startCellUri?: UriComponents, endCellUri?: UriComponents): Promise<boolean>;
	$clearOutput(id: string, cellUri: UriComponents): Promise<boolean>;
	$clearAllOutputs(id: string): Promise<boolean>;
	$changeKernel(id: string, kernel: azdata.nb.IKernelInfo): Promise<boolean>;
	$registerNavigationProvider(providerId: string, handle: number);
}

export interface ExtHostExtensionManagementShape {
	$install(vsixPath: string): Thenable<string>;
	$showObsoleteExtensionApiUsageNotification(message: string): void;
}

export interface MainThreadExtensionManagementShape extends IDisposable {
	$install(vsixPath: string): Thenable<string>;
	$showObsoleteExtensionApiUsageNotification(message: string): void;
}
