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
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import * as sqlops from 'sqlops';
import { IMetadataService } from 'sql/platform/metadata/common/metadataService';
import { IObjectExplorerService, NodeExpandInfoWithProviderId } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IAdminService } from 'sql/workbench/services/admin/common/adminService';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import { IBackupService } from 'sql/platform/backup/common/backupService';
import { IRestoreService } from 'sql/platform/restore/common/restoreService';
import { ITaskService } from 'sql/platform/taskHistory/common/taskService';
import { IProfilerService } from 'sql/workbench/services/profiler/common/interfaces';
import { ISerializationService } from 'sql/platform/serialization/common/serializationService';
import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { IDacFxService } from 'sql/platform/dacfx/common/dacFxService';
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
		@IJobManagementService private _jobManagementService: IJobManagementService,
		@IBackupService private _backupService: IBackupService,
		@IRestoreService private _restoreService: IRestoreService,
		@ITaskService private _taskService: ITaskService,
		@IProfilerService private _profilerService: IProfilerService,
		@ISerializationService private _serializationService: ISerializationService,
		@IFileBrowserService private _fileBrowserService: IFileBrowserService,
		@IDacFxService private _dacFxService: IDacFxService,
	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostDataProtocol);
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
		this._connectionManagementService.registerProvider(providerId, <sqlops.ConnectionProvider>{
			connect(connectionUri: string, connectionInfo: sqlops.ConnectionInfo): Thenable<boolean> {
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
			listDatabases(connectionUri: string): Thenable<sqlops.ListDatabasesResult> {
				return self._proxy.$listDatabases(handle, connectionUri);
			},
			getConnectionString(connectionUri: string, includePassword: boolean): Thenable<string> {
				return self._proxy.$getConnectionString(handle, connectionUri, includePassword);
			},
			buildConnectionInfo(connectionString: string): Thenable<sqlops.ConnectionInfo> {
				return self._proxy.$buildConnectionInfo(handle, connectionString);
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
			cancelQuery(ownerUri: string): Thenable<sqlops.QueryCancelResult> {
				return self._proxy.$cancelQuery(handle, ownerUri);
			},
			runQuery(ownerUri: string, selection: sqlops.ISelectionData, runOptions?: sqlops.ExecutionPlanOptions): Thenable<void> {
				return self._proxy.$runQuery(handle, ownerUri, selection, runOptions);
			},
			runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
				return self._proxy.$runQueryStatement(handle, ownerUri, line, column);
			},
			runQueryString(ownerUri: string, queryString: string): Thenable<void> {
				return self._proxy.$runQueryString(handle, ownerUri, queryString);
			},
			runQueryAndReturn(ownerUri: string, queryString: string): Thenable<sqlops.SimpleExecuteResult> {
				return self._proxy.$runQueryAndReturn(handle, ownerUri, queryString);
			},
			parseSyntax(ownerUri: string, query: string): Thenable<sqlops.SyntaxParseResult> {
				return self._proxy.$parseSyntax(handle, ownerUri, query);
			},
			getQueryRows(rowData: sqlops.QueryExecuteSubsetParams): Thenable<sqlops.QueryExecuteSubsetResult> {
				return self._proxy.$getQueryRows(handle, rowData);
			},
			disposeQuery(ownerUri: string): Thenable<void> {
				return self._proxy.$disposeQuery(handle, ownerUri);
			},
			saveResults(requestParams: sqlops.SaveResultsRequestParams): Thenable<sqlops.SaveResultRequestResult> {
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
			initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
				return self._proxy.$initializeEdit(handle, ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
			},
			updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<sqlops.EditUpdateCellResult> {
				return self._proxy.$updateCell(handle, ownerUri, rowId, columnId, newValue);
			},
			commitEdit(ownerUri): Thenable<void> {
				return self._proxy.$commitEdit(handle, ownerUri);
			},
			createRow(ownerUri: string): Thenable<sqlops.EditCreateRowResult> {
				return self._proxy.$createRow(handle, ownerUri);
			},
			deleteRow(ownerUri: string, rowId: number): Thenable<void> {
				return self._proxy.$deleteRow(handle, ownerUri, rowId);
			},
			disposeEdit(ownerUri: string): Thenable<void> {
				return self._proxy.$disposeEdit(handle, ownerUri);
			},
			revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<sqlops.EditRevertCellResult> {
				return self._proxy.$revertCell(handle, ownerUri, rowId, columnId);
			},
			revertRow(ownerUri: string, rowId: number): Thenable<void> {
				return self._proxy.$revertRow(handle, ownerUri, rowId);
			},
			getEditRows(rowData: sqlops.EditSubsetParams): Thenable<sqlops.EditSubsetResult> {
				return self._proxy.$getEditRows(handle, rowData);
			}
		});

		return undefined;
	}

	public $registerBackupProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._backupService.registerProvider(providerId, <sqlops.BackupProvider>{
			backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.BackupResponse> {
				return self._proxy.$backup(handle, connectionUri, backupInfo, taskExecutionMode);
			},
			getBackupConfigInfo(connectionUri: string): Thenable<sqlops.BackupConfigInfo> {
				return self._proxy.$getBackupConfigInfo(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerRestoreProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._restoreService.registerProvider(providerId, <sqlops.RestoreProvider>{
			getRestorePlan(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestorePlanResponse> {
				return self._proxy.$getRestorePlan(handle, connectionUri, restoreInfo);
			},
			cancelRestorePlan(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<boolean> {
				return self._proxy.$cancelRestorePlan(handle, connectionUri, restoreInfo);
			},
			restore(connectionUri: string, restoreInfo: sqlops.RestoreInfo): Thenable<sqlops.RestoreResponse> {
				return self._proxy.$restore(handle, connectionUri, restoreInfo);
			},
			getRestoreConfigInfo(connectionUri: string): Thenable<sqlops.RestoreConfigInfo> {
				return self._proxy.$getRestoreConfigInfo(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerMetadataProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._metadataService.registerProvider(providerId, <sqlops.MetadataProvider>{
			getMetadata(connectionUri: string): Thenable<sqlops.ProviderMetadata> {
				return self._proxy.$getMetadata(handle, connectionUri);
			},
			getDatabases(connectionUri: string): Thenable<string[]> {
				return self._proxy.$getDatabases(handle, connectionUri);
			},
			getTableInfo(connectionUri: string, metadata: sqlops.ObjectMetadata): Thenable<sqlops.ColumnMetadata[]> {
				return self._proxy.$getTableInfo(handle, connectionUri, metadata);
			},
			getViewInfo(connectionUri: string, metadata: sqlops.ObjectMetadata): Thenable<sqlops.ColumnMetadata[]> {
				return self._proxy.$getViewInfo(handle, connectionUri, metadata);
			}
		});

		return undefined;
	}

	public $registerObjectExplorerProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._objectExplorerService.registerProvider(providerId, <sqlops.ObjectExplorerProvider>{
			providerId: providerId,
			createNewSession(connection: sqlops.ConnectionInfo): Thenable<sqlops.ObjectExplorerSessionResponse> {
				return self._proxy.$createObjectExplorerSession(handle, connection);
			},
			expandNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$expandObjectExplorerNode(handle, nodeInfo);
			},
			refreshNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$refreshObjectExplorerNode(handle, nodeInfo);
			},
			closeSession(closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): Thenable<sqlops.ObjectExplorerCloseSessionResponse> {
				return self._proxy.$closeObjectExplorerSession(handle, closeSessionInfo);
			},
			findNodes(findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
				return self._proxy.$findNodes(handle, findNodesInfo);
			}
		});

		return undefined;
	}

	public $registerObjectExplorerNodeProvider(providerId: string, supportedProviderId: string, group: string, handle: number): TPromise<any> {
		const self = this;
		this._objectExplorerService.registerNodeProvider(<sqlops.ObjectExplorerNodeProvider> {
			supportedProviderId: supportedProviderId,
			providerId: providerId,
			group: group,
			expandNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$expandObjectExplorerNode(handle, nodeInfo);
			},
			refreshNode(nodeInfo: sqlops.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$refreshObjectExplorerNode(handle, nodeInfo);
			},
			findNodes(findNodesInfo: sqlops.FindNodesInfo): Thenable<sqlops.ObjectExplorerFindNodesResponse> {
				return self._proxy.$findNodes(handle, findNodesInfo);
			},
			handleSessionOpen(session: sqlops.ObjectExplorerSession): Thenable<boolean> {
				return self._proxy.$createObjectExplorerNodeProviderSession(handle, session);
			},
			handleSessionClose(closeSessionInfo: sqlops.ObjectExplorerCloseSessionInfo): void {
				return self._proxy.$handleSessionClose(handle, closeSessionInfo);
			}
		});

		return undefined;
	}

	public $registerTaskServicesProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._taskService.registerProvider(providerId, <sqlops.TaskServicesProvider>{
			getAllTasks(listTasksParams: sqlops.ListTasksParams): Thenable<sqlops.ListTasksResponse> {
				return self._proxy.$getAllTasks(handle, listTasksParams);
			},
			cancelTask(cancelTaskParams: sqlops.CancelTaskParams): Thenable<boolean> {
				return self._proxy.$cancelTask(handle, cancelTaskParams);
			}
		});

		return undefined;
	}

	public $registerScriptingProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._scriptingService.registerProvider(providerId, <sqlops.ScriptingProvider>{
			scriptAsOperation(connectionUri: string, operation: sqlops.ScriptOperation, metadata: sqlops.ObjectMetadata, paramDetails: sqlops.ScriptingParamDetails): Thenable<sqlops.ScriptingResult> {
				return self._proxy.$scriptAsOperation(handle, connectionUri, operation, metadata, paramDetails);
			}
		});

		return undefined;
	}

	public $registerFileBrowserProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._fileBrowserService.registerProvider(providerId, <sqlops.FileBrowserProvider>{
			openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
				return self._proxy.$openFileBrowser(handle, ownerUri, expandPath, fileFilters, changeFilter);
			},
			expandFolderNode(ownerUri: string, expandPath: string): Thenable<boolean> {
				return self._proxy.$expandFolderNode(handle, ownerUri, expandPath);
			},
			validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> {
				return self._proxy.$validateFilePaths(handle, ownerUri, serviceType, selectedFiles);
			},
			closeFileBrowser(ownerUri: string): Thenable<sqlops.FileBrowserCloseResponse> {
				return self._proxy.$closeFileBrowser(handle, ownerUri);
			}
		});

		return undefined;
	}

	public $registerProfilerProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._profilerService.registerProvider(providerId, <sqlops.ProfilerProvider>{
			createSession(sessionId: string, createStatement: string, template: sqlops.ProfilerSessionTemplate): Thenable<boolean> {
				return self._proxy.$createSession(handle, sessionId, createStatement, template);
			},
			startSession(sessionId: string, sessionName: string): Thenable<boolean> {
				return self._proxy.$startSession(handle, sessionId, sessionName);
			},
			stopSession(sessionId: string): Thenable<boolean> {
				return self._proxy.$stopSession(handle, sessionId);
			},
			pauseSession(sessionId: string): Thenable<boolean> {
				return self._proxy.$pauseSession(handle, sessionId);
			},
			getXEventSessions(sessionId: string): Thenable<string[]> {
				return self._proxy.$getXEventSessions(handle, sessionId);
			},
			connectSession(sessionId: string): Thenable<boolean> {
				return TPromise.as(true);
			},
			disconnectSession(sessionId: string): Thenable<boolean> {
				return self._proxy.$disconnectSession(handle, sessionId);
			}
		});

		return undefined;
	}

	public $registerAdminServicesProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._adminService.registerProvider(providerId, <sqlops.AdminServicesProvider>{
			createDatabase(connectionUri: string, database: sqlops.DatabaseInfo): Thenable<sqlops.CreateDatabaseResponse> {
				return self._proxy.$createDatabase(handle, connectionUri, database);
			},
			getDefaultDatabaseInfo(connectionUri: string): Thenable<sqlops.DatabaseInfo> {
				return self._proxy.$getDefaultDatabaseInfo(handle, connectionUri);
			},
			getDatabaseInfo(connectionUri: string): Thenable<sqlops.DatabaseInfo> {
				return self._proxy.$getDatabaseInfo(handle, connectionUri);
			},
			createLogin(connectionUri: string, login: sqlops.LoginInfo): Thenable<sqlops.CreateLoginResponse> {
				return self._proxy.$createLogin(handle, connectionUri, login);
			}
		});

		return undefined;
	}

	public $registerAgentServicesProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._jobManagementService.registerProvider(providerId, <sqlops.AgentServicesProvider>{
			providerId: providerId,
			getJobs(connectionUri: string): Thenable<sqlops.AgentJobsResult> {
				return self._proxy.$getJobs(handle, connectionUri);
			},
			getJobHistory(connectionUri: string, jobID: string, jobName: string): Thenable<sqlops.AgentJobHistoryResult> {
				return self._proxy.$getJobHistory(handle, connectionUri, jobID, jobName);
			},
			jobAction(connectionUri: string, jobName: string, action: string): Thenable<sqlops.ResultStatus> {
				return self._proxy.$jobAction(handle, connectionUri, jobName, action);
			},
			deleteJob(connectionUri: string, jobInfo: sqlops.AgentJobInfo): Thenable<sqlops.ResultStatus> {
				return self._proxy.$deleteJob(handle, connectionUri, jobInfo);
			},
			deleteJobStep(connectionUri: string, stepInfo: sqlops.AgentJobStepInfo): Thenable<sqlops.ResultStatus> {
				return self._proxy.$deleteJobStep(handle, connectionUri, stepInfo);
			},
			getAlerts(connectionUri: string): Thenable<sqlops.AgentAlertsResult> {
				return self._proxy.$getAlerts(handle, connectionUri);
			},
			deleteAlert(connectionUri: string, alertInfo: sqlops.AgentAlertInfo): Thenable<sqlops.ResultStatus> {
				return self._proxy.$deleteAlert(handle, connectionUri, alertInfo);
			},
			getOperators(connectionUri: string): Thenable<sqlops.AgentOperatorsResult> {
				return self._proxy.$getOperators(handle, connectionUri);
			},
			deleteOperator(connectionUri: string, operatorInfo: sqlops.AgentOperatorInfo): Thenable<sqlops.ResultStatus> {
				return self._proxy.$deleteOperator(handle, connectionUri, operatorInfo);
			},
			getProxies(connectionUri: string): Thenable<sqlops.AgentProxiesResult> {
				return self._proxy.$getProxies(handle, connectionUri);
			},
			deleteProxy(connectionUri: string, proxyInfo: sqlops.AgentProxyInfo): Thenable<sqlops.ResultStatus> {
				return self._proxy.$deleteProxy(handle, connectionUri, proxyInfo);
			},
			getCredentials(connectionUri: string): Thenable<sqlops.GetCredentialsResult> {
				return self._proxy.$getCredentials(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerCapabilitiesServiceProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._capabilitiesService.registerProvider(<sqlops.CapabilitiesProvider>{
			getServerCapabilities(client: sqlops.DataProtocolClientCapabilities): Thenable<sqlops.DataProtocolServerCapabilities> {
				return self._proxy.$getServerCapabilities(handle, client);
			}
		});

		return undefined;
	}

	public $registerDacFxServicesProvider(providerId: string, handle: number): TPromise<any> {
		const self = this;
		this._dacFxService.registerProvider(providerId, <sqlops.DacFxServicesProvider>{
			exportBacpac(databaseName: string, packageFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
				return self._proxy.$exportBacpac(handle, databaseName, packageFilePath, ownerUri, taskExecutionMode);
			},
			importBacpac(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
				return self._proxy.$importBacpac(handle, packageFilePath, databaseName, ownerUri, taskExecutionMode);
			},
			extractDacpac(databaseName: string, packageFilePath: string, applicationName: string, applicationVersion: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
				return self._proxy.$extractDacpac(handle, databaseName, packageFilePath, applicationName, applicationVersion, ownerUri, taskExecutionMode);
			},
			deployDacpac(packageFilePath: string, databaseName: string, upgradeExisting: boolean, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
				return self._proxy.$deployDacpac(handle, packageFilePath, databaseName, upgradeExisting, ownerUri, taskExecutionMode);
			},
			generateDeployScript(packageFilePath: string, databaseName: string, scriptFilePath: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.DacFxResult> {
				return self._proxy.$generateDeployScript(handle, packageFilePath, databaseName, scriptFilePath, ownerUri, taskExecutionMode);
			},
			generateDeployPlan(packageFilePath: string, databaseName: string, ownerUri: string, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.GenerateDeployPlanResult> {
				return self._proxy.$generateDeployPlan(handle, packageFilePath, databaseName, ownerUri, taskExecutionMode);
			}
		});

		return undefined;
	}

	// Connection Management handlers
	public $onConnectionComplete(handle: number, connectionInfoSummary: sqlops.ConnectionInfoSummary): void {
		this._connectionManagementService.onConnectionComplete(handle, connectionInfoSummary);
	}

	public $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._connectionManagementService.onIntelliSenseCacheComplete(handle, connectionUri);
	}

	public $onConnectionChangeNotification(handle: number, changedConnInfo: sqlops.ChangedConnectionInfo): void {
		this._connectionManagementService.onConnectionChangedNotification(handle, changedConnInfo);
	}

	// Query Management handlers
	public $onQueryComplete(handle: number, result: sqlops.QueryExecuteCompleteNotificationResult): void {
		this._queryManagementService.onQueryComplete(result);
	}
	public $onBatchStart(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void {
		this._queryManagementService.onBatchStart(batchInfo);
	}
	public $onBatchComplete(handle: number, batchInfo: sqlops.QueryExecuteBatchNotificationParams): void {
		this._queryManagementService.onBatchComplete(batchInfo);
	}
	public $onResultSetAvailable(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void {
		this._queryManagementService.onResultSetAvailable(resultSetInfo);
	}
	public $onResultSetUpdated(handle: number, resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams): void {
		this._queryManagementService.onResultSetUpdated(resultSetInfo);
	}
	public $onQueryMessage(handle: number, message: sqlops.QueryExecuteMessageParams): void {
		this._queryManagementService.onMessage(message);
	}
	public $onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._queryManagementService.onEditSessionReady(ownerUri, success, message);
	}

	// Script Handlers
	public $onScriptingComplete(handle: number, scriptingCompleteResult: sqlops.ScriptingCompleteResult): void {
		this._scriptingService.onScriptingComplete(handle, scriptingCompleteResult);
	}

	//OE handlers
	public $onObjectExplorerSessionCreated(handle: number, sessionResponse: sqlops.ObjectExplorerSession): void {
		this._objectExplorerService.onSessionCreated(handle, sessionResponse);
	}

	public $onObjectExplorerSessionDisconnected(handle: number, sessionResponse: sqlops.ObjectExplorerSession): void {
		this._objectExplorerService.onSessionDisconnected(handle, sessionResponse);
	}

	public $onObjectExplorerNodeExpanded(providerId: string, expandResponse: sqlops.ObjectExplorerExpandInfo): void {
		let expandInfo: NodeExpandInfoWithProviderId = Object.assign({ providerId: providerId }, expandResponse);
		this._objectExplorerService.onNodeExpanded(expandInfo);
	}

	//Tasks handlers
	public $onTaskCreated(handle: number, taskInfo: sqlops.TaskInfo): void {
		this._taskService.onNewTaskCreated(handle, taskInfo);
	}

	public $onTaskStatusChanged(handle: number, taskProgressInfo: sqlops.TaskProgressInfo): void {
		this._taskService.onTaskStatusChanged(handle, taskProgressInfo);
	}

	//File browser handlers
	public $onFileBrowserOpened(handle: number, response: sqlops.FileBrowserOpenedParams): void {
		this._fileBrowserService.onFileBrowserOpened(handle, response);
	}

	public $onFolderNodeExpanded(handle: number, response: sqlops.FileBrowserExpandedParams): void {
		this._fileBrowserService.onFolderNodeExpanded(handle, response);
	}

	public $onFilePathsValidated(handle: number, response: sqlops.FileBrowserValidatedParams): void {
		this._fileBrowserService.onFilePathsValidated(handle, response);
	}

	// Profiler handlers
	public $onSessionEventsAvailable(handle: number, response: sqlops.ProfilerSessionEvents): void {
		this._profilerService.onMoreRows(response);
	}

	public $onSessionStopped(handle: number, response: sqlops.ProfilerSessionStoppedParams): void {
		this._profilerService.onSessionStopped(response);
	}

	public $onProfilerSessionCreated(handle: number, response: sqlops.ProfilerSessionCreatedParams): void {
		this._profilerService.onProfilerSessionCreated(response);
	}

	// SQL Server Agent handlers
	public $onJobDataUpdated(handle: Number): void {
		this._jobManagementService.fireOnDidChange();
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
