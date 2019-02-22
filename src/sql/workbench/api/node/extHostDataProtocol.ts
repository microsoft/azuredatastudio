/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import { SqlMainContext, MainThreadDataProtocolShape, ExtHostDataProtocolShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { DataProviderType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { TPromise } from 'vs/base/common/winjs.base';

export class ExtHostDataProtocol extends ExtHostDataProtocolShape {

	private readonly _onDidChangeLanguageFlavor = new Emitter<sqlops.DidChangeLanguageFlavorParams>();

	readonly onDidChangeLanguageFlavor: Event<sqlops.DidChangeLanguageFlavorParams> = this._onDidChangeLanguageFlavor.event;

	private _proxy: MainThreadDataProtocolShape;

	private static _handlePool: number = 0;
	private _adapter = new Map<number, sqlops.DataProvider>();
	private _providersByType = new Map<sqlops.DataProviderType, sqlops.DataProvider[]>();

	constructor(
		mainContext: IMainContext
	) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadDataProtocol);
	}

	private _createDisposable(handle: number): Disposable {
		return new Disposable(() => {
			this._adapter.delete(handle);
			this._proxy.$unregisterProvider(handle);
		});
	}

	private _nextHandle(): number {
		return ExtHostDataProtocol._handlePool++;
	}

	private _resolveProvider<P extends sqlops.DataProvider>(handle: number): P {
		let provider = this._adapter.get(handle) as P;
		if (provider) {
			return provider;
		} else {
			throw new Error(`Unfound provider ${handle}`);
		}
	}

	private registerProvider(provider: sqlops.DataProvider, providerType: DataProviderType): vscode.Disposable {
		provider.handle = this._nextHandle();
		this._adapter.set(provider.handle, provider);
		let providersForType = this._providersByType.get(providerType);
		if (!providersForType) {
			providersForType = [provider];
		} else {
			providersForType.push(provider);
		}
		this._providersByType.set(providerType, providersForType);
		return this._createDisposable(provider.handle);
	}

	public getProvider<T extends sqlops.DataProvider>(providerId: string, providerType: sqlops.DataProviderType): T {
		let providersForType = this._providersByType.get(providerType);
		if (!providersForType) {
			return undefined;
		}
		return providersForType.find(provider => provider.providerId === providerId) as T;
	}

	public getProvidersByType<T extends sqlops.DataProvider>(providerType: sqlops.DataProviderType): T[] {
		let providersForType = this._providersByType.get(providerType);
		return (providersForType || []) as T[];
	}

	$registerConnectionProvider(provider: sqlops.ConnectionProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ConnectionProvider);
		this._proxy.$registerConnectionProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerBackupProvider(provider: sqlops.BackupProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.BackupProvider);
		this._proxy.$registerBackupProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerRestoreProvider(provider: sqlops.RestoreProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.RestoreProvider);
		this._proxy.$registerRestoreProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerScriptingProvider(provider: sqlops.ScriptingProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ScriptingProvider);
		this._proxy.$registerScriptingProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerQueryProvider(provider: sqlops.QueryProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.QueryProvider);
		this._proxy.$registerQueryProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerMetadataProvider(provider: sqlops.MetadataProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.MetadataProvider);
		this._proxy.$registerMetadataProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerTaskServicesProvider(provider: sqlops.TaskServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.TaskServicesProvider);
		this._proxy.$registerTaskServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerFileBrowserProvider(provider: sqlops.FileBrowserProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.FileBrowserProvider);
		this._proxy.$registerFileBrowserProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerObjectExplorerProvider(provider: sqlops.ObjectExplorerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ObjectExplorerProvider);
		this._proxy.$registerObjectExplorerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerObjectExplorerNodeProvider(provider: sqlops.ObjectExplorerNodeProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ObjectExplorerNodeProvider);
		this._proxy.$registerObjectExplorerNodeProvider(provider.providerId, provider.supportedProviderId, provider.group, provider.handle);
		return rt;
	}

	$registerProfilerProvider(provider: sqlops.ProfilerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ProfilerProvider);
		this._proxy.$registerProfilerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerAdminServicesProvider(provider: sqlops.AdminServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.AdminServicesProvider);
		this._proxy.$registerAdminServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerAgentServiceProvider(provider: sqlops.AgentServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.AgentServicesProvider);
		this._proxy.$registerAgentServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerCapabilitiesServiceProvider(provider: sqlops.CapabilitiesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.CapabilitiesProvider);
		this._proxy.$registerCapabilitiesServiceProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerDacFxServiceProvider(provider: sqlops.DacFxServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.DacFxServicesProvider);
		this._proxy.$registerDacFxServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	// Capabilities Discovery handlers
	$getServerCapabilities(handle: number, client: sqlops.DataProtocolClientCapabilities): Thenable<sqlops.DataProtocolServerCapabilities> {
		return this._resolveProvider<sqlops.CapabilitiesProvider>(handle).getServerCapabilities(client);
	}

	// Connection Management handlers
	$connect(handle: number, connectionUri: string, connection: sqlops.ConnectionInfo): Thenable<boolean> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).connect(connectionUri, connection);
	}

	$disconnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).disconnect(connectionUri);
	}

	$cancelConnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).cancelConnect(connectionUri);
	}

	$changeDatabase(handle: number, connectionUri: string, newDatabase: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).changeDatabase(connectionUri, newDatabase);
	}

	$listDatabases(handle: number, connectionUri: string): Thenable<sqlops.ListDatabasesResult> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).listDatabases(connectionUri);
	}

	$getConnectionString(handle: number, connectionUri: string, includePassword: boolean): Thenable<string> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).getConnectionString(connectionUri, includePassword);
	}

	$buildConnectionInfo(handle: number, connectionString: string): Thenable<sqlops.ConnectionInfo> {
		let provider = this._resolveProvider<sqlops.ConnectionProvider>(handle);
		if (provider.buildConnectionInfo) {
			return provider.buildConnectionInfo(connectionString);
		} else {
			return TPromise.as(undefined);
		}
	}

	$rebuildIntelliSenseCache(handle: number, connectionUri: string): Thenable<void> {
		return this._resolveProvider<sqlops.ConnectionProvider>(handle).rebuildIntelliSenseCache(connectionUri);
	}

	$onConnectComplete(handle: number, connectionInfoSummary: sqlops.ConnectionInfoSummary): void {
		this._proxy.$onConnectionComplete(handle, connectionInfoSummary);
	}

	public $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._proxy.$onIntelliSenseCacheComplete(handle, connectionUri);
	}

	public $onConnectionChanged(handle: number, changedConnInfo: sqlops.ChangedConnectionInfo): void {
		this._proxy.$onConnectionChangeNotification(handle, changedConnInfo);
	}

	// Protocol-wide Event Handlers
	public $languageFlavorChanged(params: sqlops.DidChangeLanguageFlavorParams): void {
		this._onDidChangeLanguageFlavor.fire(params);
	}

	// Query Management handlers

	$cancelQuery(handle: number, ownerUri: string): Thenable<sqlops.QueryCancelResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).cancelQuery(ownerUri);
	}

	$runQuery(handle: number, ownerUri: string, selection: sqlops.ISelectionData, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).runQuery(ownerUri, selection, runOptions);
	}

	$runQueryStatement(handle: number, ownerUri: string, line: number, column: number): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).runQueryStatement(ownerUri, line, column);
	}

	$runQueryString(handle: number, ownerUri: string, queryString: string): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).runQueryString(ownerUri, queryString);
	}

	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<sqlops.SimpleExecuteResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).runQueryAndReturn(ownerUri, queryString);
	}

	$parseSyntax(handle: number, ownerUri: string, query: string): Thenable<sqlops.SyntaxParseResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).parseSyntax(ownerUri, query);
	}

	$getQueryRows(handle: number, rowData: sqlops.QueryExecuteSubsetParams): Thenable<sqlops.QueryExecuteSubsetResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).getQueryRows(rowData);
	}

	$disposeQuery(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).disposeQuery(ownerUri);
	}

	$onQueryComplete(handle: number, result: sqlops.QueryExecuteCompleteNotificationResult): void {
		this._proxy.$onQueryComplete(handle, result);
	}
	$onBatchStart(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void {
		this._proxy.$onBatchStart(handle, batchInfo);
	}
	$onBatchComplete(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void {
		this._proxy.$onBatchComplete(handle, batchInfo);
	}
	$onResultSetAvailable(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void {
		this._proxy.$onResultSetAvailable(handle, resultSetInfo);
	}
	$onResultSetUpdated(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void {
		this._proxy.$onResultSetUpdated(handle, resultSetInfo);
	}
	$onQueryMessage(handle: number, message: sqlops.QueryExecuteMessageParams): void {
		this._proxy.$onQueryMessage(handle, message);
	}

	$saveResults(handle: number, requestParams: sqlops.SaveResultsRequestParams): Thenable<sqlops.SaveResultRequestResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).saveResults(requestParams);
	}

	// Edit Data handlers
	$commitEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).commitEdit(ownerUri);
	}

	$createRow(handle: number, ownerUri: string): Thenable<sqlops.EditCreateRowResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).createRow(ownerUri);
	}

	$deleteRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).deleteRow(ownerUri, rowId);
	}

	$disposeEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).disposeEdit(ownerUri);
	}

	$initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
	}

	$revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<sqlops.EditRevertCellResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).revertCell(ownerUri, rowId, columnId);
	}

	$revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).revertRow(ownerUri, rowId);
	}

	$updateCell(handle: number, ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<sqlops.EditUpdateCellResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).updateCell(ownerUri, rowId, columnId, newValue);
	}

	$getEditRows(handle: number, rowData: sqlops.EditSubsetParams): Thenable<sqlops.EditSubsetResult> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).getEditRows(rowData);
	}

	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._proxy.$onEditSessionReady(handle, ownerUri, success, message);
	}

	// Metadata handlers
	public $getMetadata(handle: number, connectionUri: string): Thenable<sqlops.ProviderMetadata> {
		return this._resolveProvider<sqlops.MetadataProvider>(handle).getMetadata(connectionUri);
	}

	public $getDatabases(handle: number, connectionUri: string): Thenable<string[]> {
		return this._resolveProvider<sqlops.MetadataProvider>(handle).getDatabases(connectionUri);
	}

	public $getTableInfo(handle: number, connectionUri: string, metadata: sqlops.ObjectMetadata): Thenable<sqlops.ColumnMetadata[]> {
		return this._resolveProvider<sqlops.MetadataProvider>(handle).getTableInfo(connectionUri, metadata);
	}

	public $getViewInfo(handle: number, connectionUri: string, metadata: sqlops.ObjectMetadata): Thenable<sqlops.ColumnMetadata[]> {
		return this._resolveProvider<sqlops.MetadataProvider>(handle).getViewInfo(connectionUri, metadata);
	}

	// Object Explorer Service
	public $createObjectExplorerSession(handle: number, connInfo: sqlops.ConnectionInfo): Thenable<sqlops.ObjectExplorerSessionResponse> {
		return this._resolveProvider<sqlops.ObjectExplorerProvider>(handle).createNewSession(connInfo);
	}

	public $createObjectExplorerNodeProviderSession(handle: number, session: sqlops.ObjectExplorerSession): Thenable<boolean> {
		return this._resolveProvider<sqlops.ObjectExplorerNodeProvider>(handle).handleSessionOpen(session);
	}

	public $expandObjectExplorerNode(handle: number, nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<sqlops.ObjectExplorerProviderBase> (handle).expandNode(nodeInfo);
	}

	public $refreshObjectExplorerNode(handle: number, nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<sqlops.ObjectExplorerProviderBase> (handle).refreshNode(nodeInfo);
	}

	public $closeObjectExplorerSession(handle: number, closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
		return this._resolveProvider<sqlops.ObjectExplorerProvider>(handle).closeSession(closeSessionInfo);
	}

	public $handleSessionClose(handle: number, closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): void {
		return this._resolveProvider<sqlops.ObjectExplorerNodeProvider>(handle).handleSessionClose(closeSessionInfo);
	}

	public $findNodes(handle: number, findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
		return this._resolveProvider<sqlops.ObjectExplorerProviderBase>(handle).findNodes(findNodesInfo);
	}

	public $onObjectExplorerSessionCreated(handle: number, response: sqlops.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionCreated(handle, response);
	}

	public $onObjectExplorerSessionDisconnected(handle: number, response: sqlops.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionDisconnected(handle, response);
	}

	public $onObjectExplorerNodeExpanded(providerId: string, response: sqlops.ObjectExplorerExpandInfo): void {
		this._proxy.$onObjectExplorerNodeExpanded(providerId, response);
	}

	// Task Service
	public $getAllTasks(handle: number, listTasksParams: sqlops.ListTasksParams): Thenable<sqlops.ListTasksResponse> {
		return this._resolveProvider<sqlops.TaskServicesProvider>(handle).getAllTasks(listTasksParams);
	}

	public $cancelTask(handle: number, cancelTaskParams: sqlops.CancelTaskParams): Thenable<boolean> {
		return this._resolveProvider<sqlops.TaskServicesProvider>(handle).cancelTask(cancelTaskParams);
	}

	public $onTaskStatusChanged(handle: number, response: sqlops.TaskProgressInfo): void {
		this._proxy.$onTaskStatusChanged(handle, response);
	}

	public $onTaskCreated(handle: number, response: sqlops.TaskInfo): void {
		this._proxy.$onTaskCreated(handle, response);
	}

	// Scripting handlers

	public $scriptAsOperation(handle: number, connectionUri: string, operation: sqlops.ScriptOperation, metadata: sqlops.ObjectMetadata, paramDetails: sqlops.ScriptingParamDetails): Thenable<sqlops.ScriptingResult> {
		return this._resolveProvider<sqlops.ScriptingProvider>(handle).scriptAsOperation(connectionUri, operation, metadata, paramDetails);
	}

	public $onScriptingComplete(handle: number, scriptingCompleteResult: sqlops.ScriptingCompleteResult): void {
		this._proxy.$onScriptingComplete(handle, scriptingCompleteResult);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public $createDatabase(handle: number, connectionUri: string, database: sqlops.DatabaseInfo): Thenable<sqlops.CreateDatabaseResponse> {
		return this._resolveProvider<sqlops.AdminServicesProvider>(handle).createDatabase(connectionUri, database);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public $getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<sqlops.DatabaseInfo> {
		return this._resolveProvider<sqlops.AdminServicesProvider>(handle).getDefaultDatabaseInfo(connectionUri);
	}

	/**
	 * Get the info on a database
	 */
	public $getDatabaseInfo(handle: number, connectionUri: string): Thenable<sqlops.DatabaseInfo> {
		return this._resolveProvider<sqlops.AdminServicesProvider>(handle).getDatabaseInfo(connectionUri);
	}

	/**
	 * Create a new login on the provided connection
	 */
	public $createLogin(handle: number, connectionUri: string, login: sqlops.LoginInfo): Thenable<sqlops.CreateLoginResponse> {
		return this._resolveProvider<sqlops.AdminServicesProvider>(handle).createLogin(connectionUri, login);
	}

	/**
	 * Backup a database
	 */
	public $backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.BackupResponse> {
		return this._resolveProvider<sqlops.BackupProvider>(handle).backup(connectionUri, backupInfo, taskExecutionMode);
	}

	/**
	* Create a new database on the provided connection
	*/
	public $getBackupConfigInfo(handle: number, connectionUri: string): Thenable<sqlops.BackupConfigInfo> {
		return this._resolveProvider<sqlops.BackupProvider>(handle).getBackupConfigInfo(connectionUri);
	}

	/**
	 * Restores a database
	 */
	public $restore(handle: number, connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestoreResponse> {
		return this._resolveProvider<sqlops.RestoreProvider>(handle).restore(connectionUri, restoreInfo);
	}

	/**
	 * Gets a plan for restoring a database
	 */
	public $getRestorePlan(handle: number, connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestorePlanResponse> {
		return this._resolveProvider<sqlops.RestoreProvider>(handle).getRestorePlan(connectionUri, restoreInfo);
	}

	/**
	 * cancels a restore plan
	 */
	public $cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<boolean> {
		return this._resolveProvider<sqlops.RestoreProvider>(handle).cancelRestorePlan(connectionUri, restoreInfo);
	}

	/**
	 * Gets restore config Info
	 */
	public $getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<sqlops.RestoreConfigInfo> {
		return this._resolveProvider<sqlops.RestoreProvider>(handle).getRestoreConfigInfo(connectionUri);
	}

	/**
	 * Open a file browser
	 */
	public $openFileBrowser(handle: number, ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
		return this._resolveProvider<sqlops.FileBrowserProvider>(handle).openFileBrowser(ownerUri, expandPath, fileFilters, changeFilter);
	}

	/**
	 * Send event when opening browser is complete
	 */
	public $onFileBrowserOpened(handle: number, response: sqlops.FileBrowserOpenedParams): void {
		this._proxy.$onFileBrowserOpened(handle, response);
	}

	/**
	 * Expand a folder node
	 */
	public $expandFolderNode(handle: number, ownerUri: string, expandPath: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.FileBrowserProvider>(handle).expandFolderNode(ownerUri, expandPath);
	}

	/**
	 * Send event when expansion is complete
	 */
	public $onFolderNodeExpanded(handle: number, response: sqlops.FileBrowserExpandedParams): void {
		this._proxy.$onFolderNodeExpanded(handle, response);
	}

	/**
	 * Validate selected file path
	 */
	public $validateFilePaths(handle: number, ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> {
		return this._resolveProvider<sqlops.FileBrowserProvider>(handle).validateFilePaths(ownerUri, serviceType, selectedFiles);
	}

	/**
	 * Send event when validation is complete
	 */
	public $onFilePathsValidated(handle: number, response: sqlops.FileBrowserValidatedParams) {
		this._proxy.$onFilePathsValidated(handle, response);
	}

	/**
	 * Close file browser
	 */
	public $closeFileBrowser(handle: number, ownerUri: string): Thenable<sqlops.FileBrowserCloseResponse> {
		return this._resolveProvider<sqlops.FileBrowserProvider>(handle).closeFileBrowser(ownerUri);
	}

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Create a new profiler session
	 */
	public $createSession(handle: number, sessionId: string, createStatement: string, template: sqlops.ProfilerSessionTemplate): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).createSession(sessionId, createStatement, template);
	}

	/**
	 * Start a profiler session
	 */
	public $startSession(handle: number, sessionId: string, sessionName: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).startSession(sessionId, sessionName);
	}

	/**
	 * Stop a profiler session
	 */
	public $stopSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).stopSession(sessionId);
	}

	/**
	 * Pause a profiler session
	 */
	public $pauseSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).pauseSession(sessionId);
	}

	/**
	 * Disconnect a profiler session
	 */
	public $disconnectSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).disconnectSession(sessionId);
	}

	/**
	 * Get list of running XEvent sessions on the session's target server
	 */
	public $getXEventSessions(handle: number, sessionId: string): Thenable<string[]> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).getXEventSessions(sessionId);
	}

	/**
	 * Profiler session events available notification
	 */
	public $onSessionEventsAvailable(handle: number, response: sqlops.ProfilerSessionEvents): void {
		this._proxy.$onSessionEventsAvailable(handle, response);
	}

	/**
	 * Profiler session stopped unexpectedly notification
	 */
	public $onSessionStopped(handle: number, response: sqlops.ProfilerSessionStoppedParams): void {
		this._proxy.$onSessionStopped(handle, response);
	}

	/**
	 * Profiler session created notification
	 */
	public $onProfilerSessionCreated(handle: number, response: sqlops.ProfilerSessionCreatedParams): void {
		this._proxy.$onProfilerSessionCreated(handle, response);
	}


	/**
	 * Agent Job Provider methods
	 */

	/**
	 * Get Agent Job list
	 */
	public $getJobs(handle: number, ownerUri: string): Thenable<sqlops.AgentJobsResult> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).getJobs(ownerUri);
	}

	/**
	 * Get a Agent Job's history
	 */
	public $getJobHistory(handle: number, ownerUri: string, jobID: string, jobName: string): Thenable<sqlops.AgentJobHistoryResult> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).getJobHistory(ownerUri, jobID, jobName);
	}

	/**
	 * Run an action on a job
	 */
	public $jobAction(handle: number, ownerUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).jobAction(ownerUri, jobName, action);
	}

	/**
	 * Deletes a job
	 */
	$deleteJob(handle: number, ownerUri: string, job: sqlops.AgentJobInfo): Thenable<sqlops.ResultStatus> {
		throw this._resolveProvider<sqlops.AgentServicesProvider>(handle).deleteJob(ownerUri, job);
	}

	/**
	 * Deletes a job step
	 */
	$deleteJobStep(handle: number, ownerUri: string, step: sqlops.AgentJobStepInfo): Thenable<sqlops.ResultStatus> {
		throw this._resolveProvider<sqlops.AgentServicesProvider>(handle).deleteJobStep(ownerUri, step);
	}

	/**
	 * Get Agent Alerts list
	 */
	$getAlerts(handle: number, ownerUri: string): Thenable<sqlops.AgentAlertsResult> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).getAlerts(ownerUri);
	}

	/**
	 * Deletes an alert
	 */
	$deleteAlert(handle: number, ownerUri: string, alert: sqlops.AgentAlertInfo): Thenable<sqlops.ResultStatus> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).deleteAlert(ownerUri, alert);
	}

	/**
	 * Get Agent Oeprators list
	 */
	$getOperators(handle: number, ownerUri: string): Thenable<sqlops.AgentOperatorsResult> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).getOperators(ownerUri);
	}

	/**
	 * Deletes an operator
	 */
	$deleteOperator(handle: number, ownerUri: string, operator: sqlops.AgentOperatorInfo): Thenable<sqlops.ResultStatus> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).deleteOperator(ownerUri, operator);
	}

	/**
	 * Get Agent Proxies list
	 */
	$getProxies(handle: number, ownerUri: string): Thenable<sqlops.AgentProxiesResult> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).getProxies(ownerUri);
	}

	/**
	 * Deletes a proxy
	 */
	$deleteProxy(handle: number, ownerUri: string, proxy: sqlops.AgentProxyInfo): Thenable<sqlops.ResultStatus> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).deleteProxy(ownerUri, proxy);
	}

	/**
	 * Gets Agent Credentials from server
	 */
	$getCredentials(handle: number, ownerUri: string): Thenable<sqlops.GetCredentialsResult> {
		return this._resolveProvider<sqlops.AgentServicesProvider>(handle).getCredentials(ownerUri);
	}

	/**
	 * SQL Agent job data update notification
	 */
	public $onJobDataUpdated(handle: Number): void {
		this._proxy.$onJobDataUpdated(handle);
	}
}
