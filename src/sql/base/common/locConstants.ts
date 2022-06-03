/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

// Contains vs strings that are non-native to vscode that need to be translated.

export const issueReporterMainAzuredatastudio = localize('azuredatastudio', "Azure Data Studio");
export const updateConfigContributionDefault = localize('default', "Enable automatic update checks. Azure Data Studio will check for updates automatically and periodically.");
export const updateConfigContributionEnableWindowsBackgroundUpdates = localize('enableWindowsBackgroundUpdates', "Enable to download and install new Azure Data Studio Versions in the background on Windows");
export const updateConfigContributionShowReleaseNotes = localize('showReleaseNotes', "Show Release Notes after an update. The Release Notes are opened in a new web browser window.");
export const menusExtensionPointDashboardToolbar = localize('dashboard.toolbar', "The dashboard toolbar action menu");
export const menusExtensionPointNotebookCellTitle = localize('notebook.cellTitle', "The notebook cell title menu");
export const menusExtensionPointNotebookTitle = localize('notebook.title', "The notebook title menu");
export const menusExtensionPointNotebookToolbar = localize('notebook.toolbar', "The notebook toolbar menu");
export const menusExtensionPointDataExplorerAction = localize('dataExplorer.action', "The dataexplorer view container title action menu");
export const menusExtensionPointDataExplorerContext = localize('dataExplorer.context', "The dataexplorer item context menu");
export const menusExtensionPointObjectExplorerContext = localize('objectExplorer.context', "The object explorer item context menu");
export const menusExtensionPointConnectionDialogBrowseTreeContext = localize('connectionDialogBrowseTree.context', "The connection dialog's browse tree context menu");
export const menusExtensionPointDataGridContext = localize('dataGrid.context', "The data grid item context menu");
export const extensionsContributionExtensionsPolicy = localize('extensionsPolicy', "Sets the security policy for downloading extensions.");
export const extensionsContributionInstallVSIXActionAllowNone = localize('InstallVSIXAction.allowNone', 'Your extension policy does not allow installing extensions. Please change your extension policy and try again.');
export function extensionsContributionInstallVSIXActionSuccessReload(extension: string): string { return localize('InstallVSIXAction.successReload', "Completed installing {0} extension from VSIX. Please reload Azure Data Studio to enable it.", extension); }
export const extensionsActionsPostUninstallTooltip = localize('postUninstallTooltip', "Please reload Azure Data Studio to complete the uninstallation of this extension.");
export const extensionsActionsPostUpdateTooltip = localize('postUpdateTooltip', "Please reload Azure Data Studio to enable the updated extension.");
export const extensionsActionsEnableLocally = localize('enable locally', "Please reload Azure Data Studio to enable this extension locally.");
export const extensionsActionsPostEnableTooltip = localize('postEnableTooltip', "Please reload Azure Data Studio to enable this extension.");
export const extensionsActionsPostDisableTooltip = localize('postDisableTooltip', "Please reload Azure Data Studio to disable this extension.");
export function extensionsActionsUninstallExtensionComplete(extension: string): string { return localize('uninstallExtensionComplete', "Please reload Azure Data Studio to complete the uninstallation of the extension {0}.", extension); }
export function extensionsActionsEnableRemote(remoteServer: string): string { return localize('enable remote', "Please reload Azure Data Studio to enable this extension in {0}.", remoteServer); }
export function extensionsActionsInstallExtensionCompletedAndReloadRequired(extension: string): string { return localize('installExtensionCompletedAndReloadRequired', "Installing extension {0} is completed. Please reload Azure Data Studio to enable it.", extension); }
export function extensionsActionsReinstallActionSuccessReload(extension: string): string { return localize('ReinstallAction.successReload', "Please reload Azure Data Studio to complete reinstalling the extension {0}.", extension); }
export const extensionsViewletRecommendedExtensions = localize('recommendedExtensions', "Marketplace");
export const extensionsViewsScenarioTypeUndefined = localize('scenarioTypeUndefined', 'The scenario type for extension recommendations must be provided.');
export function extensionsWorkbenchServiceIncompatible(extension: string, version: string, requiredVersion: string) { return localize('incompatible', "Unable to install extension '{0}' as it is not compatible with Azure Data Studio '{1}'. Update to Azure Data Studio {3} to install the extension", extension, version, requiredVersion); }
export const fileActionsContributionNewQuery = localize('newQuery', "New Query");
export const fileActionsContributionMiNewQuery = localize({ key: 'miNewQuery', comment: ['&& denotes a mnemonic'] }, "New &&Query");
export const fileActionsContributionMiNewNotebook = localize({ key: 'miNewNotebook', comment: ['&& denotes a mnemonic'] }, "&&New Notebook");
export const filesContributionMaxMemoryForLargeFilesMB = localize('maxMemoryForLargeFilesMB', "Controls the memory available to Azure Data Studio after restart when trying to open large files. Same effect as specifying `--max-memory=NEWSIZE` on the command line.");
export const watcherExclude = localize('sql.watcherExclude', "Configure glob patterns of file paths to exclude from file watching. Patterns must match on absolute paths, i.e. prefix with `**/` or the full path to match properly and suffix with `/**` to match files within a path (for example `**/build/output/**` or `/Users/name/workspaces/project/build/output/**`). Changing this setting requires a restart. When you experience Azure Data Studio consuming lots of CPU time on startup, you can exclude large folders to reduce the initial load.");
export function localizationsContributionUpdateLocale(locale: string): string { return localize('updateLocale', "Would you like to change Azure Data Studio's UI language to {0} and restart?", locale); }
export function localizationsContributionActivateLanguagePack(locale: string): string { return localize('activateLanguagePack', "In order to use Azure Data Studio in {0}, Azure Data Studio needs to restart.", locale); }
export const watermarkNewSqlFile = localize('watermark.newSqlFile', "New SQL File");
export const watermarkNewNotebook = localize('watermark.newNotebook', "New Notebook");
export const desktopContributionMiinstallVsix = localize({ key: 'miinstallVsix', comment: ['&& denotes a mnemonic'] }, "Install Extension from VSIX Package");
export const workspaceTrustDescription = localize('workspace.trust.description', "Controls whether or not workspace trust is enabled within Azure Data Studio.");
export function workspaceTrustEmptyWindowDescription(settingName: string): string { return localize('workspace.trust.emptyWindow.description', "Controls whether or not the empty window is trusted by default within Azure Data Studio. When used with `#{0}#`, you can enable the full functionality of Azure Data Studio without prompting in an empty window.", settingName); }
export const functionalityNotSupportedError = localize('vscodeFunctionalityNotSupportedError', "This VS Code functionality is not supported in Azure Data Studio.");
export const invalidArgumentsError = localize('vscodeInvalidArgumentsError', "Invalid arguments.");
export const docCreationFailedError = localize('vscodeDocCreationFailedError', "Failed to create notebook document.");
export const cellToolbarCompatibilityMessage = localize('notebook.cellToolbarLocation.compatibilityDescription', "Where the cell toolbar should be shown, or whether it should be hidden. Note: This setting is only enabled for extension compatibility purposes, and so does not affect anything.");
export const docNotFoundForUriError = localize('docNotFoundForUriError', 'Could not open a notebook document for the specified URI.');
