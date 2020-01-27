/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const winPlatform = 'win32';
export const pythonBundleVersion = '0.0.1';
export const managePackagesCommand = 'jupyter.cmd.managePackages';
export const pythonLanguageName = 'Python';
export const rLanguageName = 'R';
export const rLPackagedFolderName = 'r_packages';

export const mlEnableMlsCommand = 'mls.command.enableMls';
export const mlDisableMlsCommand = 'mls.command.disableMls';
export const extensionOutputChannel = 'Machine Learning Services';
export const notebookExtensionName = 'Microsoft.notebook';

// Tasks, commands
//
export const mlManagePackagesCommand = 'mls.command.managePackages';
export const mlOdbcDriverCommand = 'mls.command.odbcdriver';
export const mlsDocumentsCommand = 'mls.command.mlsdocs';
export const mlsDependenciesCommand = 'mls.command.dependencies';

// Configurations
//
export const mlsConfigKey = 'machineLearningServices';
export const pythonPathConfigKey = 'pythonPath';
export const rPathConfigKey = 'rPath';

// Localized texts
//
export const managePackageCommandError = localize('mls.managePackages.error', "Either no connection is available or the server does not have external script enabled.");
export function installDependenciesError(err: string): string { return localize('mls.installDependencies.error', "Failed to install dependencies. Error: {0}", err); }
export const installDependenciesMsgTaskName = localize('mls.installDependencies.msgTaskName', "Installing Machine Learning extension dependencies");
export const installDependenciesPackages = localize('mls.installDependencies.packages', "Installing required packages ...");
export const installDependenciesPackagesAlreadyInstalled = localize('mls.installDependencies.packagesAlreadyInstalled', "Required packages are already installed.");
export function installDependenciesGetPackagesError(err: string): string { return localize('mls.installDependencies.getPackagesError', "Failed to get installed python packages. Error: {0}", err); }
export const packageManagerNoConnection = localize('mls.packageManager.NoConnection', "No connection selected");
export const notebookExtensionNotLoaded = localize('mls.notebookExtensionNotLoaded', "Notebook extension is not loaded");
export const mlsEnabledMessage = localize('mls.enabledMessage', "Machine Learning Services Enabled");
export const mlsDisabledMessage = localize('mls.disabledMessage', "Machine Learning Services Disabled");
export const mlsConfigUpdateFailed = localize('mls.configUpdateFailed', "Failed to modify Machine Learning Services configurations");
export const mlsEnableButtonTitle = localize('mls.enableButtonTitle', "Enable");
export const mlsDisableButtonTitle = localize('mls.disableButtonTitle', "Disable");
export const mlsConfigTitle = localize('mls.configTitle', "Config");
export const mlsConfigStatus = localize('mls.configStatus', "Enabled");
export const mlsConfigAction = localize('mls.configAction', "Action");
export const mlsExternalExecuteScriptTitle = localize('mls.externalExecuteScriptTitle', "External Execute Script");
export const mlsPythonLanguageTitle = localize('mls.pythonLanguageTitle', "Python");
export const mlsRLanguageTitle = localize('mls.rLanguageTitle', "R");
export const downloadError = localize('mls.downloadError', "Error while downloading");
export const downloadingProgress = localize('mls.downloadingProgress', "Downloading");
export const pythonConfigError = localize('mls.pythonConfigError', "Python executable is not configured");
export const rConfigError = localize('mls.rConfigError', "R executable is not configured");
export const installingDependencies = localize('mls.installingDependencies', "Installing dependencies ...");
export const resourceNotFoundError = localize('mls.resourceNotFound', "Could not find the specified resource");
export const latestVersion = localize('mls.latestVersion', "Latest");
export function httpGetRequestError(code: number, message: string): string {
	return localize('mls.httpGetRequestError', "Package info request failed with error: {0} {1}",
		code,
		message);
}


// Links
//
export const mlsDocuments = 'https://docs.microsoft.com/sql/advanced-analytics/?view=sql-server-ver15';
export const odbcDriverWindowsDocuments = 'https://docs.microsoft.com/sql/connect/odbc/windows/microsoft-odbc-driver-for-sql-server-on-windows?view=sql-server-ver15';
export const odbcDriverLinuxDocuments = 'https://docs.microsoft.com/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server?view=sql-server-ver15';
export const installMlsLinuxDocs = 'https://docs.microsoft.com/sql/linux/sql-server-linux-setup-machine-learning?toc=%2fsql%2fadvanced-analytics%2ftoc.json&view=sql-server-ver15';
export const installMlsWindowsDocs = 'https://docs.microsoft.com/sql/advanced-analytics/install/sql-machine-learning-services-windows-install?view=sql-server-ver15';

// CSS Styles
//
export namespace cssStyles {
	export const title = { 'font-size': '14px', 'font-weight': '600' };
	export const tableHeader = { 'text-align': 'left', 'font-weight': 'bold', 'text-transform': 'uppercase', 'font-size': '10px', 'user-select': 'text', 'border': 'none', 'background-color': '#FFFFFF' };
	export const tableRow = { 'border-top': 'solid 1px #ccc', 'border-bottom': 'solid 1px #ccc', 'border-left': 'none', 'border-right': 'none' };
	export const hyperlink = { 'user-select': 'text', 'color': '#0078d4', 'text-decoration': 'underline', 'cursor': 'pointer' };
	export const text = { 'margin-block-start': '0px', 'margin-block-end': '0px' };
	export const overflowEllipsisText = { ...text, 'overflow': 'hidden', 'text-overflow': 'ellipsis' };
	export const nonSelectableText = { ...cssStyles.text, 'user-select': 'none' };
	export const tabHeaderText = { 'margin-block-start': '2px', 'margin-block-end': '0px', 'user-select': 'none' };
	export const selectedResourceHeaderTab = { 'font-weight': 'bold', 'color': '' };
	export const unselectedResourceHeaderTab = { 'font-weight': '', 'color': '#0078d4' };
	export const selectedTabDiv = { 'border-bottom': '2px solid #000' };
	export const unselectedTabDiv = { 'border-bottom': '1px solid #ccc' };
	export const lastUpdatedText = { ...text, 'color': '#595959' };
	export const errorText = { ...text, 'color': 'red' };
}
