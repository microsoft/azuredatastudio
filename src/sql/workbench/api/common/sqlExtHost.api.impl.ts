/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { ExtHostAccountManagement } from 'sql/workbench/api/common/extHostAccountManagement';
import { ExtHostCredentialManagement } from 'sql/workbench/api/common/extHostCredentialManagement';
import { ExtHostDataProtocol } from 'sql/workbench/api/common/extHostDataProtocol';
import { ExtHostResourceProvider } from 'sql/workbench/api/common/extHostResourceProvider';
import * as sqlExtHostTypes from 'sql/workbench/api/common/sqlExtHostTypes';
import { ExtHostModalDialogs } from 'sql/workbench/api/common/extHostModalDialog';
import { ExtHostTasks } from 'sql/workbench/api/common/extHostTasks';
import { ExtHostDashboardWebviews } from 'sql/workbench/api/common/extHostDashboardWebview';
import { ExtHostModelView } from 'sql/workbench/api/common/extHostModelView';
import { ExtHostConnectionManagement } from 'sql/workbench/api/common/extHostConnectionManagement';
import { ExtHostDashboard } from 'sql/workbench/api/common/extHostDashboard';
import { ExtHostObjectExplorer } from 'sql/workbench/api/common/extHostObjectExplorer';
import { ExtHostModelViewDialog } from 'sql/workbench/api/common/extHostModelViewDialog';
import { ExtHostModelViewTreeViews } from 'sql/workbench/api/common/extHostModelViewTree';
import { ExtHostQueryEditor } from 'sql/workbench/api/common/extHostQueryEditor';
import { ExtHostBackgroundTaskManagement } from 'sql/workbench/api/common/extHostBackgroundTaskManagement';
import { ExtHostNotebook } from 'sql/workbench/api/common/extHostNotebook';
import { ExtHostNotebookDocumentsAndEditors } from 'sql/workbench/api/common/extHostNotebookDocumentsAndEditors';
import { ExtHostExtensionManagement } from 'sql/workbench/api/common/extHostExtensionManagement';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import * as extHostTypes from 'vs/workbench/api/common/extHostTypes';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { localize } from 'vs/nls';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IURITransformerService } from 'vs/workbench/api/common/extHostUriTransformerService';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtensionApiFactory as vsIApiFactory, createApiFactoryAndRegisterActors as vsApiFactory } from 'vs/workbench/api/common/extHost.api.impl';

export interface ISqlopsExtensionApiFactory {
	(extension: IExtensionDescription): typeof sqlops;
}

export interface IAzdataExtensionApiFactory {
	(extension: IExtensionDescription): typeof azdata;
}

export interface IExtensionApiFactory {
	azdata: IAzdataExtensionApiFactory;
	sqlops: ISqlopsExtensionApiFactory;
	vscode: vsIApiFactory;
}

export interface IAdsExtensionApiFactory {
	azdata: IAzdataExtensionApiFactory;
	sqlops: ISqlopsExtensionApiFactory;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactoryAndRegisterActors(accessor: ServicesAccessor): IExtensionApiFactory {
	const { azdata, sqlops } = createAdsApiFactory(accessor);
	return {
		azdata,
		sqlops,
		vscode: vsApiFactory(accessor)
	};
}


export interface IAdsExtensionApiFactory {
	azdata: IAzdataExtensionApiFactory;
	sqlops: ISqlopsExtensionApiFactory;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createAdsApiFactory(accessor: ServicesAccessor): IAdsExtensionApiFactory {
	const uriTransformer = accessor.get(IURITransformerService);
	const rpcProtocol = accessor.get(IExtHostRpcService);
	const extHostLogService = accessor.get(ILogService);

	// Addressable instances
	const extHostAccountManagement = rpcProtocol.set(SqlExtHostContext.ExtHostAccountManagement, new ExtHostAccountManagement(rpcProtocol));
	const extHostConnectionManagement = rpcProtocol.set(SqlExtHostContext.ExtHostConnectionManagement, new ExtHostConnectionManagement(rpcProtocol));
	const extHostCredentialManagement = rpcProtocol.set(SqlExtHostContext.ExtHostCredentialManagement, new ExtHostCredentialManagement(rpcProtocol));
	const extHostDataProvider = rpcProtocol.set(SqlExtHostContext.ExtHostDataProtocol, new ExtHostDataProtocol(rpcProtocol, uriTransformer));
	const extHostObjectExplorer = rpcProtocol.set(SqlExtHostContext.ExtHostObjectExplorer, new ExtHostObjectExplorer(rpcProtocol));
	const extHostResourceProvider = rpcProtocol.set(SqlExtHostContext.ExtHostResourceProvider, new ExtHostResourceProvider(rpcProtocol));
	const extHostModalDialogs = rpcProtocol.set(SqlExtHostContext.ExtHostModalDialogs, new ExtHostModalDialogs(rpcProtocol));
	const extHostTasks = rpcProtocol.set(SqlExtHostContext.ExtHostTasks, new ExtHostTasks(rpcProtocol, extHostLogService));
	const extHostBackgroundTaskManagement = rpcProtocol.set(SqlExtHostContext.ExtHostBackgroundTaskManagement, new ExtHostBackgroundTaskManagement(rpcProtocol));
	const extHostWebviewWidgets = rpcProtocol.set(SqlExtHostContext.ExtHostDashboardWebviews, new ExtHostDashboardWebviews(rpcProtocol));
	const extHostModelViewTree = rpcProtocol.set(SqlExtHostContext.ExtHostModelViewTreeViews, new ExtHostModelViewTreeViews(rpcProtocol));
	const extHostModelView = rpcProtocol.set(SqlExtHostContext.ExtHostModelView, new ExtHostModelView(rpcProtocol, extHostModelViewTree));
	const extHostDashboard = rpcProtocol.set(SqlExtHostContext.ExtHostDashboard, new ExtHostDashboard(rpcProtocol));
	const extHostModelViewDialog = rpcProtocol.set(SqlExtHostContext.ExtHostModelViewDialog, new ExtHostModelViewDialog(rpcProtocol, extHostModelView, extHostBackgroundTaskManagement));
	const extHostQueryEditor = rpcProtocol.set(SqlExtHostContext.ExtHostQueryEditor, new ExtHostQueryEditor(rpcProtocol));
	const extHostNotebook = rpcProtocol.set(SqlExtHostContext.ExtHostNotebook, new ExtHostNotebook(rpcProtocol));
	const extHostNotebookDocumentsAndEditors = rpcProtocol.set(SqlExtHostContext.ExtHostNotebookDocumentsAndEditors, new ExtHostNotebookDocumentsAndEditors(rpcProtocol));
	const extHostExtensionManagement = rpcProtocol.set(SqlExtHostContext.ExtHostExtensionManagement, new ExtHostExtensionManagement(rpcProtocol));


	return {
		azdata: function (extension: IExtensionDescription): typeof azdata {
			// namespace: connection
			const connection: typeof azdata.connection = {
				// "azdata" API definition
				ConnectionProfile: sqlExtHostTypes.ConnectionProfile,

				getCurrentConnection(): Thenable<azdata.connection.ConnectionProfile> {
					return extHostConnectionManagement.$getCurrentConnection();
				},
				getConnections(activeConnectionsOnly?: boolean): Thenable<azdata.connection.ConnectionProfile[]> {
					return extHostConnectionManagement.$getConnections(activeConnectionsOnly);
				},
				registerConnectionEventListener(listener: azdata.connection.ConnectionEventListener): void {
					return extHostConnectionManagement.$registerConnectionEventListener(mssqlProviderName, listener);
				},
				getConnection(uri: string): Thenable<azdata.connection.ConnectionProfile> {
					return extHostConnectionManagement.$getConnection(uri);
				},
				// "sqlops" back-compat APIs
				getActiveConnections(): Thenable<azdata.connection.Connection[]> {
					console.warn('the method azdata.connection.getActiveConnections has been deprecated, replace it with azdata.connection.getConnections');
					return extHostConnectionManagement.$getActiveConnections();
				},
				getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
					return extHostConnectionManagement.$getCredentials(connectionId);
				},
				getServerInfo(connectionId: string): Thenable<azdata.ServerInfo> {
					return extHostConnectionManagement.$getServerInfo(connectionId);
				},
				openConnectionDialog(providers?: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
					return extHostConnectionManagement.$openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
				},
				listDatabases(connectionId: string): Thenable<string[]> {
					return extHostConnectionManagement.$listDatabases(connectionId);
				},
				getConnectionString(connectionId: string, includePassword: boolean): Thenable<string> {
					return extHostConnectionManagement.$getConnectionString(connectionId, includePassword);
				},
				getUriForConnection(connectionId: string): Thenable<string> {
					return extHostConnectionManagement.$getUriForConnection(connectionId);
				},
				connect(connectionProfile: azdata.IConnectionProfile, saveConnection: boolean, showDashboard: boolean): Thenable<azdata.ConnectionResult> {
					return extHostConnectionManagement.$connect(connectionProfile, saveConnection, showDashboard);
				}
			};

			// Backcompat "sqlops" APIs
			// namespace: accounts
			const accounts: typeof azdata.accounts = {
				registerAccountProvider(providerMetadata: azdata.AccountProviderMetadata, provider: azdata.AccountProvider): vscode.Disposable {
					return extHostAccountManagement.$registerAccountProvider(providerMetadata, provider);
				},
				beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
					return extHostAccountManagement.$beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
				},
				endAutoOAuthDeviceCode(): void {
					return extHostAccountManagement.$endAutoOAuthDeviceCode();
				},
				accountUpdated(updatedAccount: azdata.Account): void {
					return extHostAccountManagement.$accountUpdated(updatedAccount);
				},
				getAllAccounts(): Thenable<azdata.Account[]> {
					return extHostAccountManagement.$getAllAccounts();
				},
				getSecurityToken(account: azdata.Account, resource?: azdata.AzureResource): Thenable<{}> {
					return extHostAccountManagement.$getSecurityToken(account, resource);
				},
				onDidChangeAccounts(listener: (e: azdata.DidChangeAccountsParams) => void, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
					return extHostAccountManagement.onDidChangeAccounts(listener, thisArgs, disposables);
				}
			};

			// namespace: credentials
			const credentials: typeof azdata.credentials = {
				registerProvider(provider: azdata.CredentialProvider): vscode.Disposable {
					return extHostCredentialManagement.$registerCredentialProvider(provider);
				},
				getProvider(namespaceId: string): Thenable<azdata.CredentialProvider> {
					return extHostCredentialManagement.$getCredentialProvider(namespaceId);
				}
			};

			// namespace: objectexplorer
			const objectExplorer: typeof azdata.objectexplorer = {
				getNode(connectionId: string, nodePath?: string): Thenable<azdata.objectexplorer.ObjectExplorerNode> {
					return extHostObjectExplorer.$getNode(connectionId, nodePath);
				},
				getActiveConnectionNodes(): Thenable<azdata.objectexplorer.ObjectExplorerNode[]> {
					return extHostObjectExplorer.$getActiveConnectionNodes();
				},
				findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<azdata.objectexplorer.ObjectExplorerNode[]> {
					return extHostObjectExplorer.$findNodes(connectionId, type, schema, name, database, parentObjectNames);
				},
				getNodeActions(connectionId: string, nodePath: string): Thenable<string[]> {
					return extHostObjectExplorer.$getNodeActions(connectionId, nodePath);
				},
				getSessionConnectionProfile(sessionId: string): Thenable<azdata.IConnectionProfile> {
					return extHostObjectExplorer.$getSessionConnectionProfile(sessionId);
				}
			};

			// namespace: resources
			const resources: typeof azdata.resources = {
				registerResourceProvider(providerMetadata: azdata.ResourceProviderMetadata, provider: azdata.ResourceProvider): vscode.Disposable {
					return extHostResourceProvider.$registerResourceProvider(providerMetadata, provider);
				}
			};

			let registerConnectionProvider = (provider: azdata.ConnectionProvider): vscode.Disposable => {
				// Connection callbacks
				provider.registerOnConnectionComplete((connSummary: azdata.ConnectionInfoSummary) => {
					extHostDataProvider.$onConnectComplete(provider.handle, connSummary);
				});

				provider.registerOnIntelliSenseCacheComplete((connectionUri: string) => {
					extHostDataProvider.$onIntelliSenseCacheComplete(provider.handle, connectionUri);
				});

				provider.registerOnConnectionChanged((changedConnInfo: azdata.ChangedConnectionInfo) => {
					extHostDataProvider.$onConnectionChanged(provider.handle, changedConnInfo);
				});

				return extHostDataProvider.$registerConnectionProvider(provider);
			};

			let registerQueryProvider = (provider: azdata.QueryProvider): vscode.Disposable => {
				provider.registerOnQueryComplete((result: azdata.QueryExecuteCompleteNotificationResult) => {
					extHostDataProvider.$onQueryComplete(provider.handle, result);
				});

				provider.registerOnBatchStart((batchInfo: azdata.QueryExecuteBatchNotificationParams) => {
					extHostDataProvider.$onBatchStart(provider.handle, batchInfo);
				});

				provider.registerOnBatchComplete((batchInfo: azdata.QueryExecuteBatchNotificationParams) => {
					extHostDataProvider.$onBatchComplete(provider.handle, batchInfo);
				});

				provider.registerOnResultSetAvailable((resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => {
					extHostDataProvider.$onResultSetAvailable(provider.handle, resultSetInfo);
				});

				provider.registerOnResultSetUpdated((resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => {
					extHostDataProvider.$onResultSetUpdated(provider.handle, resultSetInfo);
				});

				provider.registerOnMessage((message: azdata.QueryExecuteMessageParams) => {
					extHostDataProvider.$onQueryMessage(provider.handle, message);
				});

				provider.registerOnEditSessionReady((ownerUri: string, success: boolean, message: string) => {
					extHostDataProvider.$onEditSessionReady(provider.handle, ownerUri, success, message);
				});

				return extHostDataProvider.$registerQueryProvider(provider);
			};

			let registerObjectExplorerProvider = (provider: azdata.ObjectExplorerProvider): vscode.Disposable => {
				provider.registerOnSessionCreated((response: azdata.ObjectExplorerSession) => {
					extHostDataProvider.$onObjectExplorerSessionCreated(provider.handle, response);
				});

				if (provider.registerOnSessionDisconnected) {
					provider.registerOnSessionDisconnected((response: azdata.ObjectExplorerSession) => {
						extHostDataProvider.$onObjectExplorerSessionDisconnected(provider.handle, response);
					});
				}

				provider.registerOnExpandCompleted((response: azdata.ObjectExplorerExpandInfo) => {
					extHostDataProvider.$onObjectExplorerNodeExpanded(provider.providerId, response);
				});

				return extHostDataProvider.$registerObjectExplorerProvider(provider);
			};

			let registerObjectExplorerNodeProvider = (provider: azdata.ObjectExplorerNodeProvider): vscode.Disposable => {
				provider.registerOnExpandCompleted((response: azdata.ObjectExplorerExpandInfo) => {
					extHostDataProvider.$onObjectExplorerNodeExpanded(provider.providerId, response);
				});

				return extHostDataProvider.$registerObjectExplorerNodeProvider(provider);
			};

			let registerIconProvider = (provider: azdata.IconProvider): vscode.Disposable => {
				return extHostDataProvider.$registerIconProvider(provider);
			};

			let registerTaskServicesProvider = (provider: azdata.TaskServicesProvider): vscode.Disposable => {
				provider.registerOnTaskCreated((response: azdata.TaskInfo) => {
					extHostDataProvider.$onTaskCreated(provider.handle, response);
				});

				provider.registerOnTaskStatusChanged((response: azdata.TaskProgressInfo) => {
					extHostDataProvider.$onTaskStatusChanged(provider.handle, response);
				});

				return extHostDataProvider.$registerTaskServicesProvider(provider);
			};

			let registerFileBrowserProvider = (provider: azdata.FileBrowserProvider): vscode.Disposable => {
				provider.registerOnFileBrowserOpened((response: azdata.FileBrowserOpenedParams) => {
					extHostDataProvider.$onFileBrowserOpened(provider.handle, response);
				});

				provider.registerOnFolderNodeExpanded((response: azdata.FileBrowserExpandedParams) => {
					extHostDataProvider.$onFolderNodeExpanded(provider.handle, response);
				});

				provider.registerOnFilePathsValidated((response: azdata.FileBrowserValidatedParams) => {
					extHostDataProvider.$onFilePathsValidated(provider.handle, response);
				});

				return extHostDataProvider.$registerFileBrowserProvider(provider);
			};

			let registerScriptingProvider = (provider: azdata.ScriptingProvider): vscode.Disposable => {
				provider.registerOnScriptingComplete((response: azdata.ScriptingCompleteResult) => {
					extHostDataProvider.$onScriptingComplete(provider.handle, response);
				});

				return extHostDataProvider.$registerScriptingProvider(provider);
			};

			let registerProfilerProvider = (provider: azdata.ProfilerProvider): vscode.Disposable => {
				provider.registerOnSessionEventsAvailable((response: azdata.ProfilerSessionEvents) => {
					extHostDataProvider.$onSessionEventsAvailable(provider.handle, response);
				});

				provider.registerOnSessionStopped((response: azdata.ProfilerSessionStoppedParams) => {
					extHostDataProvider.$onSessionStopped(provider.handle, response);
				});

				provider.registerOnProfilerSessionCreated((response: azdata.ProfilerSessionCreatedParams) => {
					extHostDataProvider.$onProfilerSessionCreated(provider.handle, response);
				});

				return extHostDataProvider.$registerProfilerProvider(provider);
			};

			let registerBackupProvider = (provider: azdata.BackupProvider): vscode.Disposable => {
				return extHostDataProvider.$registerBackupProvider(provider);
			};

			let registerRestoreProvider = (provider: azdata.RestoreProvider): vscode.Disposable => {
				return extHostDataProvider.$registerRestoreProvider(provider);
			};

			let registerMetadataProvider = (provider: azdata.MetadataProvider): vscode.Disposable => {
				return extHostDataProvider.$registerMetadataProvider(provider);
			};

			let registerCapabilitiesServiceProvider = (provider: azdata.CapabilitiesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerCapabilitiesServiceProvider(provider);
			};

			let registerAdminServicesProvider = (provider: azdata.AdminServicesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerAdminServicesProvider(provider);
			};

			let registerAgentServicesProvider = (provider: azdata.AgentServicesProvider): vscode.Disposable => {
				provider.registerOnUpdated(() => {
					extHostDataProvider.$onJobDataUpdated(provider.handle);
				});

				return extHostDataProvider.$registerAgentServiceProvider(provider);
			};

			let registerSerializationProvider = (provider: azdata.SerializationProvider): vscode.Disposable => {
				return extHostDataProvider.$registerSerializationProvider(provider);
			};

			// namespace: dataprotocol
			const dataprotocol: typeof azdata.dataprotocol = {
				registerBackupProvider,
				registerConnectionProvider,
				registerFileBrowserProvider,
				registerMetadataProvider,
				registerObjectExplorerProvider,
				registerObjectExplorerNodeProvider,
				registerIconProvider,
				registerProfilerProvider,
				registerRestoreProvider,
				registerScriptingProvider,
				registerTaskServicesProvider,
				registerQueryProvider,
				registerAdminServicesProvider,
				registerAgentServicesProvider,
				registerCapabilitiesServiceProvider,
				registerSerializationProvider,
				onDidChangeLanguageFlavor(listener: (e: azdata.DidChangeLanguageFlavorParams) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
					return extHostDataProvider.onDidChangeLanguageFlavor(listener, thisArgs, disposables);
				},
				getProvider<T extends azdata.DataProvider>(providerId: string, providerType: azdata.DataProviderType) {
					return extHostDataProvider.getProvider<T>(providerId, providerType);
				},
				getProvidersByType<T extends azdata.DataProvider>(providerType: azdata.DataProviderType) {
					return extHostDataProvider.getProvidersByType<T>(providerType);
				}
			};

			const window: typeof azdata.window = {
				createWebViewDialog(name: string) {
					return extHostModalDialogs.createDialog(name);
				},
				createModelViewDialog(title: string, dialogName?: string, isWide?: boolean): azdata.window.Dialog {
					return extHostModelViewDialog.createDialog(title, dialogName, extension, !!isWide);
				},
				createTab(title: string): azdata.window.DialogTab {
					return extHostModelViewDialog.createTab(title, extension);
				},
				createButton(label: string): azdata.window.Button {
					return extHostModelViewDialog.createButton(label);
				},
				openDialog(dialog: azdata.window.Dialog) {
					return extHostModelViewDialog.openDialog(dialog);
				},
				closeDialog(dialog: azdata.window.Dialog) {
					return extHostModelViewDialog.closeDialog(dialog);
				},
				createWizardPage(title: string): azdata.window.WizardPage {
					return extHostModelViewDialog.createWizardPage(title);
				},
				createWizard(title: string): azdata.window.Wizard {
					return extHostModelViewDialog.createWizard(title);
				},
				MessageLevel: sqlExtHostTypes.MessageLevel
			};

			const tasks: typeof azdata.tasks = {
				registerTask(id: string, task: (...args: any[]) => any, thisArgs?: any): vscode.Disposable {
					return extHostTasks.registerTask(id, task, thisArgs);
				},
				startBackgroundOperation(operationInfo: azdata.BackgroundOperationInfo): void {
					extHostBackgroundTaskManagement.$registerTask(operationInfo);
				}
			};

			const workspace: typeof azdata.workspace = {
				onDidOpenDashboard: extHostDashboard.onDidOpenDashboard,
				onDidChangeToDashboard: extHostDashboard.onDidChangeToDashboard,
				createModelViewEditor(title: string, options?: azdata.ModelViewEditorOptions): azdata.workspace.ModelViewEditor {
					return extHostModelViewDialog.createModelViewEditor(title, extension, options);
				}
			};

			const dashboard = {
				registerWebviewProvider(widgetId: string, handler: (webview: azdata.DashboardWebview) => void) {
					extHostWebviewWidgets.$registerProvider(widgetId, handler);
				}
			};

			const ui = {
				registerModelViewProvider(modelViewId: string, handler: (view: azdata.ModelView) => void): void {
					extHostModelView.$registerProvider(modelViewId, handler, extension);
				}
			};

			// namespace: queryeditor
			const queryEditor: typeof azdata.queryeditor = {
				connect(fileUri: string, connectionId: string): Thenable<void> {
					return extHostQueryEditor.$connect(fileUri, connectionId);
				},

				runQuery(fileUri: string, options?: Map<string, string>, runCurrentQuery: boolean = true): void {
					extHostQueryEditor.$runQuery(fileUri, runCurrentQuery);
				},

				registerQueryEventListener(listener: azdata.queryeditor.QueryEventListener): void {
					extHostQueryEditor.$registerQueryInfoListener(mssqlProviderName, listener);
				},

				getQueryDocument(fileUri: string): Thenable<azdata.queryeditor.QueryDocument> {
					return extHostQueryEditor.$getQueryDocument(fileUri);
				}
			};

			const extensions: typeof azdata.extensions = {
				install(vsixPath: string): Thenable<string> {
					return extHostExtensionManagement.$install(vsixPath);
				}
			};

			const nb = {
				get notebookDocuments() {
					return extHostNotebookDocumentsAndEditors.getAllDocuments().map(doc => doc.document);
				},
				get activeNotebookEditor() {
					return extHostNotebookDocumentsAndEditors.getActiveEditor();
				},
				get visibleNotebookEditors() {
					return extHostNotebookDocumentsAndEditors.getAllEditors();
				},
				get onDidOpenNotebookDocument() {
					return extHostNotebookDocumentsAndEditors.onDidOpenNotebookDocument;
				},
				get onDidChangeNotebookCell() {
					return extHostNotebookDocumentsAndEditors.onDidChangeNotebookCell;
				},
				showNotebookDocument(uri: vscode.Uri, showOptions: azdata.nb.NotebookShowOptions) {
					return extHostNotebookDocumentsAndEditors.showNotebookDocument(uri, showOptions);
				},
				registerNotebookProvider(provider: azdata.nb.NotebookProvider): vscode.Disposable {
					return extHostNotebook.registerNotebookProvider(provider);
				},
				registerNavigationProvider(provider: azdata.nb.NavigationProvider): vscode.Disposable {
					return extHostNotebookDocumentsAndEditors.registerNavigationProvider(provider);
				},
				CellRange: sqlExtHostTypes.CellRange,
				NotebookChangeKind: sqlExtHostTypes.NotebookChangeKind
			};

			return {
				accounts,
				connection,
				credentials,
				objectexplorer: objectExplorer,
				resources,
				dataprotocol,
				DataProviderType: sqlExtHostTypes.DataProviderType,
				DeclarativeDataType: sqlExtHostTypes.DeclarativeDataType,
				ServiceOptionType: sqlExtHostTypes.ServiceOptionType,
				ConnectionOptionSpecialType: sqlExtHostTypes.ConnectionOptionSpecialType,
				EditRowState: sqlExtHostTypes.EditRowState,
				MetadataType: sqlExtHostTypes.MetadataType,
				TaskStatus: sqlExtHostTypes.TaskStatus,
				TaskExecutionMode: sqlExtHostTypes.TaskExecutionMode,
				ScriptOperation: sqlExtHostTypes.ScriptOperation,
				WeekDays: sqlExtHostTypes.WeekDays,
				NotifyMethods: sqlExtHostTypes.NotifyMethods,
				JobCompletionActionCondition: sqlExtHostTypes.JobCompletionActionCondition,
				JobExecutionStatus: sqlExtHostTypes.JobExecutionStatus,
				AlertType: sqlExtHostTypes.AlertType,
				FrequencyTypes: sqlExtHostTypes.FrequencyTypes,
				FrequencySubDayTypes: sqlExtHostTypes.FrequencySubDayTypes,
				FrequencyRelativeIntervals: sqlExtHostTypes.FrequencyRelativeIntervals,
				window,
				tasks,
				dashboard,
				workspace,
				queryeditor: queryEditor,
				ui: ui,
				StatusIndicator: sqlExtHostTypes.StatusIndicator,
				CardType: sqlExtHostTypes.CardType,
				Orientation: sqlExtHostTypes.Orientation,
				SqlThemeIcon: sqlExtHostTypes.SqlThemeIcon,
				TreeComponentItem: sqlExtHostTypes.TreeComponentItem,
				nb: nb,
				AzureResource: sqlExtHostTypes.AzureResource,
				TreeItem: sqlExtHostTypes.TreeItem,
				extensions: extensions,
				ColumnType: sqlExtHostTypes.ColumnType,
				ActionOnCellCheckboxCheck: sqlExtHostTypes.ActionOnCellCheckboxCheck,
				StepCompletionAction: sqlExtHostTypes.StepCompletionAction,
				AgentSubSystem: sqlExtHostTypes.AgentSubSystem,
				ExtensionNodeType: sqlExtHostTypes.ExtensionNodeType,
				ColumnSizingMode: sqlExtHostTypes.ColumnSizingMode
			};
		},

		// "sqlops" namespace provided for back-compat only, add new interfaces to "azdata"
		sqlops: function (extension: IExtensionDescription): typeof sqlops {

			extHostExtensionManagement.$showObsoleteExtensionApiUsageNotification(localize('ObsoleteApiModuleMessage', "The extension \"{0}\" is using sqlops module which has been replaced by azdata module, the sqlops module will be removed in a future release.", extension.identifier.value));
			// namespace: connection
			const connection: typeof sqlops.connection = {
				getActiveConnections(): Thenable<sqlops.connection.Connection[]> {
					return extHostConnectionManagement.$getActiveConnections();
				},
				getCurrentConnection(): Thenable<sqlops.connection.Connection> {
					return extHostConnectionManagement.$getSqlOpsCurrentConnection();
				},
				getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
					return extHostConnectionManagement.$getCredentials(connectionId);
				},
				getServerInfo(connectionId: string): Thenable<sqlops.ServerInfo> {
					return extHostConnectionManagement.$getServerInfo(connectionId);
				},
				openConnectionDialog(providers?: string[], initialConnectionProfile?: sqlops.IConnectionProfile, connectionCompletionOptions?: sqlops.IConnectionCompletionOptions): Thenable<sqlops.connection.Connection> {
					return extHostConnectionManagement.$openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
				},
				listDatabases(connectionId: string): Thenable<string[]> {
					return extHostConnectionManagement.$listDatabases(connectionId);
				},
				getConnectionString(connectionId: string, includePassword: boolean): Thenable<string> {
					return extHostConnectionManagement.$getConnectionString(connectionId, includePassword);
				},
				getUriForConnection(connectionId: string): Thenable<string> {
					return extHostConnectionManagement.$getUriForConnection(connectionId);
				},
				connect(connectionProfile: sqlops.IConnectionProfile, saveConnection: boolean, showDashboard: boolean): Thenable<sqlops.ConnectionResult> {
					return extHostConnectionManagement.$connect(connectionProfile, saveConnection, showDashboard);
				}
			};

			// namespace: credentials
			const credentials: typeof sqlops.credentials = {
				registerProvider(provider: sqlops.CredentialProvider): vscode.Disposable {
					return extHostCredentialManagement.$registerCredentialProvider(provider);
				},
				getProvider(namespaceId: string): Thenable<sqlops.CredentialProvider> {
					return extHostCredentialManagement.$getCredentialProvider(namespaceId);
				}
			};

			// namespace: objectexplorer
			const objectExplorer: typeof sqlops.objectexplorer = {
				getNode(connectionId: string, nodePath?: string): Thenable<sqlops.objectexplorer.ObjectExplorerNode> {
					return extHostObjectExplorer.$getNode(connectionId, nodePath);
				},
				getActiveConnectionNodes(): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
					return extHostObjectExplorer.$getActiveConnectionNodes();
				},
				findNodes(connectionId: string, type: string, schema: string, name: string, database: string, parentObjectNames: string[]): Thenable<sqlops.objectexplorer.ObjectExplorerNode[]> {
					return extHostObjectExplorer.$findNodes(connectionId, type, schema, name, database, parentObjectNames);
				},
				getNodeActions(connectionId: string, nodePath: string): Thenable<string[]> {
					return extHostObjectExplorer.$getNodeActions(connectionId, nodePath);
				},
				getSessionConnectionProfile(sessionId: string): Thenable<sqlops.IConnectionProfile> {
					return extHostObjectExplorer.$getSessionConnectionProfile(sessionId);
				}
			};

			// namespace: serialization
			const serialization: typeof sqlops.serialization = {
				registerProvider(provider: sqlops.SerializationProvider): vscode.Disposable {
					// No-op this to avoid breaks in existing applications. Tested on Github - no examples,
					// but I think it's safer to avoid breaking this
					return undefined;
				},
			};


			let registerConnectionProvider = (provider: sqlops.ConnectionProvider): vscode.Disposable => {
				// Connection callbacks
				provider.registerOnConnectionComplete((connSummary: sqlops.ConnectionInfoSummary) => {
					extHostDataProvider.$onConnectComplete(provider.handle, connSummary);
				});

				provider.registerOnIntelliSenseCacheComplete((connectionUri: string) => {
					extHostDataProvider.$onIntelliSenseCacheComplete(provider.handle, connectionUri);
				});

				provider.registerOnConnectionChanged((changedConnInfo: sqlops.ChangedConnectionInfo) => {
					extHostDataProvider.$onConnectionChanged(provider.handle, changedConnInfo);
				});

				return extHostDataProvider.$registerConnectionProvider(provider);
			};

			let registerQueryProvider = (provider: sqlops.QueryProvider): vscode.Disposable => {
				provider.registerOnQueryComplete((result: sqlops.QueryExecuteCompleteNotificationResult) => {
					extHostDataProvider.$onQueryComplete(provider.handle, result);
				});

				provider.registerOnBatchStart((batchInfo: sqlops.QueryExecuteBatchNotificationParams) => {
					extHostDataProvider.$onBatchStart(provider.handle, batchInfo);
				});

				provider.registerOnBatchComplete((batchInfo: sqlops.QueryExecuteBatchNotificationParams) => {
					extHostDataProvider.$onBatchComplete(provider.handle, batchInfo);
				});

				provider.registerOnResultSetAvailable((resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams) => {
					extHostDataProvider.$onResultSetAvailable(provider.handle, resultSetInfo);
				});

				provider.registerOnResultSetUpdated((resultSetInfo: sqlops.QueryExecuteResultSetNotificationParams) => {
					extHostDataProvider.$onResultSetUpdated(provider.handle, resultSetInfo);
				});

				provider.registerOnMessage((message: sqlops.QueryExecuteMessageParams) => {
					extHostDataProvider.$onQueryMessage(provider.handle, message);
				});

				provider.registerOnEditSessionReady((ownerUri: string, success: boolean, message: string) => {
					extHostDataProvider.$onEditSessionReady(provider.handle, ownerUri, success, message);
				});

				return extHostDataProvider.$registerQueryProvider(<azdata.QueryProvider>provider);
			};

			let registerObjectExplorerProvider = (provider: sqlops.ObjectExplorerProvider): vscode.Disposable => {
				provider.registerOnSessionCreated((response: sqlops.ObjectExplorerSession) => {
					extHostDataProvider.$onObjectExplorerSessionCreated(provider.handle, response);
				});

				if (provider.registerOnSessionDisconnected) {
					provider.registerOnSessionDisconnected((response: sqlops.ObjectExplorerSession) => {
						extHostDataProvider.$onObjectExplorerSessionDisconnected(provider.handle, response);
					});
				}

				provider.registerOnExpandCompleted((response: sqlops.ObjectExplorerExpandInfo) => {
					extHostDataProvider.$onObjectExplorerNodeExpanded(provider.providerId, response);
				});

				return extHostDataProvider.$registerObjectExplorerProvider(provider);
			};

			let registerObjectExplorerNodeProvider = (provider: sqlops.ObjectExplorerNodeProvider): vscode.Disposable => {
				provider.registerOnExpandCompleted((response: sqlops.ObjectExplorerExpandInfo) => {
					extHostDataProvider.$onObjectExplorerNodeExpanded(provider.providerId, response);
				});

				return extHostDataProvider.$registerObjectExplorerNodeProvider(provider);
			};

			let registerTaskServicesProvider = (provider: sqlops.TaskServicesProvider): vscode.Disposable => {
				provider.registerOnTaskCreated((response: sqlops.TaskInfo) => {
					extHostDataProvider.$onTaskCreated(provider.handle, response);
				});

				provider.registerOnTaskStatusChanged((response: sqlops.TaskProgressInfo) => {
					extHostDataProvider.$onTaskStatusChanged(provider.handle, response);
				});

				return extHostDataProvider.$registerTaskServicesProvider(provider);
			};

			let registerFileBrowserProvider = (provider: sqlops.FileBrowserProvider): vscode.Disposable => {
				provider.registerOnFileBrowserOpened((response: sqlops.FileBrowserOpenedParams) => {
					extHostDataProvider.$onFileBrowserOpened(provider.handle, response);
				});

				provider.registerOnFolderNodeExpanded((response: sqlops.FileBrowserExpandedParams) => {
					extHostDataProvider.$onFolderNodeExpanded(provider.handle, response);
				});

				provider.registerOnFilePathsValidated((response: sqlops.FileBrowserValidatedParams) => {
					extHostDataProvider.$onFilePathsValidated(provider.handle, response);
				});

				return extHostDataProvider.$registerFileBrowserProvider(provider);
			};

			let registerScriptingProvider = (provider: sqlops.ScriptingProvider): vscode.Disposable => {
				provider.registerOnScriptingComplete((response: sqlops.ScriptingCompleteResult) => {
					extHostDataProvider.$onScriptingComplete(provider.handle, response);
				});

				return extHostDataProvider.$registerScriptingProvider(provider);
			};

			let registerMetadataProvider = (provider: sqlops.MetadataProvider): vscode.Disposable => {
				return extHostDataProvider.$registerMetadataProvider(provider);
			};

			let registerCapabilitiesServiceProvider = (provider: sqlops.CapabilitiesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerCapabilitiesServiceProvider(provider);
			};

			let registerAdminServicesProvider = (provider: sqlops.AdminServicesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerAdminServicesProvider(provider);
			};


			// namespace: dataprotocol
			const dataprotocol: typeof sqlops.dataprotocol = {
				registerConnectionProvider,
				registerFileBrowserProvider,
				registerMetadataProvider,
				registerObjectExplorerProvider,
				registerObjectExplorerNodeProvider,
				registerScriptingProvider,
				registerTaskServicesProvider,
				registerQueryProvider,
				registerAdminServicesProvider,
				registerCapabilitiesServiceProvider,
				onDidChangeLanguageFlavor(listener: (e: sqlops.DidChangeLanguageFlavorParams) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
					return extHostDataProvider.onDidChangeLanguageFlavor(listener, thisArgs, disposables);
				},
				getProvider<T extends sqlops.DataProvider>(providerId: string, providerType: sqlops.DataProviderType) {
					return extHostDataProvider.getProvider<T>(providerId, providerType);
				},
				getProvidersByType<T extends sqlops.DataProvider>(providerType: sqlops.DataProviderType) {
					return extHostDataProvider.getProvidersByType<T>(providerType);
				}
			};

			const modelViewDialog: typeof sqlops.window.modelviewdialog = {
				createDialog(title: string, dialogName?: string): sqlops.window.modelviewdialog.Dialog {
					console.warn('the method sqlops.window.modelviewdialog.createDialog has been deprecated, replace it with azdata.window.createModelViewDialog');
					return extHostModelViewDialog.createDialog(title, dialogName, extension);
				},
				createTab(title: string): sqlops.window.modelviewdialog.DialogTab {
					console.warn('the method sqlops.window.modelviewdialog.createTab has been deprecated, replace it with azdata.window.createTab');
					return extHostModelViewDialog.createTab(title, extension);
				},
				createButton(label: string): sqlops.window.modelviewdialog.Button {
					console.warn('the method sqlops.window.modelviewdialog.createButton has been deprecated, replace it with azdata.window.createButton');
					return extHostModelViewDialog.createButton(label);
				},
				openDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
					console.warn('the method sqlops.window.modelviewdialog.openDialog has been deprecated, replace it with azdata.window.openDialog');
					return extHostModelViewDialog.openDialog(dialog as azdata.window.Dialog);
				},
				closeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
					console.warn('the method sqlops.window.modelviewdialog.closeDialog has been deprecated, replace it with azdata.window.closeDialog');
					return extHostModelViewDialog.closeDialog(dialog as azdata.window.Dialog);
				},
				createWizardPage(title: string): sqlops.window.modelviewdialog.WizardPage {
					console.warn('the method sqlops.window.modelviewdialog.createWizardPage has been deprecated, replace it with azdata.window.createWizardPage');
					return extHostModelViewDialog.createWizardPage(title);
				},
				createWizard(title: string): sqlops.window.modelviewdialog.Wizard {
					console.warn('the method sqlops.window.modelviewdialog.createWizard has been deprecated, replace it with azdata.window.createWizard');
					return extHostModelViewDialog.createWizard(title);
				},
				MessageLevel: sqlExtHostTypes.MessageLevel
			};

			const window: typeof sqlops.window = {
				createDialog(name: string) {
					console.warn('the method sqlops.window.createDialog has been deprecated, replace it with azdata.window.createWebViewDialog');
					return extHostModalDialogs.createDialog(name);
				},
				modelviewdialog: modelViewDialog,
				createWebViewDialog(name: string) {
					return extHostModalDialogs.createDialog(name);
				},
				createModelViewDialog(title: string, dialogName?: string): sqlops.window.Dialog {
					return extHostModelViewDialog.createDialog(title, dialogName, extension);
				},
				createTab(title: string): sqlops.window.DialogTab {
					return extHostModelViewDialog.createTab(title, extension);
				},
				createButton(label: string): sqlops.window.Button {
					return extHostModelViewDialog.createButton(label);
				},
				openDialog(dialog: sqlops.window.Dialog) {
					return extHostModelViewDialog.openDialog(dialog as azdata.window.Dialog);
				},
				closeDialog(dialog: sqlops.window.Dialog) {
					return extHostModelViewDialog.closeDialog(dialog as azdata.window.Dialog);
				},
				createWizardPage(title: string): sqlops.window.WizardPage {
					return extHostModelViewDialog.createWizardPage(title);
				},
				createWizard(title: string): sqlops.window.Wizard {
					return extHostModelViewDialog.createWizard(title);
				},
				MessageLevel: sqlExtHostTypes.MessageLevel
			};

			const tasks: typeof sqlops.tasks = {
				registerTask(id: string, task: (...args: any[]) => any, thisArgs?: any): vscode.Disposable {
					return extHostTasks.registerTask(id, task, thisArgs);
				},
				startBackgroundOperation(operationInfo: sqlops.BackgroundOperationInfo): void {
					extHostBackgroundTaskManagement.$registerTask(operationInfo);
				}
			};

			const workspace: typeof sqlops.workspace = {
				onDidOpenDashboard: extHostDashboard.onDidOpenDashboard,
				onDidChangeToDashboard: extHostDashboard.onDidChangeToDashboard,
				createModelViewEditor(title: string, options?: sqlops.ModelViewEditorOptions): sqlops.workspace.ModelViewEditor {
					return extHostModelViewDialog.createModelViewEditor(title, extension, options);
				}
			};

			const dashboard = {
				registerWebviewProvider(widgetId: string, handler: (webview: sqlops.DashboardWebview) => void) {
					extHostWebviewWidgets.$registerProvider(widgetId, handler);
				}
			};

			const ui = {
				registerModelViewProvider(modelViewId: string, handler: (view: sqlops.ModelView) => void): void {
					extHostModelView.$registerProvider(modelViewId, handler, extension);
				}
			};

			// namespace: queryeditor
			const queryEditor: typeof sqlops.queryeditor = {

				connect(fileUri: string, connectionId: string): Thenable<void> {
					return extHostQueryEditor.$connect(fileUri, connectionId);
				},

				runQuery(fileUri: string): void {
					extHostQueryEditor.$runQuery(fileUri);
				}
			};

			const extensions: typeof sqlops.extensions = {
				install(vsixPath: string): Thenable<string> {
					return extHostExtensionManagement.$install(vsixPath);
				}
			};

			return {
				connection,
				credentials,
				objectexplorer: objectExplorer,
				serialization,
				dataprotocol,
				DataProviderType: sqlExtHostTypes.DataProviderType,
				DeclarativeDataType: sqlExtHostTypes.DeclarativeDataType,
				ServiceOptionType: sqlExtHostTypes.ServiceOptionType,
				ConnectionOptionSpecialType: sqlExtHostTypes.ConnectionOptionSpecialType,
				EditRowState: sqlExtHostTypes.EditRowState,
				MetadataType: sqlExtHostTypes.MetadataType,
				TaskStatus: sqlExtHostTypes.TaskStatus,
				TaskExecutionMode: sqlExtHostTypes.TaskExecutionMode,
				ScriptOperation: sqlExtHostTypes.ScriptOperation,
				window,
				tasks,
				dashboard,
				workspace,
				queryeditor: queryEditor,
				ui: ui,
				StatusIndicator: sqlExtHostTypes.StatusIndicator,
				CardType: sqlExtHostTypes.CardType,
				Orientation: sqlExtHostTypes.Orientation,
				SqlThemeIcon: sqlExtHostTypes.SqlThemeIcon,
				TreeComponentItem: sqlExtHostTypes.TreeComponentItem,
				AzureResource: sqlExtHostTypes.AzureResource,
				extensions: extensions,
				TreeItem: sqlExtHostTypes.TreeItem
			};
		}
	};
}
