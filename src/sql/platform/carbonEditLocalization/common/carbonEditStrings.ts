/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

// Contains vs strings that are nonnative to vscode that need to be translated.
const fixedStrings = {
	'fileActions.contribution.newQuery': nls.localize('newQuery', "New Query"),
	'fileActions.contribution.miNewQuery': nls.localize({ key: 'miNewQuery', comment: ['&& denotes a mnemonic'] }, "New &&Query"),
	'fileACtions.contribution.miNewNotebook': nls.localize({ key: 'miNewNotebook', comment: ['&& denotes a mnemonic'] }, "&&New Notebook"),
	'watermark.newSqlFile': nls.localize('watermark.newSqlFile', "New SQL File"),
	'watermark.newNotebook': nls.localize('watermark.newNotebook', "New Notebook"),
	'files.contribution.maxMemoryForLargeFilesMB': nls.localize('maxMemoryForLargeFilesMB', "Controls the memory available to Azure Data Studio after restart when trying to open large files. Same effect as specifying `--max-memory=NEWSIZE` on the command line."),
	'extensionsViews.scenarioTypeUndefined': nls.localize('scenarioTypeUndefined', 'The scenario type for extension recommendations must be provided.'),
	'extensionsViewlet.recommendedExtensions': nls.localize('recommendedExtensions', "Marketplace"),
	'update.config.contribution.default': nls.localize('default', "Enable automatic update checks. Azure Data Studio will check for updates automatically and periodically."),
	'update.config.contribution.enableWindowsBackgroundUpdates': nls.localize('enableWindowsBackgroundUpdates', "Enable to download and install new Azure Data Studio Versions in the background on Windows"),
	'update.config.contribution.showReleaseNotes': nls.localize('showReleaseNotes', "Show Release Notes after an update. The Release Notes are opened in a new web browser window."),
	'issueReporterMain.azuredatastudio': nls.localize('azuredatastudio', "Azure Data Studio"),
	'menusExtensionPoint.dashboard.toolbar': nls.localize('dashboard.toolbar', "The dashboard toolbar action menu"),
	'menusExtensionPoint.notebook.cellTitle': nls.localize('notebook.cellTitle', "The notebook cell title menu"),
	'menusExtensionPoint.notebook.title': nls.localize('notebook.title', "The notebook title menu"),
	'menusExtensionPoint.notebook.toolbar': nls.localize('notebook.toolbar', "The notebook toolbar menu"),
	'menusExtensionPoint.dataExplorer.action': nls.localize('dataExplorer.action', "The dataexplorer view container title action menu"),
	'menusExtensionPoint.dataExplorer.context': nls.localize('dataExplorer.context', "The dataexplorer item context menu"),
	'menusExtensionPoint.objectExplorer.context': nls.localize('objectExplorer.context', "The object explorer item context menu"),
	'menusExtensionPoint.connectionDialogBrowseTree.context': nls.localize('connectionDialogBrowseTree.context', "The connection dialog's browse tree context menu"),
	'menusExtensionPoint.dataGrid.context': nls.localize('dataGrid.context', "The data grid item context menu"),
	'extensions.contribution.extensionsPolicy': nls.localize('extensionsPolicy', "Sets the security policy for downloading extensions."),
	'extensions.contribution.InstallVSIXAction.allowNone': nls.localize('InstallVSIXAction.allowNone', 'Your extension policy does not allow installing extensions. Please change your extension policy and try again.'),
	'extensionsActions.postUninstallTooltip': nls.localize('postUninstallTooltip', "Please reload Azure Data Studio to complete the uninstallation of this extension."),
	'extensionsActions.postUpdateTooltip': nls.localize('postUpdateTooltip', "Please reload Azure Data Studio to enable the updated extension."),
	'extensionsActions.enableLocally': nls.localize('enable locally', "Please reload Azure Data Studio to enable this extension locally."),
	'extensionsActions.postEnableTooltip': nls.localize('postEnableTooltip', "Please reload Azure Data Studio to enable this extension."),
	'extensionsActions.postDisableTooltip': nls.localize('postDisableTooltip', "Please reload Azure Data Studio to disable this extension."),
	'desktop.contribution.miinstallVsix': nls.localize({ key: 'miinstallVsix', comment: ['&& denotes a mnemonic'] }, "Install Extension from VSIX Package")
};

export function getCustomString(stringName: string, ...stringParams: string[]): string {
	//handle strings with arguments
	if (stringName === 'localizations.contribution.updateLocale') {
		return nls.localize('updateLocale', "Would you like to change Azure Data Studio's UI language to {0} and restart?", ...stringParams);
	}
	else if (stringName === 'localizations.contribution.activateLanguagePack') {
		return nls.localize('activateLanguagePack', "In order to use Azure Data Studio in {0}, Azure Data Studio needs to restart.", ...stringParams);
	}
	else if (stringName === 'extensionsWorkbenchService.incompatible') {
		return nls.localize('incompatible', "Unable to install extension '{0}' as it is not compatible with Azure Data Studio '{1}'.", ...stringParams);
	}
	else if (stringName === 'extensions.contribution.InstallVSIXAction.successReload') {
		return nls.localize('InstallVSIXAction.successReload', "Completed installing {0} extension from VSIX. Please reload Azure Data Studio to enable it.", ...stringParams);
	}
	else if (stringName === 'extensionsActions.uninstallExtensionComplete') {
		return nls.localize('uninstallExtensionComplete', "Please reload Azure Data Studio to complete the uninstallation of the extension {0}.", ...stringParams);
	}
	else if (stringName === 'extensionsActions.enableRemote') {
		return nls.localize('enable remote', "Please reload Azure Data Studio to enable this extension in {0}.", ...stringParams);
	}
	else if (stringName === 'extensionsActions.installExtensionCompletedAndReloadRequired') {
		return nls.localize('installExtensionCompletedAndReloadRequired', "Installing extension {0} is completed. Please reload Azure Data Studio to enable it.", ...stringParams);
	}
	else if (stringName === 'extensionsActions.ReinstallAction.successReload') {
		return nls.localize('ReinstallAction.successReload', "Please reload Azure Data Studio to complete reinstalling the extension {0}.", ...stringParams);
	}
	//Else, string has no arguments or does not exist.
	else if (fixedStrings[stringName]) {
		return fixedStrings[stringName];
	}
	else {
		return nls.localize('stringNotFound', "String was not found.");
	}
}
