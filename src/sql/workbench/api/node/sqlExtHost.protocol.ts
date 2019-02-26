/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
	createMainContextProxyIdentifier as createMainId,
	createExtHostContextProxyIdentifier as createExtId,
	ProxyIdentifier, IRPCProtocol
} from 'vs/workbench/services/extensions/node/proxyIdentifier';
import { UriComponents } from 'vs/base/common/uri';

import { TPromise } from 'vs/base/common/winjs.base';
import { IDisposable } from 'vs/base/common/lifecycle';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

import { ITreeComponentItem } from 'sql/workbench/common/views';
import { ITaskHandlerDescription } from 'sql/platform/tasks/common/tasks';
import {
	IItemConfig, ModelComponentTypes, IComponentShape, IModelViewDialogDetails, IModelViewTabDetails, IModelViewButtonDetails,
	IModelViewWizardDetails, IModelViewWizardPageDetails, INotebookManagerDetails, INotebookSessionDetails, INotebookKernelDetails, INotebookFutureDetails, FutureMessageType, INotebookFutureDone, ISingleNotebookEditOperation
} from 'sql/workbench/api/common/sqlExtHostTypes';
import { EditorViewColumn } from 'vs/workbench/api/shared/editor';
import { IUndoStopOptions } from 'vs/workbench/api/node/extHost.protocol';
import { IExtensionDescription } from 'vs/workbench/services/extensions/common/extensions';

export abstract class ExtHostAccountManagementShape {
	$autoOAuthCancelled(handle: number): Thenable<void> { throw ni(); }
	$clear(handle: number, accountKey: sqlops.AccountKey): Thenable<void> { throw ni(); }
	$getSecurityToken(account: sqlops.Account, resource?: sqlops.AzureResource): Thenable<{}> { throw ni(); }
	$initialize(handle: number, restoredAccounts: sqlops.Account[]): Thenable<sqlops.Account[]> { throw ni(); }
	$prompt(handle: number): Thenable<sqlops.Account> { throw ni(); }
	$refresh(handle: number, account: sqlops.Account): Thenable<sqlops.Account> { throw ni(); }
	$accountsChanged(handle: number, accounts: sqlops.Account[]): Thenable<void> { throw ni(); }
}

export abstract class ExtHostConnectionManagementShape {
	$onConnectionOpened(handleId: string, connection: sqlops.connection.Connection): void { throw ni; }
}

export abstract class ExtHostDataProtocolShape {

	/**
	 * Establish a connection to a data source using the provided ConnectionInfo instance.
	 */
	$connect(handle: number, connectionUri: string, connection: sqlops.ConnectionInfo): Thenable<boolean> { throw ni(); }

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
	$listDatabases(handle: number, connectionUri: string): Thenable<sqlops.ListDatabasesResult> { throw ni(); }

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
	$buildConnectionInfo(handle: number, connectionString: string): Thenable<sqlops.ConnectionInfo> { throw ni(); }

	/**
	 * Notifies all listeners on the Extension Host side that a language change occurred
	 * for a dataprotocol language. The sub-flavor is the specific implementation used for query
	 * and other events
	 * @param params information on what URI was changed and the new language
	 */
	$languageFlavorChanged(params: sqlops.DidChangeLanguageFlavorParams): void { throw ni(); }

	/**
	 * Callback when a connection request has completed
	 */
	$onConnectComplete(handle: number, connectionInfoSummary: sqlops.ConnectionInfoSummary): void { throw ni(); }

	/**
	 * Callback when a IntelliSense cache has been built
	 */
	$onIntelliSenseCacheComplete(handle: number, connectionUri: string): void { throw ni(); }

	$getServerCapabilities(handle: number, client: sqlops.DataProtocolClientCapabilities): Thenable<sqlops.DataProtocolServerCapabilities> { throw ni(); }

	/**
	 * Metadata service methods
	 *
	 */
	$getMetadata(handle: number, connectionUri: string): Thenable<sqlops.ProviderMetadata> { throw ni(); }

	$getDatabases(handle: number, connectionUri: string): Thenable<string[]> { throw ni(); }

	$getTableInfo(handle: number, connectionUri: string, metadata: sqlops.ObjectMetadata): Thenable<sqlops.ColumnMetadata[]> { throw ni(); }

	$getViewInfo(handle: number, connectionUri: string, metadata: sqlops.ObjectMetadata): Thenable<sqlops.ColumnMetadata[]> { throw ni(); }

	/**
	 * Object Explorer
	 */
	$createObjectExplorerSession(handle: number, connInfo: sqlops.ConnectionInfo): Thenable<sqlops.ObjectExplorerSessionResponse> { throw ni(); }

	$expandObjectExplorerNode(handle: number, nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> { throw ni(); }

	$refreshObjectExplorerNode(handle: number, nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> { throw ni(); }

	$closeObjectExplorerSession(handle: number, closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> { throw ni(); }

	$findNodes(handle: number, findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> { throw ni(); }

	$createObjectExplorerNodeProviderSession(handle: number, sessionInfo: sqlops.ObjectExplorerSession): Thenable<boolean> { throw ni(); }

	$handleSessionClose(handle: number, closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): void { throw ni(); }

	/**
	 * Tasks
	 */
	$getAllTasks(handle: number, listTasksParams: sqlops.ListTasksParams): Thenable<sqlops.ListTasksResponse> { throw ni(); }
	$cancelTask(handle: number, cancelTaskParams: sqlops.CancelTaskParams): Thenable<boolean> { throw ni(); }

	/**
	 * Scripting methods
	 */
	$scriptAsOperation(handle: number, connectionUri: string, operation: sqlops.ScriptOperation, metadata: sqlops.ObjectMetadata, paramDetails: sqlops.ScriptingParamDetails): Thenable<sqlops.ScriptingResult> { throw ni(); }

	/**
	 * Cancels the currently running query for a URI
	 */
	$cancelQuery(handle: number, ownerUri: string): Thenable<sqlops.QueryCancelResult> { throw ni(); }

	/**
	 * Runs a query for a text selection inside a document
	 */
	$runQuery(handle: number, ownerUri: string, selection: sqlops.ISelectionData, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void> { throw ni(); }
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
	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<sqlops.SimpleExecuteResult> { throw ni(); }
	/**
	 * Parses a T-SQL string without actually executing it
	 */
	$parseSyntax(handle: number, ownerUri: string, query: string): Thenable<sqlops.SyntaxParseResult> { throw ni(); }
	/**
	 * Gets a subset of rows in a result set in order to display in the UI
	 */
	$getQueryRows(handle: number, rowData: sqlops.QueryExecuteSubsetParams): Thenable<sqlops.QueryExecuteSubsetResult> { throw ni(); }

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
	$onQueryComplete(handle: number, result: sqlops.QueryExecuteCompleteNotificationResult): void { throw ni(); }
	/**
	 * Callback when a batch has started. This enables the UI to display when batch execution has started
	 */
	$onBatchStart(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void { throw ni(); }
	/**
	 * Callback when a batch is complete. This includes updated information on result sets, time to execute, and
	 * other relevant batch information
	 */
	$onBatchComplete(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void { throw ni(); }
	/**
	 * Callback when a result set has been returned from query execution and can be displayed
	 */
	$onResultSetAvailable(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void { throw ni(); }
	/**
	 * Callback when a result set has been returned from query execution and can be displayed
	 */
	$onResultSetUpdate(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void { throw ni(); }
	/**
	 * Callback when a message generated during query execution is issued
	 */
	$onQueryMessage(handle: number, message: sqlops.QueryExecuteMessageParams): void { throw ni(); }

	/**
	 * Requests saving of the results from a result set into a specific format (CSV, JSON, Excel)
	 */
	$saveResults(handle: number, requestParams: sqlops.SaveResultsRequestParams): Thenable<sqlops.SaveResultRequestResult> { throw ni(); }

	/**
	 * Commits all pending edits in an edit session
	 */
	$commitEdit(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Creates a new row in the edit session
	 */
	$createRow(handle: number, ownerUri: string): Thenable<sqlops.EditCreateRowResult> { throw ni(); }

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
	$revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<sqlops.EditRevertCellResult> { throw ni(); }

	/**
	 * Reverts any pending changes for the requested row
	 */
	$revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> { throw ni(); }

	/**
	 * Updates a cell value in the requested row. Returns if there are any corrections to the value
	 */
	$updateCell(handle: number, ownerUri: string, rowId: number, columId: number, newValue: string): Thenable<sqlops.EditUpdateCellResult> { throw ni(); }

	/**
	 * Gets a subset of rows in a result set, merging pending edit changes in order to display in the UI
	 */
	$getEditRows(handle: number, rowData: sqlops.EditSubsetParams): Thenable<sqlops.EditSubsetResult> { throw ni(); }

	/**
	 * Diposes an initialized edit session and cleans up pending edits
	 */
	$disposeEdit(handle: number, ownerUri: string): Thenable<void> { throw ni(); }

	/**
	 * Create a new database on the provided connection
	 */
	$createDatabase(handle: number, connectionUri: string, database: sqlops.DatabaseInfo): Thenable<sqlops.CreateDatabaseResponse> { throw ni(); }

	/**
	 * Get the default database prototype
	 */
	$getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<sqlops.DatabaseInfo> { throw ni(); }

	/**
	 * Get the database info
	 */
	$getDatabaseInfo(handle: number, connectionUri: string): Thenable<sqlops.DatabaseInfo> { throw ni(); }

	/**
	 * Create a new login on the provided connection
	 */
	$createLogin(handle: number, connectionUri: string, login: sqlops.LoginInfo): Thenable<sqlops.CreateLoginResponse> { throw ni(); }

	/**
	 * Backup a database
	 */
	$backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.BackupResponse> { throw ni(); }

	/**
	 * Get the extended database prototype
	 */
	$getBackupConfigInfo(handle: number, connectionUri: string): Thenable<sqlops.BackupConfigInfo> { throw ni(); }

	/**
	 * Restores a database
	 */
	$restore(handle: number, connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestoreResponse> { throw ni(); }

	/**
	 * Gets a plan for restoring a database
	 */
	$getRestorePlan(handle: number, connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestorePlanResponse> { throw ni(); }

	/**
	 * Cancels a plan
	 */
	$cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<boolean> { throw ni(); }

	/**
	 * Gets restore config Info
	 */
	$getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<sqlops.RestoreConfigInfo> { throw ni(); }


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
	$closeFileBrowser(handle: number, ownerUri: string): Thenable<sqlops.FileBrowserCloseResponse> { throw ni(); }

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Create a profiler session
	 */
	$createSession(handle: number, sessionId: string, createStatement: string, template: sqlops.ProfilerSessionTemplate): Thenable<boolean> { throw ni(); }

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
	$getJobs(handle: number, ownerUri: string): Thenable<sqlops.AgentJobsResult> { throw ni(); }

	/**
	 * Get a Agent Job's history
	 */
	$getJobHistory(handle: number, ownerUri: string, jobID: string, jobName: string): Thenable<sqlops.AgentJobHistoryResult> { throw ni(); }

	/**
	 * Run an action on a Job
	 */
	$jobAction(handle: number, ownerUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus> { throw ni(); }

	/**
	 * Deletes a job
	 */
	$deleteJob(handle: number, ownerUri: string, job: sqlops.AgentJobInfo): Thenable<sqlops.ResultStatus> { throw ni(); }

	/**
	 * Deletes a job step
	 */
	$deleteJobStep(handle: number, ownerUri: string, step: sqlops.AgentJobStepInfo): Thenable<sqlops.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Alerts list
	 */
	$getAlerts(handle: number, connectionUri: string): Thenable<sqlops.AgentAlertsResult> { throw ni(); }

	/**
	 * Deletes  an alert
	 */
	$deleteAlert(handle: number, connectionUri: string, alert: sqlops.AgentAlertInfo): Thenable<sqlops.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Oeprators list
	 */
	$getOperators(handle: number, connectionUri: string): Thenable<sqlops.AgentOperatorsResult> { throw ni(); }

	/**
	 * Deletes  an operator
	 */
	$deleteOperator(handle: number, connectionUri: string, operator: sqlops.AgentOperatorInfo): Thenable<sqlops.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Proxies list
	 */
	$getProxies(handle: number, connectionUri: string): Thenable<sqlops.AgentProxiesResult> { throw ni(); }

	/**
	 * Deletes  a proxy
	 */
	$deleteProxy(handle: number, connectionUri: string, proxy: sqlops.AgentProxyInfo): Thenable<sqlops.ResultStatus> { throw ni(); }

	/**
	 * Get Agent Credentials list
	 */
	$getCredentials(handle: number, connectionUri: string): Thenable<sqlops.GetCredentialsResult> { throw ni(); }

	/**
	 * DacFx export bacpac
	 */
	$exportBacpac(handle: number, databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> { throw ni(); }

	/**
	 * DacFx import bacpac
	 */
	$importBacpac(handle: number, packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> { throw ni(); }

	/**
	 * DacFx extract dacpac
	 */
	$extractDacpac(handle: number, databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> { throw ni(); }

	/**
	 * DacFx deploy dacpac
	 */
	$deployDacpac(handle: number, packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> { throw ni(); }

	/**
	 * DacFx generate deploy script
	 */
	$generateDeployScript(handle: number, packageFilePath: string, databaseName: string, scriptFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> { throw ni(); }

	/**
	 * DacFx generate deploy plan
	 */
	$generateDeployPlan(handle: number, packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.GenerateDeployPlanResult> { throw ni(); }

}

/**
 * ResourceProvider extension host class.
 */
export abstract class ExtHostResourceProviderShape {
	/**
	 * Create a firewall rule
	 */
	$createFirewallRule(handle: number, account: sqlops.Account, firewallRuleInfo: sqlops.FirewallRuleInfo): Thenable<sqlops.CreateFirewallRuleResponse> { throw ni(); }

	/**
	 * Handle firewall rule
	 */
	$handleFirewallRule(handle: number, errorCode: number, errorMessage: string, connectionTypeId: string): Thenable<sqlops.HandleFirewallRuleResponse> { throw ni(); }

}

/**
 * Credential Management extension host class.
 */
export abstract class ExtHostCredentialManagementShape {
	$saveCredential(credentialId: string, password: string): Thenable<boolean> { throw ni(); }

	$readCredential(credentialId: string): Thenable<sqlops.Credential> { throw ni(); }

	$deleteCredential(credentialId: string): Thenable<boolean> { throw ni(); }
}

/**
 * Serialization provider extension host class.
 */
export abstract class ExtHostSerializationProviderShape {
	$saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult> { throw ni(); }
}

export interface MainThreadAccountManagementShape extends IDisposable {
	$registerAccountProvider(providerMetadata: sqlops.AccountProviderMetadata, handle: number): Thenable<any>;
	$unregisterAccountProvider(handle: number): Thenable<any>;

	$beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void>;
	$endAutoOAuthDeviceCode(): void;

	$accountUpdated(updatedAccount: sqlops.Account): void;

	$getAccountsForProvider(providerId: string): Thenable<sqlops.Account[]>;
}

export interface MainThreadResourceProviderShape extends IDisposable {
	$registerResourceProvider(providerMetadata: sqlops.ResourceProviderMetadata, handle: number): Thenable<any>;
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
	$registerObjectExplorerNodeProvider(providerId: string, supportedProviderId: string, group: string, handle: number): TPromise<any>;
	$registerMetadataProvider(providerId: string, handle: number): TPromise<any>;
	$registerTaskServicesProvider(providerId: string, handle: number): TPromise<any>;
	$registerFileBrowserProvider(providerId: string, handle: number): TPromise<any>;
	$registerCapabilitiesServiceProvider(providerId: string, handle: number): TPromise<any>;
	$registerAdminServicesProvider(providerId: string, handle: number): TPromise<any>;
	$registerAgentServicesProvider(providerId: string, handle: number): TPromise<any>;
	$registerDacFxServicesProvider(providerId: string, handle: number): TPromise<any>;
	$unregisterProvider(handle: number): TPromise<any>;
	$onConnectionComplete(handle: number, connectionInfoSummary: sqlops.ConnectionInfoSummary): void;
	$onIntelliSenseCacheComplete(handle: number, connectionUri: string): void;
	$onConnectionChangeNotification(handle: number, changedConnInfo: sqlops.ChangedConnectionInfo): void;
	$onQueryComplete(handle: number, result: sqlops.QueryExecuteCompleteNotificationResult): void;
	$onBatchStart(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void;
	$onBatchComplete(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void;
	$onResultSetAvailable(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void;
	$onResultSetUpdated(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void;
	$onQueryMessage(handle: number, message: sqlops.QueryExecuteMessageParams): void;
	$onObjectExplorerSessionCreated(handle: number, message: sqlops.ObjectExplorerSession): void;
	$onObjectExplorerSessionDisconnected(handle: number, message: sqlops.ObjectExplorerSession): void;
	$onObjectExplorerNodeExpanded(providerId: string, message: sqlops.ObjectExplorerExpandInfo): void;
	$onTaskCreated(handle: number, sessionResponse: sqlops.TaskInfo): void;
	$onTaskStatusChanged(handle: number, sessionResponse: sqlops.TaskProgressInfo): void;
	$onFileBrowserOpened(handle: number, response: sqlops.FileBrowserOpenedParams): void;
	$onFolderNodeExpanded(handle: number, response: sqlops.FileBrowserExpandedParams): void;
	$onFilePathsValidated(handle: number, response: sqlops.FileBrowserValidatedParams): void;
	$onScriptingComplete(handle: number, message: sqlops.ScriptingCompleteResult): void;
	$onSessionEventsAvailable(handle: number, response: sqlops.ProfilerSessionEvents): void;
	$onSessionStopped(handle: number, response: sqlops.ProfilerSessionStoppedParams): void;
	$onProfilerSessionCreated(handle: number, response: sqlops.ProfilerSessionCreatedParams): void;
	$onJobDataUpdated(handle: Number): void;

	/**
	 * Callback when a session has completed initialization
	 */
	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string);
}

export interface MainThreadConnectionManagementShape extends IDisposable {
	$getActiveConnections(): Thenable<sqlops.connection.Connection[]>;
	$getCurrentConnection(): Thenable<sqlops.connection.Connection>;
	$getCredentials(connectionId: string): Thenable<{ [name: string]: string }>;
	$getServerInfo(connectedId: string): Thenable<sqlops.ServerInfo>;
	$openConnectionDialog(providers: string[], initialConnectionProfile?: sqlops.IConnectionProfile, connectionCompletionOptions?: sqlops.IConnectionCompletionOptions): Thenable<sqlops.connection.Connection>;
	$listDatabases(connectionId: string): Thenable<string[]>;
	$getConnectionString(connectionId: string, includePassword: boolean): Thenable<string>;
	$getUriForConnection(connectionId: string): Thenable<string>;
	$connect(connectionProfile: sqlops.IConnectionProfile): Thenable<sqlops.ConnectionResult>;
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
	MainThreadObjectExplorer: createMainId<MainThreadObjectExplorerShape>('MainThreadObjectExplorer'),
	MainThreadBackgroundTaskManagement: createMainId<MainThreadBackgroundTaskManagementShape>('MainThreadBackgroundTaskManagement'),
	MainThreadSerializationProvider: createMainId<MainThreadSerializationProviderShape>('MainThreadSerializationProvider'),
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
	ExtHostSerializationProvider: createExtId<ExtHostSerializationProviderShape>('ExtHostSerializationProvider'),
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
	$onDidOpenDashboard(dashboard: sqlops.DashboardDocument): void;
	$onDidChangeToDashboard(dashboard: sqlops.DashboardDocument): void;
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
	$getContributedTaskHandlerDescriptions(): TPromise<{ [id: string]: string | ITaskHandlerDescription }>;
}

export interface MainThreadTasksShape extends IDisposable {
	$registerTask(id: string): TPromise<any>;
	$unregisterTask(id: string): TPromise<any>;
}

export interface ExtHostDashboardWebviewsShape {
	$registerProvider(widgetId: string, handler: (webview: sqlops.DashboardWebview) => void): void;
	$onMessage(handle: number, message: any): void;
	$onClosed(handle: number): void;
	$registerWidget(handle: number, id: string, connection: sqlops.connection.Connection, serverInfo: sqlops.ServerInfo): void;
}

export interface MainThreadDashboardWebviewShape extends IDisposable {
	$sendMessage(handle: number, message: string);
	$registerProvider(widgetId: string);
	$setHtml(handle: number, value: string);
}

export interface ExtHostModelViewShape {
	$registerProvider(widgetId: string, handler: (webview: sqlops.ModelView) => void, extension: IExtensionDescription): void;
	$onClosed(handle: number): void;
	$registerWidget(handle: number, id: string, connection: sqlops.connection.Connection, serverInfo: sqlops.ServerInfo): void;
	$handleEvent(handle: number, id: string, eventArgs: any);
	$runCustomValidations(handle: number, id: string): Thenable<boolean>;
}

export interface ExtHostModelViewTreeViewsShape {
	$getChildren(treeViewId: string, treeItemHandle?: string): TPromise<ITreeComponentItem[]>;
	$createTreeView(handle: number, componentId: string, options: { treeDataProvider: vscode.TreeDataProvider<any> }, extension: IExtensionDescription): sqlops.TreeComponentView<any>;
	$onNodeCheckedChanged(treeViewId: string, treeItemHandle?: string, checked?: boolean): void;
	$onNodeSelected(treeViewId: string, nodes: string[]): void;

	$setExpanded(treeViewId: string, treeItemHandle: string, expanded: boolean): void;
	$setSelection(treeViewId: string, treeItemHandles: string[]): void;
	$setVisible(treeViewId: string, visible: boolean): void;
}

export interface ExtHostBackgroundTaskManagementShape {
	$onTaskRegistered(operationId: string): void;
	$onTaskCanceled(operationId: string): void;
	$registerTask(operationInfo: sqlops.BackgroundOperationInfo): void;
	$removeTask(operationId: string): void;
}

export interface MainThreadBackgroundTaskManagementShape extends IDisposable {
	$registerTask(taskInfo: sqlops.TaskInfo): void;
	$updateTask(taskProgressInfo: sqlops.TaskProgressInfo): void;
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
	$getNode(connectionId: string, nodePath?: string): Thenable<sqlops.NodeInfo>;
	$getActiveConnectionNodes(): Thenable<{ nodeInfo: sqlops.NodeInfo, connectionId: string }[]>;
	$setExpandedState(connectionId: string, nodePath: string, expandedState: vscode.TreeItemCollapsibleState): Thenable<void>;
	$setSelected(connectionId: string, nodePath: string, selected: boolean, clearOtherSelections?: boolean): Thenable<void>;
	$getChildren(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo[]>;
	$isExpanded(connectionId: string, nodePath: string): Thenable<boolean>;
	$findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<sqlops.NodeInfo[]>;
	$refresh(connectionId: string, nodePath: string): Thenable<sqlops.NodeInfo>;
	$getNodeActions(connectionId: string, nodePath: string): Thenable<string[]>;
	$getSessionConnectionProfile(sessionId: string): Thenable<sqlops.IConnectionProfile>;
}

export interface ExtHostModelViewDialogShape {
	$onButtonClick(handle: number): void;
	$onPanelValidityChanged(handle: number, valid: boolean): void;
	$onWizardPageChanged(handle: number, info: sqlops.window.WizardPageChangeInfo): void;
	$updateWizardPageInfo(handle: number, pageHandles: number[], currentPageIndex: number): void;
	$validateNavigation(handle: number, info: sqlops.window.WizardPageChangeInfo): Thenable<boolean>;
	$validateDialogClose(handle: number): Thenable<boolean>;
	$handleSave(handle: number): Thenable<boolean>;
}

export interface MainThreadModelViewDialogShape extends IDisposable {
	$openEditor(handle: number, modelViewId: string, title: string, options?: sqlops.ModelViewEditorOptions, position?: vscode.ViewColumn): Thenable<void>;
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
}

export interface MainThreadQueryEditorShape extends IDisposable {
	$connect(fileUri: string, connectionId: string): Thenable<void>;
	$runQuery(fileUri: string): void;
}

export interface ExtHostNotebookShape {

	/**
	 * Looks up a notebook manager for a given notebook URI
	 * @param {number} providerHandle
	 * @param {vscode.Uri} notebookUri
	 * @returns {Thenable<string>} handle of the manager to be used when sending
	 */
	$getNotebookManager(providerHandle: number, notebookUri: UriComponents): Thenable<INotebookManagerDetails>;
	$handleNotebookClosed(notebookUri: UriComponents): void;

	// Server Manager APIs
	$doStartServer(managerHandle: number): Thenable<void>;
	$doStopServer(managerHandle: number): Thenable<void>;

	// Content Manager APIs
	$getNotebookContents(managerHandle: number, notebookUri: UriComponents): Thenable<sqlops.nb.INotebookContents>;
	$save(managerHandle: number, notebookUri: UriComponents, notebook: sqlops.nb.INotebookContents): Thenable<sqlops.nb.INotebookContents>;

	// Session Manager APIs
	$refreshSpecs(managerHandle: number): Thenable<sqlops.nb.IAllKernels>;
	$startNewSession(managerHandle: number, options: sqlops.nb.ISessionOptions): Thenable<INotebookSessionDetails>;
	$shutdownSession(managerHandle: number, sessionId: string): Thenable<void>;

	// Session APIs
	$changeKernel(sessionId: number, kernelInfo: sqlops.nb.IKernelSpec): Thenable<INotebookKernelDetails>;
	$configureKernel(sessionId: number, kernelInfo: sqlops.nb.IKernelSpec): Thenable<void>;
	$configureConnection(sessionId: number, connection: sqlops.IConnectionProfile): Thenable<void>;

	// Kernel APIs
	$getKernelReadyStatus(kernelId: number): Thenable<sqlops.nb.IInfoReply>;
	$getKernelSpec(kernelId: number): Thenable<sqlops.nb.IKernelSpec>;
	$requestComplete(kernelId: number, content: sqlops.nb.ICompleteRequest): Thenable<sqlops.nb.ICompleteReplyMsg>;
	$requestExecute(kernelId: number, content: sqlops.nb.IExecuteRequest, disposeOnDone?: boolean): Thenable<INotebookFutureDetails>;
	$interruptKernel(kernelId: number): Thenable<void>;

	// Future APIs
	$sendInputReply(futureId: number, content: sqlops.nb.IInputReply): void;
	$disposeFuture(futureId: number): void;
}

export interface MainThreadNotebookShape extends IDisposable {
	$registerNotebookProvider(providerId: string, handle: number): void;
	$unregisterNotebookProvider(handle: number): void;
	$onFutureMessage(futureId: number, type: FutureMessageType, payload: sqlops.nb.IMessage): void;
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
	cells: sqlops.nb.NotebookCell[];
}

export interface INotebookModelChangedData {
	uri: UriComponents;
	providerId: string;
	providers: string[];
	isDirty: boolean;
	cells: sqlops.nb.NotebookCell[];
	kernelSpec: sqlops.nb.IKernelSpec;
}

export interface INotebookEditorAddData {
	id: string;
	documentUri: UriComponents;
	editorPosition: EditorViewColumn;
}

export interface INotebookShowOptions {
	position?: EditorViewColumn;
	preserveFocus?: boolean;
	preview?: boolean;
	providerId?: string;
	connectionId?: string;
	defaultKernel?: sqlops.nb.IKernelSpec;
}

export interface ExtHostNotebookDocumentsAndEditorsShape {
	$acceptDocumentsAndEditorsDelta(delta: INotebookDocumentsAndEditorsDelta): void;
	$acceptModelChanged(strURL: UriComponents, e: INotebookModelChangedData);
}

export interface MainThreadNotebookDocumentsAndEditorsShape extends IDisposable {
	$trySaveDocument(uri: UriComponents): Thenable<boolean>;
	$tryShowNotebookDocument(resource: UriComponents, options: INotebookShowOptions): TPromise<string>;
	$tryApplyEdits(id: string, modelVersionId: number, edits: ISingleNotebookEditOperation[], opts: IUndoStopOptions): TPromise<boolean>;
	$runCell(id: string, cellUri: UriComponents): TPromise<boolean>;
}

export interface ExtHostExtensionManagementShape {
	$install(vsixPath: string): Thenable<string>;
}

export interface MainThreadExtensionManagementShape extends IDisposable {
	$install(vsixPath: string): Thenable<string>;
}