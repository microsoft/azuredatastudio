/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as path from 'path';
import { SqlTargetPlatform } from 'sqldbproj';
import * as utils from '../common/utils';

const localize = nls.loadMessageBundle();

//#region file extensions
export const dataSourcesFileName = 'datasources.json';
export const sqlprojExtension = '.sqlproj';
export const sqlFileExtension = '.sql';
export const publishProfileExtension = '.publish.xml';
export const openApiSpecFileExtensions = ['yaml', 'yml', 'json'];

//#endregion

//#region Placeholder values
export const schemaCompareExtensionId = 'microsoft.schema-compare';
export const master = 'master';
export const msdb = 'msdb';
export const MicrosoftDatatoolsSchemaSqlSql = 'Microsoft.Data.Tools.Schema.Sql.Sql';
export const databaseSchemaProvider = 'DatabaseSchemaProvider';
export const sqlProjectSdk = 'Microsoft.Build.Sql';
export const problemMatcher = '$sqlproj-problem-matcher';
export const sqlProjTaskType = 'sqlproj-build';
export const dotnet = 'dotnet';
export const build = 'build';
export const runCodeAnalysisParam = '/p:RunSqlCodeAnalysis=true';
export const detailedVerbose = '-v:detailed';

//#endregion

//#region Project Provider
export const emptySqlDatabaseProjectTypeId = 'EmptySqlDbProj';
export const emptyProjectTypeDisplayName = localize('emptyProjectTypeDisplayName', "SQL Server Database");
export const emptyProjectTypeDescription = localize('emptyProjectTypeDescription', "Develop and publish schemas for SQL Server databases starting from an empty project");

export const edgeSqlDatabaseProjectTypeId = 'SqlDbEdgeProj';
export const edgeProjectTypeDisplayName = localize('edgeProjectTypeDisplayName', "Azure SQL Edge Database");
export const edgeProjectTypeDescription = localize('edgeProjectTypeDescription', "Start with the core pieces to develop and publish schemas for Azure SQL Edge Database");

export const emptySqlDatabaseSdkProjectTypeId = 'EmptySqlDbSdkProj';
export const emptySdkProjectTypeDisplayName = localize('emptySdkProjectTypeDisplayName', "SQL Database (SDK)");
export const emptySdkProjectTypeDescription = localize('emptySdkProjectTypeDescription', "Develop and publish schemas for SQL databases with Microsoft.Build.Sql, starting from an empty SDK-style project.");

export const emptyAzureDbSqlDatabaseProjectTypeId = 'EmptyAzureSqlDbProj';
export const emptyAzureDbProjectTypeDisplayName = localize('emptyAzureDbProjectTypeDisplayName', "Azure SQL Database");
export const emptyAzureDbProjectTypeDescription = localize('emptyAzureDbProjectTypeDescription', "Develop and publish schemas for Azure SQL Database starting from an empty project");

//#endregion

//#region Dashboard
export const addItemAction = localize('addItemAction', "Add Item");
export const schemaCompareAction = localize('schemaCompareAction', "Schema Compare");
export const buildAction = localize('buildAction', "Build");
export const publishAction = localize('publishAction', "Publish");
export const changeTargetPlatformAction = localize('changeTargetPlatformAction', "Change Target Platform");

export const Status = localize('Status', "Status");
export const Time = localize('Time', "Time");
export const Date = localize('Date', "Date");
export const TargetPlatform = localize('TargetPlatform', "Target Platform");
export const TargetServer = localize('TargetServer', "Target Server");
export const TargetDatabase = localize('TargetDatabase', "Target Database");
export const BuildHistory = localize('BuildHistory', "Build History");
export const PublishHistory = localize('PublishHistory', "Publish History");

export const Success = localize('Success', "Success");
export const Failed = localize('Failed', "Failed");
export const InProgress = localize('InProgress', "In progress");

export const hr = localize('hr', "hr");
export const min = localize('min', "min");
export const sec = localize('sec', "sec");
export const msec = localize('msec', "msec");

export const at = localize('at', "at");

//#endregion

//#region commands
export const revealFileInOsCommand = 'revealFileInOS';
export const schemaCompareStartCommand = 'schemaCompare.start';
export const schemaCompareRunComparisonCommand = 'schemaCompare.runComparison';
export const vscodeOpenCommand = 'vscode.open';
export const refreshDataWorkspaceCommand = 'dataworkspace.refresh';

//#endregion

//#region UI Strings
export const databaseReferencesNodeName = localize('databaseReferencesNodeName', "Database References");
export const sqlcmdVariablesNodeName = localize('sqlcmdVariablesNodeName', "SQLCMD Variables");
export const sqlConnectionStringFriendly = localize('sqlConnectionStringFriendly', "SQL connection string");
export const yesString = localize('yesString', "Yes");
export const openEulaString = localize('openEulaString', "Open License Agreement");
export const noString = localize('noString', "No");
export const noStringDefault = localize('noStringDefault', "No (default)");
export const okString = localize('okString', "Ok");
export const selectString = localize('selectString', "Select");
export const selectFileString = localize('selectFileString', "Select File");
export const dacpacFiles = localize('dacpacFiles', "dacpac Files");
export const publishSettingsFiles = localize('publishSettingsFiles', "Publish Settings File");
export const file = localize('file', "File");
export const flat = localize('flat', "Flat");
export const objectType = localize('objectType', "Object Type");
export const schema = localize('schema', "Schema");
export const schemaObjectType = localize('schemaObjectType', "Schema/Object Type");
export const defaultProjectNameStarter = localize('defaultProjectNameStarter', "DatabaseProject");
export const location = localize('location', "Location");
export const reloadProject = localize('reloadProject', "Would you like to reload your database project?");
export const learnMore = localize('learnMore', "Learn More");
export const sdkLearnMoreUrl = 'https://aka.ms/sqlprojsdk';
export const azureDevOpsLink = 'https://docs.microsoft.com/azure/azure-sql/database/local-dev-experience-overview?view=azuresql';
export function newObjectNamePrompt(objectType: string) { return localize('newObjectNamePrompt', 'New {0} name:', objectType); }
export function deleteConfirmation(toDelete: string) { return localize('deleteConfirmation', "Are you sure you want to delete {0}?", toDelete); }
export function deleteConfirmationContents(toDelete: string) { return localize('deleteConfirmationContents', "Are you sure you want to delete {0} and all of its contents?", toDelete); }
export function deleteReferenceConfirmation(toDelete: string) { return localize('deleteReferenceConfirmation', "Are you sure you want to delete the reference to {0}?", toDelete); }
export function deleteSqlCmdVariableConfirmation(toDelete: string) { return localize('deleteSqlCmdVariableConfirmation', "Are you sure you want to delete the SQLCMD Variable '{0}'?", toDelete); }
export function selectTargetPlatform(currentTargetPlatform: string) { return localize('selectTargetPlatform', "Current target platform: {0}. Select new target platform", currentTargetPlatform); }
export function currentTargetPlatform(projectName: string, currentTargetPlatform: string) { return localize('currentTargetPlatform', "Target platform of the project {0} is now {1}", projectName, currentTargetPlatform); }
export function projectUpdatedToSdkStyle(projectName: string) { return localize('projectUpdatedToSdkStyle', "The project {0} has been updated to be an SDK-style project. Click 'Learn More' for details on the Microsoft.Build.Sql SDK and ways to simplify the project file.", projectName); }
export function convertToSdkStyleConfirmation(projectName: string) { return localize('convertToSdkStyleConfirmation', "The project '{0}' will not be fully compatible with SSDT after conversion. A backup copy of the project file will be created in the project folder prior to conversion. More information is available at https://aka.ms/sqlprojsdk. Continue with converting to SDK-style project?", projectName); }
export function updatedToSdkStyleError(projectName: string) { return localize('updatedToSdkStyleError', "Converting the project {0} to SDK-style was unsuccessful. Changes to the .sqlproj have been rolled back.", projectName); }
export const enterNewName = localize('enterNewName', "Enter new name");
//#endregion

export const illegalSqlCmdChars = ['$', '@', '#', '"', '\'', '-'];
export const reservedProjectFolders = ['Properties', 'SQLCMD Variables', 'Database References'];

//#region Publish dialog strings
export const publishDialogName = localize('publishDialogName', "Publish project");
export const publish = localize('publish', "Publish");
export const cancelButtonText = localize('cancelButtonText', "Cancel");
export const generateScriptButtonText = localize('generateScriptButtonText', "Generate Script");
export const databaseNameLabel = localize('databaseNameLabel', "Database");
export const targetConnectionLabel = localize('targetConnectionLabel', "Connection");
export const dataSourceRadioButtonLabel = localize('dataSourceRadioButtonLabel', "Data sources");
export const connectionRadioButtonLabel = localize('connectionRadioButtonLabel', "Connections");
export const dataSourceDropdownTitle = localize('dataSourceDropdownTitle', "Data source");
export const noDataSourcesText = localize('noDataSourcesText', "No data sources in this project");
export const loadProfilePlaceholderText = localize('loadProfilePlaceholderText', "Load profile...");
export const profileReadError = (err: any) => localize('profileReadError', "Error loading the publish profile. {0}", utils.getErrorMessage(err));
export const sqlCmdVariables = localize('sqlCmdTableLabel', "SQLCMD Variables");
export const sqlCmdVariableColumn = localize('sqlCmdVariableColumn', "Name");
export const sqlCmdValueColumn = localize('sqlCmdValueColumn', "Value");
export const revertSqlCmdVarsButtonTitle = localize('revertSqlCmdVarsButtonTitle', "Revert values to project defaults");
export const profile = localize('profile', "Profile");
export const selectConnection = localize('selectConnection', "Select connection");
export const server = localize('server', "Server");
export const defaultUser = localize('default', "default");
export const selectProfileToUse = localize('selectProfileToUse', "Select publish profile to load");
export const selectProfile = localize('selectProfile', "Select Profile");
export const saveProfileAsButtonText = localize('saveProfileAsButtonText', "Save As...");
export const save = localize('save', "Save");
export const dontUseProfile = localize('dontUseProfile', "Don't use profile");
export const browseForProfileWithIcon = `$(folder) ${localize('browseForProfile', "Browse for profile")}`;
export const chooseAction = localize('chooseAction', "Choose action");
export const chooseSqlcmdVarsToModify = localize('chooseSqlcmdVarsToModify', "Choose SQLCMD variables to modify");
export const enterNewValueForVar = (varName: string) => localize('enterNewValueForVar', "Enter new default value for variable '{0}'", varName);
export const enterNewSqlCmdVariableName = localize('enterNewSqlCmdVariableName', "Enter new SQLCMD Variable name");
export const enterNewSqlCmdVariableDefaultValue = (varName: string) => localize('enterNewSqlCmdVariableDefaultValue', "Enter default value for SQLCMD variable '{0}'", varName);
export const addSqlCmdVariableWithoutDefaultValue = (varName: string) => localize('addSqlCmdVariableWithoutDefaultValue', "Add SQLCMD variable '{0}' to project without default value?", varName);
export const sqlcmdVariableAlreadyExists = localize('sqlcmdVariableAlreadyExists', "A SQLCMD Variable with the same name already exists in this project");
export const resetAllVars = localize('resetAllVars', "Reset all variables");
export const createNew = localize('createNew', "Create New");
export const enterNewDatabaseName = localize('enterNewDatabaseName', "Enter new database name");
export const newText = localize('new', "New");
export const selectDatabase = localize('selectDatabase', "Select database");
export const done = localize('done', "Done");
export const nameMustNotBeEmpty = localize('nameMustNotBeEmpty', "Name must not be empty");
export const versionMustNotBeEmpty = localize('versionMustNotBeEmpty', "Version must not be empty");
export const saveProfile = localize('saveProfile', "Would you like to save the settings in a profile (.publish.xml)?");

//#endregion

//#region Publish Dialog options
export const AdvancedOptionsButton = localize('advancedOptionsButton', 'Advanced...');
export const AdvancedPublishOptions = localize('advancedPublishOptions', 'Advanced Publish Options');
export const PublishOptions = localize('publishOptions', 'Publish Options');
export const ExcludeObjectTypeTab = localize('excludeObjectTypes', 'Exclude Object Types');
export const ResetButton: string = localize('reset', "Reset");
export const OptionDescription: string = localize('optionDescription', "Option Description");
export const OptionName: string = localize('optionName', "Option Name");
export const OptionInclude: string = localize('include', "Include");
export function OptionNotFoundWarningMessage(label: string) { return localize('optionNotFoundWarningMessage', "label: {0} does not exist in the options value name lookup", label); }

//#endregion

//#region Deploy
export const SqlServerName = 'SQL server';
export const AzureSqlServerName = 'Azure SQL server';
export const SqlServerDockerImageName = 'Microsoft SQL Server';
export const SqlServerDocker2022ImageName = 'Microsoft SQL Server 2022';
export const AzureSqlDbFullDockerImageName = 'Microsoft SQL Server';
export const AzureSqlLogicalServerName = 'Azure SQL logical server';
export const selectPublishOption = localize('selectPublishOption', "Select where to publish the project to");
export const defaultQuickPickItem = localize('defaultQuickPickItem', "Default - image defined as default in the container registry");
export function publishToExistingServer(name: string) { return localize('publishToExistingServer', "Publish to an existing {0}", name); }
export function publishToDockerContainer(name: string) { return localize('publishToDockerContainer', "Publish to new {0} local development container", name); }
export function publishToDockerContainerPreview(name: string) { return localize('publishToDockerContainerPreview', "Publish to new {0} local development container (Preview)", name); }
export const publishToAzureEmulator = localize('publishToAzureEmulator', "Publish to new SQL Server local development container");
export const publishToNewAzureServer = localize('publishToNewAzureServer', "Publish to new Azure SQL logical server (Preview)");
export const azureServerName = localize('azureServerName', "Azure SQL server name");
export const azureSubscription = localize('azureSubscription', "Azure subscription");
export const resourceGroup = localize('resourceGroup', "Resource group");
export const azureLocation = localize('location', "Location");
export const azureAccounts = localize('azureAccounts', "Azure accounts");
export function enterPortNumber(name: string) { return localize('enterPortNumber', "Enter {0} port number or press enter to use the default value", name); }
export function serverPortNumber(name: string) { return localize('serverPortNumber', "{0} port number", name); }
export function serverPassword(name: string) { return localize('serverPassword', "{0} admin password", name); }
export function confirmServerPassword(name: string) { return localize('confirmServerPassword', "Confirm {0} admin password", name); }
export function baseDockerImage(name: string) { return localize('baseDockerImage', "Base {0} Docker image", name); }
export const publishTo = localize('publishTo', "Publish Target");
export const enterConnectionStringEnvName = localize('enterConnectionStringEnvName', "Enter connection string environment variable name");
export const enterConnectionStringTemplate = localize('enterConnectionStringTemplate', "Enter connection string template");
export function enterUser(name: string) { return localize('enterUser', "Enter {0} admin user name", name); }
export function enterPassword(name: string) { return localize('enterPassword', "Enter {0} admin password", name); }
export function confirmPassword(name: string) { return localize('confirmPassword', "Confirm {0} admin password", name); }
export function selectBaseImage(name: string) { return localize('selectBaseImage', "Select the base {0} docker image", name); }
export function selectImageTag(name: string) { return localize('selectImageTag', "Select the image tag or press enter to use the default value", name); }
export function invalidSQLPasswordMessage(name: string) { return localize('invalidSQLPassword', "{0} password doesn't meet the password complexity requirement. For more information see https://docs.microsoft.com/sql/relational-databases/security/password-policy", name); }
export function passwordNotMatch(name: string) { return localize('passwordNotMatch', "{0} password doesn't match the confirmation password", name); }
export const portMustBeNumber = localize('portMustNotBeNumber', "Port must a be number");
export const valueCannotBeEmpty = localize('valueCannotBeEmpty', "Value cannot be empty");
export const imageTag = localize('imageTag', "Image tag");
export const dockerImageLabelPrefix = 'source=sqldbproject';
export const dockerImageNamePrefix = 'sqldbproject';
export const dockerImageDefaultTag = 'latest';

//#endregion

//#region Publish to Container
export const eulaAgreementTemplate = localize({ key: 'eulaAgreementTemplate', comment: ['The placeholders are contents of the line and should not be translated.'] }, "I accept the {0}.");
export function eulaAgreementText(name: string) { return localize({ key: 'eulaAgreementText', comment: ['The placeholders are contents of the line and should not be translated.'] }, "I accept the {0}.", name); }
export const eulaAgreementTitle = localize('eulaAgreementTitle', "Microsoft SQL Server License Agreement");
export const sqlServerEulaLink = 'https://aka.ms/mcr/osslegalnotice';
export const connectionNamePrefix = 'SQLDbProject';
export const sqlServerDockerRegistry = 'mcr.microsoft.com';
export const sqlServerDockerRepository = 'mssql/server';
export const commandsFolderName = 'commands';
export const mssqlFolderName = '.mssql';
export const dockerFileName = 'Dockerfile';
export const startCommandName = 'start.sh';
export const defaultPortNumber = '1433';
export const defaultLocalServerName = 'localhost';
export const defaultLocalServerAdminName = 'sa';
export const defaultConnectionStringEnvVarName = 'SQLConnectionString';
export const defaultConnectionStringTemplate = 'Data Source=@@SERVER@@,@@PORT@@;Initial Catalog=@@DATABASE@@;User id=@@USER@@;Password=@@SA_PASSWORD@@;';
export const azureFunctionLocalSettingsFileName = 'local.settings.json';
export const enterConnStringTemplateDescription = localize('enterConnStringTemplateDescription', "Enter a template for SQL connection string");
export const appSettingPrompt = localize('appSettingPrompt', "Would you like to update Azure Function local.settings.json with the new connection string?");
export const enterConnectionStringEnvNameDescription = localize('enterConnectionStringEnvNameDescription', "Enter environment variable for SQL connection string");
export const deployDbTaskName = localize('deployDbTaskName', "Deploying SQL Db Project Locally");
export const publishProjectSucceed = localize('publishProjectSucceed', "Database project published successfully");
export const publishingProjectMessage = localize('publishingProjectMessage', "Publishing project in a container...");
export const cleaningDockerImagesMessage = localize('cleaningDockerImagesMessage', "Cleaning existing deployments...");
export const dockerImageMessage = localize('dockerImageMessage', "Docker Image:");
export const dockerImageEulaMessage = localize('dockerImageEulaMessage', "License Agreement:");
export const creatingDeploymentSettingsMessage = localize('creatingDeploymentSettingsMessage', "Creating deployment settings ...");
export const runningDockerMessage = localize('runningDockerMessage', "Running the docker container ...");
export function dockerNotRunningError(error: string) { return localize('dockerNotRunningError', "Failed to verify docker. Please make sure docker is installed and running. Error: '{0}'", error || ''); }
export const dockerContainerNotRunningErrorMessage = localize('dockerContainerNotRunningErrorMessage', "Docker container is not running");
export const dockerContainerFailedToRunErrorMessage = localize('dockerContainerFailedToRunErrorMessage', "Failed to run the docker container");
export const connectingToSqlServerMessage = localize('connectingToSqlServerMessage', "Connecting to SQL Server");
export const serverCreated = localize('serverCreated', "Server created");
export const deployProjectFailedMessage = localize('deployProjectFailedMessage', "Failed to open a connection to the deployed database'");
export const containerAlreadyExistForProject = localize('containerAlreadyExistForProject', "Containers already exist for this project. Do you want to delete them before deploying a new one?");
export const checkoutOutputMessage = localize('checkoutOutputMessage', "Check output pane for more details");
export function creatingAzureSqlServer(name: string): string { return localize('creatingAzureSqlServer', "Creating Azure SQL Server '{0}' ...", name); }
export function azureSqlServerCreated(name: string): string { return localize('azureSqlServerCreated', "Azure SQL Server '{0}' created", name); }
export function taskFailedError(taskName: string, err: string): string { return localize('taskFailedError.error', "Failed to complete task '{0}'. Error: {1}", taskName, err); }
export function publishToContainerFailed(errorMessage: string) { return localize('publishToContainerFailed', "Failed to publish to container. {0}", errorMessage); }
export function publishToNewAzureServerFailed(errorMessage: string) { return localize('publishToNewAzureServerFailed', "Failed to publish to new Azure SQL server. {0}", errorMessage); }
export function deployAppSettingUpdateFailed(appSetting: string) { return localize('deployAppSettingUpdateFailed', "Failed to update app setting '{0}'", appSetting); }
export function deployAppSettingUpdating(appSetting: string) { return localize('deployAppSettingUpdating', "Updating app setting: '{0}'", appSetting); }
export function connectionFailedError(error: string) { return localize('connectionFailedError', "Connection failed error: '{0}'", error); }
export function dockerContainerCreatedMessage(id: string) { return localize('dockerContainerCreatedMessage', "Docker created id: '{0}'", id); }
export function dockerLogMessage(log: string) { return localize('dockerLogMessage', "Docker logs: '{0}'", log); }
export function retryWaitMessage(numberOfSeconds: number, name: string) { return localize('retryWaitMessage', "Waiting for {0} seconds before another attempt for operation '{1}'", numberOfSeconds, name); }
export function retryRunMessage(attemptNumber: number, numberOfAttempts: number, name: string) { return localize('retryRunMessage', "Running operation '{2}' Attempt {0} of {1}", attemptNumber, numberOfAttempts, name); }
export function retrySucceedMessage(name: string, result: string) { return localize('retrySucceedMessage', "Operation '{0}' completed successfully. Result: {1}", name, result); }
export function retryFailedMessage(name: string, result: string, error: string) { return localize('retryFailedMessage', "Operation '{0}' failed. Re-trying... Current Result: {1}. Error: '{2}'", name, result, error); }
export function retryMessage(name: string, error: string) { return localize('retryMessage', "Operation '{0}' failed. Re-trying... Error: '{1}' ", name, error); }

//#endregion

//#region Add Database Reference dialog strings
export const addDatabaseReferenceDialogName = localize('addDatabaseReferencedialogName', "Add database reference");
export const addDatabaseReferenceOkButtonText = localize('addDatabaseReferenceOkButtonText', "Add reference");
export const referenceRadioButtonsGroupTitle = localize('referenceRadioButtonsGroupTitle', "Referenced Database Type");
export const projectLabel = localize('projectLocString', "Project");
export const systemDatabase = localize('systemDatabase', "System database");
export const dacpacText = localize('dacpacText', "Data-tier application (.dacpac)");
export const nupkgText = localize('nupkgText', "Published data-tier application (.nupkg)");
export const nupkgNamePlaceholder = localize('nupkgNamePlaceholder', "NuGet package name");
export const version = localize('version', "Version");
export const versionPlaceholder = localize('versionPlaceholder', "NuGet package version");
export const selectDacpac = localize('selectDacpac', "Select .dacpac");
export const sameDatabase = localize('sameDatabase', "Same database");
export const differentDbSameServer = localize('differentDbSameServer', "Different database, same server");
export const differentDbDifferentServer = localize('differentDbDifferentServer', "Different database, different server");
export const systemDbLocationDropdownValues = [differentDbSameServer];
export const locationDropdownValues = [sameDatabase, differentDbSameServer, differentDbDifferentServer];
export const databaseName = localize('databaseName', "Database name");
export const databaseVariable = localize('databaseVariable', "Database variable");
export const serverName = localize('serverName', "Server name");
export const serverVariable = localize('serverVariable', "Server variable");
export const suppressMissingDependenciesErrors = localize('suppressMissingDependenciesErrors', "Suppress errors caused by unresolved references in the referenced project");
export const exampleUsage = localize('exampleUsage', "Example Usage");
export const enterSystemDbName = localize('enterSystemDbName', "Enter a database name for this system database");
export const databaseNameRequiredVariableOptional = localize('databaseNameRequiredVariableOptional', "A database name is required. The database variable is optional.");
export const databaseNameServerNameVariableRequired = localize('databaseNameServerNameVariableRequired', "A database name, server name, and server variable are required. The database variable is optional");
export const otherServer = 'OtherServer';
export const otherSeverVariable = 'OtherServer';
export const databaseProject = localize('databaseProject', "Database project");
export const dacpacMustBeOnSameDrive = localize('dacpacNotOnSameDrive', "Dacpac references need to be located on the same drive as the project file.");
export const dacpacNotOnSameDrive = (projectLocation: string): string => { return localize('dacpacNotOnSameDrive', "Dacpac references need to be located on the same drive as the project file. The project file is located at {0}", projectLocation); };
export const referencedDatabaseType = localize('referencedDatabaseType', "Referenced Database type");
export const excludeFolderNotSupported = localize('excludeFolderNotSupported', "Excluding folders is not yet supported");
export const unhandledDeleteType = (itemType: string): string => { return localize('unhandledDeleteType', "Unhandled item type during delete: '{0}", itemType); }
export const unhandledExcludeType = (itemType: string): string => { return localize('unhandledDeleteType', "Unhandled item type during exclude: '{0}", itemType); }
export const artifactReference = localize('artifactReference', "Artifact Reference");
export const packageReference = localize('packageReference', "Package Reference");
export const referenceTypeRadioButtonsGroupTitle = localize('referenceTypeRadioButtonsGroupTitle', "Reference Type");


//#endregion

//#region Create Project From Database dialog strings
export const createProjectFromDatabaseDialogName = localize('createProjectFromDatabaseDialogName', "Create project from database");
export const createProjectDialogOkButtonText = localize('createProjectDialogOkButtonText', "Create");
export const sourceDatabase = localize('sourceDatabase', "Source database");
export const targetProject = localize('targetProject', "Target project");
export const createProjectSettings = localize('createProjectSettings', "Settings");
export const projectNameLabel = localize('projectNameLabel', "Name");
export const projectNamePlaceholderText = localize('projectNamePlaceholderText', "Enter project name");
export const projectLocationLabel = localize('projectLocationLabel', "Location");
export const projectLocationPlaceholderText = localize('projectLocationPlaceholderText', "Select location to create project");
export const browseButtonText = localize('browseButtonText', "Browse folder");
export const selectFolderStructure = localize('selectFolderStructure', "Select folder structure");
export const folderStructureLabel = localize('folderStructureLabel', "Folder structure");
export const includePermissionsLabel = localize('includePermissionsLabel', "Include permissions");
export const includePermissionsInProject = localize('includePermissionsInProject', "Include permissions in project");
export const browseEllipsisWithIcon = `$(folder) ${localize('browseEllipsis', "Browse...")}`;
export const selectProjectLocation = localize('selectProjectLocation', "Select project location");
export const sdkStyleProject = localize('sdkStyleProject', 'SDK-style project');
export const YesRecommended = localize('yesRecommended', "Yes (Recommended)");
export const SdkLearnMorePlaceholder = localize('sdkLearnMorePlaceholder', "Click \"Learn More\" button for more information about SDK-style projects");
export const ProjectParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.projectParentDirectoryNotExistError', "The selected project location '{0}' does not exist or is not a directory.", location); };
export const ProjectDirectoryAlreadyExistError = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };
export const confirmCreateProjectWithBuildTaskDialogName = localize('configureSqlProjDefaultBuild', "Do you want to configure SQL project build as the default build configuration for this folder?");
export const buildTaskName = localize('buildTaskName', "Build");
export const buildWithCodeAnalysisTaskName = localize('buildWithCodeAnalysisTaskName', "Build with Code Analysis");

//#endregion

//#region Update Project From Database dialog strings
export const updateProjectFromDatabaseDialogName = localize('updateProjectFromDatabaseDialogName', "Update project from database");
export const updateText = localize('updateText', "Update");
export const noSqlProjFile = localize('noSqlProjFile', "The selected project file does not exist");
export const noSchemaCompareExtension = localize('noSchemaCompareExtension', "The Schema Compare extension must be installed to a update a project from a database.");
export const projectToUpdatePlaceholderText = localize('projectToUpdatePlaceholderText', "Select project file");
export const updateAction = localize('updateAction', "Update action");
export const compareActionRadioButtonLabel = localize('compareActionRadiButtonLabel', "View changes in Schema Compare");
export const updateActionRadioButtonLabel = localize('updateActionRadiButtonLabel', "Apply all changes");
export const actionLabel = localize('actionLabel', "Action");
export const applyConfirmation: string = localize('applyConfirmation', "Are you sure you want to update the target project?");

//#endregion

//#region Update project from database
export const applySuccess = localize('applySuccess', "Project was successfully updated.");
export const equalComparison = localize('equalComparison', "The project is already up to date with the database.");
export function applyError(errorMessage: string): string { return localize('applyError', "There was an error updating the project: {0}", errorMessage); }
export function updatingProjectFromDatabase(projectName: string, databaseName: string): string { return localize('updatingProjectFromDatabase', "Updating {0} from {1}...", projectName, databaseName); }

//#endregion

//#region Error messages
export function errorPrefix(errorMessage: string): string { return localize('errorPrefix', "Error: {0}", errorMessage); }
export function compareErrorMessage(errorMessage: string): string { return localize('schemaCompare.compareErrorMessage', "Schema Compare failed: {0}", errorMessage ? errorMessage : 'Unknown'); }
export const multipleSqlProjFiles = localize('multipleSqlProjFilesSelected', "Multiple .sqlproj files selected; please select only one.");
export const noSqlProjFiles = localize('noSqlProjFilesSelected', "No .sqlproj file selected; please select one.");
export const noDataSourcesFile = localize('noDataSourcesFile', "No {0} found", dataSourcesFileName);
export const missingVersion = localize('missingVersion', "Missing 'version' entry in {0}", dataSourcesFileName);
export const unrecognizedDataSourcesVersion = localize('unrecognizedDataSourcesVersion', "Unrecognized version: ");
export const unknownDataSourceType = localize('unknownDataSourceType', "Unknown data source type: ");
export const invalidSqlConnectionString = localize('invalidSqlConnectionString', "Invalid SQL connection string");
export const extractTargetRequired = localize('extractTargetRequired', "Target information for extract is required to create database project.");
export const schemaCompareNotInstalled = localize('schemaCompareNotInstalled', "Schema compare extension installation is required to run schema compare");
export const buildFailedCannotStartSchemaCompare = localize('buildFailedCannotStartSchemaCompare', "Schema compare could not start because build failed");
export function projectNeedsUpdatingForCrossPlat(projectName: string) { return localize('projectNeedsUpdatingForCrossPlat', "The targets, references, and system database references need to be updated to build the project '{0}'.", projectName); }
export function updateProjectForCrossPlatform(projectName: string) { return localize('updateProjectForCrossPlatform', "{0} If the project was created in SSDT, it will continue to work in both tools. Do you want to update the project?", projectNeedsUpdatingForCrossPlat(projectName)); }
export function updateProjectForCrossPlatformShort(projectName: string) { return localize('updateProjectForCrossPlatformShort', "Update {0} for cross-platform support?", projectName); }
export function updateProjectDatabaseReferencesForCrossPlatform(projectName: string) { return localize('updateProjectDatabaseReferencesForRoundTrip', "The system database references need to be updated to build the project '{0}'. If the project was created in SSDT, it will continue to work in both tools. Do you want to update the project?", projectName); }
export const databaseReferenceTypeRequired = localize('databaseReferenceTypeRequired', "Database reference type is required for adding a reference to a database");
export const systemDatabaseReferenceRequired = localize('systemDatabaseReferenceRequired', "System database selection is required for adding a reference to a system database");
export const dacpacFileLocationRequired = localize('dacpacFileLocationRequired', "Dacpac file location is required for adding a reference to a database");
export const databaseLocationRequired = localize('databaseLocation', "Database location is required for adding a reference to a database");
export const databaseNameRequired = localize('databaseNameRequired', "Database name is required for adding a reference to a different database");
export const invalidDataSchemaProvider = localize('invalidDataSchemaProvider', "Invalid DSP in .sqlproj file");
export const invalidDatabaseReference = localize('invalidDatabaseReference', "Invalid database reference in .sqlproj file");
export const databaseSelectionRequired = localize('databaseSelectionRequired', "Database selection is required to create a project from a database");
export const databaseReferenceAlreadyExists = localize('databaseReferenceAlreadyExists', "A reference to this database already exists in this project");
export const outsideFolderPath = localize('outsideFolderPath', "Items with absolute path outside project folder are not supported. Please make sure the paths in the project file are relative to project folder.");
export const parentTreeItemUnknown = localize('parentTreeItemUnknown', "Cannot access parent of provided tree item");
export const prePostDeployCount = localize('prePostDeployCount', "To successfully build, update the project to have one pre-deployment script and/or one post-deployment script");
export const invalidProjectReload = localize('invalidProjectReload', "Cannot access provided database project. Only valid, open database projects can be reloaded.");
export const externalStreamingJobValidationPassed = localize('externalStreamingJobValidationPassed', "Validation of external streaming job passed.");
export const errorRetrievingBuildFiles = localize('errorRetrievingBuildFiles', "Could not build project. Error retrieving files needed to build.");

export function projectAlreadyOpened(path: string) { return localize('projectAlreadyOpened', "Project '{0}' is already opened.", path); }
export function projectAlreadyExists(name: string, path: string) { return localize('projectAlreadyExists', "A project named {0} already exists in {1}.", name, path); }
export function noFileExist(fileName: string) { return localize('noFileExist', "File {0} doesn't exist", fileName); }
export function fileOrFolderDoesNotExist(name: string) { return localize('fileOrFolderDoesNotExist', "File or directory '{0}' doesn't exist", name); }
export function cannotResolvePath(path: string) { return localize('cannotResolvePath', "Cannot resolve path {0}", path); }
export function fileAlreadyExists(filename: string) { return localize('fileAlreadyExists', "A file with the name '{0}' already exists on disk at this location. Please choose another name.", filename); }
export function folderAlreadyExists(filename: string) { return localize('folderAlreadyExists', "A folder with the name '{0}' already exists on disk at this location. Please choose another name.", filename); }
export function folderAlreadyExistsChooseNewLocation(filename: string) { return localize('folderAlreadyExistsChooseNewLocation', "A folder with the name '{0}' already exists on disk at this location. Please choose another location.", filename); }
export function invalidInput(input: string) { return localize('invalidInput', "Invalid input: {0}", input); }
export function invalidProjectPropertyValueInSqlProj(propertyName: string) { return localize('invalidPropertyValueInSqlProj', "Invalid value specified for the property '{0}' in .sqlproj file", propertyName); }
export function invalidProjectPropertyValueProvided(propertyName: string) { return localize('invalidPropertyValueProvided', "Project property value '{0} is invalid", propertyName); }
export function unableToCreatePublishConnection(input: string) { return localize('unableToCreatePublishConnection', "Unable to construct connection: {0}", input); }
export function circularProjectReference(project1: string, project2: string) { return localize('cicularProjectReference', "Circular reference from project {0} to project {1}", project1, project2); }
export function errorFindingBuildFilesLocation(err: any) { return localize('errorFindingBuildFilesLocation', "Error finding build files location: {0}", utils.getErrorMessage(err)); }
export function projBuildFailed(errorMessage: string) { return localize('projBuildFailed', "Build failed. Check output pane for more details. {0}", errorMessage); }
export function unexpectedProjectContext(uri: string) { return localize('unexpectedProjectContext', "Unable to establish project context.  Command invoked from unexpected location: {0}", uri); }
export function unableToPerformAction(action: string, uri: string, error?: string) { return localize('unableToPerformAction', "Unable to locate '{0}' target: '{1}'. {2}", action, uri, error); }
export function unableToFindObject(path: string, objType: string) { return localize('unableToFindFile', "Unable to find {1} with path '{0}'", path, objType); }
export function deployScriptExists(scriptType: string) { return localize('deployScriptExists', "A {0} script already exists. The new script will not be included in build.", scriptType); }
export function cantAddCircularProjectReference(project: string) { return localize('cantAddCircularProjectReference', "A reference to project '{0}' cannot be added. Adding this project as a reference would cause a circular dependency", project); }
export function unableToFindSqlCmdVariable(variableName: string) { return localize('unableToFindSqlCmdVariable', "Unable to find SQLCMD variable '{0}'", variableName); }
export function unableToFindDatabaseReference(reference: string) { return localize('unableToFindReference', "Unable to find database reference {0}", reference); }
export function invalidGuid(guid: string) { return localize('invalidGuid', "Specified GUID is invalid: {0}", guid); }
export function invalidTargetPlatform(targetPlatform: string, supportedTargetPlatforms: string[]) { return localize('invalidTargetPlatform', "Invalid target platform: {0}. Supported target platforms: {1}", targetPlatform, supportedTargetPlatforms.toString()); }
export function errorReadingProject(section: string, path: string, error?: string) { return localize('errorReadingProjectGuid', "Error trying to read {0} of project '{1}'. {2}", section, path, error); }
export function errorAddingDatabaseReference(referenceName: string, error: string) { return localize('errorAddingDatabaseReference', "Error adding database reference to {0}. Error: {1}", referenceName, error); }
export function errorNotSupportedInVsCode(actionDescription: string) { return localize('errorNotSupportedInVsCode', "Error: {0} is not currently supported in SQL Database Projects for VS Code.", actionDescription); }
export function sqlcmdVariableNameCannotContainWhitespace(name: string) { return localize('sqlcmdVariableNameCannotBeWhitespace', "SQLCMD variable name '{0}' cannot contain whitespace", name); }
export function sqlcmdVariableNameCannotContainIllegalChars(name: string) { return localize('sqlcmdVariableNameCannotContainIllegalChars', "SQLCMD variable name '{0}' cannot contain any of the following characters: {1}", name, illegalSqlCmdChars.join(', ')); }

//#endregion

// Action types
export const deleteAction = localize('deleteAction', 'Delete');
export const excludeAction = localize('excludeAction', 'Exclude');

// Project tree object types
export const fileObject = localize('fileObject', "file");
export const folderObject = localize('folderObject', "folder");

//#region Project script types
export const folderFriendlyName = localize('folderFriendlyName', "Folder");
export const scriptFriendlyName = localize('scriptFriendlyName', "Script");
export const tableFriendlyName = localize('tableFriendlyName', "Table");
export const viewFriendlyName = localize('viewFriendlyName', "View");
export const storedProcedureFriendlyName = localize('storedProcedureFriendlyName', "Stored Procedure");
export const dataSourceFriendlyName = localize('dataSource', "Data Source");
export const fileFormatFriendlyName = localize('fileFormat', "File Format");
export const externalStreamFriendlyName = localize('externalStream', "External Stream");
export const externalStreamingJobFriendlyName = localize('externalStreamingJobFriendlyName', "External Streaming Job");
export const preDeployScriptFriendlyName = localize('preDeployScriptFriendlyName', "Script.PreDeployment");
export const postDeployScriptFriendlyName = localize('postDeployScriptFriendlyName', "Script.PostDeployment");
export const publishProfileFriendlyName = localize('publishProfileFriendlyName', "Publish Profile");
export const tasksJsonFriendlyName = localize('tasksJsonFriendlyName', "Tasks.json");

//#endregion

//#region Build
export const DotnetInstallationConfirmation: string = localize('sqlDatabaseProjects.DotnetInstallationConfirmation', "The .NET SDK cannot be located. Project build will not work. Please install .NET 8 SDK or higher or update the .NET SDK location in settings if already installed.");
export function NetCoreSupportedVersionInstallationConfirmation(installedVersion: string) { return localize('sqlDatabaseProjects.NetCoreSupportedVersionInstallationConfirmation', "Currently installed .NET SDK version is {0}, which is not supported. Project build will not work. Please install .NET 8 SDK or higher or update the .NET SDK supported version location in settings if already installed.", installedVersion); }
export const UpdateDotnetLocation: string = localize('sqlDatabaseProjects.UpdateDotnetLocation', "Update Location");
export const projectsOutputChannel = localize('sqlDatabaseProjects.outputChannel', "Database Projects");

//#endregion

// Prompt buttons
export const Install: string = localize('sqlDatabaseProjects.Install', "Install");
export const DoNotAskAgain: string = localize('sqlDatabaseProjects.doNotAskAgain', "Don't Ask Again");

//#region SqlProj file XML names
export const ItemGroup = 'ItemGroup';
export const Build = 'Build';
export const Folder = 'Folder';
export const Include = 'Include';
export const Remove = 'Remove';
export const Import = 'Import';
export const Project = 'Project';
export const Condition = 'Condition';
export const Target = 'Target';
export const Name = 'Name';
export const BeforeBuildTarget = 'BeforeBuild';
export const Delete = 'Delete';
export const Files = 'Files';
export const PackageReference = 'PackageReference';
export const Version = 'Version';
export const PrivateAssets = 'PrivateAssets';
export const SqlCmdVariable = 'SqlCmdVariable';
export const DefaultValue = 'DefaultValue';
export const Value = 'Value';
export const ArtifactReference = 'ArtifactReference';
export const SuppressMissingDependenciesErrors = 'SuppressMissingDependenciesErrors';
export const DatabaseVariableLiteralValue = 'DatabaseVariableLiteralValue';
export const DatabaseSqlCmdVariable = 'DatabaseSqlCmdVariable';
export const ServerSqlCmdVariable = 'ServerSqlCmdVariable';
export const DSP = 'DSP';
export const Properties = 'Properties';
export const RelativeOuterPath = '..';
export const ProjectReference = 'ProjectReference';
export const TargetConnectionString = 'TargetConnectionString';
export const PreDeploy = 'PreDeploy';
export const PostDeploy = 'PostDeploy';
export const None = 'None';
export const True = 'True';
export const False = 'False';
export const Private = 'Private';
export const ProjectGuid = 'ProjectGuid';
export const PropertyGroup = 'PropertyGroup';
export const Type = 'Type';
export const ExternalStreamingJob: string = 'ExternalStreamingJob';
export const Sdk: string = 'Sdk';
export const DatabaseSource = 'DatabaseSource';
export const VisualStudioVersion = 'VisualStudioVersion';
export const SSDTExists = 'SSDTExists';
export const OutputPath = 'OutputPath';
export const Configuration = 'Configuration';
export const Platform = 'Platform';
export const AnyCPU = 'AnyCPU';

export const BuildElements = localize('buildElements', "Build Elements");
export const FolderElements = localize('folderElements', "Folder Elements");
export const PreDeployElements = localize('preDeployElements', "PreDeploy Elements");
export const PostDeployElements = localize('postDeployElements', "PostDeploy Elements");
export const NoneElements = localize('noneElements', "None Elements");
export const ImportElements = localize('importElements', "Import Elements");
export const ProjectReferenceNameElement = localize('projectReferenceNameElement', "Project reference name element");
export const ProjectReferenceElement = localize('projectReferenceElement', "Project reference");
export const DacpacReferenceElement = localize('dacpacReferenceElement', "Dacpac reference");
export const PublishProfileElements = localize('publishProfileElements', "Publish profile elements");

//#endregion

export function defaultOutputPath(configuration: string) { return path.join('.', 'bin', configuration); }

/**
 * Path separator to use within SqlProj file for `Include`, `Exclude`, etc. attributes.
 * This matches Windows path separator, as expected by SSDT.
 */
export const SqlProjPathSeparator = '\\';

// Profile XML names
export const targetDatabaseName = 'TargetDatabaseName';
export const targetConnectionString = 'TargetConnectionString';

//#region SQL connection string components
export const initialCatalogSetting = 'Initial Catalog';
export const dataSourceSetting = 'Data Source';
export const integratedSecuritySetting = 'Integrated Security';
export const authenticationSetting = 'Authentication';
export const activeDirectoryInteractive = 'active directory interactive';
export const userIdSetting = 'User ID';
export const passwordSetting = 'Password';
export const encryptSetting = 'Encrypt';
export const trustServerCertificateSetting = 'Trust Server Certificate';
export const hostnameInCertificateSetting = 'Host Name in Certificate';

export const azureAddAccount = localize('azureAddAccount', "Add an Account...");
//#endregion

//#region Tree item types
export enum DatabaseProjectItemType {
	project = 'databaseProject.itemType.project',
	legacyProject = 'databaseProject.itemType.legacyProject',
	folder = 'databaseProject.itemType.folder',
	file = 'databaseProject.itemType.file',
	externalStreamingJob = 'databaseProject.itemType.file.externalStreamingJob',
	table = 'databaseProject.itemType.file.table',
	referencesRoot = 'databaseProject.itemType.referencesRoot',
	reference = 'databaseProject.itemType.reference',
	sqlProjectReference = 'databaseProject.itemType.reference.sqlProject',
	dataSourceRoot = 'databaseProject.itemType.dataSourceRoot',
	sqlcmdVariablesRoot = 'databaseProject.itemType.sqlcmdVariablesRoot',
	sqlcmdVariable = 'databaseProject.itemType.sqlcmdVariable',
	preDeploymentScript = 'databaseProject.itemType.file.preDeploymentScript',
	postDeploymentScript = 'databaseProject.itemType.file.postDeployScript',
	noneFile = 'databaseProject.itemType.file.noneFile',
	sqlObjectScript = 'databaseProject.itemType.file.sqlObjectScript',
	publishProfile = 'databaseProject.itemType.file.publishProfile'
}

//#endregion

//#region AutoRest
export const autorestPostDeploymentScriptName = 'PostDeploymentScript.sql';
export const nodeButNotAutorestFound = localize('nodeButNotAutorestFound', "Autorest tool not found in system path, but found Node.js.  Prompting user for how to proceed.  Execute 'npm install autorest -g' to install permanently and avoid this message.");
export const nodeNotFound = localize('nodeNotFound', "Neither Autorest nor Node.js (npx) found in system path.  Please install Node.js for Autorest generation to work.");
export const nodeButNotAutorestFoundPrompt = localize('nodeButNotAutorestFoundPrompt', "Autorest is not installed. To proceed, choose whether to run Autorest from a temporary location via 'npx' or install Autorest globally then run.");
export const userSelectionInstallGlobally = localize('userSelectionInstallGlobally', "User selected to install autorest gloablly.  Installing now...");
export const userSelectionRunNpx = localize('userSelectionRunNpx', "User selected to run via npx.");
export const userSelectionCancelled = localize('userSelectionCancelled', "User has cancelled selection for how to run autorest.");
export const installGlobally = localize('installGlobally', "Install globally");
export const runViaNpx = localize('runViaNpx', "Run via npx");

export const selectSpecFile = localize('selectSpecFile', "Select OpenAPI/Swagger spec file");
export function generatingProjectFailed(errorMessage: string) { return localize('generatingProjectFailed', "Generating project via AutoRest failed.  Check output pane for more details. Error: {0}", errorMessage); }
export const noSqlFilesGenerated = localize('noSqlFilesGenerated', "No .sql files were generated by Autorest. Please confirm that your spec contains model definitions, or check the output log for details.");
export function multipleMostDeploymentScripts(count: number) { return localize('multipleMostDeploymentScripts', "Unexpected number of {0} files: {1}", autorestPostDeploymentScriptName, count); }
export const specSelectionText = localize('specSelectionText', "OpenAPI/Swagger spec");
export const autorestProjectName = localize('autorestProjectName', "New SQL project name");
export function generatingProjectFromAutorest(specName: string) { return localize('generatingProjectFromAutorest', "Generating new SQL project from {0}...  Check output window for details.", specName); }
//#endregion

// System dbs
export const systemDbs = ['master', 'msdb', 'tempdb', 'model'];

// SQL queries
export const sameDatabaseExampleUsage = 'SELECT * FROM [Schema1].[Table1]';
export function differentDbSameServerExampleUsage(db: string) { return `SELECT * FROM [${db}].[Schema1].[Table1]`; }
export function differentDbDifferentServerExampleUsage(server: string, db: string) { return `SELECT * FROM [${server}].[${db}].[Schema1].[Table1]`; }
//#endregion

//#region Target platforms
export const targetPlatformToVersion: Map<string, string> = new Map<string, string>([
	// Note: the values here must match values from Microsoft.Data.Tools.Schema.SchemaModel.SqlPlatformNames
	[SqlTargetPlatform.sqlServer2012, '110'],
	[SqlTargetPlatform.sqlServer2014, '120'],
	[SqlTargetPlatform.sqlServer2016, '130'],
	[SqlTargetPlatform.sqlServer2017, '140'],
	[SqlTargetPlatform.sqlServer2019, '150'],
	[SqlTargetPlatform.sqlServer2022, '160'],
	[SqlTargetPlatform.sqlAzure, 'AzureV12'],
	[SqlTargetPlatform.sqlDW, 'Dw'],
	[SqlTargetPlatform.sqlDwServerless, 'Serverless'],
	[SqlTargetPlatform.sqlDwUnified, 'DwUnified'],
	[SqlTargetPlatform.sqlDbFabric, 'DbFabric']
]);

export const onPremServerVersionToTargetPlatform: Map<number, SqlTargetPlatform> = new Map<number, SqlTargetPlatform>([
	[11, SqlTargetPlatform.sqlServer2012],
	[12, SqlTargetPlatform.sqlServer2014],
	[13, SqlTargetPlatform.sqlServer2016],
	[14, SqlTargetPlatform.sqlServer2017],
	[15, SqlTargetPlatform.sqlServer2019],
	[16, SqlTargetPlatform.sqlServer2022]
]);

// DW is special since the system dacpac folder has a different name from the target platform
export const AzureDwFolder = 'AzureDw';

export const defaultTargetPlatform = SqlTargetPlatform.sqlServer2022;
export const defaultDSP = targetPlatformToVersion.get(defaultTargetPlatform)!;

/**
 * Returns the name of the target platform of the version of sql
 * @param version version of sql
 * @returns target platform name
 */
export function getTargetPlatformFromVersion(version: string): string {
	return Array.from(targetPlatformToVersion.keys()).filter(k => targetPlatformToVersion.get(k) === version)[0];
}

//#endregion

export enum PublishTargetType {
	existingServer = 'existingServer',
	docker = 'docker',
	newAzureServer = 'newAzureServer'
}

//#region Configuration keys
export const CollapseProjectNodesKey = 'collapseProjectNodes';
export const microsoftBuildSqlVersionKey = 'microsoftBuildSqlVersion';
export const enablePreviewFeaturesKey = 'enablePreviewFeatures';

//#endregion

//#region httpClient
export const downloadError = localize('downloadError', "Download error");
export const downloadProgress = localize('downloadProgress', "Download progress");
export const downloading = localize('downloading', "Downloading");

//#endregion

//#region buildHelper
export function downloadingNuget(nuget: string) { return localize('downloadingNuget', "Downloading {0} nuget to get build DLLs ", nuget); }
export function downloadingFromTo(from: string, to: string) { return localize('downloadingFromTo', "Downloading from {0} to {1}", from, to); }
export function extractingDacFxDlls(location: string) { return localize('extractingDacFxDlls', "Extracting DacFx build DLLs to {0}", location); }
export function errorDownloading(url: string, error: string) { return localize('errorDownloading', "Error downloading {0}. Error: {1}", url, error); }
export function errorExtracting(path: string, error: string) { return localize('errorExtracting', "Error extracting files from {0}. Error: {1}", path, error); }

//#endregion

//#region move
export const onlyMoveFilesFoldersSupported = localize('onlyMoveFilesFoldersSupported', "Only moving files and folders are supported");
export const movingFilesBetweenProjectsNotSupported = localize('movingFilesBetweenProjectsNotSupported', "Moving files between projects is not supported");
export function errorMovingFile(source: string, destination: string, error: string) { return localize('errorMovingFile', "Error when moving file from {0} to {1}. Error: {2}", source, destination, error); }
export function moveConfirmationPrompt(source: string, destination: string) { return localize('moveConfirmationPrompt', "Are you sure you want to move {0} to {1}?", source, destination); }
export const move = localize('Move', "Move");
export function errorRenamingFile(source: string, destination: string, error: string) { return localize('errorRenamingFile', "Error when renaming file from {0} to {1}. Error: {2}", source, destination, error); }
export const unhandledMoveNode = localize('unhandledMoveNode', "Unhandled node type for move");

//#endregion
