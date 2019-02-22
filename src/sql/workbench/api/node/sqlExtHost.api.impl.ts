/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as extHostApi from 'vs/workbench/api/node/extHost.api.impl';
import { TrieMap } from 'sql/base/common/map';
import { TPromise } from 'vs/base/common/winjs.base';
import { IInitData, IExtHostContext, IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostExtensionService } from 'vs/workbench/api/node/extHostExtensionService';
import { IExtensionDescription } from 'vs/workbench/services/extensions/common/extensions';
import { realpath } from 'fs';
import * as extHostTypes from 'vs/workbench/api/node/extHostTypes';
import { URI } from 'vs/base/common/uri';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ExtHostAccountManagement } from 'sql/workbench/api/node/extHostAccountManagement';
import { ExtHostCredentialManagement } from 'sql/workbench/api/node/extHostCredentialManagement';
import { ExtHostDataProtocol } from 'sql/workbench/api/node/extHostDataProtocol';
import { ExtHostSerializationProvider } from 'sql/workbench/api/node/extHostSerializationProvider';
import { ExtHostResourceProvider } from 'sql/workbench/api/node/extHostResourceProvider';
import * as sqlExtHostTypes from 'sql/workbench/api/common/sqlExtHostTypes';
import { ExtHostWorkspace } from 'vs/workbench/api/node/extHostWorkspace';
import { ExtHostConfiguration } from 'vs/workbench/api/node/extHostConfiguration';
import { ExtHostModalDialogs } from 'sql/workbench/api/node/extHostModalDialog';
import { ExtHostTasks } from 'sql/workbench/api/node/extHostTasks';
import { ExtHostDashboardWebviews } from 'sql/workbench/api/node/extHostDashboardWebview';
import { ExtHostModelView } from 'sql/workbench/api/node/extHostModelView';
import { ExtHostConnectionManagement } from 'sql/workbench/api/node/extHostConnectionManagement';
import { ExtHostDashboard } from 'sql/workbench/api/node/extHostDashboard';
import { ExtHostObjectExplorer } from 'sql/workbench/api/node/extHostObjectExplorer';
import { ExtHostLogService } from 'vs/workbench/api/node/extHostLogService';
import { ExtHostModelViewDialog } from 'sql/workbench/api/node/extHostModelViewDialog';
import { ExtHostModelViewTreeViews } from 'sql/workbench/api/node/extHostModelViewTree';
import { ExtHostQueryEditor } from 'sql/workbench/api/node/extHostQueryEditor';
import { ExtHostBackgroundTaskManagement } from './extHostBackgroundTaskManagement';
import { ExtHostNotebook } from 'sql/workbench/api/node/extHostNotebook';
import { ExtHostNotebookDocumentsAndEditors } from 'sql/workbench/api/node/extHostNotebookDocumentsAndEditors';
import { ExtHostStorage } from 'vs/workbench/api/node/extHostStorage';
import { ExtensionDescriptionRegistry } from 'vs/workbench/services/extensions/node/extensionDescriptionRegistry';
import { ExtHostExtensionManagement } from 'sql/workbench/api/node/extHostExtensionManagement';

export interface ISqlExtensionApiFactory {
	vsCodeFactory(extension: IExtensionDescription, registry: ExtensionDescriptionRegistry): typeof vscode;
	sqlopsFactory(extension: IExtensionDescription): typeof sqlops;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactory(
	initData: IInitData,
	rpcProtocol: IMainContext,
	extHostWorkspace: ExtHostWorkspace,
	extHostConfiguration: ExtHostConfiguration,
	extensionService: ExtHostExtensionService,
	logService: ExtHostLogService,
	extHostStorage: ExtHostStorage
): ISqlExtensionApiFactory {
	let vsCodeFactory = extHostApi.createApiFactory(initData, rpcProtocol, extHostWorkspace, extHostConfiguration, extensionService, logService, extHostStorage);

	// Addressable instances
	const extHostAccountManagement = rpcProtocol.set(SqlExtHostContext.ExtHostAccountManagement, new ExtHostAccountManagement(rpcProtocol));
	const extHostConnectionManagement = rpcProtocol.set(SqlExtHostContext.ExtHostConnectionManagement, new ExtHostConnectionManagement(rpcProtocol));
	const extHostCredentialManagement = rpcProtocol.set(SqlExtHostContext.ExtHostCredentialManagement, new ExtHostCredentialManagement(rpcProtocol));
	const extHostDataProvider = rpcProtocol.set(SqlExtHostContext.ExtHostDataProtocol, new ExtHostDataProtocol(rpcProtocol));
	const extHostObjectExplorer = rpcProtocol.set(SqlExtHostContext.ExtHostObjectExplorer, new ExtHostObjectExplorer(rpcProtocol));
	const extHostSerializationProvider = rpcProtocol.set(SqlExtHostContext.ExtHostSerializationProvider, new ExtHostSerializationProvider(rpcProtocol));
	const extHostResourceProvider = rpcProtocol.set(SqlExtHostContext.ExtHostResourceProvider, new ExtHostResourceProvider(rpcProtocol));
	const extHostModalDialogs = rpcProtocol.set(SqlExtHostContext.ExtHostModalDialogs, new ExtHostModalDialogs(rpcProtocol));
	const extHostTasks = rpcProtocol.set(SqlExtHostContext.ExtHostTasks, new ExtHostTasks(rpcProtocol, logService));
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
		vsCodeFactory: vsCodeFactory,
		sqlopsFactory: function (extension: IExtensionDescription): typeof sqlops {
			// namespace: accounts
			const accounts: typeof sqlops.accounts = {
				registerAccountProvider(providerMetadata: sqlops.AccountProviderMetadata, provider: sqlops.AccountProvider): vscode.Disposable {
					return extHostAccountManagement.$registerAccountProvider(providerMetadata, provider);
				},
				beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
					return extHostAccountManagement.$beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
				},
				endAutoOAuthDeviceCode(): void {
					return extHostAccountManagement.$endAutoOAuthDeviceCode();
				},
				accountUpdated(updatedAccount: sqlops.Account): void {
					return extHostAccountManagement.$accountUpdated(updatedAccount);
				},
				getAllAccounts(): Thenable<sqlops.Account[]> {
					return extHostAccountManagement.$getAllAccounts();
				},
				getSecurityToken(account: sqlops.Account, resource?: sqlops.AzureResource): Thenable<{}> {
					return extHostAccountManagement.$getSecurityToken(account, resource);
				},
				onDidChangeAccounts(listener: (e: sqlops.DidChangeAccountsParams) => void, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
					return extHostAccountManagement.onDidChangeAccounts(listener, thisArgs, disposables);
				}
			};

			// namespace: connection
			const connection: typeof sqlops.connection = {
				getActiveConnections(): Thenable<sqlops.connection.Connection[]> {
					return extHostConnectionManagement.$getActiveConnections();
				},
				getCurrentConnection(): Thenable<sqlops.connection.Connection> {
					return extHostConnectionManagement.$getCurrentConnection();
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
				connect(connectionProfile: sqlops.IConnectionProfile): Thenable<sqlops.ConnectionResult> {
					return extHostConnectionManagement.$connect(connectionProfile);
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
					return extHostSerializationProvider.$registerSerializationProvider(provider);
				},
			};

			// namespace: serialization
			const resources: typeof sqlops.resources = {
				registerResourceProvider(providerMetadata: sqlops.ResourceProviderMetadata, provider: sqlops.ResourceProvider): vscode.Disposable {
					return extHostResourceProvider.$registerResourceProvider(providerMetadata, provider);
				}
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

				return extHostDataProvider.$registerQueryProvider(provider);
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

			let registerProfilerProvider = (provider: sqlops.ProfilerProvider): vscode.Disposable => {
				provider.registerOnSessionEventsAvailable((response: sqlops.ProfilerSessionEvents) => {
					extHostDataProvider.$onSessionEventsAvailable(provider.handle, response);
				});

				provider.registerOnSessionStopped((response: sqlops.ProfilerSessionStoppedParams) => {
					extHostDataProvider.$onSessionStopped(provider.handle, response);
				});

				provider.registerOnProfilerSessionCreated((response: sqlops.ProfilerSessionCreatedParams) => {
					extHostDataProvider.$onProfilerSessionCreated(provider.handle, response);
				});

				return extHostDataProvider.$registerProfilerProvider(provider);
			};

			let registerBackupProvider = (provider: sqlops.BackupProvider): vscode.Disposable => {
				return extHostDataProvider.$registerBackupProvider(provider);
			};

			let registerRestoreProvider = (provider: sqlops.RestoreProvider): vscode.Disposable => {
				return extHostDataProvider.$registerRestoreProvider(provider);
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

			let registerAgentServicesProvider = (provider: sqlops.AgentServicesProvider): vscode.Disposable => {
				provider.registerOnUpdated(() => {
					extHostDataProvider.$onJobDataUpdated(provider.handle);
				});

				return extHostDataProvider.$registerAgentServiceProvider(provider);
			};

			let registerDacFxServicesProvider = (provider: sqlops.DacFxServicesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerDacFxServiceProvider(provider);
			};

			// namespace: dataprotocol
			const dataprotocol: typeof sqlops.dataprotocol = {
				registerBackupProvider,
				registerConnectionProvider,
				registerFileBrowserProvider,
				registerMetadataProvider,
				registerObjectExplorerProvider,
				registerObjectExplorerNodeProvider,
				registerProfilerProvider,
				registerRestoreProvider,
				registerScriptingProvider,
				registerTaskServicesProvider,
				registerQueryProvider,
				registerAdminServicesProvider,
				registerAgentServicesProvider,
				registerCapabilitiesServiceProvider,
				registerDacFxServicesProvider,
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
					console.warn('the method sqlops.window.modelviewdialog.createDialog has been deprecated, replace it with sqlops.window.createModelViewDialog');
					return extHostModelViewDialog.createDialog(title, dialogName, extension);
				},
				createTab(title: string): sqlops.window.modelviewdialog.DialogTab {
					console.warn('the method sqlops.window.modelviewdialog.createTab has been deprecated, replace it with sqlops.window.createTab');
					return extHostModelViewDialog.createTab(title, extension);
				},
				createButton(label: string): sqlops.window.modelviewdialog.Button {
					console.warn('the method sqlops.window.modelviewdialog.createButton has been deprecated, replace it with sqlops.window.createButton');
					return extHostModelViewDialog.createButton(label);
				},
				openDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
					console.warn('the method sqlops.window.modelviewdialog.openDialog has been deprecated, replace it with sqlops.window.openDialog');
					return extHostModelViewDialog.openDialog(dialog);
				},
				closeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
					console.warn('the method sqlops.window.modelviewdialog.closeDialog has been deprecated, replace it with sqlops.window.closeDialog');
					return extHostModelViewDialog.closeDialog(dialog);
				},
				createWizardPage(title: string): sqlops.window.modelviewdialog.WizardPage {
					console.warn('the method sqlops.window.modelviewdialog.createWizardPage has been deprecated, replace it with sqlops.window.createWizardPage');
					return extHostModelViewDialog.createWizardPage(title);
				},
				createWizard(title: string): sqlops.window.modelviewdialog.Wizard {
					console.warn('the method sqlops.window.modelviewdialog.createWizard has been deprecated, replace it with sqlops.window.createWizard');
					return extHostModelViewDialog.createWizard(title);
				},
				MessageLevel: sqlExtHostTypes.MessageLevel
			};

			const window: typeof sqlops.window = {
				createDialog(name: string) {
					console.warn('the method sqlops.window.createDialog has been deprecated, replace it with sqlops.window.createWebViewDialog');
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
					return extHostModelViewDialog.openDialog(dialog);
				},
				closeDialog(dialog: sqlops.window.Dialog) {
					return extHostModelViewDialog.closeDialog(dialog);
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
				showNotebookDocument(uri: vscode.Uri, showOptions: sqlops.nb.NotebookShowOptions) {
					return extHostNotebookDocumentsAndEditors.showNotebookDocument(uri, showOptions);
				},
				registerNotebookProvider(provider: sqlops.nb.NotebookProvider): vscode.Disposable {
					return extHostNotebook.registerNotebookProvider(provider);
				},
				CellRange: sqlExtHostTypes.CellRange
			};

			return {
				accounts,
				connection,
				credentials,
				objectexplorer: objectExplorer,
				resources,
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
				extensions: extensions,
				TreeItem: sqlExtHostTypes.TreeItem,
			};
		}
	};
}

export function initializeExtensionApi(extensionService: ExtHostExtensionService, apiFactory: ISqlExtensionApiFactory, extensionRegistry: ExtensionDescriptionRegistry): TPromise<void> {
	return createExtensionPathIndex(extensionService, extensionRegistry).then(trie => defineAPI(apiFactory, trie, extensionRegistry));
}

function createExtensionPathIndex(extensionService: ExtHostExtensionService, extensionRegistry: ExtensionDescriptionRegistry): Promise<TrieMap<IExtensionDescription>> {

	// create trie to enable fast 'filename -> extension id' look up
	const trie = new TrieMap<IExtensionDescription>(TrieMap.PathSplitter);
	const extensions = extensionRegistry.getAllExtensionDescriptions().map(ext => {
		if (!ext.main) {
			return undefined;
		}
		return new Promise((resolve, reject) => {
			realpath(ext.extensionLocation.fsPath, (err, path) => {
				if (err) {
					reject(err);
				} else {
					trie.insert(path, ext);
					resolve(void 0);
				}
			});
		});
	});

	return Promise.all(extensions).then(() => trie);
}

function defineAPI(factory: ISqlExtensionApiFactory, extensionPaths: TrieMap<IExtensionDescription>, extensionRegistry: ExtensionDescriptionRegistry): void {
	type ApiImpl = typeof vscode | typeof sqlops;

	// each extension is meant to get its own api implementation
	const extApiImpl = new Map<string, typeof vscode>();
	const dataExtApiImpl = new Map<string, typeof sqlops>();
	let defaultApiImpl: typeof vscode;
	let defaultDataApiImpl: typeof sqlops;

	// The module factory looks for an entry in the API map for an extension. If found, it reuses this.
	// If not, it loads it & saves it in the map
	let getModuleFactory = function (apiMap: Map<string, any>,
		createApi: (extensionDescription: IExtensionDescription) => ApiImpl,
		defaultImpl: ApiImpl,
		setDefaultApiImpl: (defaultImpl: ApiImpl) => void,
		parent: any): ApiImpl {
		// get extension id from filename and api for extension
		const ext = extensionPaths.findSubstr(URI.file(parent.filename).fsPath);
		if (ext) {
			let apiImpl = apiMap.get(ext.id);
			if (!apiImpl) {
				apiImpl = createApi(ext);
				apiMap.set(ext.id, apiImpl);
			}
			return apiImpl;
		}

		// fall back to a default implementation
		if (!defaultImpl) {
			console.warn(`Could not identify extension for 'vscode' require call from ${parent.filename}`);
			defaultImpl = createApi(nullExtensionDescription);
			setDefaultApiImpl(defaultImpl);
		}
		return defaultImpl;
	};

	const node_module = <any>require.__$__nodeRequire('module');
	const original = node_module._load;

	// TODO look into de-duplicating this code
	node_module._load = function load(request, parent, isMain) {
		if (request === 'vscode') {
			return getModuleFactory(extApiImpl, (ext) => factory.vsCodeFactory(ext, extensionRegistry),
				defaultApiImpl,
				(impl) => defaultApiImpl = <typeof vscode>impl,
				parent);
		} else if (request === 'sqlops') {
			return getModuleFactory(dataExtApiImpl,
				(ext) => factory.sqlopsFactory(ext),
				defaultDataApiImpl,
				(impl) => defaultDataApiImpl = <typeof sqlops>impl,
				parent);
		} else {
			// Allow standard node_module load to occur
			return original.apply(this, arguments);
		}
	};
}


const nullExtensionDescription: IExtensionDescription = {
	id: 'nullExtensionDescription',
	name: 'Null Extension Description',
	publisher: 'vscode',
	activationEvents: undefined,
	contributes: undefined,
	enableProposedApi: false,
	engines: undefined,
	extensionDependencies: undefined,
	extensionLocation: undefined,
	isBuiltin: false,
	main: undefined,
	version: undefined,
	isUnderDevelopment: true
};
