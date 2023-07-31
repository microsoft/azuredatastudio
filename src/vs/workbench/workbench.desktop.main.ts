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

import 'vs/workbench/electron-sandbox/desktop.main';
import 'vs/workbench/electron-sandbox/desktop.contribution';

//#endregion


//#region --- workbench parts

import 'vs/workbench/electron-sandbox/parts/dialogs/dialog.contribution';

//#endregion


//#region --- workbench services

import 'vs/workbench/services/textfile/electron-sandbox/nativeTextFileService';
import 'vs/workbench/services/dialogs/electron-sandbox/fileDialogService';
import 'vs/workbench/services/workspaces/electron-sandbox/workspacesService';
import 'vs/workbench/services/menubar/electron-sandbox/menubarService';
import 'vs/workbench/services/issue/electron-sandbox/issueMainService';
import 'vs/workbench/services/issue/electron-sandbox/issueService';
import 'vs/workbench/services/update/electron-sandbox/updateService';
import 'vs/workbench/services/url/electron-sandbox/urlService';
import 'vs/workbench/services/lifecycle/electron-sandbox/lifecycleService';
import 'vs/workbench/services/title/electron-sandbox/titleService';
import 'vs/workbench/services/host/electron-sandbox/nativeHostService';
import 'vs/workbench/services/request/electron-sandbox/requestService';
import 'vs/workbench/services/clipboard/electron-sandbox/clipboardService';
import 'vs/workbench/services/contextmenu/electron-sandbox/contextmenuService';
import 'vs/workbench/services/workspaces/electron-sandbox/workspaceEditingService';
import 'vs/workbench/services/configurationResolver/electron-sandbox/configurationResolverService';
import 'vs/workbench/services/accessibility/electron-sandbox/accessibilityService';
import 'vs/workbench/services/keybinding/electron-sandbox/nativeKeyboardLayout';
import 'vs/workbench/services/path/electron-sandbox/pathService';
import 'vs/workbench/services/themes/electron-sandbox/nativeHostColorSchemeService';
import 'vs/workbench/services/extensionManagement/electron-sandbox/extensionManagementService';
import 'vs/workbench/services/extensionManagement/electron-sandbox/extensionUrlTrustService';
import 'vs/workbench/services/credentials/electron-sandbox/credentialsService';
import 'vs/workbench/services/encryption/electron-sandbox/encryptionService';
import 'vs/workbench/services/localization/electron-sandbox/languagePackService';
import 'vs/workbench/services/telemetry/electron-sandbox/telemetryService';
import 'vs/workbench/services/extensions/electron-sandbox/extensionHostStarter';
import 'vs/platform/extensionResourceLoader/common/extensionResourceLoaderService';
import 'vs/workbench/services/localization/electron-sandbox/localeService';
import 'vs/workbench/services/extensions/electron-sandbox/extensionsScannerService';
import 'vs/workbench/services/extensionManagement/electron-sandbox/extensionManagementServerService';
import 'vs/workbench/services/extensionManagement/electron-sandbox/extensionTipsService';
import 'vs/workbench/services/userDataSync/electron-sandbox/userDataSyncMachinesService';
import 'vs/workbench/services/userDataSync/electron-sandbox/userDataSyncService';
import 'vs/workbench/services/userDataSync/electron-sandbox/userDataSyncAccountService';
import 'vs/workbench/services/userDataSync/electron-sandbox/userDataSyncStoreManagementService';
import 'vs/workbench/services/userDataSync/electron-sandbox/userDataAutoSyncService';
import 'vs/workbench/services/timer/electron-sandbox/timerService';
import 'vs/workbench/services/environment/electron-sandbox/shellEnvironmentService';
import 'vs/workbench/services/integrity/electron-sandbox/integrityService';
import 'vs/workbench/services/workingCopy/electron-sandbox/workingCopyBackupService';
import 'vs/workbench/services/checksum/electron-sandbox/checksumService';
import 'vs/platform/remote/electron-sandbox/sharedProcessTunnelService';
import 'vs/workbench/services/tunnel/electron-sandbox/tunnelService';
import 'vs/platform/diagnostics/electron-sandbox/diagnosticsService';
import 'vs/platform/profiling/electron-sandbox/profilingService';
import 'vs/platform/telemetry/electron-sandbox/customEndpointTelemetryService';
import 'vs/platform/remoteTunnel/electron-sandbox/remoteTunnelService';
import 'vs/workbench/services/files/electron-sandbox/elevatedFileService';
import 'vs/workbench/services/search/electron-sandbox/searchService';
import 'vs/workbench/services/workingCopy/electron-sandbox/workingCopyHistoryService';
import 'vs/workbench/services/userDataSync/browser/userDataSyncEnablementService';
import 'vs/workbench/services/extensions/electron-sandbox/nativeExtensionService';
import 'vs/platform/userDataProfile/electron-sandbox/userDataProfileStorageService';

import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IUserDataInitializationService, UserDataInitializationService } from 'vs/workbench/services/userData/browser/userDataInit';
import { IExtensionsProfileScannerService } from 'vs/platform/extensionManagement/common/extensionsProfileScannerService';
import { ExtensionsProfileScannerService } from 'vs/platform/extensionManagement/electron-sandbox/extensionsProfileScannerService';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

registerSingleton(IUserDataInitializationService, new SyncDescriptor(UserDataInitializationService, [[]], true));
registerSingleton(IExtensionsProfileScannerService, ExtensionsProfileScannerService, InstantiationType.Delayed);


//#endregion


//#region --- workbench contributions

// Logs
import 'vs/workbench/contrib/logs/electron-sandbox/logs.contribution';

// Localizations
import 'vs/workbench/contrib/localization/electron-sandbox/localization.contribution';

// Explorer
import 'vs/workbench/contrib/files/electron-sandbox/fileActions.contribution';

// CodeEditor Contributions
import 'vs/workbench/contrib/codeEditor/electron-sandbox/codeEditor.contribution';

// Debug
import 'vs/workbench/contrib/debug/electron-sandbox/extensionHostDebugService';

// Extensions Management
import 'vs/workbench/contrib/extensions/electron-sandbox/extensions.contribution';

// Issues
import 'vs/workbench/contrib/issue/electron-sandbox/issue.contribution';

// Remote
import 'vs/workbench/contrib/remote/electron-sandbox/remote.contribution';

// Configuration Exporter
import 'vs/workbench/contrib/configExporter/electron-sandbox/configurationExportHelper.contribution';

// Terminal
import 'vs/workbench/contrib/terminal/electron-sandbox/terminal.contribution';

// Themes Support
import 'vs/workbench/contrib/themes/browser/themes.test.contribution';

// User Data Sync
import 'vs/workbench/contrib/userDataSync/electron-sandbox/userDataSync.contribution';

// Tags
import 'vs/workbench/contrib/tags/electron-sandbox/workspaceTagsService';
import 'vs/workbench/contrib/tags/electron-sandbox/tags.contribution';

// Performance
import 'vs/workbench/contrib/performance/electron-sandbox/performance.contribution';

// Tasks
import 'vs/workbench/contrib/tasks/electron-sandbox/taskService';

// External terminal
import 'vs/workbench/contrib/externalTerminal/electron-sandbox/externalTerminal.contribution';

// Webview
import 'vs/workbench/contrib/webview/electron-sandbox/webview.contribution';

// Splash
import 'vs/workbench/contrib/splash/electron-sandbox/splash.contribution';

// Local History
import 'vs/workbench/contrib/localHistory/electron-sandbox/localHistory.contribution';

// Merge Editor
import 'vs/workbench/contrib/mergeEditor/electron-sandbox/mergeEditor.contribution';

// Remote Tunnel
import 'vs/workbench/contrib/remoteTunnel/electron-sandbox/remoteTunnel.contribution';

// {{SQL CARBON EDIT}} - SQL added contributions
// Telemetry Opt Out
import 'sql/workbench/contrib/telemetry/electron-sandbox/telemetryOptOut.contribution';

//#endregion

export { main } from 'vs/workbench/electron-sandbox/desktop.main';

// {{SQL CARBON EDIT}} - SQL-specific services
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';
import { SqlOAuthService } from 'sql/platform/oAuth/electron-sandbox/sqlOAuthServiceImpl';
import { IClipboardService as sqlIClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ClipboardService as sqlClipboardService } from 'sql/platform/clipboard/electron-sandbox/clipboardService';
import { IAzureBlobService } from 'sql/platform/azureBlob/common/azureBlobService';
import { AzureBlobService } from 'sql/workbench/services/azureBlob/browser/azureBlobService';
import { IAzureAccountService } from 'sql/platform/azureAccount/common/azureAccountService';
import { AzureAccountService } from 'sql/workbench/services/azureAccount/browser/azureAccountService';

registerSingleton(ISqlOAuthService, SqlOAuthService, InstantiationType.Delayed);
registerSingleton(sqlIClipboardService, sqlClipboardService, InstantiationType.Delayed);
registerSingleton(IAzureBlobService, AzureBlobService, InstantiationType.Delayed);
registerSingleton(IAzureAccountService, AzureAccountService, InstantiationType.Delayed);
// {{SQL CARBON EDIT}} - End

// {{SQL CARBON EDIT}}
// getting started

// CLI
import 'sql/workbench/contrib/commandLine/electron-sandbox/commandLine.contribution';

//getting started
import 'sql/workbench/contrib/welcome/electron-sandbox/gettingStarted.contribution';
