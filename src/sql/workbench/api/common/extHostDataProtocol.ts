/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { Event, Emitter } from 'vs/base/common/event';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';
import { SqlMainContext, MainThreadDataProtocolShape, ExtHostDataProtocolShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { DataProviderType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { URI, UriComponents } from 'vs/base/common/uri';
import { RunOnceScheduler } from 'vs/base/common/async';
import { mapToSerializable } from 'sql/base/common/map';

export class ExtHostDataProtocol extends ExtHostDataProtocolShape {

	private readonly _onDidChangeLanguageFlavor = new Emitter<azdata.DidChangeLanguageFlavorParams>();

	readonly onDidChangeLanguageFlavor: Event<azdata.DidChangeLanguageFlavorParams> = this._onDidChangeLanguageFlavor.event;

	private _proxy: MainThreadDataProtocolShape;

	private static _handlePool: number = 0;
	private _adapter = new Map<number, azdata.DataProvider>();
	private _providersByType = new Map<azdata.DataProviderType, azdata.DataProvider[]>();

	private readonly messageRunner = new RunOnceScheduler(() => this.sendMessages(), 1000);
	private readonly queuedMessages = new Map<string, azdata.QueryExecuteMessageParams[]>();

	constructor(
		mainContext: IMainContext,
		private uriTransformer: IURITransformer | null
	) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadDataProtocol);
	}

	private _getTransformedUri(uri: string, transformMethod: (uri: UriComponents) => UriComponents): string {
		let encodedUri = URI.parse(encodeURI(uri));
		return URI.from(transformMethod(encodedUri)).toString(true);
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

	private _resolveProvider<P extends azdata.DataProvider>(handle: number): P {
		let provider = this._adapter.get(handle) as P;
		if (provider) {
			return provider;
		} else {
			throw new Error(`Unfound provider ${handle}`);
		}
	}

	private registerProvider(provider: azdata.DataProvider, providerType: DataProviderType): vscode.Disposable {
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

	public getProvider<T extends azdata.DataProvider>(providerId: string, providerType: azdata.DataProviderType): T {
		let providersForType = this._providersByType.get(providerType);
		if (!providersForType) {
			return undefined;
		}
		return providersForType.find(provider => provider.providerId === providerId) as T;
	}

	public getProvidersByType<T extends azdata.DataProvider>(providerType: azdata.DataProviderType): T[] {
		let providersForType = this._providersByType.get(providerType);
		return (providersForType || []) as T[];
	}

	$registerConnectionProvider(provider: azdata.ConnectionProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ConnectionProvider);
		this._proxy.$registerConnectionProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerBackupProvider(provider: azdata.BackupProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.BackupProvider);
		this._proxy.$registerBackupProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerRestoreProvider(provider: azdata.RestoreProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.RestoreProvider);
		this._proxy.$registerRestoreProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerScriptingProvider(provider: azdata.ScriptingProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ScriptingProvider);
		this._proxy.$registerScriptingProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerQueryProvider(provider: azdata.QueryProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.QueryProvider);
		this._proxy.$registerQueryProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerMetadataProvider(provider: azdata.MetadataProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.MetadataProvider);
		this._proxy.$registerMetadataProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerTaskServicesProvider(provider: azdata.TaskServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.TaskServicesProvider);
		this._proxy.$registerTaskServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerFileBrowserProvider(provider: azdata.FileBrowserProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.FileBrowserProvider);
		this._proxy.$registerFileBrowserProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerObjectExplorerProvider(provider: azdata.ObjectExplorerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ObjectExplorerProvider);
		this._proxy.$registerObjectExplorerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerObjectExplorerNodeProvider(provider: azdata.ObjectExplorerNodeProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ObjectExplorerNodeProvider);
		this._proxy.$registerObjectExplorerNodeProvider(provider.providerId, provider.supportedProviderId, provider.group, provider.handle);
		return rt;
	}

	$registerIconProvider(provider: azdata.IconProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.IconProvider);
		this._proxy.$registerIconProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerProfilerProvider(provider: azdata.ProfilerProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.ProfilerProvider);
		this._proxy.$registerProfilerProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerAdminServicesProvider(provider: azdata.AdminServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.AdminServicesProvider);
		this._proxy.$registerAdminServicesProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerAgentServiceProvider(provider: azdata.AgentServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.AgentServicesProvider);
		this._proxy.$registerAgentServicesProvider(provider.providerId, provider.handle);
		return rt;
	}
	$registerSqlAssessmentServiceProvider(provider: azdata.SqlAssessmentServicesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.SqlAssessmentServicesProvider);
		this._proxy.$registerSqlAssessmentServicesProvider(provider.providerId, provider.handle);
		return rt;
	}
	$registerDataGridProvider(provider: azdata.DataGridProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.DataGridProvider);
		this._proxy.$registerDataGridProvider(provider.providerId, provider.title, provider.handle);
		return rt;
	}
	$registerCapabilitiesServiceProvider(provider: azdata.CapabilitiesProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.CapabilitiesProvider);
		this._proxy.$registerCapabilitiesServiceProvider(provider.providerId, provider.handle);
		return rt;
	}

	$registerSerializationProvider(provider: azdata.SerializationProvider): vscode.Disposable {
		let rt = this.registerProvider(provider, DataProviderType.QueryProvider);
		this._proxy.$registerSerializationProvider(provider.providerId, provider.handle);
		return rt;
	}

	// Capabilities Discovery handlers
	override $getServerCapabilities(handle: number, client: azdata.DataProtocolClientCapabilities): Thenable<azdata.DataProtocolServerCapabilities> {
		return this._resolveProvider<azdata.CapabilitiesProvider>(handle).getServerCapabilities(client);
	}

	// Connection Management handlers
	override $connect(handle: number, connectionUri: string, connection: azdata.ConnectionInfo): Thenable<boolean> {
		if (this.uriTransformer) {
			connectionUri = this._getTransformedUri(connectionUri, this.uriTransformer.transformIncoming);
		}
		return this._resolveProvider<azdata.ConnectionProvider>(handle).connect(connectionUri, connection);
	}

	override $disconnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ConnectionProvider>(handle).disconnect(connectionUri);
	}

	override $cancelConnect(handle: number, connectionUri: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ConnectionProvider>(handle).cancelConnect(connectionUri);
	}

	override $changeDatabase(handle: number, connectionUri: string, newDatabase: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ConnectionProvider>(handle).changeDatabase(connectionUri, newDatabase);
	}

	override $listDatabases(handle: number, connectionUri: string): Thenable<azdata.ListDatabasesResult> {
		return this._resolveProvider<azdata.ConnectionProvider>(handle).listDatabases(connectionUri);
	}

	override $getConnectionString(handle: number, connectionUri: string, includePassword: boolean): Thenable<string> {
		return this._resolveProvider<azdata.ConnectionProvider>(handle).getConnectionString(connectionUri, includePassword);
	}

	override $buildConnectionInfo(handle: number, connectionString: string): Thenable<azdata.ConnectionInfo> {
		let provider = this._resolveProvider<azdata.ConnectionProvider>(handle);
		if (provider.buildConnectionInfo) {
			return provider.buildConnectionInfo(connectionString);
		} else {
			return Promise.resolve(undefined);
		}
	}

	override $rebuildIntelliSenseCache(handle: number, connectionUri: string): Thenable<void> {
		return this._resolveProvider<azdata.ConnectionProvider>(handle).rebuildIntelliSenseCache(connectionUri);
	}

	override $onConnectComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void {
		if (this.uriTransformer) {
			connectionInfoSummary.ownerUri = this._getTransformedUri(connectionInfoSummary.ownerUri, this.uriTransformer.transformOutgoing);
		}
		this._proxy.$onConnectionComplete(handle, connectionInfoSummary);
	}

	public override $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._proxy.$onIntelliSenseCacheComplete(handle, connectionUri);
	}

	public $onConnectionChanged(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void {
		this._proxy.$onConnectionChangeNotification(handle, changedConnInfo);
	}

	// Protocol-wide Event Handlers
	public override $languageFlavorChanged(params: azdata.DidChangeLanguageFlavorParams): void {
		this._onDidChangeLanguageFlavor.fire(params);
	}

	// Query Management handlers

	override $cancelQuery(handle: number, ownerUri: string): Thenable<azdata.QueryCancelResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).cancelQuery(ownerUri);
	}

	override $runQuery(handle: number, ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
		if (this.uriTransformer) {
			ownerUri = this._getTransformedUri(ownerUri, this.uriTransformer.transformIncoming);
		}

		return this._resolveProvider<azdata.QueryProvider>(handle).runQuery(ownerUri, selection, runOptions);
	}

	override $runQueryStatement(handle: number, ownerUri: string, line: number, column: number): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).runQueryStatement(ownerUri, line, column);
	}

	override $runQueryString(handle: number, ownerUri: string, queryString: string): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).runQueryString(ownerUri, queryString);
	}

	override $runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).runQueryAndReturn(ownerUri, queryString);
	}

	override $setQueryExecutionOptions(handle: number, ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		if (this._resolveProvider<azdata.QueryProvider>(handle).setQueryExecutionOptions) {
			return this._resolveProvider<azdata.QueryProvider>(handle).setQueryExecutionOptions(ownerUri, options);
		} else {
			return new Promise((r) => r());
		}
	}

	override $connectWithProfile(handle: number, ownerUri: string, profile: azdata.connection.ConnectionProfile): Thenable<void> {
		return new Promise((r) => r());
	}

	override $parseSyntax(handle: number, ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).parseSyntax(ownerUri, query);
	}

	override $getQueryRows(handle: number, rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> {
		if (this.uriTransformer) {
			rowData.ownerUri = this._getTransformedUri(rowData.ownerUri, this.uriTransformer.transformIncoming);
		}
		return this._resolveProvider<azdata.QueryProvider>(handle).getQueryRows(rowData);
	}

	override $disposeQuery(handle: number, ownerUri: string): Thenable<void> {
		if (this.uriTransformer) {
			ownerUri = this._getTransformedUri(ownerUri, this.uriTransformer.transformOutgoing);
		}
		return this._resolveProvider<azdata.QueryProvider>(handle).disposeQuery(ownerUri);
	}

	override $notifyConnectionUriChanged(handle: number, newUri: string, oldUri: string): Thenable<void> {
		if (this.uriTransformer) {
			newUri = this._getTransformedUri(newUri, this.uriTransformer.transformOutgoing);
			oldUri = this._getTransformedUri(oldUri, this.uriTransformer.transformOutgoing);
		}
		return this._resolveProvider<azdata.QueryProvider>(handle).notifyConnectionUriChanged(newUri, oldUri);
	}

	override $onQueryComplete(handle: number, result: azdata.QueryExecuteCompleteNotificationResult): void {
		if (this.uriTransformer) {
			result.ownerUri = this._getTransformedUri(result.ownerUri, this.uriTransformer.transformOutgoing);
		}
		// clear messages to maintain the order of things
		if (this.messageRunner.isScheduled()) {
			this.messageRunner.cancel();
			this.sendMessages();
		}
		this._proxy.$onQueryComplete(handle, result);
	}

	override $onBatchStart(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		if (this.uriTransformer) {
			batchInfo.ownerUri = this._getTransformedUri(batchInfo.ownerUri, this.uriTransformer.transformOutgoing);
		}
		this._proxy.$onBatchStart(handle, batchInfo);
	}

	override $onBatchComplete(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		if (this.uriTransformer) {
			batchInfo.ownerUri = this._getTransformedUri(batchInfo.ownerUri, this.uriTransformer.transformOutgoing);
		}
		this.messageRunner.cancel(); // clear batch messages before saying we completed the batch
		this.sendMessages();
		this._proxy.$onBatchComplete(handle, batchInfo);
	}

	override $onResultSetAvailable(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		if (this.uriTransformer) {
			resultSetInfo.ownerUri = this._getTransformedUri(resultSetInfo.ownerUri, this.uriTransformer.transformOutgoing);
		}
		this._proxy.$onResultSetAvailable(handle, resultSetInfo);
	}
	$onResultSetUpdated(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		if (this.uriTransformer) {
			resultSetInfo.ownerUri = this._getTransformedUri(resultSetInfo.ownerUri, this.uriTransformer.transformOutgoing);
		}
		this._proxy.$onResultSetUpdated(handle, resultSetInfo);
	}
	override $onQueryMessage(message: azdata.QueryExecuteMessageParams): void {
		if (this.uriTransformer) {
			message.ownerUri = this._getTransformedUri(message.ownerUri, this.uriTransformer.transformOutgoing);
		}
		if (!this.queuedMessages.has(message.ownerUri)) {
			this.queuedMessages.set(message.ownerUri, []);
		}
		this.queuedMessages.get(message.ownerUri).push(message);
		if (!this.messageRunner.isScheduled()) {
			this.messageRunner.schedule();
		}
	}

	private sendMessages() {
		const messages = mapToSerializable(this.queuedMessages);
		this.queuedMessages.clear();
		this._proxy.$onQueryMessage(messages);
	}

	override $saveResults(handle: number, requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).saveResults(requestParams);
	}

	// Edit Data handlers
	override $commitEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).commitEdit(ownerUri);
	}

	override $createRow(handle: number, ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).createRow(ownerUri);
	}

	override $deleteRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).deleteRow(ownerUri, rowId);
	}

	override $disposeEdit(handle: number, ownerUri: string): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).disposeEdit(ownerUri);
	}

	override $initializeEdit(handle: number, ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).initializeEdit(ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
	}

	override $revertCell(handle: number, ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).revertCell(ownerUri, rowId, columnId);
	}

	override $revertRow(handle: number, ownerUri: string, rowId: number): Thenable<void> {
		return this._resolveProvider<azdata.QueryProvider>(handle).revertRow(ownerUri, rowId);
	}

	override $updateCell(handle: number, ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).updateCell(ownerUri, rowId, columnId, newValue);
	}

	override $getEditRows(handle: number, rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> {
		return this._resolveProvider<azdata.QueryProvider>(handle).getEditRows(rowData);
	}

	$onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._proxy.$onEditSessionReady(handle, ownerUri, success, message);
	}

	public override $getConnectionIconId(handle: number, connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string> {
		return this._resolveProvider<azdata.IconProvider>(handle).getConnectionIconId(connection, serverInfo);
	}

	// Metadata handlers
	public override $getMetadata(handle: number, connectionUri: string): Thenable<azdata.ProviderMetadata> {
		return this._resolveProvider<azdata.MetadataProvider>(handle).getMetadata(connectionUri);
	}

	public override $getDatabases(handle: number, connectionUri: string): Thenable<string[] | azdata.DatabaseInfo[]> {
		return this._resolveProvider<azdata.MetadataProvider>(handle).getDatabases(connectionUri);
	}

	public override $getTableInfo(handle: number, connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[]> {
		return this._resolveProvider<azdata.MetadataProvider>(handle).getTableInfo(connectionUri, metadata);
	}

	public override $getViewInfo(handle: number, connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[]> {
		return this._resolveProvider<azdata.MetadataProvider>(handle).getViewInfo(connectionUri, metadata);
	}

	// Object Explorer Service
	public override $createObjectExplorerSession(handle: number, connInfo: azdata.ConnectionInfo): Thenable<azdata.ObjectExplorerSessionResponse> {
		return this._resolveProvider<azdata.ObjectExplorerProvider>(handle).createNewSession(connInfo);
	}

	public override $createObjectExplorerNodeProviderSession(handle: number, session: azdata.ObjectExplorerSession): Thenable<boolean> {
		return this._resolveProvider<azdata.ObjectExplorerNodeProvider>(handle).handleSessionOpen(session);
	}

	public override $expandObjectExplorerNode(handle: number, nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<azdata.ObjectExplorerProviderBase>(handle).expandNode(nodeInfo);
	}

	public override $refreshObjectExplorerNode(handle: number, nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
		return this._resolveProvider<azdata.ObjectExplorerProviderBase>(handle).refreshNode(nodeInfo);
	}

	public override $closeObjectExplorerSession(handle: number, closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): Thenable<azdata.ObjectExplorerCloseSessionResponse> {
		return this._resolveProvider<azdata.ObjectExplorerProvider>(handle).closeSession(closeSessionInfo);
	}

	public override $handleSessionClose(handle: number, closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): void {
		return this._resolveProvider<azdata.ObjectExplorerNodeProvider>(handle).handleSessionClose(closeSessionInfo);
	}

	public override $findNodes(handle: number, findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
		return this._resolveProvider<azdata.ObjectExplorerProviderBase>(handle).findNodes(findNodesInfo);
	}

	public $onObjectExplorerSessionCreated(handle: number, response: azdata.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionCreated(handle, response);
	}

	public $onObjectExplorerSessionDisconnected(handle: number, response: azdata.ObjectExplorerSession): void {
		this._proxy.$onObjectExplorerSessionDisconnected(handle, response);
	}

	public $onObjectExplorerNodeExpanded(providerId: string, response: azdata.ObjectExplorerExpandInfo): void {
		this._proxy.$onObjectExplorerNodeExpanded(providerId, response);
	}

	// Task Service
	public override $getAllTasks(handle: number, listTasksParams: azdata.ListTasksParams): Thenable<azdata.ListTasksResponse> {
		return this._resolveProvider<azdata.TaskServicesProvider>(handle).getAllTasks(listTasksParams);
	}

	public override $cancelTask(handle: number, cancelTaskParams: azdata.CancelTaskParams): Thenable<boolean> {
		return this._resolveProvider<azdata.TaskServicesProvider>(handle).cancelTask(cancelTaskParams);
	}

	public $onTaskStatusChanged(handle: number, response: azdata.TaskProgressInfo): void {
		this._proxy.$onTaskStatusChanged(handle, response);
	}

	public $onTaskCreated(handle: number, response: azdata.TaskInfo): void {
		this._proxy.$onTaskCreated(handle, response);
	}

	// Scripting handlers

	public override $scriptAsOperation(handle: number, connectionUri: string, operation: azdata.ScriptOperation, metadata: azdata.ObjectMetadata, paramDetails: azdata.ScriptingParamDetails): Thenable<azdata.ScriptingResult> {
		return this._resolveProvider<azdata.ScriptingProvider>(handle).scriptAsOperation(connectionUri, operation, metadata, paramDetails);
	}

	public $onScriptingComplete(handle: number, scriptingCompleteResult: azdata.ScriptingCompleteResult): void {
		this._proxy.$onScriptingComplete(handle, scriptingCompleteResult);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public override $createDatabase(handle: number, connectionUri: string, database: azdata.DatabaseInfo): Thenable<azdata.CreateDatabaseResponse> {
		return this._resolveProvider<azdata.AdminServicesProvider>(handle).createDatabase(connectionUri, database);
	}

	/**
	 * Create a new database on the provided connection
	 */
	public override $getDefaultDatabaseInfo(handle: number, connectionUri: string): Thenable<azdata.DatabaseInfo> {
		return this._resolveProvider<azdata.AdminServicesProvider>(handle).getDefaultDatabaseInfo(connectionUri);
	}

	/**
	 * Get the info on a database
	 */
	public override $getDatabaseInfo(handle: number, connectionUri: string): Thenable<azdata.DatabaseInfo> {
		return this._resolveProvider<azdata.AdminServicesProvider>(handle).getDatabaseInfo(connectionUri);
	}

	/**
	 * Create a new login on the provided connection
	 */
	public override $createLogin(handle: number, connectionUri: string, login: azdata.LoginInfo): Thenable<azdata.CreateLoginResponse> {
		return this._resolveProvider<azdata.AdminServicesProvider>(handle).createLogin(connectionUri, login);
	}

	/**
	 * Backup a database
	 */
	public override $backup(handle: number, connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.BackupResponse> {
		return this._resolveProvider<azdata.BackupProvider>(handle).backup(connectionUri, backupInfo, taskExecutionMode);
	}

	/**
	* Create a new database on the provided connection
	*/
	public override $getBackupConfigInfo(handle: number, connectionUri: string): Thenable<azdata.BackupConfigInfo> {
		return this._resolveProvider<azdata.BackupProvider>(handle).getBackupConfigInfo(connectionUri);
	}

	/**
	 * Restores a database
	 */
	public override $restore(handle: number, connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestoreResponse> {
		return this._resolveProvider<azdata.RestoreProvider>(handle).restore(connectionUri, restoreInfo);
	}

	/**
	 * Gets a plan for restoring a database
	 */
	public override $getRestorePlan(handle: number, connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestorePlanResponse> {
		return this._resolveProvider<azdata.RestoreProvider>(handle).getRestorePlan(connectionUri, restoreInfo);
	}

	/**
	 * cancels a restore plan
	 */
	public override $cancelRestorePlan(handle: number, connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<boolean> {
		return this._resolveProvider<azdata.RestoreProvider>(handle).cancelRestorePlan(connectionUri, restoreInfo);
	}

	/**
	 * Gets restore config Info
	 */
	public override $getRestoreConfigInfo(handle: number, connectionUri: string): Thenable<azdata.RestoreConfigInfo> {
		return this._resolveProvider<azdata.RestoreProvider>(handle).getRestoreConfigInfo(connectionUri);
	}

	/**
	 * Open a file browser
	 */
	public override $openFileBrowser(handle: number, ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
		return this._resolveProvider<azdata.FileBrowserProvider>(handle).openFileBrowser(ownerUri, expandPath, fileFilters, changeFilter);
	}

	/**
	 * Send event when opening browser is complete
	 */
	public $onFileBrowserOpened(handle: number, response: azdata.FileBrowserOpenedParams): void {
		this._proxy.$onFileBrowserOpened(handle, response);
	}

	/**
	 * Expand a folder node
	 */
	public override $expandFolderNode(handle: number, ownerUri: string, expandPath: string): Thenable<boolean> {
		return this._resolveProvider<azdata.FileBrowserProvider>(handle).expandFolderNode(ownerUri, expandPath);
	}

	/**
	 * Send event when expansion is complete
	 */
	public $onFolderNodeExpanded(handle: number, response: azdata.FileBrowserExpandedParams): void {
		this._proxy.$onFolderNodeExpanded(handle, response);
	}

	/**
	 * Validate selected file path
	 */
	public override $validateFilePaths(handle: number, ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> {
		return this._resolveProvider<azdata.FileBrowserProvider>(handle).validateFilePaths(ownerUri, serviceType, selectedFiles);
	}

	/**
	 * Send event when validation is complete
	 */
	public $onFilePathsValidated(handle: number, response: azdata.FileBrowserValidatedParams) {
		this._proxy.$onFilePathsValidated(handle, response);
	}

	/**
	 * Close file browser
	 */
	public override $closeFileBrowser(handle: number, ownerUri: string): Thenable<azdata.FileBrowserCloseResponse> {
		return this._resolveProvider<azdata.FileBrowserProvider>(handle).closeFileBrowser(ownerUri);
	}

	/**
	 * Profiler Provider methods
	 */

	/**
	 * Create a new profiler session
	 */
	public override $createSession(handle: number, sessionId: string, createStatement: string, template: azdata.ProfilerSessionTemplate): Thenable<boolean> {
		return this._resolveProvider<azdata.ProfilerProvider>(handle).createSession(sessionId, createStatement, template);
	}

	/**
	 * Start a profiler session
	 */
	public override $startSession(handle: number, sessionId: string, sessionName: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ProfilerProvider>(handle).startSession(sessionId, sessionName);
	}

	/**
	 * Stop a profiler session
	 */
	public override $stopSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ProfilerProvider>(handle).stopSession(sessionId);
	}

	/**
	 * Pause a profiler session
	 */
	public override $pauseSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ProfilerProvider>(handle).pauseSession(sessionId);
	}

	/**
	 * Disconnect a profiler session
	 */
	public override $disconnectSession(handle: number, sessionId: string): Thenable<boolean> {
		return this._resolveProvider<azdata.ProfilerProvider>(handle).disconnectSession(sessionId);
	}

	/**
	 * Get list of running XEvent sessions on the session's target server
	 */
	public override $getXEventSessions(handle: number, sessionId: string): Thenable<string[]> {
		return this._resolveProvider<azdata.ProfilerProvider>(handle).getXEventSessions(sessionId);
	}

	/**
	 * Profiler session events available notification
	 */
	public $onSessionEventsAvailable(handle: number, response: azdata.ProfilerSessionEvents): void {
		this._proxy.$onSessionEventsAvailable(handle, response);
	}

	/**
	 * Profiler session stopped unexpectedly notification
	 */
	public $onSessionStopped(handle: number, response: azdata.ProfilerSessionStoppedParams): void {
		this._proxy.$onSessionStopped(handle, response);
	}

	/**
	 * Profiler session created notification
	 */
	public $onProfilerSessionCreated(handle: number, response: azdata.ProfilerSessionCreatedParams): void {
		this._proxy.$onProfilerSessionCreated(handle, response);
	}


	/**
	 * Agent Job Provider methods
	 */

	/**
	 * Get Agent Job list
	 */
	public override $getJobs(handle: number, ownerUri: string): Thenable<azdata.AgentJobsResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getJobs(ownerUri);
	}

	/**
	 * Get a Agent Job's history
	 */
	public override $getJobHistory(handle: number, ownerUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getJobHistory(ownerUri, jobID, jobName);
	}

	/**
	 * Run an action on a job
	 */
	public override $jobAction(handle: number, ownerUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).jobAction(ownerUri, jobName, action);
	}

	/**
	 * Deletes a job
	 */
	override $deleteJob(handle: number, ownerUri: string, job: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteJob(ownerUri, job);
	}

	/**
	 * Deletes a job step
	 */
	override $deleteJobStep(handle: number, ownerUri: string, step: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteJobStep(ownerUri, step);
	}

	/**
	 * Get Agent Alerts list
	 */
	override $getAlerts(handle: number, ownerUri: string): Thenable<azdata.AgentAlertsResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getAlerts(ownerUri);
	}

	/**
	 * Deletes an alert
	 */
	override $deleteAlert(handle: number, ownerUri: string, alert: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteAlert(ownerUri, alert);
	}

	/**
	 * Get Agent Notebook list
	 */
	public override $getNotebooks(handle: number, ownerUri: string): Thenable<azdata.AgentNotebooksResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getNotebooks(ownerUri);
	}

	/**
	 * Get a Agent Notebook's history
	 */
	public override $getNotebookHistory(handle: number, ownerUri: string, jobID: string, jobName: string, targetDatabase: string): Thenable<azdata.AgentNotebookHistoryResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getNotebookHistory(ownerUri, jobID, jobName, targetDatabase);
	}

	/**
	 * Get a Agent Materialized Notebook
	 */
	public override $getMaterializedNotebook(handle: number, ownerUri: string, targetDatabase: string, notebookMaterializedId: number): Thenable<azdata.AgentNotebookMaterializedResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getMaterializedNotebook(ownerUri, targetDatabase, notebookMaterializedId);
	}

	/**
	 * Get a Agent Template Notebook
	 */
	public override $getTemplateNotebook(handle: number, ownerUri: string, targetDatabase: string, jobId: string): Thenable<azdata.AgentNotebookTemplateResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getTemplateNotebook(ownerUri, targetDatabase, jobId);
	}

	/**
	 * Delete a Agent Notebook
	 */
	public override $deleteNotebook(handle: number, ownerUri: string, notebook: azdata.AgentNotebookInfo): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteNotebook(ownerUri, notebook);
	}

	/**
	 * Update a Agent Materialized Notebook Name
	 */
	public override $updateNotebookMaterializedName(handle: number, ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, name: string): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).updateNotebookMaterializedName(ownerUri, agentNotebookHistory, targetDatabase, name);
	}

	/**
	 * Get a Agent Materialized Notebook
	 */
	public override $deleteMaterializedNotebook(handle: number, ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteMaterializedNotebook(ownerUri, agentNotebookHistory, targetDatabase);
	}

	/**
	 * Update a Agent Materialized Notebook Pin
	 */
	public override $updateNotebookMaterializedPin(handle: number, ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, pin: boolean): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).updateNotebookMaterializedPin(ownerUri, agentNotebookHistory, targetDatabase, pin);
	}

	/**
	 * Get Agent Oeprators list
	 */
	override $getOperators(handle: number, ownerUri: string): Thenable<azdata.AgentOperatorsResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getOperators(ownerUri);
	}

	/**
	 * Deletes an operator
	 */
	override $deleteOperator(handle: number, ownerUri: string, operator: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteOperator(ownerUri, operator);
	}

	/**
	 * Get Agent Proxies list
	 */
	override $getProxies(handle: number, ownerUri: string): Thenable<azdata.AgentProxiesResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getProxies(ownerUri);
	}

	/**
	 * Deletes a proxy
	 */
	override $deleteProxy(handle: number, ownerUri: string, proxy: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).deleteProxy(ownerUri, proxy);
	}

	/**
	 * Gets Agent Credentials from server
	 */
	override $getCredentials(handle: number, ownerUri: string): Thenable<azdata.GetCredentialsResult> {
		return this._resolveProvider<azdata.AgentServicesProvider>(handle).getCredentials(ownerUri);
	}

	/**
	 * SQL Agent job data update notification
	 */
	public $onJobDataUpdated(handle: Number): void {
		this._proxy.$onJobDataUpdated(handle);
	}

	// Serialization methods
	public override $startSerialization(handle: number, requestParams: azdata.SerializeDataStartRequestParams): Thenable<azdata.SerializeDataResult> {
		return this._resolveProvider<azdata.SerializationProvider>(handle).startSerialization(requestParams);
	}

	public override $continueSerialization(handle: number, requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> {
		return this._resolveProvider<azdata.SerializationProvider>(handle).continueSerialization(requestParams);
	}

	// Assessment methods
	public override $assessmentInvoke(handle: number, ownerUri: string, targetType: number): Thenable<azdata.SqlAssessmentResult> {
		return this._resolveProvider<azdata.SqlAssessmentServicesProvider>(handle).assessmentInvoke(ownerUri, targetType);
	}

	public override $getAssessmentItems(handle: number, ownerUri: string, targetType: number): Thenable<azdata.SqlAssessmentResult> {
		return this._resolveProvider<azdata.SqlAssessmentServicesProvider>(handle).getAssessmentItems(ownerUri, targetType);
	}

	public override $generateAssessmentScript(handle: number, items: azdata.SqlAssessmentResultItem[]): Thenable<azdata.ResultStatus> {
		return this._resolveProvider<azdata.SqlAssessmentServicesProvider>(handle).generateAssessmentScript(items);
	}

	public override $getDataGridItems(handle: number): Thenable<azdata.DataGridItem[]> {
		return this._resolveProvider<azdata.DataGridProvider>(handle).getDataGridItems();
	}

	public override $getDataGridColumns(handle: number): Thenable<azdata.DataGridColumn[]> {
		return this._resolveProvider<azdata.DataGridProvider>(handle).getDataGridColumns();
	}
}
