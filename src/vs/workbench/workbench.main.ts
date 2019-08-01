/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//#region --- workbench/editor core

import 'vs/editor/editor.all';

import 'vs/workbench/api/browser/extensionHost.contribution';
import 'sql/workbench/api/electron-browser/extensionHost.contribution'; // {{SQL CARBON EDIT}} @anthonydresser add our extension contributions

import 'vs/workbench/electron-browser/main.contribution';
import 'vs/workbench/browser/workbench.contribution';

import 'vs/workbench/electron-browser/main';

//#endregion


//#region --- workbench actions

import 'vs/workbench/browser/actions/layoutActions';
import 'vs/workbench/browser/actions/windowActions';
import 'vs/workbench/browser/actions/developerActions';
import 'vs/workbench/browser/actions/listCommands';
import 'vs/workbench/browser/actions/navigationActions';
import 'vs/workbench/browser/parts/quickopen/quickOpenActions';
import 'vs/workbench/browser/parts/quickinput/quickInputActions';

//#endregion


//#region --- API Extension Points

import 'vs/workbench/api/common/menusExtensionPoint';
import 'vs/workbench/api/common/configurationExtensionPoint';
import 'vs/workbench/api/browser/viewsExtensionPoint';

//#endregion


//#region --- workbench services
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IMenuService } from 'vs/platform/actions/common/actions';
import { MenuService } from 'vs/platform/actions/common/menuService';
import { IListService, ListService } from 'vs/platform/list/browser/listService';
import { OpenerService } from 'vs/editor/browser/services/openerService';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorkerService';
import { EditorWorkerServiceImpl } from 'vs/editor/common/services/editorWorkerServiceImpl';
import { MarkerDecorationsService } from 'vs/editor/common/services/markerDecorationsServiceImpl';
import { IMarkerDecorationsService } from 'vs/editor/common/services/markersDecorationService';
import { IMarkerService } from 'vs/platform/markers/common/markers';
import { MarkerService } from 'vs/platform/markers/common/markerService';
import { IDownloadService } from 'vs/platform/download/common/download';
import { DownloadService } from 'vs/platform/download/common/downloadService';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ClipboardService } from 'vs/platform/clipboard/electron-browser/clipboardService';
import { ContextKeyService } from 'vs/platform/contextkey/browser/contextKeyService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ModelServiceImpl } from 'vs/editor/common/services/modelServiceImpl';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { TextResourceConfigurationService } from 'vs/editor/common/services/resourceConfigurationImpl';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { AccessibilityService } from 'vs/workbench/services/accessibility/node/accessibilityService';
import { IExtensionGalleryService, IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ContextViewService } from 'vs/platform/contextview/browser/contextViewService';
import { ExtensionGalleryService } from 'vs/platform/extensionManagement/common/extensionGalleryService';
import { IRequestService } from 'vs/platform/request/common/request';
import { RequestService } from 'vs/platform/request/browser/requestService';
import { LifecycleService } from 'vs/platform/lifecycle/electron-browser/lifecycleService';
import { ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { ILocalizationsService } from 'vs/platform/localizations/common/localizations';
import { LocalizationsService } from 'vs/platform/localizations/electron-browser/localizationsService';
import { ISharedProcessService, SharedProcessService } from 'vs/platform/ipc/electron-browser/sharedProcessService';
import { IProductService } from 'vs/platform/product/common/product';
import { ProductService } from 'vs/platform/product/node/productService';
import { IWindowsService } from 'vs/platform/windows/common/windows';
import { WindowsService } from 'vs/platform/windows/electron-browser/windowsService';
import { IUpdateService } from 'vs/platform/update/common/update';
import { UpdateService } from 'vs/platform/update/electron-browser/updateService';
import { IIssueService } from 'vs/platform/issue/common/issue';
import { IssueService } from 'vs/platform/issue/electron-browser/issueService';
import { IWorkspacesService } from 'vs/platform/workspaces/common/workspaces';
import { WorkspacesService } from 'vs/platform/workspaces/electron-browser/workspacesService';
import { IMenubarService } from 'vs/platform/menubar/common/menubar';
import { MenubarService } from 'vs/platform/menubar/electron-browser/menubarService';
import { IURLService } from 'vs/platform/url/common/url';
import { RelayURLService } from 'vs/platform/url/electron-browser/urlService';
import { ITunnelService } from 'vs/platform/remote/common/tunnel';
import { TunnelService } from 'vs/workbench/services/remote/node/tunnelService';
import { ICredentialsService } from 'vs/platform/credentials/common/credentials';
import { KeytarCredentialsService } from 'vs/platform/credentials/node/credentialsService';

import 'vs/workbench/services/bulkEdit/browser/bulkEditService';
import 'vs/workbench/services/integrity/node/integrityService';
import 'vs/workbench/services/keybinding/common/keybindingEditing';
import 'vs/workbench/services/textMate/electron-browser/textMateService';
import 'vs/workbench/services/workspace/electron-browser/workspaceEditingService';
import 'vs/workbench/services/extensions/common/inactiveExtensionUrlHandler';
import 'vs/workbench/services/decorations/browser/decorationsService';
import 'vs/workbench/services/search/node/searchService';
import 'vs/workbench/services/progress/browser/progressService';
import 'vs/workbench/services/editor/browser/codeEditorService';
import 'vs/workbench/services/extensions/electron-browser/extensionHostDebugService';
import 'vs/workbench/services/preferences/browser/preferencesService';
import 'vs/workbench/services/output/node/outputChannelModelService';
import 'vs/workbench/services/configuration/common/jsonEditingService';
import 'vs/workbench/services/textmodelResolver/common/textModelResolverService';
import 'vs/workbench/services/textfile/node/textFileService';
import 'vs/workbench/services/dialogs/browser/fileDialogService';
import 'vs/workbench/services/dialogs/electron-browser/dialogService';
import 'vs/workbench/services/editor/browser/editorService';
import 'vs/workbench/services/history/browser/history';
import 'vs/workbench/services/activity/browser/activityService';
import 'vs/workbench/browser/parts/views/views';
import 'vs/workbench/services/keybinding/electron-browser/nativeKeymapService';
import 'vs/workbench/services/keybinding/electron-browser/keybinding.contribution';
import 'vs/workbench/services/keybinding/browser/keybindingService';
import 'vs/workbench/services/untitled/common/untitledEditorService';
import 'vs/workbench/services/textfile/common/textResourcePropertiesService';
import 'vs/workbench/services/mode/common/workbenchModeService';
import 'vs/workbench/services/commands/common/commandService';
import 'vs/workbench/services/themes/browser/workbenchThemeService';
import 'vs/workbench/services/extensions/electron-browser/extensionService';
import 'vs/workbench/services/contextmenu/electron-browser/contextmenuService';
import 'vs/workbench/services/label/common/labelService';
import 'vs/workbench/services/extensionManagement/electron-browser/extensionManagementServerService';
import 'vs/workbench/services/extensionManagement/common/extensionEnablementService';
import 'vs/workbench/services/remote/electron-browser/remoteAgentServiceImpl';
import 'vs/workbench/services/notification/common/notificationService';
import 'vs/workbench/services/window/electron-browser/windowService';
import 'vs/workbench/services/telemetry/electron-browser/telemetryService';
import 'vs/workbench/services/configurationResolver/electron-browser/configurationResolverService';
import { IBackupFileService } from 'vs/workbench/services/backup/common/backup';
import { BackupFileService } from 'vs/workbench/services/backup/node/backupFileService';
import { ExtensionManagementService } from 'vs/workbench/services/extensionManagement/node/extensionManagementService';

registerSingleton(IExtensionManagementService, ExtensionManagementService);
registerSingleton(IBackupFileService, BackupFileService);
registerSingleton(IMenuService, MenuService, true);
registerSingleton(IListService, ListService, true);
registerSingleton(IOpenerService, OpenerService, true);
registerSingleton(IEditorWorkerService, EditorWorkerServiceImpl);
registerSingleton(IMarkerDecorationsService, MarkerDecorationsService);
registerSingleton(IMarkerService, MarkerService, true);
registerSingleton(IDownloadService, DownloadService, true);
registerSingleton(IClipboardService, ClipboardService, true);
registerSingleton(IContextKeyService, ContextKeyService);
registerSingleton(IModelService, ModelServiceImpl, true);
registerSingleton(ITextResourceConfigurationService, TextResourceConfigurationService);
registerSingleton(IAccessibilityService, AccessibilityService, true);
registerSingleton(IContextViewService, ContextViewService, true);
registerSingleton(IExtensionGalleryService, ExtensionGalleryService, true);
registerSingleton(IRequestService, RequestService, true);
registerSingleton(ILifecycleService, LifecycleService);
registerSingleton(ILocalizationsService, LocalizationsService);
registerSingleton(ISharedProcessService, SharedProcessService, true);
registerSingleton(IProductService, ProductService, true);
registerSingleton(IWindowsService, WindowsService);
registerSingleton(IUpdateService, UpdateService);
registerSingleton(IIssueService, IssueService);
registerSingleton(IWorkspacesService, WorkspacesService);
registerSingleton(IMenubarService, MenubarService);
registerSingleton(IURLService, RelayURLService);
registerSingleton(ITunnelService, TunnelService, true);
registerSingleton(ICredentialsService, KeytarCredentialsService, true);
registerSingleton(IWorkspaceStatsService, WorkspaceStatsService, true);

//#endregion

// {{SQL CARBON EDIT}} - SQL-specific services
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
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
import { IObjectExplorerService, ObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
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
import { IDacFxService, DacFxService } from 'sql/platform/dacfx/common/dacFxService';
import { ISchemaCompareService, SchemaCompareService } from 'sql/platform/schemaCompare/common/schemaCompareService';
import { IBackupService } from 'sql/platform/backup/common/backupService';
import { BackupService } from 'sql/platform/backup/common/backupServiceImp';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';
import { BackupUiService } from 'sql/workbench/services/backup/browser/backupUiService';
import { IRestoreDialogController, IRestoreService } from 'sql/platform/restore/common/restoreService';
import { RestoreService, RestoreDialogController } from 'sql/platform/restore/common/restoreServiceImpl';
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
import { IProfilerService } from 'sql/workbench/services/profiler/common/interfaces';
import { ProfilerService } from 'sql/workbench/services/profiler/browser/profilerService';
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';
import { SqlOAuthService } from 'sql/platform/oAuth/electron-browser/sqlOAuthServiceImpl';
import { IClipboardService as sqlIClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ClipboardService as sqlClipboardService } from 'sql/platform/clipboard/electron-browser/clipboardService';
import { AccountPickerService } from 'sql/platform/accounts/browser/accountPickerService';
import { IAccountPickerService } from 'sql/platform/accounts/common/accountPicker';
import { IResourceProviderService } from 'sql/workbench/services/resourceProvider/common/resourceProviderService';
import { ResourceProviderService } from 'sql/workbench/services/resourceProvider/browser/resourceProviderService';
import { IDashboardViewService } from 'sql/platform/dashboard/common/dashboardViewService';
import { DashboardViewService } from 'sql/platform/dashboard/common/dashboardViewServiceImpl';
import { IModelViewService } from 'sql/platform/modelComponents/common/modelViewService';
import { ModelViewService } from 'sql/platform/modelComponents/common/modelViewServiceImpl';
import { IDashboardService } from 'sql/platform/dashboard/browser/dashboardService';
import { DashboardService } from 'sql/platform/dashboard/browser/dashboardServiceImpl';
import { NotebookService } from 'sql/workbench/services/notebook/common/notebookServiceImpl';
import { INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { OEShimService, IOEShimService } from 'sql/workbench/parts/objectExplorer/common/objectExplorerViewTreeShim';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { AdsTelemetryService } from 'sql/platform/telemetry/common/adsTelemetryService';

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
registerSingleton(IDacFxService, DacFxService);
registerSingleton(ISchemaCompareService, SchemaCompareService);
registerSingleton(IAdsTelemetryService, AdsTelemetryService);
// {{SQL CARBON EDIT}} - End

//#region --- workbench parts

import 'vs/workbench/browser/parts/quickinput/quickInput';
import 'vs/workbench/browser/parts/quickopen/quickOpenController';
import 'vs/workbench/browser/parts/titlebar/titlebarPart';
import 'vs/workbench/browser/parts/editor/editorPart';
import 'vs/workbench/browser/parts/activitybar/activitybarPart';
import 'vs/workbench/browser/parts/panel/panelPart';
import 'vs/workbench/browser/parts/sidebar/sidebarPart';
import 'vs/workbench/browser/parts/statusbar/statusbarPart';

//#endregion


//#region --- workbench contributions

// Workspace File Watching
import 'vs/workbench/services/files/common/workspaceWatcher';

// Telemetry
import 'vs/workbench/contrib/telemetry/browser/telemetry.contribution';

// Localizations
import 'vs/workbench/contrib/localizations/browser/localizations.contribution';

// Preferences
import 'vs/workbench/contrib/preferences/browser/preferences.contribution';
import 'vs/workbench/contrib/preferences/browser/keybindingsEditorContribution';
import { IPreferencesSearchService } from 'vs/workbench/contrib/preferences/common/preferences';
import { PreferencesSearchService } from 'vs/workbench/contrib/preferences/browser/preferencesSearch';
registerSingleton(IPreferencesSearchService, PreferencesSearchService, true);

// Logs
import 'vs/workbench/contrib/logs/common/logs.contribution';
import 'vs/workbench/contrib/logs/electron-browser/logs.contribution';

// Quick Open Handlers
import 'vs/workbench/contrib/quickopen/browser/quickopen.contribution';

// Explorer
import 'vs/workbench/contrib/files/browser/explorerViewlet';
import 'vs/workbench/contrib/files/browser/fileActions.contribution';
import 'vs/workbench/contrib/files/browser/files.contribution';

// Backup
import 'vs/workbench/contrib/backup/common/backup.contribution';

// Stats
import 'vs/workbench/contrib/stats/electron-browser/stats.contribution';

// Rapid Render Splash
import 'vs/workbench/contrib/splash/electron-browser/partsSplash.contribution';

// Search
import 'vs/workbench/contrib/search/browser/search.contribution';
import 'vs/workbench/contrib/search/browser/searchView';
import 'vs/workbench/contrib/search/browser/openAnythingHandler';

// SCM
import 'vs/workbench/contrib/scm/browser/scm.contribution';
import 'vs/workbench/contrib/scm/browser/scmViewlet';

/* {{SQL CARBON EDIT}}
// Debug
import 'vs/workbench/contrib/debug/browser/debug.contribution';
import 'vs/workbench/contrib/debug/browser/debugQuickOpen';
import 'vs/workbench/contrib/debug/browser/debugEditorContribution';
import 'vs/workbench/contrib/debug/browser/repl';
import 'vs/workbench/contrib/debug/browser/debugViewlet';
import 'vs/workbench/contrib/debug/node/debugHelperService';
*/
// Markers
import 'vs/workbench/contrib/markers/browser/markers.contribution';

// Comments
import 'vs/workbench/contrib/comments/browser/comments.contribution';

// URL Support
import 'vs/workbench/contrib/url/common/url.contribution';

// Webview
import 'vs/workbench/contrib/webview/browser/webview.contribution';
import 'vs/workbench/contrib/webview/electron-browser/webview.contribution';

// Extensions Management
import 'vs/workbench/contrib/extensions/browser/extensions.contribution';
import 'vs/workbench/contrib/extensions/electron-browser/extensions.contribution';
import 'vs/workbench/contrib/extensions/browser/extensionsQuickOpen';
import 'vs/workbench/contrib/extensions/browser/extensionsViewlet';

// Output Panel
import 'vs/workbench/contrib/output/browser/output.contribution';
import 'vs/workbench/contrib/output/browser/outputPanel';

// Terminal
import 'vs/workbench/contrib/terminal/browser/terminal.contribution';
import 'vs/workbench/contrib/terminal/electron-browser/terminal.contribution';
import 'vs/workbench/contrib/terminal/browser/terminalQuickOpen';
import 'vs/workbench/contrib/terminal/browser/terminalPanel';

// Relauncher
import 'vs/workbench/contrib/relauncher/electron-browser/relauncher.contribution';

// Tasks {{SQL CARBON EDIT}} remove tasks
// import 'vs/workbench/contrib/tasks/browser/task.contribution';
// import { TaskService } from 'vs/workbench/contrib/tasks/electron-browser/taskService';
// import { ITaskService } from 'vs/workbench/contrib/tasks/common/taskService';
// registerSingleton(ITaskService, TaskService, true);

// Remote
// {{SQL CARBON EDIT}} @anthonydresser comment our remote
// import 'vs/workbench/contrib/remote/common/remote.contribution';
// import 'vs/workbench/contrib/remote/electron-browser/remote.contribution';

// Emmet
// import 'vs/workbench/contrib/emmet/browser/emmet.contribution'; {{SQL CARBON EDIT}} @anthonydresser comment our emmet

// CodeEditor Contributions
import 'vs/workbench/contrib/codeEditor/browser/codeEditor.contribution';
import 'vs/workbench/contrib/codeEditor/electron-browser/codeEditor.contribution';

// Execution
import 'vs/workbench/contrib/externalTerminal/node/externalTerminalService';
import 'vs/workbench/contrib/externalTerminal/browser/externalTerminal.contribution';

// Snippets
import 'vs/workbench/contrib/snippets/browser/snippets.contribution';
import 'vs/workbench/contrib/snippets/browser/snippetsService';
import 'vs/workbench/contrib/snippets/browser/insertSnippet';
import 'vs/workbench/contrib/snippets/browser/configureSnippets';
import 'vs/workbench/contrib/snippets/browser/tabCompletion';

// Formatter Help
import 'vs/workbench/contrib/format/browser/format.contribution';

// Send a Smile
import 'vs/workbench/contrib/feedback/browser/feedback.contribution';

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
import 'vs/workbench/contrib/themes/browser/themes.contribution';
import 'vs/workbench/contrib/themes/test/electron-browser/themes.test.contribution';

// Watermark
import 'vs/workbench/contrib/watermark/browser/watermark';

// Welcome
import 'vs/workbench/contrib/welcome/walkThrough/browser/walkThrough.contribution';
import 'vs/workbench/contrib/welcome/gettingStarted/electron-browser/gettingStarted.contribution';
import 'vs/workbench/contrib/welcome/overlay/browser/welcomeOverlay';
import 'vs/workbench/contrib/welcome/page/browser/welcomePage.contribution';

// Call Hierarchy
import 'vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution';

// Outline
import 'vs/workbench/contrib/outline/browser/outline.contribution';

// Experiments
import 'vs/workbench/contrib/experiments/electron-browser/experiments.contribution';

// Issues
import 'vs/workbench/contrib/issue/electron-browser/issue.contribution';
import { IWorkspaceStatsService, WorkspaceStatsService } from 'vs/workbench/contrib/stats/electron-browser/workspaceStatsService';

// {{SQL CARBON EDIT}}
// SQL
import 'sql/workbench/parts/tasks/browser/tasks.contribution';
import 'sql/workbench/update/electron-browser/releaseNotes.contribution';

// data explorer
import 'sql/workbench/parts/dataExplorer/browser/dataExplorer.contribution';
import 'sql/workbench/parts/dataExplorer/browser/dataExplorerViewlet';
import 'sql/workbench/parts/dataExplorer/browser/dataExplorerExtensionPoint';
import 'sql/workbench/parts/dataExplorer/common/nodeActions.common.contribution';
import 'sql/workbench/parts/dataExplorer/electron-browser/nodeActions.contribution';

import 'sql/workbench/parts/telemetry/common/telemetry.contribution';
import 'sql/workbench/parts/connection/browser/connection.contribution';

// query editor
import 'sql/workbench/parts/query/browser/query.contribution';
import 'sql/workbench/parts/query/common/resultsGridContribution';

// edit data editor
import 'sql/workbench/parts/editData/browser/editData.contribution';

// query plan editor
import 'sql/workbench/parts/queryPlan/electron-browser/queryPlan.contribution';

//acounts
import 'sql/workbench/parts/accounts/browser/accounts.contribution';

import 'sql/workbench/parts/profiler/browser/profiler.contribution';
import 'sql/workbench/parts/profiler/browser/profilerActions.contribution';
import 'sql/workbench/parts/objectExplorer/common/serverGroup.contribution';
import 'sql/workbench/parts/objectExplorer/electron-browser/objectExplorerScripting.contribution';
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
import 'sql/workbench/parts/dashboard/browser/dashboard.contribution';
/* Tasks */
import 'sql/workbench/common/actions.contribution';
/* Widgets */
import 'sql/workbench/parts/dashboard/browser/widgets/insights/insightsWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/explorer/explorerWidget.common.contribution';
import 'sql/workbench/parts/dashboard/electron-browser/widgets/explorer/explorerWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/tasks/tasksWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/widgets/webview/webviewWidget.contribution';
import 'sql/workbench/parts/dashboard/browser/dashboardConfig.contribution';
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
