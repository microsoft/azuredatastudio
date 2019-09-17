/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import {
	SqlExtHostContext, ExtHostDataProtocolShape,
	MainThreadDataProtocolShape, SqlMainContext
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IQueryManagementService } from 'sql/platform/query/common/queryManagement';
import * as azdata from 'azdata';
import { IMetadataService } from 'sql/platform/metadata/common/metadataService';
import { IObjectExplorerService, NodeExpandInfoWithProviderId } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IAdminService } from 'sql/workbench/services/admin/common/adminService';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import { IBackupService } from 'sql/platform/backup/common/backupService';
import { IRestoreService } from 'sql/platform/restore/common/restoreService';
import { ITaskService } from 'sql/platform/tasks/common/tasksService';
import { IProfilerService } from 'sql/workbench/services/profiler/browser/interfaces';
import { ISerializationService } from 'sql/platform/serialization/common/serializationService';
import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';

/**
 * Main thread class for handling data protocol management registration.
 */
@extHostNamedCustomer(SqlMainContext.MainThreadDataProtocol)
export class MainThreadDataProtocol extends Disposable implements MainThreadDataProtocolShape {

	private _proxy: ExtHostDataProtocolShape;

	private _capabilitiesRegistrations: { [handle: number]: IDisposable; } = Object.create(null); // should we be registering these?

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
		@IFileBrowserService private _fileBrowserService: IFileBrowserService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostDataProtocol);
		}
		if (this._connectionManagementService) {
			this._register(this._connectionManagementService.onLanguageFlavorChanged(e => this._proxy.$languageFlavorChanged(e)));
		}
	}

	public $registerConnectionProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._connectionManagementService.registerProvider(providerId, <azdata.ConnectionProvider>{
			connect(connectionUri: string, connectionInfo: azdata.ConnectionInfo): Thenable<boolean> {
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
			listDatabases(connectionUri: string): Thenable<azdata.ListDatabasesResult> {
				return self._proxy.$listDatabases(handle, connectionUri);
			},
			getConnectionString(connectionUri: string, includePassword: boolean): Thenable<string> {
				return self._proxy.$getConnectionString(handle, connectionUri, includePassword);
			},
			buildConnectionInfo(connectionString: string): Thenable<azdata.ConnectionInfo> {
				return self._proxy.$buildConnectionInfo(handle, connectionString);
			},
			rebuildIntelliSenseCache(connectionUri: string): Thenable<void> {
				return self._proxy.$rebuildIntelliSenseCache(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerQueryProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._queryManagementService.addQueryRequestHandler(providerId, {
			cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult> {
				return self._proxy.$cancelQuery(handle, ownerUri);
			},
			runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
				return self._proxy.$runQuery(handle, ownerUri, selection, runOptions);
			},
			runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
				return self._proxy.$runQueryStatement(handle, ownerUri, line, column);
			},
			runQueryString(ownerUri: string, queryString: string): Thenable<void> {
				return self._proxy.$runQueryString(handle, ownerUri, queryString);
			},
			runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> {
				return self._proxy.$runQueryAndReturn(handle, ownerUri, queryString);
			},
			parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> {
				return self._proxy.$parseSyntax(handle, ownerUri, query);
			},
			getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> {
				return self._proxy.$getQueryRows(handle, rowData);
			},
			setQueryExecutionOptions(ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
				return self._proxy.$setQueryExecutionOptions(handle, ownerUri, options);
			},
			disposeQuery(ownerUri: string): Thenable<void> {
				return self._proxy.$disposeQuery(handle, ownerUri);
			},
			saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> {
				let saveResultsFeatureInfo = self._serializationService.getSaveResultsFeatureMetadataProvider(requestParams.ownerUri);
				if (saveResultsFeatureInfo && saveResultsFeatureInfo.enabled) {
					return self._proxy.$saveResults(handle, requestParams);
				}
				else if (saveResultsFeatureInfo && !saveResultsFeatureInfo.enabled) {
					return self._serializationService.disabledSaveAs();
				}
				else {
					return self._serializationService.saveAs(requestParams.resultFormat, requestParams.filePath, undefined, true);
				}
			},
			initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
				return self._proxy.$initializeEdit(handle, ownerUri, schemaName, objectName, objectType, rowLimit, queryString);
			},
			updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
				return self._proxy.$updateCell(handle, ownerUri, rowId, columnId, newValue);
			},
			commitEdit(ownerUri): Thenable<void> {
				return self._proxy.$commitEdit(handle, ownerUri);
			},
			createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
				return self._proxy.$createRow(handle, ownerUri);
			},
			deleteRow(ownerUri: string, rowId: number): Thenable<void> {
				return self._proxy.$deleteRow(handle, ownerUri, rowId);
			},
			disposeEdit(ownerUri: string): Thenable<void> {
				return self._proxy.$disposeEdit(handle, ownerUri);
			},
			revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
				return self._proxy.$revertCell(handle, ownerUri, rowId, columnId);
			},
			revertRow(ownerUri: string, rowId: number): Thenable<void> {
				return self._proxy.$revertRow(handle, ownerUri, rowId);
			},
			getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> {
				return self._proxy.$getEditRows(handle, rowData);
			}
		});

		return undefined;
	}

	public $registerBackupProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._backupService.registerProvider(providerId, <azdata.BackupProvider>{
			backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.BackupResponse> {
				return self._proxy.$backup(handle, connectionUri, backupInfo, taskExecutionMode);
			},
			getBackupConfigInfo(connectionUri: string): Thenable<azdata.BackupConfigInfo> {
				return self._proxy.$getBackupConfigInfo(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerRestoreProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._restoreService.registerProvider(providerId, <azdata.RestoreProvider>{
			getRestorePlan(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestorePlanResponse> {
				return self._proxy.$getRestorePlan(handle, connectionUri, restoreInfo);
			},
			cancelRestorePlan(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<boolean> {
				return self._proxy.$cancelRestorePlan(handle, connectionUri, restoreInfo);
			},
			restore(connectionUri: string, restoreInfo: azdata.RestoreInfo): Thenable<azdata.RestoreResponse> {
				return self._proxy.$restore(handle, connectionUri, restoreInfo);
			},
			getRestoreConfigInfo(connectionUri: string): Thenable<azdata.RestoreConfigInfo> {
				return self._proxy.$getRestoreConfigInfo(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerMetadataProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._metadataService.registerProvider(providerId, <azdata.MetadataProvider>{
			getMetadata(connectionUri: string): Thenable<azdata.ProviderMetadata> {
				return self._proxy.$getMetadata(handle, connectionUri);
			},
			getDatabases(connectionUri: string): Thenable<string[]> {
				return self._proxy.$getDatabases(handle, connectionUri);
			},
			getTableInfo(connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[]> {
				return self._proxy.$getTableInfo(handle, connectionUri, metadata);
			},
			getViewInfo(connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[]> {
				return self._proxy.$getViewInfo(handle, connectionUri, metadata);
			}
		});

		return undefined;
	}

	public $registerObjectExplorerProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._objectExplorerService.registerProvider(providerId, <azdata.ObjectExplorerProvider>{
			providerId: providerId,
			createNewSession(connection: azdata.ConnectionInfo): Thenable<azdata.ObjectExplorerSessionResponse> {
				return self._proxy.$createObjectExplorerSession(handle, connection);
			},
			expandNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$expandObjectExplorerNode(handle, nodeInfo);
			},
			refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$refreshObjectExplorerNode(handle, nodeInfo);
			},
			closeSession(closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): Thenable<azdata.ObjectExplorerCloseSessionResponse> {
				return self._proxy.$closeObjectExplorerSession(handle, closeSessionInfo);
			},
			findNodes(findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
				return self._proxy.$findNodes(handle, findNodesInfo);
			}
		});

		return undefined;
	}

	public $registerObjectExplorerNodeProvider(providerId: string, supportedProviderId: string, group: string, handle: number): Promise<any> {
		const self = this;
		this._objectExplorerService.registerNodeProvider(<azdata.ObjectExplorerNodeProvider>{
			supportedProviderId: supportedProviderId,
			providerId: providerId,
			group: group,
			expandNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$expandObjectExplorerNode(handle, nodeInfo);
			},
			refreshNode(nodeInfo: azdata.ExpandNodeInfo): Thenable<boolean> {
				return self._proxy.$refreshObjectExplorerNode(handle, nodeInfo);
			},
			findNodes(findNodesInfo: azdata.FindNodesInfo): Thenable<azdata.ObjectExplorerFindNodesResponse> {
				return self._proxy.$findNodes(handle, findNodesInfo);
			},
			handleSessionOpen(session: azdata.ObjectExplorerSession): Thenable<boolean> {
				return self._proxy.$createObjectExplorerNodeProviderSession(handle, session);
			},
			handleSessionClose(closeSessionInfo: azdata.ObjectExplorerCloseSessionInfo): void {
				return self._proxy.$handleSessionClose(handle, closeSessionInfo);
			}
		});

		return undefined;
	}

	public $registerIconProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._connectionManagementService.registerIconProvider(providerId, <azdata.IconProvider>{
			getConnectionIconId(connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string> {
				return self._proxy.$getConnectionIconId(handle, connection, serverInfo);
			}
		});
		return undefined;
	}

	public $registerTaskServicesProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._taskService.registerProvider(providerId, <azdata.TaskServicesProvider>{
			getAllTasks(listTasksParams: azdata.ListTasksParams): Thenable<azdata.ListTasksResponse> {
				return self._proxy.$getAllTasks(handle, listTasksParams);
			},
			cancelTask(cancelTaskParams: azdata.CancelTaskParams): Thenable<boolean> {
				return self._proxy.$cancelTask(handle, cancelTaskParams);
			}
		});

		return undefined;
	}

	public $registerScriptingProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._scriptingService.registerProvider(providerId, <azdata.ScriptingProvider>{
			scriptAsOperation(connectionUri: string, operation: azdata.ScriptOperation, metadata: azdata.ObjectMetadata, paramDetails: azdata.ScriptingParamDetails): Thenable<azdata.ScriptingResult> {
				return self._proxy.$scriptAsOperation(handle, connectionUri, operation, metadata, paramDetails);
			}
		});

		return undefined;
	}

	public $registerFileBrowserProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._fileBrowserService.registerProvider(providerId, <azdata.FileBrowserProvider>{
			openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean> {
				return self._proxy.$openFileBrowser(handle, ownerUri, expandPath, fileFilters, changeFilter);
			},
			expandFolderNode(ownerUri: string, expandPath: string): Thenable<boolean> {
				return self._proxy.$expandFolderNode(handle, ownerUri, expandPath);
			},
			validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean> {
				return self._proxy.$validateFilePaths(handle, ownerUri, serviceType, selectedFiles);
			},
			closeFileBrowser(ownerUri: string): Thenable<azdata.FileBrowserCloseResponse> {
				return self._proxy.$closeFileBrowser(handle, ownerUri);
			}
		});

		return undefined;
	}

	public $registerProfilerProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._profilerService.registerProvider(providerId, <azdata.ProfilerProvider>{
			createSession(sessionId: string, createStatement: string, template: azdata.ProfilerSessionTemplate): Thenable<boolean> {
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
				return Promise.resolve(true);
			},
			disconnectSession(sessionId: string): Thenable<boolean> {
				return self._proxy.$disconnectSession(handle, sessionId);
			}
		});

		return undefined;
	}

	public $registerAdminServicesProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._adminService.registerProvider(providerId, <azdata.AdminServicesProvider>{
			createDatabase(connectionUri: string, database: azdata.DatabaseInfo): Thenable<azdata.CreateDatabaseResponse> {
				return self._proxy.$createDatabase(handle, connectionUri, database);
			},
			getDefaultDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo> {
				return self._proxy.$getDefaultDatabaseInfo(handle, connectionUri);
			},
			getDatabaseInfo(connectionUri: string): Thenable<azdata.DatabaseInfo> {
				return self._proxy.$getDatabaseInfo(handle, connectionUri);
			},
			createLogin(connectionUri: string, login: azdata.LoginInfo): Thenable<azdata.CreateLoginResponse> {
				return self._proxy.$createLogin(handle, connectionUri, login);
			}
		});

		return undefined;
	}

	public $registerAgentServicesProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._jobManagementService.registerProvider(providerId, <azdata.AgentServicesProvider>{
			providerId: providerId,
			getJobs(connectionUri: string): Thenable<azdata.AgentJobsResult> {
				return self._proxy.$getJobs(handle, connectionUri);
			},
			getJobHistory(connectionUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> {
				return self._proxy.$getJobHistory(handle, connectionUri, jobID, jobName);
			},
			jobAction(connectionUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> {
				return self._proxy.$jobAction(handle, connectionUri, jobName, action);
			},
			deleteJob(connectionUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteJob(handle, connectionUri, jobInfo);
			},
			deleteJobStep(connectionUri: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteJobStep(handle, connectionUri, stepInfo);
			},
			getNotebooks(connectionUri: string): Thenable<azdata.AgentNotebooksResult> {
				return self._proxy.$getNotebooks(handle, connectionUri);
			},
			getNotebookHistory(connectionUri: string, jobID: string, jobName: string, targetDatabase: string): Thenable<azdata.AgentNotebookHistoryResult> {
				return self._proxy.$getNotebookHistory(handle, connectionUri, jobID, jobName, targetDatabase);
			},
			getMaterializedNotebook(connectionUri: string, targetDatabase: string, notebookMaterializedId: number): Thenable<azdata.AgentNotebookMaterializedResult> {
				return self._proxy.$getMaterializedNotebook(handle, connectionUri, targetDatabase, notebookMaterializedId);
			},
			updateNotebookMaterializedName(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, name: string): Thenable<azdata.ResultStatus> {
				return self._proxy.$updateNotebookMaterializedName(handle, connectionUri, agentNotebookHistory, targetDatabase, name);
			},
			deleteMaterializedNotebook(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteMaterializedNotebook(handle, connectionUri, agentNotebookHistory, targetDatabase);
			},
			updateNotebookMaterializedPin(connectionUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, pin: boolean): Thenable<azdata.ResultStatus> {
				return self._proxy.$updateNotebookMaterializedPin(handle, connectionUri, agentNotebookHistory, targetDatabase, pin);
			},
			getTemplateNotebook(connectionUri: string, targetDatabase: string, jobId: string): Thenable<azdata.AgentNotebookTemplateResult> {
				return self._proxy.$getTemplateNotebook(handle, connectionUri, targetDatabase, jobId);
			},
			deleteNotebook(connectionUri: string, notebook: azdata.AgentNotebookInfo): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteNotebook(handle, connectionUri, notebook);
			},
			getAlerts(connectionUri: string): Thenable<azdata.AgentAlertsResult> {
				return self._proxy.$getAlerts(handle, connectionUri);
			},
			deleteAlert(connectionUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteAlert(handle, connectionUri, alertInfo);
			},
			getOperators(connectionUri: string): Thenable<azdata.AgentOperatorsResult> {
				return self._proxy.$getOperators(handle, connectionUri);
			},
			deleteOperator(connectionUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteOperator(handle, connectionUri, operatorInfo);
			},
			getProxies(connectionUri: string): Thenable<azdata.AgentProxiesResult> {
				return self._proxy.$getProxies(handle, connectionUri);
			},
			deleteProxy(connectionUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> {
				return self._proxy.$deleteProxy(handle, connectionUri, proxyInfo);
			},
			getCredentials(connectionUri: string): Thenable<azdata.GetCredentialsResult> {
				return self._proxy.$getCredentials(handle, connectionUri);
			}
		});

		return undefined;
	}

	public $registerCapabilitiesServiceProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._capabilitiesService.registerProvider(<azdata.CapabilitiesProvider>{
			getServerCapabilities(client: azdata.DataProtocolClientCapabilities): Thenable<azdata.DataProtocolServerCapabilities> {
				return self._proxy.$getServerCapabilities(handle, client);
			}
		});

		return undefined;
	}

	public $registerSerializationProvider(providerId: string, handle: number): Promise<any> {
		const self = this;
		this._serializationService.registerProvider(providerId, <azdata.SerializationProvider>{
			startSerialization(requestParams: azdata.SerializeDataStartRequestParams): Thenable<azdata.SerializeDataResult> {
				return self._proxy.$startSerialization(handle, requestParams);
			},
			continueSerialization(requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> {
				return self._proxy.$continueSerialization(handle, requestParams);
			},
		});

		return undefined;
	}

	// Connection Management handlers
	public $onConnectionComplete(handle: number, connectionInfoSummary: azdata.ConnectionInfoSummary): void {
		this._connectionManagementService.onConnectionComplete(handle, connectionInfoSummary);
	}

	public $onIntelliSenseCacheComplete(handle: number, connectionUri: string): void {
		this._connectionManagementService.onIntelliSenseCacheComplete(handle, connectionUri);
	}

	public $onConnectionChangeNotification(handle: number, changedConnInfo: azdata.ChangedConnectionInfo): void {
		this._connectionManagementService.onConnectionChangedNotification(handle, changedConnInfo);
	}

	// Query Management handlers
	public $onQueryComplete(handle: number, result: azdata.QueryExecuteCompleteNotificationResult): void {
		this._queryManagementService.onQueryComplete(result);
	}
	public $onBatchStart(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		this._queryManagementService.onBatchStart(batchInfo);
	}
	public $onBatchComplete(handle: number, batchInfo: azdata.QueryExecuteBatchNotificationParams): void {
		this._queryManagementService.onBatchComplete(batchInfo);
	}
	public $onResultSetAvailable(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		this._queryManagementService.onResultSetAvailable(resultSetInfo);
	}
	public $onResultSetUpdated(handle: number, resultSetInfo: azdata.QueryExecuteResultSetNotificationParams): void {
		this._queryManagementService.onResultSetUpdated(resultSetInfo);
	}
	public $onQueryMessage(handle: number, message: azdata.QueryExecuteMessageParams): void {
		this._queryManagementService.onMessage(message);
	}
	public $onEditSessionReady(handle: number, ownerUri: string, success: boolean, message: string): void {
		this._queryManagementService.onEditSessionReady(ownerUri, success, message);
	}

	// Script Handlers
	public $onScriptingComplete(handle: number, scriptingCompleteResult: azdata.ScriptingCompleteResult): void {
		this._scriptingService.onScriptingComplete(handle, scriptingCompleteResult);
	}

	//OE handlers
	public $onObjectExplorerSessionCreated(handle: number, sessionResponse: azdata.ObjectExplorerSession): void {
		this._objectExplorerService.onSessionCreated(handle, sessionResponse);
	}

	public $onObjectExplorerSessionDisconnected(handle: number, sessionResponse: azdata.ObjectExplorerSession): void {
		this._objectExplorerService.onSessionDisconnected(handle, sessionResponse);
	}

	public $onObjectExplorerNodeExpanded(providerId: string, expandResponse: azdata.ObjectExplorerExpandInfo): void {
		let expandInfo: NodeExpandInfoWithProviderId = Object.assign({ providerId: providerId }, expandResponse);
		this._objectExplorerService.onNodeExpanded(expandInfo);
	}

	//Tasks handlers
	public $onTaskCreated(handle: number, taskInfo: azdata.TaskInfo): void {
		this._taskService.onNewTaskCreated(handle, taskInfo);
	}

	public $onTaskStatusChanged(handle: number, taskProgressInfo: azdata.TaskProgressInfo): void {
		this._taskService.onTaskStatusChanged(handle, taskProgressInfo);
	}

	//File browser handlers
	public $onFileBrowserOpened(handle: number, response: azdata.FileBrowserOpenedParams): void {
		this._fileBrowserService.onFileBrowserOpened(handle, response);
	}

	public $onFolderNodeExpanded(handle: number, response: azdata.FileBrowserExpandedParams): void {
		this._fileBrowserService.onFolderNodeExpanded(handle, response);
	}

	public $onFilePathsValidated(handle: number, response: azdata.FileBrowserValidatedParams): void {
		this._fileBrowserService.onFilePathsValidated(handle, response);
	}

	// Profiler handlers
	public $onSessionEventsAvailable(handle: number, response: azdata.ProfilerSessionEvents): void {
		this._profilerService.onMoreRows(response);
	}

	public $onSessionStopped(handle: number, response: azdata.ProfilerSessionStoppedParams): void {
		this._profilerService.onSessionStopped(response);
	}

	public $onProfilerSessionCreated(handle: number, response: azdata.ProfilerSessionCreatedParams): void {
		this._profilerService.onProfilerSessionCreated(response);
	}

	// SQL Server Agent handlers
	public $onJobDataUpdated(handle: Number): void {
		this._jobManagementService.fireOnDidChange();
	}

	public $unregisterProvider(handle: number): Promise<any> {
		let capabilitiesRegistration = this._capabilitiesRegistrations[handle];
		if (capabilitiesRegistration) {
			capabilitiesRegistration.dispose();
			delete this._capabilitiesRegistrations[handle];
		}

		return undefined;
	}
}
