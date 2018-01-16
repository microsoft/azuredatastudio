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
	private _adapter = new Map<number, data.DataProtocolProvider>();

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

	private _runWithProvider<T>(handle: number, action: (p: data.DataProtocolProvider) => Thenable<T>): Thenable<T> {
		let provider = this._adapter.get(handle);
		return provider !== undefined
			? action(provider)
			: undefined;
	}


	$registerProvider(provider: data.DataProtocolProvider): vscode.Disposable {
		provider.handle = this._nextHandle();
		this._adapter.set(provider.handle, provider);

		this._proxy.$registerProvider(provider.providerId, provider.handle);
		return this._createDisposable(provider.handle);
	}

	// Capabilities Discovery handlers
	$getServerCapabilities(handle: number, client: data.DataProtocolClientCapabilities): Thenable<data.DataProtocolServerCapabilities> {
		return this._runWithProvider(handle, provider => {
			return provider.capabilitiesProvider ? provider.capabilitiesProvider.getServerCapabilities(client)
				: undefined;
		});
	}

	// Connection Management handlers
	$connect(handle: number, connectionUri: string, connection: data.ConnectionInfo): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.connectionProvider ? provider.connectionProvider.connect(connectionUri, connection)
				: undefined;
		});
	}

	$disconnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.connectionProvider ? provider.connectionProvider.disconnect(connectionUri)
				: undefined;
		});
	}

	$cancelConnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.connectionProvider ? provider.connectionProvider.cancelConnect(connectionUri)
				: undefined;
		});
	}

	$changeDatabase(handle: number, connectionUri: string, newDatabase: string): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.connectionProvider ? provider.connectionProvider.changeDatabase(connectionUri, newDatabase)
				: undefined;
		});
	}

	$listDatabases(handle: number, connectionUri: string): Thenable<data.ListDatabasesResult> {
		return this._runWithProvider(handle, provider => {
			return provider.connectionProvider ? provider.connectionProvider.listDatabases(connectionUri)
				: undefined;
		});
	}

	$rebuildIntelliSenseCache(handle: number, connectionUri: string): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.connectionProvider ? provider.connectionProvider.rebuildIntelliSenseCache(connectionUri)
				: undefined;
		});
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
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.cancelQuery(ownerUri);
		});
	}

	$runQuery(handle: number, ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.runQuery(ownerUri, selection, runOptions);
		});
	}

	$runQueryStatement(handle: number, ownerUri: string, line: number, column: number): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.runQueryStatement(ownerUri, line, column);
		});
	}

	$runQueryString(handle: number, ownerUri: string, queryString: string): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.runQueryString(ownerUri, queryString);
		});
	}

	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.runQueryAndReturn(ownerUri, queryString);
		});
	}

	$getQueryRows(handle: number, rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult> {
		return this._runWithProvider(handle, (provider) => {
			return provider.queryProvider.getQueryRows(rowData);
		});
	}

	$disposeQuery(handle: number, ownerUri: string): Thenable<void> {
		return this._runWithProvider(handle, (provider) => {
			return provider.queryProvider.disposeQuery(ownerUri);
		});
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
		return this._runWithProvider(handle, (provider) => {
			return provider.queryProvider.saveResults(requestParams);
		});
	}

	// Edit Data handlers
	$commitEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.commitEdit(ownerUri);
		});
	}

	$createRow(handle: number, ownerUri: string): Thenable<data.EditCreateRowResult> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.createRow(ownerUri);
		});
	}

	$deleteRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.deleteRow(ownerUri, rowId);
		});
	}

	$disposeEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.disposeEdit(ownerUri);
		});
	}

	$initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit);
		});
	}

	$revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.revertCell(ownerUri, rowId, columnId);
		});
	}

	$revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.revertRow(ownerUri, rowId);
		});
	}

	$updateCell(handle: number, ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<data.EditUpdateCellResult> {
		return this._runWithProvider(handle, provider => {
			return provider.queryProvider.updateCell(ownerUri, rowId, columnId, newValue);
		});
	}

	$getEditRows(handle: number, rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult> {
		return this._runWithProvider(handle, (provider) => {
			return provider.queryProvider.getEditRows(rowData);
		});
	}

	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._proxy.$onEditSessionReady(handle, ownerUri, success, message);
	}

	// Metadata handlers
	public $getMetadata(handle: number, connectionUri: string): Thenable<data.ProviderMetadata> {
		return this._runWithProvider(handle, provider => {
			return provider.metadataProvider ? provider.metadataProvider.getMetadata(connectionUri)
				: Promise.resolve(undefined);
		});
	}

	// Object Explorer Service
	public $createObjectExplorerSession(handle: number, connInfo: data.ConnectionInfo): Thenable<data.ObjectExplorerSessionResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.objectExplorerProvider ? provider.objectExplorerProvider.createNewSession(connInfo)
				: Promise.resolve(undefined);
		});
	}

	public $expandObjectExplorerNode(handle: number, nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.objectExplorerProvider ? provider.objectExplorerProvider.expandNode(nodeInfo)
				: Promise.resolve(undefined);
		});
	}

	public $refreshObjectExplorerNode(handle: number, nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.objectExplorerProvider ? provider.objectExplorerProvider.refreshNode(nodeInfo)
				: Promise.resolve(undefined);
		});
	}

	public $closeObjectExplorerSession(handle: number, closeSessionInfo: data.ObjectExplorerCloseSessionInfo): Thenable<data.ObjectExplorerCloseSessionResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.objectExplorerProvider ? provider.objectExplorerProvider.closeSession(closeSessionInfo)
				: Promise.resolve(undefined);
		});
	}

	public $onObjectExplorerSessionCreated(handle: number, response: data.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionCreated(handle, response);
	}

	public $onObjectExplorerNodeExpanded(handle: number, response: data.ObjectExplorerExpandInfo): void {
		this._proxy.$onObjectExplorerNodeExpanded(handle, response);
	}

	// Task Service
	public $getAllTasks(handle: number, listTasksParams: data.ListTasksParams): Thenable<data.ListTasksResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.taskServicesProvider ? provider.taskServicesProvider.getAllTasks(listTasksParams)
				: Promise.resolve(undefined);
		});
	}

	public $cancelTask(handle: number, cancelTaskParams: data.CancelTaskParams): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.taskServicesProvider ? provider.taskServicesProvider.cancelTask(cancelTaskParams)
				: Promise.resolve(undefined);
		});
	}

	public $onTaskStatusChanged(handle: number, response: data.TaskProgressInfo): void {
		this._proxy.$onTaskStatusChanged(handle, response);
	}

	public $onTaskCreated(handle: number, response: data.TaskInfo): void {
		this._proxy.$onTaskCreated(handle, response);
	}

	public $getDatabases(handle: number, connectionUri: string): Thenable<string[]> {
		return this._runWithProvider(handle, provider => {
			return provider.metadataProvider ? provider.metadataProvider.getDatabases(connectionUri)
				: Promise.resolve(undefined);
		});
	}

	public $getTableInfo(handle: number, connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
		return this._runWithProvider(handle, provider => {
			return provider.metadataProvider ? provider.metadataProvider.getTableInfo(connectionUri, metadata)
				: Promise.resolve(undefined);
		});
	}

	public $getViewInfo(handle: number, connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
		return this._runWithProvider(handle, provider => {
			return provider.metadataProvider ? provider.metadataProvider.getViewInfo(connectionUri, metadata)
				: Promise.resolve(undefined);
		});
	}

	// Scripting handlers

	public $scriptAsOperation(handle: number, connectionUri: string, operation: data.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): Thenable<data.ScriptingResult> {
		return this._runWithProvider(handle, provider => {
			return provider.scriptingProvider ? provider.scriptingProvider.scriptAsOperation(connectionUri, operation, metadata, paramDetails)
				: Promise.resolve(undefined);
		});
	}

	public $onScriptingComplete(handle: number, scriptingCompleteResult: data.ScriptingCompleteResult): void {
		this._proxy.$onScriptingComplete(handle, scriptingCompleteResult);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public $createDatabase(handle: number, connectionUri: string, database: data.DatabaseInfo): Thenable<data.CreateDatabaseResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.adminServicesProvider ? provider.adminServicesProvider.createDatabase(connectionUri, database)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Create a new database on the provided connection
	 */
	public $getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<data.DatabaseInfo> {
		return this._runWithProvider(handle, provider => {
			return provider.adminServicesProvider ? provider.adminServicesProvider.getDefaultDatabaseInfo(connectionUri)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Get the info on a database
	 */
	public $getDatabaseInfo(handle: number, connectionUri: string): Thenable<data.DatabaseInfo> {
		return this._runWithProvider(handle, provider => {
			return provider.adminServicesProvider ? provider.adminServicesProvider.getDatabaseInfo(connectionUri)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Create a new login on the provided connection
	 */
	public $createLogin(handle: number, connectionUri: string, login: data.LoginInfo): Thenable<data.CreateLoginResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.adminServicesProvider ? provider.adminServicesProvider.createLogin(connectionUri, login)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Backup a database
	 */
	public $backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: data.TaskExecutionMode): Thenable<data.BackupResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.disasterRecoveryProvider ? provider.disasterRecoveryProvider.backup(connectionUri, backupInfo, taskExecutionMode)
				: Promise.resolve(undefined);
		});
	}

	/**
	* Create a new database on the provided connection
	*/
	public $getBackupConfigInfo(handle: number, connectionUri: string): Thenable<data.BackupConfigInfo> {
		return this._runWithProvider(handle, provider => {
			return provider.disasterRecoveryProvider ? provider.disasterRecoveryProvider.getBackupConfigInfo(connectionUri)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Restores a database
	 */
	public $restore(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestoreResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.disasterRecoveryProvider ? provider.disasterRecoveryProvider.restore(connectionUri, restoreInfo)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Gets a plan for restoring a database
	 */
	public $getRestorePlan(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestorePlanResponse> {
		return this._runWithProvider(handle, provider => {
			return provider.disasterRecoveryProvider ? provider.disasterRecoveryProvider.getRestorePlan(connectionUri, restoreInfo)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * cancels a restore plan
	 */
	public $cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.disasterRecoveryProvider ? provider.disasterRecoveryProvider.cancelRestorePlan(connectionUri, restoreInfo)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Gets restore config Info
	 */
	public $getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<data.RestoreConfigInfo> {
		return this._runWithProvider(handle, provider => {
			return provider.disasterRecoveryProvider ? provider.disasterRecoveryProvider.getRestoreConfigInfo(connectionUri)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Open a file browser
	 */
	public $openFileBrowser(handle: number, ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
		return this._runWithProvider(handle, provider => {
			return provider.fileBrowserProvider ? provider.fileBrowserProvider.openFileBrowser(ownerUri, expandPath, fileFilters, changeFilter)
				: Promise.resolve(undefined);
		});
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
		return this._runWithProvider(handle, provider => {
			return provider.fileBrowserProvider ? provider.fileBrowserProvider.expandFolderNode(ownerUri, expandPath)
				: Promise.resolve(undefined);
		});
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
		return this._runWithProvider(handle, provider => {
			return provider.fileBrowserProvider ? provider.fileBrowserProvider.validateFilePaths(ownerUri, serviceType, selectedFiles)
				: Promise.resolve(undefined);
		});
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
		return this._runWithProvider(handle, provider => {
			return provider.fileBrowserProvider ? provider.fileBrowserProvider.closeFileBrowser(ownerUri)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Start a profiler session
	 */
	public $startSession(handle: number, sessionId: string): Thenable<boolean>  {
		return this._runWithProvider(handle, provider => {
			return provider.profilerProvider ? provider.profilerProvider.startSession(sessionId)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Stop a profiler session
	 */
	public $stopSession(handle: number, sessionId: string): Thenable<boolean>  {
		return this._runWithProvider(handle, provider => {
			return provider.profilerProvider ? provider.profilerProvider.stopSession(sessionId)
				: Promise.resolve(undefined);
		});
	}

	/**
	 * Profiler session events available notification
	 */
	public $onSessionEventsAvailable(handle: number, response: data.ProfilerSessionEvents): void {
		this._proxy.$onSessionEventsAvailable(handle, response);
	}
}
