/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


// #######################################################################
// ###                                                                 ###
// ### !!! PLEASE ADD COMMON IMPORTS INTO WORKBENCH.COMMON.MAIN.TS !!! ###
// ###                                                                 ###
// #######################################################################


//#region --- workbench common

import 'vs/workbench/workbench.common.main';

//#endregion


//#region --- workbench (desktop main)
import 'sql/setup'; // {{SQL CARBON EDIT}}

import 'vs/workbench/electron-browser/desktop.contribution';
import 'vs/workbench/electron-browser/desktop.main';

//#endregion


//#region --- workbench services
import 'vs/workbench/services/integrity/node/integrityService';
import 'vs/workbench/services/textMate/electron-browser/textMateService';
import 'vs/workbench/services/search/node/searchService';
import 'vs/workbench/services/output/node/outputChannelModelService';
import 'vs/workbench/services/textfile/node/textFileService';
import 'vs/workbench/services/dialogs/electron-browser/dialogService';
import 'vs/workbench/services/keybinding/electron-browser/nativeKeymapService';
import 'vs/workbench/services/keybinding/electron-browser/keybinding.contribution';
import 'vs/workbench/services/extensions/electron-browser/extensionService';
import 'vs/workbench/services/contextmenu/electron-browser/contextmenuService';
import 'vs/workbench/services/extensionManagement/electron-browser/extensionManagementServerService';
import 'vs/workbench/services/remote/electron-browser/remoteAgentServiceImpl';
import 'vs/workbench/services/window/electron-browser/windowService';
import 'vs/workbench/services/telemetry/electron-browser/telemetryService';
import 'vs/workbench/services/configurationResolver/electron-browser/configurationResolverService';
import 'vs/workbench/services/extensionManagement/node/extensionManagementService';
import 'vs/workbench/services/accessibility/node/accessibilityService';
import 'vs/workbench/services/remote/node/tunnelService';
import 'vs/workbench/services/backup/node/backupFileService';
import 'vs/workbench/services/credentials/node/credentialsService';
import 'vs/workbench/services/url/electron-browser/urlService';

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ClipboardService } from 'vs/platform/clipboard/electron-browser/clipboardService';
import { IRequestService } from 'vs/platform/request/common/request';
import { RequestService } from 'vs/platform/request/browser/requestService';
import { LifecycleService } from 'vs/platform/lifecycle/electron-browser/lifecycleService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { ILocalizationsService } from 'vs/platform/localizations/common/localizations';
import { LocalizationsService } from 'vs/platform/localizations/electron-browser/localizationsService';
import { ISharedProcessService, SharedProcessService } from 'vs/platform/ipc/electron-browser/sharedProcessService';
import { IWindowsService } from 'vs/platform/windows/common/windows';
import { WindowsService } from 'vs/platform/windows/electron-browser/windowsService';
import { IUpdateService } from 'vs/platform/update/common/update';
import { UpdateService } from 'vs/platform/update/electron-browser/updateService';
import { IIssueService } from 'vs/platform/issue/node/issue';
import { IssueService } from 'vs/platform/issue/electron-browser/issueService';
import { IWorkspacesService } from 'vs/platform/workspaces/common/workspaces';
import { WorkspacesService } from 'vs/platform/workspaces/electron-browser/workspacesService';
import { IMenubarService } from 'vs/platform/menubar/node/menubar';
import { MenubarService } from 'vs/platform/menubar/electron-browser/menubarService';

registerSingleton(IClipboardService, ClipboardService, true);
registerSingleton(IRequestService, RequestService, true);
registerSingleton(ILifecycleService, LifecycleService);
registerSingleton(ILocalizationsService, LocalizationsService);
registerSingleton(ISharedProcessService, SharedProcessService, true);
registerSingleton(IWindowsService, WindowsService);
registerSingleton(IUpdateService, UpdateService);
registerSingleton(IIssueService, IssueService);
registerSingleton(IWorkspacesService, WorkspacesService);
registerSingleton(IMenubarService, MenubarService);

//#endregion

// {{SQL CARBON EDIT}} - SQL-specific services
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementService } from 'sql/platform/connection/browser/connectionManagementService';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { ConnectionDialogService } from 'sql/workbench/services/connection/browser/connectionDialogService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ErrorMessageService } from 'sql/workbench/services/errorMessage/browser/errorMessageService';
import { ServerGroupController } from 'sql/workbench/services/serverGroup/browser/serverGroupController';
import { IServerGroupController } from 'sql/platform/serverGroup/common/serverGroupController';
import { IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { AngularEventingService } from 'sql/platform/angularEventing/node/angularEventingService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { CapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesServiceImpl';
import { ICredentialsService as sqlICredentialsService, CredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { ISerializationService, SerializationService } from 'sql/platform/serialization/common/serializationService';
import { IMetadataService, MetadataService } from 'sql/platform/metadata/common/metadataService';
import { IObjectExplorerService, ObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { ITaskService, TaskService } from 'sql/platform/tasks/common/tasksService';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { QueryModelService } from 'sql/platform/query/common/queryModelService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { QueryEditorService } from 'sql/workbench/services/queryEditor/browser/queryEditorService';
import { IQueryManagementService, QueryManagementService } from 'sql/platform/query/common/queryManagement';
import { IEditorDescriptorService, EditorDescriptorService } from 'sql/workbench/services/queryEditor/browser/editorDescriptorService';
import { IScriptingService, ScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IAdminService, AdminService } from 'sql/workbench/services/admin/common/adminService';
import { IJobManagementService } from 'sql/platform/jobManagement/common/interfaces';
import { JobManagementService } from 'sql/platform/jobManagement/common/jobManagementService';
import { IBackupService } from 'sql/platform/backup/common/backupService';
import { BackupService } from 'sql/platform/backup/common/backupServiceImp';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';
import { BackupUiService } from 'sql/workbench/services/backup/browser/backupUiService';
import { IRestoreDialogController, IRestoreService } from 'sql/platform/restore/common/restoreService';
import { RestoreService, RestoreDialogController } from 'sql/platform/restore/browser/restoreServiceImpl';
import { INewDashboardTabDialogService } from 'sql/workbench/services/dashboard/browser/newDashboardTabDialog';
import { NewDashboardTabDialogService } from 'sql/workbench/services/dashboard/browser/newDashboardTabDialogService';
import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { FileBrowserService } from 'sql/platform/fileBrowser/common/fileBrowserService';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { FileBrowserDialogController } from 'sql/workbench/services/fileBrowser/browser/fileBrowserDialogController';
import { IInsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { InsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogServiceImpl';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';
import { AccountManagementService } from 'sql/workbench/services/accountManagement/browser/accountManagementService';
import { IProfilerService } from 'sql/workbench/services/profiler/browser/interfaces';
import { ProfilerService } from 'sql/workbench/services/profiler/browser/profilerService';
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';
import { SqlOAuthService } from 'sql/platform/oAuth/electron-browser/sqlOAuthServiceImpl';
import { IClipboardService as sqlIClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ClipboardService as sqlClipboardService } from 'sql/platform/clipboard/electron-browser/clipboardService';
import { AccountPickerService } from 'sql/platform/accounts/browser/accountPickerService';
import { IAccountPickerService } from 'sql/platform/accounts/browser/accountPicker';
import { IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { ResourceProviderService } from 'sql/workbench/services/resourceProvider/browser/resourceProviderService';
import { IDashboardViewService } from 'sql/platform/dashboard/browser/dashboardViewService';
import { DashboardViewService } from 'sql/platform/dashboard/browser/dashboardViewServiceImpl';
import { IModelViewService } from 'sql/platform/modelComponents/browser/modelViewService';
import { ModelViewService } from 'sql/platform/modelComponents/browser/modelViewServiceImpl';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { DashboardService } from 'sql/platform/dashboard/browser/dashboardServiceImpl';
import { NotebookService } from 'sql/workbench/services/notebook/browser/notebookServiceImpl';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { OEShimService, IOEShimService } from 'sql/workbench/parts/objectExplorer/browser/objectExplorerViewTreeShim';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { AdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';
import { IQueryHistoryService } from 'sql/platform/queryHistory/common/queryHistoryService';
import { QueryHistoryService } from 'sql/platform/queryHistory/common/queryHistoryServiceImpl';

registerSingleton(IDashboardService, DashboardService);
registerSingleton(IDashboardViewService, DashboardViewService);
registerSingleton(IModelViewService, ModelViewService);
registerSingleton(IAngularEventingService, AngularEventingService);
registerSingleton(INewDashboardTabDialogService, NewDashboardTabDialogService);
registerSingleton(ISqlOAuthService, SqlOAuthService);
registerSingleton(sqlIClipboardService, sqlClipboardService);
registerSingleton(ICapabilitiesService, CapabilitiesService);
registerSingleton(IErrorMessageService, ErrorMessageService);
registerSingleton(IConnectionDialogService, ConnectionDialogService);
registerSingleton(IServerGroupController, ServerGroupController);
registerSingleton(sqlICredentialsService, CredentialsService);
registerSingleton(IResourceProviderService, ResourceProviderService);
registerSingleton(IAccountManagementService, AccountManagementService);
registerSingleton(IConnectionManagementService, ConnectionManagementService as any);
registerSingleton(ISerializationService, SerializationService);
registerSingleton(IQueryManagementService, QueryManagementService);
registerSingleton(IQueryModelService, QueryModelService);
registerSingleton(IQueryEditorService, QueryEditorService);
registerSingleton(IEditorDescriptorService, EditorDescriptorService);
registerSingleton(ITaskService, TaskService);
registerSingleton(IMetadataService, MetadataService);
registerSingleton(IObjectExplorerService, ObjectExplorerService);
registerSingleton(IOEShimService, OEShimService);
registerSingleton(IScriptingService, ScriptingService);
registerSingleton(IAdminService, AdminService);
registerSingleton(IJobManagementService, JobManagementService);
registerSingleton(IBackupService, BackupService);
registerSingleton(IBackupUiService, BackupUiService);
registerSingleton(IRestoreService, RestoreService);
registerSingleton(IRestoreDialogController, RestoreDialogController);
registerSingleton(IFileBrowserService, FileBrowserService);
registerSingleton(IFileBrowserDialogController, FileBrowserDialogController);
registerSingleton(IInsightsDialogService, InsightsDialogService);
registerSingleton(INotebookService, NotebookService);
registerSingleton(IAccountPickerService, AccountPickerService);
registerSingleton(IProfilerService, ProfilerService);
registerSingleton(IAdsTelemetryService, AdsTelemetryService);
registerSingleton(IQueryHistoryService, QueryHistoryService);
// {{SQL CARBON EDIT}} - End

//#region --- workbench contributions

// Localizations
import 'vs/workbench/contrib/localizations/browser/localizations.contribution';

// Stats
import 'vs/workbench/contrib/stats/electron-browser/workspaceStatsService';
import 'vs/workbench/contrib/stats/electron-browser/stats.contribution';

// Rapid Render Splash
import 'vs/workbench/contrib/splash/electron-browser/partsSplash.contribution';

// Debug
// import 'vs/workbench/contrib/debug/node/debugHelperService'; {{SQL CARBON EDIT}}
import 'vs/workbench/contrib/debug/electron-browser/extensionHostDebugService';

// Webview
import 'vs/workbench/contrib/webview/electron-browser/webview.contribution';

// Extensions Management
import 'vs/workbench/contrib/extensions/electron-browser/extensions.contribution';

// Terminal
import 'vs/workbench/contrib/terminal/electron-browser/terminal.contribution';

// Remote
import 'vs/workbench/contrib/remote/electron-browser/remote.contribution';

// CodeEditor Contributions
import 'vs/workbench/contrib/codeEditor/electron-browser/codeEditor.contribution';

// Execution
import 'vs/workbench/contrib/externalTerminal/node/externalTerminalService';

// Update
import 'vs/workbench/contrib/update/electron-browser/update.contribution';

// Surveys
import 'vs/workbench/contrib/surveys/electron-browser/nps.contribution';
import 'vs/workbench/contrib/surveys/electron-browser/languageSurveys.contribution';

// Performance
import 'vs/workbench/contrib/performance/electron-browser/performance.contribution';

// CLI
import 'vs/workbench/contrib/cli/node/cli.contribution';

// Themes Support
import 'vs/workbench/contrib/themes/test/electron-browser/themes.test.contribution';

// Welcome
import 'vs/workbench/contrib/welcome/walkThrough/browser/walkThrough.contribution';
import 'vs/workbench/contrib/welcome/gettingStarted/electron-browser/gettingStarted.contribution';
import 'vs/workbench/contrib/welcome/page/browser/welcomePage.contribution';

// Issues
import 'vs/workbench/contrib/issue/electron-browser/issue.contribution';

// Tasks
import 'vs/workbench/contrib/tasks/electron-browser/taskService';

// {{SQL CARBON EDIT}}
// SQL
import 'sql/workbench/parts/tasks/browser/tasks.contribution';
import 'sql/workbench/update/electron-browser/releaseNotes.contribution';

// data explorer
import 'sql/workbench/parts/dataExplorer/browser/dataExplorer.contribution';
import 'sql/workbench/parts/dataExplorer/browser/nodeActions.common.contribution';

import 'sql/workbench/parts/telemetry/common/telemetry.contribution';
import 'sql/workbench/parts/connection/browser/connection.contribution';

// Scripting
import 'sql/workbench/parts/scripting/electron-browser/scripting.contribution';

// query editor
import 'sql/workbench/parts/query/browser/query.contribution';
import 'sql/workbench/parts/query/common/resultsGridContribution';

// edit data editor
import 'sql/workbench/parts/editData/browser/editData.contribution';

// query plan editor
import 'sql/workbench/parts/queryPlan/electron-browser/queryPlan.contribution';

// query history
import 'sql/workbench/parts/queryHistory/electron-browser/queryHistory.contribution';

//accounts
import 'sql/workbench/parts/accounts/browser/accounts.contribution';

//backup
import 'sql/workbench/parts/backup/browser/backup.contribution';

//extensions
import 'sql/workbench/parts/dataExplorer/browser/extensions.contribution';

//restore
import 'sql/workbench/parts/restore/browser/restore.contribution';

import 'sql/workbench/parts/profiler/browser/profiler.contribution';
import 'sql/workbench/parts/profiler/browser/profilerActions.contribution';
import 'sql/workbench/parts/objectExplorer/common/serverGroup.contribution';
import 'sql/platform/accounts/browser/accountManagement.contribution';

// dashboard
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/barChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/doughnutChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/horizontalBarChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/lineChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/pieChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/scatterChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/charts/types/timeSeriesChart.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/countInsight.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/imageInsight.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/insights/views/tableInsight.contribution';
/* Widgets */
import 'sql/workbench/parts/dashboard/browser/widgets/insights/insightsWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerWidget.common.contribution';
import 'sql/workbench/parts/dashboard/electron-browser/widgets/explorer/explorerWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/tasks/tasksWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/webview/webviewWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/dashboard.contribution';
/* Tasks */
import 'sql/workbench/browser/actions.contribution';
/* Model-based Views */
import 'sql/workbench/browser/modelComponents/components.contribution';
/* View Model Editor */
import 'sql/workbench/browser/modelComponents/modelViewEditor.contribution';
/* Notebook Editor */
import 'sql/workbench/parts/notebook/browser/notebook.common.contribution';
import 'sql/workbench/parts/notebook/electron-browser/notebook.contribution';
/* Containers */
import 'sql/workbench/parts/dashboard/browser/containers/dashboardWebviewContainer.contribution';
import 'sql/workbench/parts/dashboard/browser/containers/dashboardControlHostContainer.contribution';
import 'sql/workbench/parts/dashboard/browser/containers/dashboardGridContainer.contribution';
import 'sql/workbench/parts/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import 'sql/workbench/parts/dashboard/browser/containers/dashboardContainer.contribution';
import 'sql/workbench/parts/dashboard/browser/containers/dashboardNavSection.contribution';
import 'sql/workbench/parts/dashboard/browser/containers/dashboardModelViewContainer.contribution';
import 'sql/workbench/parts/dashboard/browser/core/dashboardTab.contribution';

import 'sql/workbench/parts/commandLine/electron-browser/commandLine.contribution';
