/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import {
	SqlExtHostContext, ExtHostDataProtocolShape,
	MainThreadDataProtocolShape, SqlMainContext
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { IQueryManagementService } from 'sql/parts/query/common/queryManagement';
import * as data from 'data';
import { IMetadataService } from 'sql/services/metadata/metadataService';
import { IObjectExplorerService } from 'sql/parts/registeredServer/common/objectExplorerService';
import { IScriptingService } from 'sql/services/scripting/scriptingService';
import { IAdminService } from 'sql/parts/admin/common/adminService';
import { IBackupService } from 'sql/parts/disasterRecovery/backup/common/backupService';
import { IRestoreService } from 'sql/parts/disasterRecovery/restore/common/restoreService';
import { ITaskService } from 'sql/parts/taskHistory/common/taskService';
import { IProfilerService } from 'sql/parts/profiler/service/interfaces';
import { ISerializationService } from 'sql/services/serialization/serializationService';
import { IFileBrowserService } from 'sql/parts/fileBrowser/common/interfaces';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';

/**
 * Main thread class for handling data protocol management registration.
 */
@extHostNamedCustomer(SqlMainContext.MainThreadDataProtocol)
export class MainThreadDataProtocol implements MainThreadDataProtocolShape {

	private _proxy: ExtHostDataProtocolShape;

	private _toDispose: IDisposable[];

	private _capabilitiesRegistrations: { [handle: number]: IDisposable; } = Object.create(null);

	constructor(
		extHostContext: IExtHostContext,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IQueryManagementService private _queryManagementService: IQueryManagementService,
		@IMetadataService private _metadataService: IMetadataService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IScriptingService private _scriptingService: IScriptingService,
		@IAdminService private _adminService: IAdminService,
		@IBackupService private _backupService: IBackupService,
		@IRestoreService private _restoreService: IRestoreService,
		@ITaskService private _taskService: ITaskService,
		@IProfilerService private _profilerService: IProfilerService,
		@ISerializationService private _serializationService: ISerializationService,
		@IFileBrowserService private _fileBrowserService: IFileBrowserService
	) {
		if (extHostContext) {
			this._proxy = extHostContext.get(SqlExtHostContext.ExtHostDataProtocol);
		}
		if (this._connectionManagementService) {
			this._connectionManagementService.onLanguageFlavorChanged(e => this._proxy.$languageFlavorChanged(e), this, this._toDispose);
		}
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $registerConnectionProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._connectionManagementService.registerProvider(providerId, <data.ConnectionProvider>{
			connect(connectionUri: string, connectionInfo: data.ConnectionInfo): Thenable<boolean> {
				return self._proxy.$connect(handle, connectionUri, connectionInfo);
			},
			disconnect(connectionUri: string): Thenable<boolean> {
				return self._proxy.$disconnect(handle, connectionUri);
			},
			changeDatabase(connectionUri: string, newDatabase: string): Thenable<boolean> {
				return self._proxy.$changeDatabase(handle, connectionUri, newDatabase);
			},
			cancelConnect(connectionUri: string): Thenable<boolean> {
				return self._proxy.$cancelConnect(handle, connectionUri);
			},
			listDatabases(connectionUri: string): Thenable<data.ListDatabasesResult> {
				return self._proxy.$listDatabases(handle, connectionUri);
			},
			rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
				return self._proxy.$rebuildIntelliSenseCache(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerQueryProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._queryManagementService.addQueryRequestHandler(providerId, {
			cancelQuery(ownerUri: string): Thenable<data.QueryCancelResult> {
				return self._proxy.$cancelQuery(handle, ownerUri);
			},
			runQuery(ownerUri: string, selection: data.ISelectionData, runOptions?: data.ExecutionPlanOptions): Thenable<void> {
				return self._proxy.$runQuery(handle, ownerUri, selection, runOptions);
			},
			runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
				return self._proxy.$runQueryStatement(handle, ownerUri, line, column);
			},
			runQueryString(ownerUri: string, queryString: string): Thenable<void> {
				return self._proxy.$runQueryString(handle, ownerUri, queryString);
			},
			runQueryAndReturn(ownerUri: string, queryString: string): Thenable<data.SimpleExecuteResult> {
				return self._proxy.$runQueryAndReturn(handle, ownerUri, queryString);
			},
			getQueryRows(rowData: data.QueryExecuteSubsetParams): Thenable<data.QueryExecuteSubsetResult> {
				return self._proxy.$getQueryRows(handle, rowData);
			},
			disposeQuery(ownerUri: string): Thenable<void> {
				return self._proxy.$disposeQuery(handle, ownerUri);
			},
			saveResults(requestParams: data.SaveResultsRequestParams): Thenable<data.SaveResultRequestResult> {
				let serializationProvider = self._serializationService.getSerializationFeatureMetadataProvider(requestParams.ownerUri);
				if (serializationProvider && serializationProvider.enabled) {
					return self._proxy.$saveResults(handle, requestParams);
				}
				else if (serializationProvider && !serializationProvider.enabled) {
					return self._serializationService.disabledSaveAs();
				}
				else {
					return self._serializationService.saveAs(requestParams.resultFormat, requestParams.filePath, undefined, true);
				}
			},
			initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number): Thenable<void> {
				return self._proxy.$initializeEdit(handle, ownerUri, schemaName, objectName, objectType, rowLimit);
			},
			updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<data.EditUpdateCellResult> {
				return self._proxy.$updateCell(handle, ownerUri, rowId, columnId, newValue);
			},
			commitEdit(ownerUri): Thenable<void> {
				return self._proxy.$commitEdit(handle, ownerUri);
			},
			createRow(ownerUri: string): Thenable<data.EditCreateRowResult> {
				return self._proxy.$createRow(handle, ownerUri);
			},
			deleteRow(ownerUri: string, rowId: number): Thenable<void> {
				return self._proxy.$deleteRow(handle, ownerUri, rowId);
			},
			disposeEdit(ownerUri: string): Thenable<void> {
				return self._proxy.$disposeEdit(handle, ownerUri);
			},
			revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<data.EditRevertCellResult> {
				return self._proxy.$revertCell(handle, ownerUri, rowId, columnId);
			},
			revertRow(ownerUri: string, rowId: number): Thenable<void> {
				return self._proxy.$revertRow(handle, ownerUri, rowId);
			},
			getEditRows(rowData: data.EditSubsetParams): Thenable<data.EditSubsetResult> {
				return self._proxy.$getEditRows(handle, rowData);
			}
		});

		return undefined;
	}

	public $registerBackupProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._backupService.registerProvider(providerId, <data.BackupProvider>{
			backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: data.TaskExecutionMode): Thenable<data.BackupResponse> {
				return self._proxy.$backup(handle, connectionUri, backupInfo, taskExecutionMode);
			},
			getBackupConfigInfo(connectionUri: string): Thenable<data.BackupConfigInfo> {
				return self._proxy.$getBackupConfigInfo(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerRestoreProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._restoreService.registerProvider(providerId, <data.RestoreProvider>{
			getRestorePlan(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestorePlanResponse> {
				return self._proxy.$getRestorePlan(handle, connectionUri, restoreInfo);
			},
			cancelRestorePlan(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<boolean> {
				return self._proxy.$cancelRestorePlan(handle, connectionUri, restoreInfo);
			},
			restore(connectionUri: string, restoreInfo: data.RestoreInfo): Thenable<data.RestoreResponse> {
				return self._proxy.$restore(handle, connectionUri, restoreInfo);
			},
			getRestoreConfigInfo(connectionUri: string): Thenable<data.RestoreConfigInfo> {
				return self._proxy.$getRestoreConfigInfo(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerMetadataProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._metadataService.registerProvider(providerId, <data.MetadataProvider>{
			getMetadata(connectionUri: string): Thenable<data.ProviderMetadata> {
				return self._proxy.$getMetadata(handle, connectionUri);
			},
			getDatabases(connectionUri: string): Thenable<string[]> {
				return self._proxy.$getDatabases(handle, connectionUri);
			},
			getTableInfo(connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
				return self._proxy.$getTableInfo(handle, connectionUri, metadata);
			},
			getViewInfo(connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
				return self._proxy.$getViewInfo(handle, connectionUri, metadata);
			}
		});

		return undefined;
	}

	public $registerObjectExplorerProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._objectExplorerService.registerProvider(providerId, <data.ObjectExplorerProvider>{
			createNewSession(connection: data.ConnectionInfo): Thenable<data.ObjectExplorerSessionResponse> {
				return self._proxy.$createObjectExplorerSession(handle, connection);
			},
			expandNode(nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$expandObjectExplorerNode(handle, nodeInfo);
			},
			refreshNode(nodeInfo: data.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$refreshObjectExplorerNode(handle, nodeInfo);
			},
			closeSession(closeSessionInfo: data.ObjectExplorerCloseSessionInfo): Thenable<data.ObjectExplorerCloseSessionResponse> {
				return self._proxy.$closeObjectExplorerSession(handle, closeSessionInfo);
			}
		});

		return undefined;
	}

	public $registerTaskServicesProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._taskService.registerProvider(providerId, <data.TaskServicesProvider>{
			getAllTasks(listTasksParams: data.ListTasksParams): Thenable<data.ListTasksResponse> {
				return self._proxy.$getAllTasks(handle, listTasksParams);
			},
			cancelTask(cancelTaskParams: data.CancelTaskParams): Thenable<boolean> {
				return self._proxy.$cancelTask(handle, cancelTaskParams);
			}
		});

		return undefined;
	}

	public $registerScriptingProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._scriptingService.registerProvider(providerId, <data.ScriptingProvider>{
			scriptAsOperation(connectionUri: string, operation: data.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): Thenable<data.ScriptingResult> {
				return self._proxy.$scriptAsOperation(handle, connectionUri, operation, metadata, paramDetails);
			}
		});

		return undefined;
	}

	public $registerFileBrowserProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._fileBrowserService.registerProvider(providerId, <data.FileBrowserProvider>{
			openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
				return self._proxy.$openFileBrowser(handle, ownerUri, expandPath, fileFilters, changeFilter);
			},
			expandFolderNode(ownerUri: string, expandPath: string): Thenable<boolean> {
				return self._proxy.$expandFolderNode(handle, ownerUri, expandPath);
			},
			validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> {
				return self._proxy.$validateFilePaths(handle, ownerUri, serviceType, selectedFiles);
			},
			closeFileBrowser(ownerUri: string): Thenable<data.FileBrowserCloseResponse> {
				return self._proxy.$closeFileBrowser(handle, ownerUri);
			}
		});

		return undefined;
	}

	public $registerProfilerProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._profilerService.registerProvider(providerId, <data.ProfilerProvider>{
			startSession(sessionId: string): Thenable<boolean> {
				return self._proxy.$startSession(handle, sessionId);
			},
			stopSession(sessionId: string): Thenable<boolean> {
				return self._proxy.$stopSession(handle, sessionId);
			},
			pauseSession(sessionId: string): Thenable<boolean> {
				return TPromise.as(true);
			},
			connectSession(sessionId: string): Thenable<boolean> {
				return TPromise.as(true);
			},
			disconnectSession(sessionId: string): Thenable<boolean> {
				return TPromise.as(true);
			}
		});

		return undefined;
	}

	public $registerAdminServicesProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._adminService.registerProvider(providerId, <data.AdminServicesProvider>{
			createDatabase(connectionUri: string, database: data.DatabaseInfo): Thenable<data.CreateDatabaseResponse> {
				return self._proxy.$createDatabase(handle, connectionUri, database);
			},
			getDefaultDatabaseInfo(connectionUri: string): Thenable<data.DatabaseInfo> {
				return self._proxy.$getDefaultDatabaseInfo(handle, connectionUri);
			},
			getDatabaseInfo(connectionUri: string): Thenable<data.DatabaseInfo> {
				return self._proxy.$getDatabaseInfo(handle, connectionUri);
			},
			createLogin(connectionUri: string, login: data.LoginInfo): Thenable<data.CreateLoginResponse> {
				return self._proxy.$createLogin(handle, connectionUri, login);
			}
		});

		return undefined;
	}

	public $registerCapabilitiesServiceProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._capabilitiesService.registerProvider(<data.CapabilitiesProvider>{
			getServerCapabilities(client: data.DataProtocolClientCapabilities): Thenable<data.DataProtocolServerCapabilities> {
				return self._proxy.$getServerCapabilities(handle, client);
			}
		});

		return undefined;
	}

	// Connection Management handlers
	public $onConnectionComplete(handle: number, connectionInfoSummary: data.ConnectionInfoSummary): void {
		this._connectionManagementService.onConnectionComplete(handle, connectionInfoSummary);
	}

	public $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._connectionManagementService.onIntelliSenseCacheComplete(handle, connectionUri);
	}

	public $onConnectionChangeNotification(handle: number, changedConnInfo: data.ChangedConnectionInfo): void {
		this._connectionManagementService.onConnectionChangedNotification(handle, changedConnInfo);
	}

	// Query Management handlers
	public $onQueryComplete(handle: number, result: data.QueryExecuteCompleteNotificationResult): void {
		this._queryManagementService.onQueryComplete(result);
	}
	public $onBatchStart(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void {
		this._queryManagementService.onBatchStart(batchInfo);
	}
	public $onBatchComplete(handle: number, batchInfo: data.QueryExecuteBatchNotificationParams): void {
		this._queryManagementService.onBatchComplete(batchInfo);
	}
	public $onResultSetComplete(handle: number, resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams): void {
		this._queryManagementService.onResultSetComplete(resultSetInfo);
	}
	public $onQueryMessage(handle: number, message: data.QueryExecuteMessageParams): void {
		this._queryManagementService.onMessage(message);
	}
	public $onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._queryManagementService.onEditSessionReady(ownerUri, success, message);
	}

	// Script Handlers
	public $onScriptingComplete(handle: number, scriptingCompleteResult: data.ScriptingCompleteResult): void {
		this._scriptingService.onScriptingComplete(handle, scriptingCompleteResult);
	}

	//OE handlers
	public $onObjectExplorerSessionCreated(handle: number, sessionResponse: data.ObjectExplorerSession): void {
		this._objectExplorerService.onSessionCreated(handle, sessionResponse);
	}

	public $onObjectExplorerNodeExpanded(handle: number, expandResponse: data.ObjectExplorerExpandInfo): void {
		this._objectExplorerService.onNodeExpanded(handle, expandResponse);
	}

	//Tasks handlers
	public $onTaskCreated(handle: number, taskInfo: data.TaskInfo): void {
		this._taskService.onNewTaskCreated(handle, taskInfo);
	}

	public $onTaskStatusChanged(handle: number, taskProgressInfo: data.TaskProgressInfo): void {
		this._taskService.onTaskStatusChanged(handle, taskProgressInfo);
	}

	//File browser handlers
	public $onFileBrowserOpened(handle: number, response: data.FileBrowserOpenedParams): void {
		this._fileBrowserService.onFileBrowserOpened(handle, response);
	}

	public $onFolderNodeExpanded(handle: number, response: data.FileBrowserExpandedParams): void {
		this._fileBrowserService.onFolderNodeExpanded(handle, response);
	}

	public $onFilePathsValidated(handle: number, response: data.FileBrowserValidatedParams): void {
		this._fileBrowserService.onFilePathsValidated(handle, response);
	}

	// Profiler handlers
	public $onSessionEventsAvailable(handle: number, response: data.ProfilerSessionEvents): void {
		this._profilerService.onMoreRows(response);
	}

	public $unregisterProvider(handle: number): TPromise<any> {
		let capabilitiesRegistration = this._capabilitiesRegistrations[handle];
		if (capabilitiesRegistration) {
			capabilitiesRegistration.dispose();
			delete this._capabilitiesRegistrations[handle];
		}

		return undefined;
	}
}
