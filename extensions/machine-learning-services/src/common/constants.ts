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
export const azureSubscriptionsCommand = 'azure.accounts.getSubscriptions';
export const azureResourceGroupsCommand = 'azure.accounts.getResourceGroups';

// Tasks, commands
//
export const mlManageLanguagesCommand = 'mls.command.manageLanguages';
export const mlsPredictModelCommand = 'mls.command.predictModel';
export const mlManageModelsCommand = 'mls.command.manageModels';
export const mlRegisterModelCommand = 'mls.command.registerModel';
export const mlManagePackagesCommand = 'mls.command.managePackages';
export const mlOdbcDriverCommand = 'mls.command.odbcdriver';
export const mlsDocumentsCommand = 'mls.command.mlsdocs';
export const mlsDependenciesCommand = 'mls.command.dependencies';

// Configurations
//
export const mlsConfigKey = 'machineLearningServices';
export const pythonPathConfigKey = 'pythonPath';
export const pythonEnabledConfigKey = 'enablePython';
export const rEnabledConfigKey = 'enableR';
export const registeredModelsTableName = 'registeredModelsTableName';
export const rPathConfigKey = 'rPath';

// Localized texts
//
export const msgYes = localize('msgYes', "Yes");
export const msgNo = localize('msgNo', "No");
export const managePackageCommandError = localize('mls.managePackages.error', "Either no connection is available or the server does not have external script enabled.");
export function taskFailedError(taskName: string, err: string): string { return localize('mls.taskFailedError.error', "Failed to complete task '{0}'. Error: {1}", taskName, err); }
export const installPackageMngDependenciesMsgTaskName = localize('mls.installPackageMngDependencies.msgTaskName', "Installing package management dependencies");
export const installModelMngDependenciesMsgTaskName = localize('mls.installModelMngDependencies.msgTaskName', "Installing model management dependencies");
export const noResultError = localize('mls.noResultError', "No Result returned");
export const requiredPackagesNotInstalled = localize('mls.requiredPackagesNotInstalled', "The required dependencies are not installed");
export const confirmEnableExternalScripts = localize('mls.confirmEnableExternalScripts', "External script is required for package management. Are you sure you want to enable that.");
export const enableExternalScriptsError = localize('mls.enableExternalScriptsError', "Failed to enable External script.");
export const externalScriptsIsRequiredError = localize('mls.externalScriptsIsRequiredError', "External script configuration is required for this action.");
export function confirmInstallPythonPackages(packages: string): string {
	return localize('mls.installDependencies.confirmInstallPythonPackages'
		, "The following Python packages are required to install: {0}. Are you sure you want to install?", packages);
}
export const installDependenciesPackages = localize('mls.installDependencies.packages', "Installing required packages ...");
export const installDependenciesPackagesAlreadyInstalled = localize('mls.installDependencies.packagesAlreadyInstalled', "Required packages are already installed.");
export function installDependenciesGetPackagesError(err: string): string { return localize('mls.installDependencies.getPackagesError', "Failed to get installed python packages. Error: {0}", err); }
export const noConnectionError = localize('mls.packageManager.NoConnection', "No connection selected");
export const notebookExtensionNotLoaded = localize('mls.notebookExtensionNotLoaded', "Notebook extension is not loaded");
export const mssqlExtensionNotLoaded = localize('mls.mssqlExtensionNotLoaded', "MSSQL extension is not loaded");
export const mlsEnabledMessage = localize('mls.enabledMessage', "Machine Learning Services Enabled");
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
export function invalidModelIdError(modelUrl: string | undefined): string { return localize('mls.invalidModelIdError', "Invalid model id. model url: {0}", modelUrl || ''); }
export function noArtifactError(modelUrl: string | undefined): string { return localize('mls.noArtifactError', "Model doesn't have any artifact. model url: {0}", modelUrl || ''); }
export const downloadingProgress = localize('mls.downloadingProgress', "Downloading");
export const pythonConfigError = localize('mls.pythonConfigError', "Python executable is not configured");
export const rConfigError = localize('mls.rConfigError', "R executable is not configured");
export const installingDependencies = localize('mls.installingDependencies', "Installing dependencies ...");
export const resourceNotFoundError = localize('mls.resourceNotFound', "Could not find the specified resource");
export const latestVersion = localize('mls.latestVersion', "Latest");
export const localhost = 'localhost';
export function httpGetRequestError(code: number, message: string): string {
	return localize('mls.httpGetRequestError', "Package info request failed with error: {0} {1}",
		code,
		message);
}
export function getErrorMessage(error: Error): string { return localize('azure.resource.error', "Error: {0}", error?.message || error?.toString()); }
export const notSupportedEventArg = localize('notSupportedEventArg', "Not supported event args");
export const extLangInstallTabTitle = localize('extLang.installTabTitle', "Installed");
export const extLangLanguageCreatedDate = localize('extLang.languageCreatedDate', "Installed");
export const extLangLanguagePlatform = localize('extLang.languagePlatform', "Platform");
export const deleteTitle = localize('extLang.delete', "Delete");
export const extLangInstallButtonText = localize('extLang.installButtonText', "Install");
export const extLangCancelButtonText = localize('extLang.CancelButtonText', "Cancel");
export const extLangDoneButtonText = localize('extLang.DoneButtonText', "Close");
export const extLangOkButtonText = localize('extLang.OkButtonText', "OK");
export const extLangSaveButtonText = localize('extLang.SaveButtonText', "Save");
export const extLangLanguageName = localize('extLang.languageName', "Name");
export const extLangNewLanguageTabTitle = localize('extLang.newLanguageTabTitle', "Add new");
export const extLangFileBrowserTabTitle = localize('extLang.fileBrowserTabTitle', "File Browser");
export const extLangDialogTitle = localize('extLang.DialogTitle', "Languages");
export const extLangTarget = localize('extLang.Target', "Target");
export const extLangLocal = localize('extLang.Local', "localhost");
export const extLangExtensionFilePath = localize('extLang.extensionFilePath', "Language extension path");
export const extLangExtensionFileLocation = localize('extLang.extensionFileLocation', "Language extension location");
export const extLangExtensionFileName = localize('extLang.extensionFileName', "Extension file Name");
export const extLangEnvVariables = localize('extLang.envVariables', "Environment variables");
export const extLangParameters = localize('extLang.parameters', "Parameters");
export const extLangSelectedPath = localize('extLang.selectedPath', "Selected Path");
export const extLangInstallFailedError = localize('extLang.installFailedError', "Failed to install language");
export const extLangUpdateFailedError = localize('extLang.updateFailedError', "Failed to update language");

export const modelArtifactName = localize('models.artifactName', "Artifact Name");
export const modelName = localize('models.name', "Name");
export const modelDescription = localize('models.description', "Description");
export const modelCreated = localize('models.created', "Date Created");
export const modelVersion = localize('models.version', "Version");
export const browseModels = localize('models.browseButton', "...");
export const azureAccount = localize('models.azureAccount', "Azure account");
export const columnDatabase = localize('predict.columnDatabase', "Target database");
export const columnTable = localize('predict.columnTable', "Target table");
export const inputColumns = localize('predict.inputColumns', "Model input mapping");
export const outputColumns = localize('predict.outputColumns', "Model output");
export const columnName = localize('predict.columnName', "Target columns");
export const dataTypeName = localize('predict.dataTypeName', "Type");
export const displayName = localize('predict.displayName', "Display  name");
export const inputName = localize('predict.inputName', "Required model input features");
export const outputName = localize('predict.outputName', "Name");
export const azureSubscription = localize('models.azureSubscription', "Azure subscription");
export const azureGroup = localize('models.azureGroup', "Azure resource group");
export const azureModelWorkspace = localize('models.azureModelWorkspace', "Azure ML workspace");
export const azureModelFilter = localize('models.azureModelFilter', "Filter");
export const azureModels = localize('models.azureModels', "Models");
export const azureModelsTitle = localize('models.azureModelsTitle', "Azure models");
export const localModelsTitle = localize('models.localModelsTitle', "Local models");
export const modelSourcesTitle = localize('models.modelSourcesTitle', "Source location");
export const modelSourcePageTitle = localize('models.modelSourcePageTitle', "Enter model source details");
export const columnSelectionPageTitle = localize('models.columnSelectionPageTitle', "Map predictions target data to model input");
export const modelDetailsPageTitle = localize('models.modelDetailsPageTitle', "Provide model details");
export const modelLocalSourceTitle = localize('models.modelLocalSourceTitle', "Source file");
export const currentModelsTitle = localize('models.currentModelsTitle', "Models");
export const azureRegisterModel = localize('models.azureRegisterModel', "Deploy");
export const predictModel = localize('models.predictModel', "Predict");
export const registerModelTitle = localize('models.RegisterWizard', "Deployed models");
export const deployModelTitle = localize('models.deployModelTitle', "Deploy models");
export const makePredictionTitle = localize('models.makePredictionTitle', "Make prediction");
export const modelRegisteredSuccessfully = localize('models.modelRegisteredSuccessfully', "Model registered successfully");
export const modelFailedToRegister = localize('models.modelFailedToRegistered', "Model failed to register");
export const localModelSource = localize('models.localModelSource', "Upload file");
export const azureModelSource = localize('models.azureModelSource', "Import from AzureML registry");
export const registeredModelsSource = localize('models.registeredModelsSource', "Select managed models");
export const downloadModelMsgTaskName = localize('models.downloadModelMsgTaskName', "Downloading Model from Azure");
export const invalidAzureResourceError = localize('models.invalidAzureResourceError', "Invalid Azure resource");
export const invalidModelToRegisterError = localize('models.invalidModelToRegisterError', "Invalid model to register");
export const invalidModelToPredictError = localize('models.invalidModelToPredictError', "Invalid model to predict");
export const invalidModelToSelectError = localize('models.invalidModelToSelectError', "Please select a valid model");
export const modelNameRequiredError = localize('models.modelNameRequiredError', "Model name is required.");
export const updateModelFailedError = localize('models.updateModelFailedError', "Failed to update the model");
export const importModelFailedError = localize('models.importModelFailedError', "Failed to register the model");
export const loadModelParameterFailedError = localize('models.loadModelParameterFailedError', "Failed to load model parameters'");
export const unsupportedModelParameterType = localize('models.unsupportedModelParameterType', "unsupported");



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
	export const tableHeader = { 'text-align': 'left', 'font-weight': 'bold', 'text-transform': 'uppercase', 'font-size': '10px', 'user-select': 'text', 'border': 'none' };
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
