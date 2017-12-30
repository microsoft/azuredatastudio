/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import Event, { Emitter } from 'vs/base/common/event';
import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { SqlMainContext, MainThreadDataProtocolShape, ExtHostDataProtocolShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as vscode from 'vscode';
import * as data from 'data';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';

export class ExtHostDataProtocol extends ExtHostDataProtocolShape {

	private readonly _onDidChangeLanguageFlavor = new Emitter<data.DidChangeLanguageFlavorParams>();

	readonly onDidChangeLanguageFlavor: Event<data.DidChangeLanguageFlavorParams> = this._onDidChangeLanguageFlavor.event;

	private _proxy: MainThreadDataProtocolShape;

	private static _handlePool: number = 0;
	private _adapter = new Map<number, data.DataProvider>();

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

	private _resolveProvider<P extends data.DataProvider>(handle: number): P {
		let provider = this._adapter.get(handle) as P;
		if (provider) {
			return provider;
		} else {
			throw new Error(`Unfound provider ${handle}`);
		}
	}

	private registerProvider(provider: data.DataProvider): vscode.Disposable {
		provider.handle = this._nextHandle();
		this._adapter.set(provider.handle, provider);
		return this._createDisposable(provider.handle);
	};

	$registerConnectionProvider(provider: data.ConnectionProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerConnectionProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerBackupProvider(provider: data.BackupProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerBackupProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerRestoreProvider(provider: data.RestoreProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerRestoreProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerScriptingProvider(provider: data.ScriptingProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerScriptingProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerQueryProvider(provider: data.QueryProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerQueryProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerMetadataProvider(provider: data.MetadataProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerMetadataProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerTaskServicesProvider(provider: data.TaskServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerTaskServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerFileBrowserProvider(provider: data.FileBrowserProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerFileBrowserProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerObjectExplorerProvider(provider: data.ObjectExplorerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerObjectExplorerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerProfilerProvider(provider: data.ProfilerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerProfilerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerAdminServicesProvider(provider: data.AdminServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerAdminServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerCapabilitiesServiceProvider(provider: data.CapabilitiesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider);
		this._proxy.$registerCapabilitiesServiceProvider(provider.providerId, provider.handle);
		return rt;
	}

	// Capabilities Discovery handlers
	$getServerCapabilities(handle: number, client: data.DataProtocolClientCapabilities): Thenable<data.DataProtocolServerCapabilities> {
		return this._resolveProvider<data.CapabilitiesProvider>(handle).getServerCapabilities(client);
	}

	// Connection Management handlers
	$connect(handle: number, connectionUri: string, connection: data.ConnectionInfo): Thenable<boolean> {
		return this._resolveProvider<data.ConnectionProvider>(handle).connect(connectionUri, connection);
	}

	$disconnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._resolveProvider<data.ConnectionProvider>(handle).disconnect(connectionUri);
	}

	$cancelConnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._resolveProvider<data.ConnectionProvider>(handle).cancelConnect(connectionUri);
	}

	$changeDatabase(handle: number, connectionUri: string, newDatabase: string): Thenable<boolean> {
		return this._resolveProvider<data.ConnectionProvider>(handle).changeDatabase(connectionUri, newDatabase);
	}

	$listDatabases(handle: number, connectionUri: string): Thenable<data.ListDatabasesResult> {
		return this._resolveProvider<data.ConnectionProvider>(handle).listDatabases(connectionUri);
	}

	$rebuildIntelliSenseCache(handle: number, connectionUri: string): Thenable<void> {
		return this._resolveProvider<data.ConnectionProvider>(handle).rebuildIntelliSenseCache(connectionUri);
	}

	$onConnectComplete(handle: number, connectionInfoSummary: data.ConnectionInfoSummary): void {
		this._proxy.$onConnectionComplete(handle, connectionInfoSummary);
	}

	public $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._proxy.$onIntelliSenseCacheComplete(handle, connectionUri);
	}

	public $onConnectionChanged(handle: number, changedConnInfo: data.ChangedConnectionInfo): void {
		this._proxy.$onConnectionChangeNotification(handle, changedConnInfo);
	}

	// Protocol-wide Event Handlers
	public $languageFlavorChanged(params: data.DidChangeLanguageFlavorParams): void {
		this._onDidChangeLanguageFlavor.fire(params);
	}

	// Query Management handlers

	$cancelQuery(handle: number, ownerUri: string): Thenable<data.QueryCancelResult> {
		return this._resolveProvider<data.QueryProvider>(handle).cancelQuery(ownerUri);
	}

	$runQuery(handle: number, ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).runQuery(ownerUri, selection, runOptions);
	}

	$runQueryStatement(handle: number, ownerUri: string, line: number, column: number): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).runQueryStatement(ownerUri, line, column);
	}

	$runQueryString(handle: number, ownerUri: string, queryString: string): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).runQueryString(ownerUri, queryString);
	}

	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult> {
		return this._resolveProvider<data.QueryProvider>(handle).runQueryAndReturn(ownerUri, queryString);
	}

	$getQueryRows(handle: number, rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult> {
		return this._resolveProvider<data.QueryProvider>(handle).getQueryRows(rowData);
	}

	$disposeQuery(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).disposeQuery(ownerUri);
	}

	$onQueryComplete(handle: number, result: data.QueryExecuteCompleteNotificationResult): void {
		this._proxy.$onQueryComplete(handle, result);
	}
	$onBatchStart(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void {
		this._proxy.$onBatchStart(handle, batchInfo);
	}
	$onBatchComplete(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void {
		this._proxy.$onBatchComplete(handle, batchInfo);
	}
	$onResultSetComplete(handle: number, resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams): void {
		this._proxy.$onResultSetComplete(handle, resultSetInfo);
	}
	$onQueryMessage(handle: number, message: data.QueryExecuteMessageParams): void {
		this._proxy.$onQueryMessage(handle, message);
	}

	$saveResults(handle: number, requestParams: data.SaveResultsRequestParams): Thenable<data.SaveResultRequestResult> {
		return this._resolveProvider<data.QueryProvider>(handle).saveResults(requestParams);
	}

	// Edit Data handlers
	$commitEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).commitEdit(ownerUri);
	}

	$createRow(handle: number, ownerUri: string): Thenable<data.EditCreateRowResult> {
		return this._resolveProvider<data.QueryProvider>(handle).createRow(ownerUri);
	}

	$deleteRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).deleteRow(ownerUri, rowId);
	}

	$disposeEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).disposeEdit(ownerUri);
	}

	$initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit);
	}

	$revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult> {
		return this._resolveProvider<data.QueryProvider>(handle).revertCell(ownerUri, rowId, columnId);
	}

	$revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._resolveProvider<data.QueryProvider>(handle).revertRow(ownerUri, rowId);
	}

	$updateCell(handle: number, ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<data.EditUpdateCellResult> {
		return this._resolveProvider<data.QueryProvider>(handle).updateCell(ownerUri, rowId, columnId, newValue);
	}

	$getEditRows(handle: number, rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult> {
		return this._resolveProvider<data.QueryProvider>(handle).getEditRows(rowData);
	}

	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._proxy.$onEditSessionReady(handle, ownerUri, success, message);
	}

	// Metadata handlers
	public $getMetadata(handle: number, connectionUri: string): Thenable<data.ProviderMetadata> {
		return this._resolveProvider<data.MetadataProvider>(handle).getMetadata(connectionUri);
	}

	public $getDatabases(handle: number, connectionUri: string): Thenable<string[]> {
		return this._resolveProvider<data.MetadataProvider>(handle).getDatabases(connectionUri);
	}

	public $getTableInfo(handle: number, connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
		return this._resolveProvider<data.MetadataProvider>(handle).getTableInfo(connectionUri, metadata);
	}

	public $getViewInfo(handle: number, connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
		return this._resolveProvider<data.MetadataProvider>(handle).getViewInfo(connectionUri, metadata);
	}

	// Object Explorer Service
	public $createObjectExplorerSession(handle: number, connInfo: data.ConnectionInfo): Thenable<data.ObjectExplorerSessionResponse> {
		return this._resolveProvider<data.ObjectExplorerProvider>(handle).createNewSession(connInfo);
	}

	public $expandObjectExplorerNode(handle: number, nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<data.ObjectExplorerProvider>(handle).expandNode(nodeInfo);
	}

	public $refreshObjectExplorerNode(handle: number, nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<data.ObjectExplorerProvider>(handle).refreshNode(nodeInfo);
	}

	public $closeObjectExplorerSession(handle: number, closeSessionInfo: data.ObjectExplorerCloseSessionInfo): Thenable<data.ObjectExplorerCloseSessionResponse> {
		return this._resolveProvider<data.ObjectExplorerProvider>(handle).closeSession(closeSessionInfo);
	}

	public $onObjectExplorerSessionCreated(handle: number, response: data.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionCreated(handle, response);
	}

	public $onObjectExplorerNodeExpanded(handle: number, response: data.ObjectExplorerExpandInfo): void {
		this._proxy.$onObjectExplorerNodeExpanded(handle, response);
	}

	// Task Service
	public $getAllTasks(handle: number, listTasksParams: data.ListTasksParams): Thenable<data.ListTasksResponse> {
		return this._resolveProvider<data.TaskServicesProvider>(handle).getAllTasks(listTasksParams);
	}

	public $cancelTask(handle: number, cancelTaskParams: data.CancelTaskParams): Thenable<boolean> {
		return this._resolveProvider<data.TaskServicesProvider>(handle).cancelTask(cancelTaskParams);
	}

	public $onTaskStatusChanged(handle: number, response: data.TaskProgressInfo): void {
		this._proxy.$onTaskStatusChanged(handle, response);
	}

	public $onTaskCreated(handle: number, response: data.TaskInfo): void {
		this._proxy.$onTaskCreated(handle, response);
	}

	// Scripting handlers

	public $scriptAsOperation(handle: number, connectionUri: string, operation: data.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): Thenable<data.ScriptingResult> {
		return this._resolveProvider<data.ScriptingProvider>(handle).scriptAsOperation(connectionUri, operation, metadata, paramDetails);
	}

	public $onScriptingComplete(handle: number, scriptingCompleteResult: data.ScriptingCompleteResult): void {
		this._proxy.$onScriptingComplete(handle, scriptingCompleteResult);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public $createDatabase(handle: number, connectionUri: string, database: data.DatabaseInfo): Thenable<data.CreateDatabaseResponse> {
		return this._resolveProvider<data.AdminServicesProvider>(handle).createDatabase(connectionUri, database);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public $getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<data.DatabaseInfo> {
		return this._resolveProvider<data.AdminServicesProvider>(handle).getDefaultDatabaseInfo(connectionUri);
	}

	/**
	 * Get the info on a database
	 */
	public $getDatabaseInfo(handle: number, connectionUri: string): Thenable<data.DatabaseInfo> {
		return this._resolveProvider<data.AdminServicesProvider>(handle).getDatabaseInfo(connectionUri);
	}

	/**
	 * Create a new login on the provided connection
	 */
	public $createLogin(handle: number, connectionUri: string, login: data.LoginInfo): Thenable<data.CreateLoginResponse> {
		return this._resolveProvider<data.AdminServicesProvider>(handle).createLogin(connectionUri, login);
	}

	/**
	 * Backup a database
	 */
	public $backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: data.TaskExecutionMode): Thenable<data.BackupResponse> {
		return this._resolveProvider<data.BackupProvider>(handle).backup(connectionUri, backupInfo, taskExecutionMode);
	}

	/**
	* Create a new database on the provided connection
	*/
	public $getBackupConfigInfo(handle: number, connectionUri: string): Thenable<data.BackupConfigInfo> {
		return this._resolveProvider<data.BackupProvider>(handle).getBackupConfigInfo(connectionUri);
	}

	/**
	 * Restores a database
	 */
	public $restore(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestoreResponse> {
		return this._resolveProvider<data.RestoreProvider>(handle).restore(connectionUri, restoreInfo);
	}

	/**
	 * Gets a plan for restoring a database
	 */
	public $getRestorePlan(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestorePlanResponse> {
		return this._resolveProvider<data.RestoreProvider>(handle).getRestorePlan(connectionUri, restoreInfo);
	}

	/**
	 * cancels a restore plan
	 */
	public $cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<boolean> {
		return this._resolveProvider<data.RestoreProvider>(handle).cancelRestorePlan(connectionUri, restoreInfo);
	}

	/**
	 * Gets restore config Info
	 */
	public $getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<data.RestoreConfigInfo> {
		return this._resolveProvider<data.RestoreProvider>(handle).getRestoreConfigInfo(connectionUri);
	}

	/**
	 * Open a file browser
	 */
	public $openFileBrowser(handle: number, ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
		return this._resolveProvider<data.FileBrowserProvider>(handle).openFileBrowser(ownerUri, expandPath, fileFilters, changeFilter);
	}

	/**
	 * Send event when opening browser is complete
	 */
	public $onFileBrowserOpened(handle: number, response: data.FileBrowserOpenedParams): void {
		this._proxy.$onFileBrowserOpened(handle, response);
	}

	/**
	 * Expand a folder node
	 */
	public $expandFolderNode(handle: number, ownerUri: string, expandPath: string): Thenable<boolean> {
		return this._resolveProvider<data.FileBrowserProvider>(handle).expandFolderNode(ownerUri, expandPath);
	}

	/**
	 * Send event when expansion is complete
	 */
	public $onFolderNodeExpanded(handle: number, response: data.FileBrowserExpandedParams): void {
		this._proxy.$onFolderNodeExpanded(handle, response);
	}

	/**
	 * Validate selected file path
	 */
	public $validateFilePaths(handle: number, ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> {
		return this._resolveProvider<data.FileBrowserProvider>(handle).validateFilePaths(ownerUri, serviceType, selectedFiles);
	}

	/**
	 * Send event when validation is complete
	 */
	public $onFilePathsValidated(handle: number, response: data.FileBrowserValidatedParams) {
		this._proxy.$onFilePathsValidated(handle, response);
	}

	/**
	 * Close file browser
	 */
	public $closeFileBrowser(handle: number, ownerUri: string): Thenable<data.FileBrowserCloseResponse> {
		return this._resolveProvider<data.FileBrowserProvider>(handle).closeFileBrowser(ownerUri);
	}

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Start a profiler session
	 */
	public $startSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<data.ProfilerProvider>(handle).startSession(sessionId);
	}

	/**
	 * Stop a profiler session
	 */
	public $stopSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<data.ProfilerProvider>(handle).stopSession(sessionId);
	}

	/**
	 * Profiler session events available notification
	 */
	public $onSessionEventsAvailable(handle: number, response: data.ProfilerSessionEvents): void {
		this._proxy.$onSessionEventsAvailable(handle, response);
	}
}
