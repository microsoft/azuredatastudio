/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import Event, { Emitter } from 'vs/base/common/event';
import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { SqlMainContext, MainThreadDataProtocolShape, ExtHostDataProtocolShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';

export class ExtHostDataProtocol extends ExtHostDataProtocolShape {

	private readonly _onDidChangeLanguageFlavor = new Emitter<sqlops.DidChangeLanguageFlavorParams>();

	readonly onDidChangeLanguageFlavor: Event<sqlops.DidChangeLanguageFlavorParams> = this._onDidChangeLanguageFlavor.event;

	private _proxy: MainThreadDataProtocolShape;

	private static _handlePool: number = 0;
	private _adapter = new Map<number, sqlops.DataProvider>();

	constructor(
		threadService: IThreadService
	) {
		super();
		this._proxy = threadService.get(SqlMainContext.MainThreadDataProtocol);
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

	private registerProvider(provider: sqlops.DataProvider): vscode.Disposable {
		provider.handle = this._nextHandle();
		this._adapter.set(provider.handle, provider);
		return this._createDisposable(provider.handle);
	};

	$registerConnectionProvider(provider: sqlops.ConnectionProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerConnectionProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerBackupProvider(provider: sqlops.BackupProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerBackupProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerRestoreProvider(provider: sqlops.RestoreProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerRestoreProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerScriptingProvider(provider: sqlops.ScriptingProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerScriptingProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerQueryProvider(provider: sqlops.QueryProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerQueryProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerMetadataProvider(provider: sqlops.MetadataProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerMetadataProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerTaskServicesProvider(provider: sqlops.TaskServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerTaskServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerFileBrowserProvider(provider: sqlops.FileBrowserProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerFileBrowserProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerObjectExplorerProvider(provider: sqlops.ObjectExplorerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerObjectExplorerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerProfilerProvider(provider: sqlops.ProfilerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerProfilerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerAdminServicesProvider(provider: sqlops.AdminServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerAdminServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerCapabilitiesServiceProvider(provider: sqlops.CapabilitiesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerCapabilitiesServiceProvider(provider.providerId, provider.handle);
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
	$onResultSetComplete(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetCompleteNotificationParams): void {
		this._proxy.$onResultSetComplete(handle, resultSetInfo);
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

	$initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> {
		return this._resolveProvider<sqlops.QueryProvider>(handle).initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit);
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

	public $expandObjectExplorerNode(handle: number, nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<sqlops.ObjectExplorerProvider>(handle).expandNode(nodeInfo);
	}

	public $refreshObjectExplorerNode(handle: number, nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<sqlops.ObjectExplorerProvider>(handle).refreshNode(nodeInfo);
	}

	public $closeObjectExplorerSession(handle: number, closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
		return this._resolveProvider<sqlops.ObjectExplorerProvider>(handle).closeSession(closeSessionInfo);
	}

	public $onObjectExplorerSessionCreated(handle: number, response: sqlops.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionCreated(handle, response);
	}

	public $onObjectExplorerNodeExpanded(handle: number, response: sqlops.ObjectExplorerExpandInfo): void {
		this._proxy.$onObjectExplorerNodeExpanded(handle, response);
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
	 * Start a profiler session
	 */
	public $startSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).startSession(sessionId);
	}

	/**
	 * Stop a profiler session
	 */
	public $stopSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<sqlops.ProfilerProvider>(handle).stopSession(sessionId);
	}

	/**
	 * Profiler session events available notification
	 */
	public $onSessionEventsAvailable(handle: number, response: sqlops.ProfilerSessionEvents): void {
		this._proxy.$onSessionEventsAvailable(handle, response);
	}
}
