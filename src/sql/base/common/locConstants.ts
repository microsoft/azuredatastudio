/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

// Contains vs strings that are non-native to vscode that need to be translated.

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
export function extensionsWorkbenchServiceIncompatible(extension: string, extensionVersion: string, currentAzDataVersion: string, requiredAzDataVersion: string) { return localize('incompatible', "Unable to install version '{0}' of extension '{1}' as it is not compatible with Azure Data Studio '{2}'. Update to Azure Data Studio {3} to install the extension.", extensionVersion, extension, currentAzDataVersion, requiredAzDataVersion); }
export const fileActionsContributionNewQuery = localize('newQuery', "New Query");
export const fileActionsContributionMiNewQuery = localize({ key: 'miNewQuery', comment: ['&& denotes a mnemonic'] }, "New &&Query");
export const fileActionsContributionMiNewNotebook = localize({ key: 'miNewNotebook', comment: ['&& denotes a mnemonic'] }, "&&New Notebook");
export const fileActionsContributionMiNewDeployment = localize({ key: 'miNewDeployment', comment: ['&& denotes a mnemonic'] }, "New &&Deployment...");
export const filesContributionMaxMemoryForLargeFilesMB = localize('maxMemoryForLargeFilesMB', "Controls the memory available to Azure Data Studio after restart when trying to open large files. Same effect as specifying `--max-memory=NEWSIZE` on the command line.");
export const watcherExclude = localize('sql.watcherExclude', "Configure glob patterns of file paths to exclude from file watching. Patterns must match on absolute paths, i.e. prefix with `**/` or the full path to match properly and suffix with `/**` to match files within a path (for example `**/build/output/**` or `/Users/name/workspaces/project/build/output/**`). Changing this setting requires a restart. When you experience Azure Data Studio consuming lots of CPU time on startup, you can exclude large folders to reduce the initial load.");
export function localizationsContributionUpdateLocale(locale: string): string { return localize('updateLocale', "Would you like to change Azure Data Studio's UI language to {0} and restart?", locale); }
export function localizationsContributionActivateLanguagePack(locale: string): string { return localize('activateLanguagePack', "In order to use Azure Data Studio in {0}, Azure Data Studio needs to restart.", locale); }
export const watermarkNewSqlFile = localize('watermark.newSqlFile', "New SQL File");
export const watermarkNewNotebook = localize('watermark.newNotebook', "New Notebook");
export const desktopContributionMiinstallVsix = localize({ key: 'miinstallVsix', comment: ['&& denotes a mnemonic'] }, "Install Extension from VSIX Package");
export const workspaceTrustDescription = localize('workspace.trust.description', "Controls whether or not workspace trust is enabled within Azure Data Studio.");
export function workspaceTrustEmptyWindowDescription(settingName: string): string { return localize('workspace.trust.emptyWindow.description', "Controls whether or not the empty window is trusted by default within Azure Data Studio. When used with `#{0}#`, you can enable the full functionality of Azure Data Studio without prompting in an empty window.", settingName); }
export const notebooksNotSupportedError = localize('vscodeNotebooksNotSupportedError', "VS Code notebook extensions are not supported in Azure Data Studio.");
export function versionSyntax(engine: string, version: string): string { return localize('sql.versionSyntax', "Could not parse `{0}` value {1}. Please use, for example: ^1.22.0, ^1.22.x, etc.", engine, version) }
export function versionMismatch(currentVersion: string, requestedVersion: string): string { return localize('sql.versionMismatch', "Extension is not compatible with Azure Data Studio {0}. Extension requires: {1}.", currentVersion, requestedVersion); }
export function versionMismatchVsCode(currentVersion: string, requestedVersion: string, supportedVersion: string): string { return localize('sql.versionMismatchVsCode', "Extension is not compatible with Azure Data Studio {0}. Extension requires a newer VS Code Engine Version {1}, which is newer than what is currently supported ({2}).", currentVersion, requestedVersion, supportedVersion); }
export const windowTitleAppNameDescription = localize('appName', "`${appName}`: e.g. Azure Data Studio.")
export const terminalIntegratedAllowChordsDescription = localize('terminal.integrated.allowChords', "Whether or not to allow chord keybindings in the terminal. Note that when this is true and the keystroke results in a chord it will bypass `#terminal.integrated.commandsToSkipShell#`, setting this to false is particularly useful when you want ctrl+k to go to your shell (not Azure Data Studio).")
export const terminalIntegratedAutoRepliesDescription = localize('terminal.integrated.autoReplies', "A set of messages that when encountered in the terminal will be automatically responded to. Provided the message is specific enough, this can help automate away common responses.\n\nRemarks:\n\n- Use {0} to automatically respond to the terminate batch job prompt on Windows.\n- The message includes escape sequences so the reply might not happen with styled text.\n- Each reply can only happen once every second.\n- Use {1} in the reply to mean the enter key.\n- To unset a default key, set the value to null.\n- Restart Azured Data Studio if new don't apply.", '`"Terminate batch job (Y/N)": "\\r"`', '`"\\r"`')
export function terminalIntegratedCommandsToSkipShellDescrption(commands: string[]): string {
	return localize(
		'terminal.integrated.commandsToSkipShell',
		"A set of command IDs whose keybindings will not be sent to the shell but instead always be handled by Azure Data Studio. This allows keybindings that would normally be consumed by the shell to act instead the same as when the terminal is not focused, for example `Ctrl+P` to launch Quick Open.\n\n&nbsp;\n\nMany commands are skipped by default. To override a default and pass that command's keybinding to the shell instead, add the command prefixed with the `-` character. For example add `-workbench.action.quickOpen` to allow `Ctrl+P` to reach the shell.\n\n&nbsp;\n\nThe following list of default skipped commands is truncated when viewed in Settings Editor. To see the full list, {1} and search for the first command from the list below.\n\n&nbsp;\n\nDefault Skipped Commands:\n\n{0}",
		commands.sort().map(command => `- ${command}`).join('\n'),
		`[${localize('openDefaultSettingsJson', "open the default settings JSON")}](command:workbench.action.openRawDefaultSettings '${localize('openDefaultSettingsJson.capitalized', "Open Default Settings (JSON)")}')`
	);
}
export const terminalIntegratedDetectLocaleDescrption = localize('terminal.integrated.detectLocale', "Controls whether to detect and set the `$LANG` environment variable to a UTF-8 compliant option since Azure Data Studio's terminal only supports UTF-8 encoded data coming from the shell.")
export const terminalIntegratedEnvOsxDescription = localize('terminal.integrated.env.osx', "Object with environment variables that will be added to the Azure Data Studio process to be used by the terminal on macOS. Set to `null` to delete the environment variable.")
export const terminalIntegratedEnvLinuxDescription = localize('terminal.integrated.env.linux', "Object with environment variables that will be added to the Azure Data Studio process to be used by the terminal on Linux. Set to `null` to delete the environment variable.")
export const terminalIntegratedEnvWindowsDescription = localize('terminal.integrated.env.windows', "Object with environment variables that will be added to the Azure Data Studio process to be used by the terminal on Windows. Set to `null` to delete the environment variable.")
export const terminalIntegratedInheritEnvDescription = localize('terminal.integrated.inheritEnv', "Whether new shells should inherit their environment from Azure Data Studio, which may source a login shell to ensure $PATH and other development variables are initialized. This has no effect on Windows.")

//#region VS Code Issue Reporter
export const issueReporterServiceAzuredatastudio = localize('azuredatastudio', "Azure Data Studio");
export const issueReporterPageReviewGuidanceLabel = localize( // intentionally not escaped because of its embedded tags
	{
		key: 'reviewGuidanceLabel',
		comment: [
			'{Locked="<a href=\"https://github.com/microsoft/azuredatastudio/wiki/Submitting-Bugs-and-Suggestions\" target=\"_blank\">"}', // {{SQL CARBON EDIT}} - Update link to Azure Data Studio submitting bugs and suggestions wiki
			'{Locked="</a>"}'
		]
	},
	'Before you report an issue here please <a href="https://github.com/microsoft/azuredatastudio/wiki/Submitting-Bugs-and-Suggestions" target="_blank">review the guidance we provide</a>.' // {{SQL CARBON EDIT}} - Update link to Azure Data Studio submitting bugs and suggestions wiki
);
//#endregion

//#region VS Code Notebook settings
export const displayOrderDescription = localize('notebook.displayOrder.description', "Priority list for output mime types. (for VS Code Notebooks only)");
export const cellToolbarLocationDescription = localize('notebook.cellToolbarLocation.description', "Where the cell toolbar should be shown, or whether it should be hidden. (for VS Code Notebooks only)");
export const showCellStatusbarDescription = localize('notebook.showCellStatusbar.description', "Whether the cell status bar should be shown. (for VS Code Notebooks only)");
export const diffEnablePreviewDescription = localize('notebook.diff.enablePreview.description', "Whether to use the enhanced text diff editor for notebook. (for VS Code Notebooks only)");
export const cellToolbarVisibilityDescription = localize('notebook.cellToolbarVisibility.description', "Whether the cell toolbar should appear on hover or click. (for VS Code Notebooks only)");
export const undoRedoPerCellDescription = localize('notebook.undoRedoPerCell.description', "Whether to use separate undo/redo stack for each cell. (for VS Code Notebooks only)");
export const compactViewDescription = localize('notebook.compactView.description', "Control whether the notebook editor should be rendered in a compact form. For example, when turned on, it will decrease the left margin width. (for VS Code Notebooks only)");
export const focusIndicatorDescription = localize('notebook.focusIndicator.description', "Controls where the focus indicator is rendered, either along the cell borders or on the left gutter. (for VS Code Notebooks only)");
export const insertToolbarPositionDescription = localize('notebook.insertToolbarPosition.description', "Control where the insert cell actions should appear. (for VS Code Notebooks only)");
export const globalToolbarDescription = localize('notebook.globalToolbar.description', "Control whether to render a global toolbar inside the notebook editor. (for VS Code Notebooks only)");
export const consolidatedOutputButtonDescription = localize('notebook.consolidatedOutputButton.description', "Control whether outputs action should be rendered in the output toolbar. (for VS Code Notebooks only)");
export const showFoldingControlsDescription = localize('notebook.showFoldingControls.description', "Controls when the Markdown header folding arrow is shown. (for VS Code Notebooks only)");
export const dragAndDropDescription = localize('notebook.dragAndDrop.description', "Control whether the notebook editor should allow moving cells through drag and drop. (for VS Code Notebooks only)");
export const consolidatedRunButtonDescription = localize('notebook.consolidatedRunButton.description', "Control whether extra actions are shown in a dropdown next to the run button. (for VS Code Notebooks only)");
export const globalToolbarShowLabelDescription = localize('notebook.globalToolbarShowLabel', "Control whether the actions on the notebook toolbar should render label or not. (for VS Code Notebooks only)");
export const textOutputLineLimitDescription = localize('notebook.textOutputLineLimit', "Control how many lines of text in a text output is rendered. (for VS Code Notebooks only)");
export const markupFontSizeDescription = localize('notebook.markup.fontSize', "Controls the font size in pixels of rendered markup in notebooks. When set to `0`, 120% of `#editor.fontSize#` is used. (for VS Code Notebooks only)");
export const interactiveWindowCollapseCodeCellsDescription = localize('notebook.interactiveWindow.collapseCodeCells', "Controls whether code cells in the interactive window are collapsed by default. (for VS Code Notebooks only)");
export const outputLineHeightDescription = localize('notebook.outputLineHeight', "Line height of the output text for notebook cells.\n - Values between 0 and 8 will be used as a multiplier with the font size.\n - Values greater than or equal to 8 will be used as effective values. (for VS Code Notebooks only)");
export const outputFontSizeDescription = localize('notebook.outputFontSize', "Font size for the output text for notebook cells. When set to 0 `#editor.fontSize#` is used. (for VS Code Notebooks only)");
export const outputFontFamilyDescription = localize('notebook.outputFontFamily', "The font family for the output text for notebook cells. When set to empty, the `#editor.fontFamily#` is used. (for VS Code Notebooks only)");
export const experimentalCustomizationDescription = localize('notebook.editorOptions.experimentalCustomization', 'Settings for code editors used in notebooks. This can be used to customize most editor.* settings. (for VS Code Notebooks only)');
export const download = localize('azuredatastudio.download', 'Download');
export const downloadTooltip = localize('azuredatastudio.downloadTooltip', "Download this extension from an external source");
export const installTooltip = localize('azuredatastudio.installTooltip', "Install this extension");
export function getThemeUpdatedNotification(label: string): string {
	return localize({ key: 'azuredatastudio.themeUpdatedNotification', comment: ['{0} is the name of the new default theme'] }, "Azure Data Studio now ships with a new default theme '{0}'. If you prefer, you can switch back to the old theme or try one of the many other color themes available.", label);
}
export function getNewThemeNotification(label: string): string {
	return localize({ key: 'newThemeNotification', comment: ['{0} is the name of the new default theme'] }, "Azure Data Studio now ships with a new default theme '{0}'. Do you want to give it a try?", label);
}

//#endregion

//#region VS Code About Dialog

export function aboutDetail(productVersion: string, commit: string, date: string, electronVersion: string, chromeVersion: string, nodeVersion: string, v8: string, osProps: string, vscodeVersion: string): string {
	return localize({ key: 'aboutDetail', comment: ['Electron, Chromium, Node.js and V8 are product names that need no translation'] },
		"Version: {0}\nCommit: {1}\nDate: {2}\nVS Code: {3}\nElectron: {4}\nChromium: {5}\nNode.js: {6}\nV8: {7}\nOS: {8}",
		productVersion,
		commit,
		date,
		vscodeVersion,
		electronVersion,
		chromeVersion,
		nodeVersion,
		v8,
		osProps
	);
}

//#endregion
