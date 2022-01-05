/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { SqlTargetPlatform } from 'sqldbproj';
import * as utils from '../common/utils';

const localize = nls.loadMessageBundle();

// Placeholder values
export const dataSourcesFileName = 'datasources.json';
export const sqlprojExtension = '.sqlproj';
export const sqlFileExtension = '.sql';
export const openApiSpecFileExtensions = ['yaml', 'yml', 'json'];
export const schemaCompareExtensionId = 'microsoft.schema-compare';
export const master = 'master';
export const masterDacpac = 'master.dacpac';
export const msdb = 'msdb';
export const msdbDacpac = 'msdb.dacpac';
export const MicrosoftDatatoolsSchemaSqlSql = 'Microsoft.Data.Tools.Schema.Sql.Sql';
export const databaseSchemaProvider = 'DatabaseSchemaProvider';
export const sqlProjectSdk = 'Microsoft.Build.Sql';

// Project Provider
export const emptySqlDatabaseProjectTypeId = 'EmptySqlDbProj';
export const emptyProjectTypeDisplayName = localize('emptyProjectTypeDisplayName', "SQL Database");
export const emptyProjectTypeDescription = localize('emptyProjectTypeDescription', "Develop and publish schemas for SQL databases starting from an empty project");

export const edgeSqlDatabaseProjectTypeId = 'SqlDbEdgeProj';
export const edgeProjectTypeDisplayName = localize('edgeProjectTypeDisplayName', "SQL Edge");
export const edgeProjectTypeDescription = localize('edgeProjectTypeDescription', "Start with the core pieces to develop and publish schemas for SQL Edge");

// Dashboard
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

// commands
export const revealFileInOsCommand = 'revealFileInOS';
export const schemaCompareStartCommand = 'SchemaCompare.start';
export const vscodeOpenCommand = 'vscode.open';

// UI Strings

export const dataSourcesNodeName = localize('dataSourcesNodeName', "Data Sources");
export const databaseReferencesNodeName = localize('databaseReferencesNodeName', "Database References");
export const sqlConnectionStringFriendly = localize('sqlConnectionStringFriendly', "SQL connection string");
export const yesString = localize('yesString', "Yes");
export const openEulaString = localize('openEulaString', "Open License Agreement");
export const noString = localize('noString', "No");
export const noStringDefault = localize('noStringDefault', "No (default)");
export const okString = localize('okString', "Ok");
export const selectString = localize('selectString', "Select");
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
export function newObjectNamePrompt(objectType: string) { return localize('newObjectNamePrompt', 'New {0} name:', objectType); }
export function deleteConfirmation(toDelete: string) { return localize('deleteConfirmation', "Are you sure you want to delete {0}?", toDelete); }
export function deleteConfirmationContents(toDelete: string) { return localize('deleteConfirmationContents', "Are you sure you want to delete {0} and all of its contents?", toDelete); }
export function deleteReferenceConfirmation(toDelete: string) { return localize('deleteReferenceConfirmation', "Are you sure you want to delete the reference to {0}?", toDelete); }
export function selectTargetPlatform(currentTargetPlatform: string) { return localize('selectTargetPlatform', "Current target platform: {0}. Select new target platform", currentTargetPlatform); }
export function currentTargetPlatform(projectName: string, currentTargetPlatform: string) { return localize('currentTargetPlatform', "Target platform of the project {0} is now {1}", projectName, currentTargetPlatform); }

// Publish dialog strings

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
export const loadSqlCmdVarsButtonTitle = localize('reloadValuesFromProjectButtonTitle', "Reload values from project");
export const profile = localize('profile', "Profile");
export const selectConnection = localize('selectConnection', "Select connection");
export const server = localize('server', "Server");
export const defaultUser = localize('default', "default");
export const selectProfileToUse = localize('selectProfileToUse', "Select publish profile to load");
export const selectProfile = localize('selectProfile', "Select Profile");
export const dontUseProfile = localize('dontUseProfile', "Don't use profile");
export const browseForProfileWithIcon = `$(folder) ${localize('browseForProfile', "Browse for profile")}`;
export const chooseAction = localize('chooseAction', "Choose action");
export const chooseSqlcmdVarsToModify = localize('chooseSqlcmdVarsToModify', "Choose SQLCMD variables to modify");
export const enterNewValueForVar = (varName: string) => localize('enterNewValueForVar', "Enter new value for variable '{0}'", varName);
export const resetAllVars = localize('resetAllVars', "Reset all variables");
export const createNew = localize('createNew', "Create New");
export const enterNewDatabaseName = localize('enterNewDatabaseName', "Enter new database name");
export const newText = localize('new', "New");
export const selectDatabase = localize('selectDatabase', "Select database");
export const done = localize('done', "Done");
export const nameMustNotBeEmpty = localize('nameMustNotBeEmpty', "Name must not be empty");

// Publish Dialog options
export const publishOptionsLabel = localize('publishDisplayOptionsLabel', 'Publish Options');
export const configureOptions = localize('configureOptions', 'Configure Options');
export const GeneralOptionsLabel: string = localize('publishOperation.GeneralOptionsLabel', "General Options");
export const OkButtonText: string = localize('publishOperation.OkButtonText', "Ok");
export const CancelButtonText: string = localize('publishOperation.CancelButtonText', "Cancel");
export const ResetButtonText: string = localize('publishOperation.ResetButtonText', "Reset");


// Deploy
export const selectPublishOption = localize('selectPublishOption', "Select where to publish the project to");
export const publishToExistingServer = localize('publishToExistingServer', "Publish to existing server");
export const publishToDockerContainer = localize('publishToDockerContainer', "Publish to new server in a container");
export const enterPortNumber = localize('enterPortNumber', "Enter SQL server port number or press enter to use the default value");
export const serverPortNumber = localize('serverPortNumber', "SQL server port number");
export const serverPassword = localize('serverPassword', "SQL Server admin password");
export const confirmServerPassword = localize('confirmServerPassword', "Confirm SQL Server admin password");
export const baseDockerImage = localize('baseDockerImage', "Base SQL Server Docker image");
export const publishTo = localize('publishTo', "Publish Target");
export const enterConnectionStringEnvName = localize('enterConnectionStringEnvName', "Enter connection string environment variable name");
export const enterConnectionStringTemplate = localize('enterConnectionStringTemplate', "Enter connection string template");
export const enterPassword = localize('enterPassword', "Enter SQL Server admin password");
export const confirmPassword = localize('confirmPassword', "Confirm SQL server admin password");
export const selectBaseImage = localize('selectBaseImage', "Select the base SQL Server docker image");
export const invalidSQLPasswordMessage = localize('invalidSQLPassword', "SQL Server password doesn't meet the password complexity requirement. For more information see https://docs.microsoft.com/sql/relational-databases/security/password-policy");
export const passwordNotMatch = localize('passwordNotMatch', "SQL Server password doesn't match the confirmation password");
export const portMustBeNumber = localize('portMustNotBeNumber', "Port must a be number");
export const valueCannotBeEmpty = localize('valueCannotBeEmpty', "Value cannot be empty");
export const dockerImageLabelPrefix = 'source=sqldbproject';
export const dockerImageNamePrefix = 'sqldbproject';

//
export const eulaAgreementTemplate = localize({ key: 'eulaAgreementTemplate', comment: ['The placeholders are contents of the line and should not be translated.'] }, "I accept the {0}.");
export function eulaAgreementText(name: string) { return localize({ key: 'eulaAgreementText', comment: ['The placeholders are contents of the line and should not be translated.'] }, "I accept the {0}.", name); }
export const eulaAgreementTitle = localize('eulaAgreementTitle', "Microsoft SQL Server License Agreement");
export const edgeEulaAgreementTitle = localize('edgeEulaAgreementTitle', "Microsoft Azure SQL Edge License Agreement");
export const sqlServerEulaLink = 'https://go.microsoft.com/fwlink/?linkid=857698';
export const sqlServerEdgeEulaLink = 'https://go.microsoft.com/fwlink/?linkid=2139274';
export const connectionNamePrefix = 'SQLDbProject';
export const sqlServerDockerRegistry = 'mcr.microsoft.com';
export const sqlServerDockerRepository = 'mssql/server';
export const azureSqlEdgeDockerRepository = 'azure-sql-edge';
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
export const runningDockerMessage = localize('runningDockerMessage', "Building and running the docker container ...");
export function dockerNotRunningError(error: string) { return localize('dockerNotRunningError', "Failed to verify docker. Please make sure docker is installed and running. Error: '{0}'", error || ''); }
export const dockerContainerNotRunningErrorMessage = localize('dockerContainerNotRunningErrorMessage', "Docker container is not running");
export const dockerContainerFailedToRunErrorMessage = localize('dockerContainerFailedToRunErrorMessage', "Failed to run the docker container");
export const connectingToSqlServerOnDockerMessage = localize('connectingToSqlServerOnDockerMessage', "Connecting to SQL Server on Docker");
export const deployProjectFailedMessage = localize('deployProjectFailedMessage', "Failed to open a connection to the deployed database'");
export const containerAlreadyExistForProject = localize('containerAlreadyExistForProject', "Other servers on container already exist for the project. Do you want to delete them?");
export const checkoutOutputMessage = localize('checkoutOutputMessage', "Check output pane for more details");
export function taskFailedError(taskName: string, err: string): string { return localize('taskFailedError.error', "Failed to complete task '{0}'. Error: {1}", taskName, err); }
export function publishToContainerFailed(errorMessage: string) { return localize('publishToContainerFailed', "Failed to publish to container. {0}", errorMessage); }
export function deployAppSettingUpdateFailed(appSetting: string) { return localize('deployAppSettingUpdateFailed', "Failed to update app setting '{0}'", appSetting); }
export function deployAppSettingUpdating(appSetting: string) { return localize('deployAppSettingUpdating', "Updating app setting: '{0}'", appSetting); }
export function connectionFailedError(error: string) { return localize('connectionFailedError', "Connection failed error: '{0}'", error); }
export function dockerContainerCreatedMessage(id: string) { return localize('dockerContainerCreatedMessage', "Docker created id: '{0}'", id); }
export function dockerLogMessage(log: string) { return localize('dockerLogMessage', "Docker logs: '{0}'", log); }
export function retryWaitMessage(numberOfSeconds: number, name: string) { return localize('retryWaitMessage', "Waiting for {0} seconds before another attempt for operation '{1}'", numberOfSeconds, name); }
export function retryRunMessage(attemptNumber: number, numberOfAttempts: number, name: string) { return localize('retryRunMessage', "Running operation '{2}' Attempt {0} of {1}", attemptNumber, numberOfAttempts, name); }
export function retrySucceedMessage(name: string, result: string) { return localize('retrySucceedMessage', "Operation '{0}' completed successfully. Result: {1}", name, result); }
export function retryFailedMessage(name: string, result: string, error: string) { return localize('retryFailedMessage', "Operation '{0}' failed. Re-trying... Current Result: {1}. Error: '{2}'", name, result, error); }
export function retryMessage(name: string, error: string) { return localize('retryMessage', "Operation '{0}' failed. Re-trying... Error: '{1}'", name, error || ''); }

// Add Database Reference dialog strings

export const addDatabaseReferenceDialogName = localize('addDatabaseReferencedialogName', "Add database reference");
export const addDatabaseReferenceOkButtonText = localize('addDatabaseReferenceOkButtonText', "Add reference");
export const referenceRadioButtonsGroupTitle = localize('referenceRadioButtonsGroupTitle', "Type");
export const projectLabel = localize('projectLocString', "Project");
export const systemDatabase = localize('systemDatabase', "System database");
export const dacpacText = localize('dacpacText', "Data-tier application (.dacpac)");
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
export const dacpacNotOnSameDrive = (projectLocation: string): string => { return localize('dacpacNotOnSameDrive', "Dacpac references need to be located on the same drive as the project file. The project file is located at {0}", projectLocation); };
export const referenceType = localize('referenceType', "Reference type");

// Create Project From Database dialog strings

export const createProjectFromDatabaseDialogName = localize('createProjectFromDatabaseDialogName', "Create project from database");
export const createProjectDialogOkButtonText = localize('createProjectDialogOkButtonText', "Create");
export const sourceDatabase = localize('sourceDatabase', "Source database");
export const targetProject = localize('targetProject', "Target project");
export const createProjectSettings = localize('createProjectSettings', "Settings");
export const projectNameLabel = localize('projectNameLabel', "Name");
export const projectNamePlaceholderText = localize('projectNamePlaceholderText', "Enter project name");
export const projectLocationPlaceholderText = localize('projectLocationPlaceholderText', "Select location to create project");
export const browseButtonText = localize('browseButtonText', "Browse folder");
export const selectFolderStructure = localize('selectFolderStructure', "Select folder structure");
export const folderStructureLabel = localize('folderStructureLabel', "Folder structure");
export const WorkspaceFileExtension = '.code-workspace';
export const browseEllipsisWithIcon = `$(folder) ${localize('browseEllipsis', "Browse...")}`;
export const selectProjectLocation = localize('selectProjectLocation', "Select project location");
export const ProjectParentDirectoryNotExistError = (location: string): string => { return localize('dataworkspace.projectParentDirectoryNotExistError', "The selected project location '{0}' does not exist or is not a directory.", location); };
export const ProjectDirectoryAlreadyExistError = (projectName: string, location: string): string => { return localize('dataworkspace.projectDirectoryAlreadyExistError', "There is already a directory named '{0}' in the selected location: '{1}'.", projectName, location); };


// Error messages

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
export function updateProjectForRoundTrip(projectName: string) { return localize('updateProjectForRoundTrip', "The targets, references, and system database references need to be updated to build the project '{0}'. If the project was created in SSDT, it will continue to work in both tools. Do you want to update the project?", projectName); }
export function updateProjectDatabaseReferencesForRoundTrip(projectName: string) { return localize('updateProjectDatabaseReferencesForRoundTrip', "The system database references need to be updated to build the project '{0}'. If the project was created in SSDT, it will continue to work in both tools. Do you want to update the project?", projectName); }
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
export function projectAlreadyOpened(path: string) { return localize('projectAlreadyOpened', "Project '{0}' is already opened.", path); }
export function projectAlreadyExists(name: string, path: string) { return localize('projectAlreadyExists', "A project named {0} already exists in {1}.", name, path); }
export function noFileExist(fileName: string) { return localize('noFileExist', "File {0} doesn't exist", fileName); }
export function fileOrFolderDoesNotExist(name: string) { return localize('fileOrFolderDoesNotExist', "File or directory '{0}' doesn't exist", name); }
export function cannotResolvePath(path: string) { return localize('cannotResolvePath', "Cannot resolve path {0}", path); }
export function fileAlreadyExists(filename: string) { return localize('fileAlreadyExists', "A file with the name '{0}' already exists on disk at this location. Please choose another name.", filename); }
export function folderAlreadyExists(filename: string) { return localize('folderAlreadyExists', "A folder with the name '{0}' already exists on disk at this location. Please choose another name.", filename); }
export function folderAlreadyExistsChooseNewLocation(filename: string) { return localize('folderAlreadyExistsChooseNewLocation', "A folder with the name '{0}' already exists on disk at this location. Please choose another location.", filename); }
export function invalidInput(input: string) { return localize('invalidInput', "Invalid input: {0}", input); }
export function invalidProjectPropertyValue(propertyName: string) { return localize('invalidPropertyValue', "Invalid value specified for the property '{0}' in .sqlproj file", propertyName); }
export function unableToCreatePublishConnection(input: string) { return localize('unableToCreatePublishConnection', "Unable to construct connection: {0}", input); }
export function circularProjectReference(project1: string, project2: string) { return localize('cicularProjectReference', "Circular reference from project {0} to project {1}", project1, project2); }
export function errorFindingBuildFilesLocation(err: any) { return localize('errorFindingBuildFilesLocation', "Error finding build files location: {0}", utils.getErrorMessage(err)); }
export function projBuildFailed(errorMessage: string) { return localize('projBuildFailed', "Build failed. Check output pane for more details. {0}", errorMessage); }
export function unexpectedProjectContext(uri: string) { return localize('unexpectedProjectContext', "Unable to establish project context.  Command invoked from unexpected location: {0}", uri); }
export function unableToPerformAction(action: string, uri: string) { return localize('unableToPerformAction', "Unable to locate '{0}' target: '{1}'", action, uri); }
export function unableToFindObject(path: string, objType: string) { return localize('unableToFindFile', "Unable to find {1} with path '{0}'", path, objType); }
export function deployScriptExists(scriptType: string) { return localize('deployScriptExists', "A {0} script already exists. The new script will not be included in build.", scriptType); }
export function notValidVariableName(name: string) { return localize('notValidVariableName', "The variable name '{0}' is not valid.", name); }
export function cantAddCircularProjectReference(project: string) { return localize('cantAddCircularProjectReference', "A reference to project '{0}' cannot be added. Adding this project as a reference would cause a circular dependency", project); }
export function unableToFindSqlCmdVariable(variableName: string) { return localize('unableToFindSqlCmdVariable', "Unable to find SQLCMD variable '{0}'", variableName); }
export function unableToFindDatabaseReference(reference: string) { return localize('unableToFindReference', "Unable to find database reference {0}", reference); }
export function invalidGuid(guid: string) { return localize('invalidGuid', "Specified GUID is invalid: {0}", guid); }
export function invalidTargetPlatform(targetPlatform: string, supportedTargetPlatforms: string[]) { return localize('invalidTargetPlatform', "Invalid target platform: {0}. Supported target platforms: {1}", targetPlatform, supportedTargetPlatforms.toString()); }
export function errorReadingProject(section: string, path: string) { return localize('errorReadingProjectGuid', "Error trying to read {0} of project '{1}'", section, path); }

// Action types
export const deleteAction = localize('deleteAction', 'Delete');
export const excludeAction = localize('excludeAction', 'Exclude');

// Project tree object types
export const fileObject = localize('fileObject', "file");
export const folderObject = localize('folderObject', "folder");

// Project script types

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

// Build

export const DotnetInstallationConfirmation: string = localize('sqlDatabaseProjects.DotnetInstallationConfirmation', "The .NET SDK cannot be located. Project build will not work. Please install .NET Core SDK version 3.1 or higher or update the .NET SDK location in settings if already installed.");
export function NetCoreSupportedVersionInstallationConfirmation(installedVersion: string) { return localize('sqlDatabaseProjects.NetCoreSupportedVersionInstallationConfirmation', "Currently installed .NET Core SDK version is {0}, which is not supported. Project build will not work. Please install .NET Core SDK version 3.1 or higher or update the .NET SDK supported version location in settings if already installed.", installedVersion); }
export const UpdateDotnetLocation: string = localize('sqlDatabaseProjects.UpdateDotnetLocation', "Update Location");
export const projectsOutputChannel = localize('sqlDatabaseProjects.outputChannel', "Database Projects");

// Prompt buttons
export const Install: string = localize('sqlDatabaseProjects.Install', "Install");
export const DoNotAskAgain: string = localize('sqlDatabaseProjects.doNotAskAgain', "Don't Ask Again");

// SqlProj file XML names
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
export const Type = 'Type';
export const ExternalStreamingJob: string = 'ExternalStreamingJob';
export const Sdk: string = 'Sdk';

export const BuildElements = localize('buildElements', "Build Elements");
export const FolderElements = localize('folderElements', "Folder Elements");
export const PreDeployElements = localize('preDeployElements', "PreDeploy Elements");
export const PostDeployElements = localize('postDeployElements', "PostDeploy Elements");
export const NoneElements = localize('noneElements', "None Elements");
export const ImportElements = localize('importElements', "Import Elements");
export const ProjectReferenceNameElement = localize('projectReferenceNameElement', "Project reference name element");
export const ProjectReferenceElement = localize('projectReferenceElement', "Project reference");
export const DacpacReferenceElement = localize('dacpacReferenceElement', "Dacpac reference");

/** Name of the property item in the project file that defines default database collation. */
export const DefaultCollationProperty = 'DefaultCollation';

/** Default database collation to use when none is specified in the project */
export const DefaultCollation = 'SQL_Latin1_General_CP1_CI_AS';

// SqlProj File targets
export const NetCoreTargets = '$(NETCoreTargetsPath)\\Microsoft.Data.Tools.Schema.SqlTasks.targets';
export const SqlDbTargets = '$(SQLDBExtensionsRefPath)\\Microsoft.Data.Tools.Schema.SqlTasks.targets';
export const MsBuildtargets = '$(MSBuildExtensionsPath)\\Microsoft\\VisualStudio\\v$(VisualStudioVersion)\\SSDT\\Microsoft.Data.Tools.Schema.SqlTasks.targets';
export const NetCoreCondition = '\'$(NetCoreBuild)\' == \'true\'';
export const NotNetCoreCondition = '\'$(NetCoreBuild)\' != \'true\'';
export const SqlDbPresentCondition = '\'$(SQLDBExtensionsRefPath)\' != \'\'';
export const SqlDbNotPresentCondition = '\'$(SQLDBExtensionsRefPath)\' == \'\'';
export const RoundTripSqlDbPresentCondition = '\'$(NetCoreBuild)\' != \'true\' AND \'$(SQLDBExtensionsRefPath)\' != \'\'';
export const RoundTripSqlDbNotPresentCondition = '\'$(NetCoreBuild)\' != \'true\' AND \'$(SQLDBExtensionsRefPath)\' == \'\'';
export const DacpacRootPath = '$(DacPacRootPath)';
export const ProjJsonToClean = '$(BaseIntermediateOutputPath)\\project.assets.json';

// SqlProj Reference Assembly Information
export const NETFrameworkAssembly = 'Microsoft.NETFramework.ReferenceAssemblies';
export const VersionNumber = '1.0.0';
export const All = 'All';

/**
 * Path separator to use within SqlProj file for `Include`, `Exclude`, etc. attributes.
 * This matches Windows path separator, as expected by SSDT.
 */
export const SqlProjPathSeparator = '\\';

// Profile XML names
export const targetDatabaseName = 'TargetDatabaseName';
export const targetConnectionString = 'TargetConnectionString';

// SQL connection string components
export const initialCatalogSetting = 'Initial Catalog';
export const dataSourceSetting = 'Data Source';
export const integratedSecuritySetting = 'Integrated Security';
export const authenticationSetting = 'Authentication';
export const activeDirectoryInteractive = 'active directory interactive';
export const userIdSetting = 'User ID';
export const passwordSetting = 'Password';

// Authentication types
export const integratedAuth = 'Integrated';
export const azureMfaAuth = 'AzureMFA';
export const sqlAuth = 'SqlAuth';

// Tree item types
export enum DatabaseProjectItemType {
	project = 'databaseProject.itemType.project',
	folder = 'databaseProject.itemType.folder',
	file = 'databaseProject.itemType.file',
	externalStreamingJob = 'databaseProject.itemType.file.externalStreamingJob',
	referencesRoot = 'databaseProject.itemType.referencesRoot',
	reference = 'databaseProject.itemType.reference',
	dataSourceRoot = 'databaseProject.itemType.dataSourceRoot',
}

// AutoRest
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

// System dbs
export const systemDbs = ['master', 'msdb', 'tempdb', 'model'];

// SQL queries
export const sameDatabaseExampleUsage = 'SELECT * FROM [Schema1].[Table1]';
export function differentDbSameServerExampleUsage(db: string) { return `SELECT * FROM [${db}].[Schema1].[Table1]`; }
export function differentDbDifferentServerExampleUsage(server: string, db: string) { return `SELECT * FROM [${server}].[${db}].[Schema1].[Table1]`; }

// Target platforms
export const targetPlatformToVersion: Map<string, string> = new Map<string, string>([
	[SqlTargetPlatform.sqlServer2005, '90'],
	[SqlTargetPlatform.sqlServer2008, '100'],
	[SqlTargetPlatform.sqlServer2012, '110'],
	[SqlTargetPlatform.sqlServer2014, '120'],
	[SqlTargetPlatform.sqlServer2016, '130'],
	[SqlTargetPlatform.sqlServer2017, '140'],
	[SqlTargetPlatform.sqlServer2019, '150'],
	[SqlTargetPlatform.sqlAzure, 'AzureV12'],
	[SqlTargetPlatform.sqlDW, 'Dw']
]);

// DW is special since the system dacpac folder has a different name from the target platform
export const AzureDwFolder = 'AzureDw';

export const defaultTargetPlatform = SqlTargetPlatform.sqlServer2019;
export const defaultDSP = targetPlatformToVersion.get(defaultTargetPlatform)!;

/**
 * Returns the name of the target platform of the version of sql
 * @param version version of sql
 * @returns target platform name
 */
export function getTargetPlatformFromVersion(version: string): string {
	return Array.from(targetPlatformToVersion.keys()).filter(k => targetPlatformToVersion.get(k) === version)[0];
}

// Insert SQL binding
export const hostFileName = 'host.json';
export const sqlExtensionPackageName = 'Microsoft.Azure.WebJobs.Extensions.Sql';
export const placeHolderObject = '[dbo].[table1]';
export const sqlBindingsHelpLink = 'https://github.com/Azure/azure-functions-sql-extension/blob/main/README.md';

export const input = localize('input', "Input");
export const output = localize('output', "Output");
export const selectBindingType = localize('selectBindingType', "Select type of binding");
export const selectAzureFunction = localize('selectAzureFunction', "Select an Azure function in the current file to add SQL binding to");
export const sqlTableOrViewToQuery = localize('sqlTableOrViewToQuery', "SQL table or view to query");
export const sqlTableToUpsert = localize('sqlTableToUpsert', "SQL table to upsert into");
export const connectionStringSetting = localize('connectionStringSetting', "Connection string setting name");
export const selectSetting = localize('selectSetting', "Select SQL connection string setting from local.settings.json");
export const connectionStringSettingPlaceholder = localize('connectionStringSettingPlaceholder', "Connection string setting specified in \"local.settings.json\"");
export const noAzureFunctionsInFile = localize('noAzureFunctionsInFile', "No Azure functions in the current active file");
export const noAzureFunctionsProjectsInWorkspace = localize('noAzureFunctionsProjectsInWorkspace', "No Azure functions projects found in the workspace");
export const addPackage = localize('addPackage', "Add Package");
export const createNewLocalAppSetting = localize('createNewLocalAppSetting', 'Create new local app setting');
export const createNewLocalAppSettingWithIcon = `$(add) ${createNewLocalAppSetting}`;
export const sqlConnectionStringSetting = 'SqlConnectionString';
export const valueMustNotBeEmpty = localize('valueMustNotBeEmpty', "Value must not be empty");
export const enterConnectionStringSettingName = localize('enterConnectionStringSettingName', "Enter connection string setting name");
export const enterConnectionString = localize('enterConnectionString', "Enter connection string");
export const saveChangesInFile = localize('saveChangesInFile', "There are unsaved changes in the current file. Save now?");
export const save = localize('save', "Save");
export function settingAlreadyExists(settingName: string) { return localize('SettingAlreadyExists', 'Local app setting \'{0}\' already exists. Overwrite?', settingName); }
export function failedToParse(errorMessage: string) { return localize('failedToParse', 'Failed to parse "{0}": {1}.', azureFunctionLocalSettingsFileName, errorMessage); }
export function jsonParseError(error: string, line: number, column: number) { return localize('jsonParseError', '{0} near line "{1}", column "{2}"', error, line, column); }
export const moreInformation = localize('moreInformation', "More Information");
export const addPackageReferenceMessage = localize('addPackageReferenceMessage', 'To use SQL bindings, ensure your Azure Functions project has a reference to {0}', sqlExtensionPackageName);
export const addSqlBindingPackageError = localize('addSqlBindingPackageError', 'Error adding Sql Binding extension package to project');

// publish tab deploy options
export const IgnoreTableOptions: string = localize('DeployOptions.IgnoreTableOptions', "Ignore Table Options");
export const IgnoreSemicolonBetweenStatements: string = localize('DeployOptions.IgnoreSemicolonBetweenStatements', "Ignore Semicolon Between Statements");
export const IgnoreRouteLifetime: string = localize('DeployOptions.IgnoreRouteLifetime', "Ignore Route Lifetime");
export const IgnoreRoleMembership: string = localize('DeployOptions.IgnoreRoleMembership', "Ignore Role Membership");
export const IgnoreQuotedIdentifiers: string = localize('DeployOptions.IgnoreQuotedIdentifiers', "Ignore Quoted Identifiers");
export const IgnorePermissions: string = localize('DeployOptions.IgnorePermissions', "Ignore Permissions");
export const IgnorePartitionSchemes: string = localize('DeployOptions.IgnorePartitionSchemes', "Ignore Partition Schemes");
export const IgnoreObjectPlacementOnPartitionScheme: string = localize('DeployOptions.IgnoreObjectPlacementOnPartitionScheme', "Ignore Object Placement On Partition Scheme");
export const IgnoreNotForReplication: string = localize('DeployOptions.IgnoreNotForReplication', "Ignore Not For Replication");
export const IgnoreLoginSids: string = localize('DeployOptions.IgnoreLoginSids', "Ignore Login Sids");
export const IgnoreLockHintsOnIndexes: string = localize('DeployOptions.IgnoreLockHintsOnIndexes', "Ignore Lock Hints On Indexes");
export const IgnoreKeywordCasing: string = localize('DeployOptions.IgnoreKeywordCasing', "Ignore Keyword Casing");
export const IgnoreIndexPadding: string = localize('DeployOptions.IgnoreIndexPadding', "Ignore Index Padding");
export const IgnoreIndexOptions: string = localize('DeployOptions.IgnoreIndexOptions', "Ignore Index Options");
export const IgnoreIncrement: string = localize('DeployOptions.IgnoreIncrement', "Ignore Increment");
export const IgnoreIdentitySeed: string = localize('DeployOptions.IgnoreIdentitySeed', "Ignore Identity Seed");
export const IgnoreUserSettingsObjects: string = localize('DeployOptions.IgnoreUserSettingsObjects', "Ignore User Settings Objects");
export const IgnoreFullTextCatalogFilePath: string = localize('DeployOptions.IgnoreFullTextCatalogFilePath', "Ignore Full Text Catalog FilePath");
export const IgnoreWhitespace: string = localize('DeployOptions.IgnoreWhitespace', "Ignore Whitespace");
export const IgnoreWithNocheckOnForeignKeys: string = localize('DeployOptions.IgnoreWithNocheckOnForeignKeys', "Ignore With Nocheck On ForeignKeys");
export const VerifyCollationCompatibility: string = localize('DeployOptions.VerifyCollationCompatibility', "Verify Collation Compatibility");
export const UnmodifiableObjectWarnings: string = localize('DeployOptions.UnmodifiableObjectWarnings', "Unmodifiable Object Warnings");
export const TreatVerificationErrorsAsWarnings: string = localize('DeployOptions.TreatVerificationErrorsAsWarnings', "Treat Verification Errors As Warnings");
export const ScriptRefreshModule: string = localize('DeployOptions.ScriptRefreshModule', "Script Refresh Module");
export const ScriptNewConstraintValidation: string = localize('DeployOptions.ScriptNewConstraintValidation', "Script New Constraint Validation");
export const ScriptFileSize: string = localize('DeployOptions.ScriptFileSize', "Script File Size");
export const ScriptDeployStateChecks: string = localize('DeployOptions.ScriptDeployStateChecks', "Script Deploy StateChecks");
export const ScriptDatabaseOptions: string = localize('DeployOptions.ScriptDatabaseOptions', "Script Database Options");
export const ScriptDatabaseCompatibility: string = localize('DeployOptions.ScriptDatabaseCompatibility', "Script Database Compatibility");
export const ScriptDatabaseCollation: string = localize('DeployOptions.ScriptDatabaseCollation', "Script Database Collation");
export const RunDeploymentPlanExecutors: string = localize('DeployOptions.RunDeploymentPlanExecutors', "Run Deployment Plan Executors");
export const RegisterDataTierApplication: string = localize('DeployOptions.RegisterDataTierApplication', "Register DataTier Application");
export const PopulateFilesOnFileGroups: string = localize('DeployOptions.PopulateFilesOnFileGroups', "Populate Files On File Groups");
export const NoAlterStatementsToChangeClrTypes: string = localize('DeployOptions.NoAlterStatementsToChangeClrTypes', "No Alter Statements To Change Clr Types");
export const IncludeTransactionalScripts: string = localize('DeployOptions.IncludeTransactionalScripts', "Include Transactional Scripts");
export const IncludeCompositeObjects: string = localize('DeployOptions.IncludeCompositeObjects', "Include Composite Objects");
export const AllowUnsafeRowLevelSecurityDataMovement: string = localize('DeployOptions.AllowUnsafeRowLevelSecurityDataMovement', "Allow Unsafe Row Level Security Data Movement");
export const IgnoreWithNocheckOnCheckConstraints: string = localize('DeployOptions.IgnoreWithNocheckOnCheckConstraints', "Ignore With No check On Check Constraints");
export const IgnoreFillFactor: string = localize('DeployOptions.IgnoreFillFactor', "Ignore Fill Factor");
export const IgnoreFileSize: string = localize('DeployOptions.IgnoreFileSize', "Ignore File Size");
export const IgnoreFilegroupPlacement: string = localize('DeployOptions.IgnoreFilegroupPlacement', "Ignore Filegroup Placement");
export const DoNotAlterReplicatedObjects: string = localize('DeployOptions.DoNotAlterReplicatedObjects', "Do Not Alter Replicated Objects");
export const DoNotAlterChangeDataCaptureObjects: string = localize('DeployOptions.DoNotAlterChangeDataCaptureObjects', "Do Not Alter Change Data Capture Objects");
export const DisableAndReenableDdlTriggers: string = localize('DeployOptions.DisableAndReenableDdlTriggers', "Disable And Reenable Ddl Triggers");
export const DeployDatabaseInSingleUserMode: string = localize('DeployOptions.DeployDatabaseInSingleUserMode', "Deploy Database In Single User Mode");
export const CreateNewDatabase: string = localize('DeployOptions.CreateNewDatabase', "Create New Database");
export const CompareUsingTargetCollation: string = localize('DeployOptions.CompareUsingTargetCollation', "Compare Using Target Collation");
export const CommentOutSetVarDeclarations: string = localize('DeployOptions.CommentOutSetVarDeclarations', "Comment Out Set Var Declarations");
export const BlockWhenDriftDetected: string = localize('DeployOptions.BlockWhenDriftDetected', "Block When Drift Detected");
export const BlockOnPossibleDataLoss: string = localize('DeployOptions.BlockOnPossibleDataLoss', "Block On Possible Data Loss");
export const BackupDatabaseBeforeChanges: string = localize('DeployOptions.BackupDatabaseBeforeChanges', "Backup Database Before Changes");
export const AllowIncompatiblePlatform: string = localize('DeployOptions.AllowIncompatiblePlatform', "Allow Incompatible Platform");
export const AllowDropBlockingAssemblies: string = localize('DeployOptions.AllowDropBlockingAssemblies', "Allow Drop Blocking Assemblies");
export const DropConstraintsNotInSource: string = localize('DeployOptions.DropConstraintsNotInSource', "Drop Constraints Not In Source");
export const DropDmlTriggersNotInSource: string = localize('DeployOptions.DropDmlTriggersNotInSource', "Drop Dml Triggers Not In Source");
export const DropExtendedPropertiesNotInSource: string = localize('DeployOptions.DropExtendedPropertiesNotInSource', "Drop Extended Properties Not In Source");
export const DropIndexesNotInSource: string = localize('DeployOptions.DropIndexesNotInSource', "Drop Indexes Not In Source");
export const IgnoreFileAndLogFilePath: string = localize('DeployOptions.IgnoreFileAndLogFilePath', "Ignore File And Log File Path");
export const IgnoreExtendedProperties: string = localize('DeployOptions.IgnoreExtendedProperties', "Ignore Extended Properties");
export const IgnoreDmlTriggerState: string = localize('DeployOptions.IgnoreDmlTriggerState', "Ignore Dml Trigger State");
export const IgnoreDmlTriggerOrder: string = localize('DeployOptions.IgnoreDmlTriggerOrder', "Ignore Dml Trigger Order");
export const IgnoreDefaultSchema: string = localize('DeployOptions.IgnoreDefaultSchema', "Ignore Default Schema");
export const IgnoreDdlTriggerState: string = localize('DeployOptions.IgnoreDdlTriggerState', "Ignore Ddl Trigger State");
export const IgnoreDdlTriggerOrder: string = localize('DeployOptions.IgnoreDdlTriggerOrder', "Ignore Ddl Trigger Order");
export const IgnoreCryptographicProviderFilePath: string = localize('DeployOptions.IgnoreCryptographicProviderFilePath', "Ignore Cryptographic Provider FilePath");
export const VerifyDeployment: string = localize('DeployOptions.VerifyDeployment', "Verify Deployment");
export const IgnoreComments: string = localize('DeployOptions.IgnoreComments', "Ignore Comments");
export const IgnoreColumnCollation: string = localize('DeployOptions.IgnoreColumnCollation', "Ignore Column Collation");
export const IgnoreAuthorizer: string = localize('DeployOptions.IgnoreAuthorizer', "Ignore Authorizer");
export const IgnoreAnsiNulls: string = localize('DeployOptions.IgnoreAnsiNulls', "Ignore AnsiNulls");
export const GenerateSmartDefaults: string = localize('DeployOptions.GenerateSmartDefaults', "Generate SmartDefaults");
export const DropStatisticsNotInSource: string = localize('DeployOptions.DropStatisticsNotInSource', "Drop Statistics Not In Source");
export const DropRoleMembersNotInSource: string = localize('DeployOptions.DropRoleMembersNotInSource', "Drop Role Members Not In Source");
export const DropPermissionsNotInSource: string = localize('DeployOptions.DropPermissionsNotInSource', "Drop Permissions Not In Source");
export const DropObjectsNotInSource: string = localize('DeployOptions.DropObjectsNotInSource', "Drop Objects Not In Source");
export const IgnoreColumnOrder: string = localize('DeployOptions.IgnoreColumnOrder', "Ignore Column Order");
export const IgnoreTablePartitionOptions: string = localize('DeployOptions.IgnoreTablePartitionOptions', "Ignore Table Partition Options");
export const DoNotEvaluateSqlCmdVariables: string = localize('DeployOptions.DoNotEvaluateSqlCmdVariables', "Do Not Evaluate Sql Cmd Variables");
export const DisableParallelismForEnablingIndexes: string = localize('DeployOptions.DisableParallelismForEnablingIndexes', "Disable Parallelism For Enabling Indexes");
export const DisableIndexesForDataPhase: string = localize('DeployOptions.DisableIndexesForDataPhase', "Disable Indexes For Data Phase");
export const RestoreSequenceCurrentValue: string = localize('DeployOptions.RestoreSequenceCurrentValue', "Restore Sequence Current Value");
export const RebuildIndexesOfflineForDataPhase: string = localize('DeployOptions.RebuildIndexesOfflineForDataPhase', "Rebuild Indexes Offline For Data Phase");
export const IsAlwaysEncryptedParameterizationEnabled: string = localize('DeployOptions.IsAlwaysEncryptedParameterizationEnabled', "IsAlways Encrypted Parameterization Enabled");
export const PreserveIdentityLastValues: string = localize('DeployOptions.PreserveIdentityLastValues', "Preserve Identity Last Values");
export const AllowExternalLibraryPaths: string = localize('DeployOptions.AllowExternalLibraryPaths', "Allow External Library Paths");
export const AllowExternalLanguagePaths: string = localize('DeployOptions.AllowExternalLanguagePaths', "Allow External Language Paths");
export const HashObjectNamesInLogs: string = localize('DeployOptions.HashObjectNamesInLogs', "Hash Object Names In Logs");
export const DoNotDropWorkloadClassifiers: string = localize('DeployOptions.DoNotDropWorkloadClassifiers', "Do Not Drop Workload Classifiers");
export const IgnoreWorkloadClassifiers: string = localize('DeployOptions.IgnoreWorkloadClassifiers', "Ignore Workload Classifiers");
export const IgnoreDatabaseWorkloadGroups: string = localize('DeployOptions.IgnoreDatabaseWorkloadGroups', "Ignore Database Workload Groups");
export const DoNotDropDatabaseWorkloadGroups: string = localize('DeployOptions.DoNotDropDatabaseWorkloadGroups', "Do Not Drop Database Workload Groups");

// publish tab deploy options descriptions
export const descriptionIgnoreTableOptions: string = localize('DeployOptions.Description.IgnoreTableOptions', "Specifies whether differences in the table options will be ignored or updated when you publish to a database.");
export const descriptionIgnoreSemicolonBetweenStatements: string = localize('DeployOptions.Description.IgnoreSemicolonBetweenStatements', "Specifies whether differences in the semi-colons between T-SQL statements will be ignored or updated when you publish to a database.");
export const descriptionIgnoreRouteLifetime: string = localize('DeployOptions.Description.IgnoreRouteLifetime', "Specifies whether differences in the amount of time that SQL Server retains the route in the routing table should be ignored or updated when you publish to a database.");
export const descriptionIgnoreRoleMembership: string = localize('DeployOptions.Description.IgnoreRoleMembership', "Specifies whether differences in the role membership of logins should be ignored or updated when you publish to a database.");
export const descriptionIgnoreQuotedIdentifiers: string = localize('DeployOptions.Description.IgnoreQuotedIdentifiers', "Specifies whether differences in the quoted identifiers setting should be ignored or updated when you publish to a database.");
export const descriptionIgnorePermissions: string = localize('DeployOptions.Description.IgnorePermissions', "Specifies whether permissions should be ignored.");
export const descriptionIgnorePartitionSchemes: string = localize('DeployOptions.Description.IgnorePartitionSchemes', "Specifies whether differences in partition schemes and functions should be ignored or updated when you publish to a database.");
export const descriptionIgnoreObjectPlacementOnPartitionScheme: string = localize('DeployOptions.Description.IgnoreObjectPlacementOnPartitionScheme', "Specifies whether an object\'s placement on a partition scheme should be ignored or updated when you publish to a database.");
export const descriptionIgnoreNotForReplication: string = localize('DeployOptions.Description.IgnoreNotForReplication', "Specifies whether the not for replication settings should be ignored or updated when you publish to a database.");
export const descriptionIgnoreLoginSids: string = localize('DeployOptions.Description.IgnoreLoginSids', "Specifies whether differences in the security identification number (SID) should be ignored or updated when you publish to a database.");
export const descriptionIgnoreLockHintsOnIndexes: string = localize('DeployOptions.Description.IgnoreLockHintsOnIndexes', "Specifies whether differences in the lock hints on indexes should be ignored or updated when you publish to a database.");
export const descriptionIgnoreKeywordCasing: string = localize('DeployOptions.Description.IgnoreKeywordCasing', "Specifies whether differences in the casing of keywords should be ignored or updated when you publish to a database.");
export const descriptionIgnoreIndexPadding: string = localize('DeployOptions.Description.IgnoreIndexPadding', "Specifies whether differences in the index padding should be ignored or updated when you publish to a database.");
export const descriptionIgnoreIndexOptions: string = localize('DeployOptions.Description.IgnoreIndexOptions', "Specifies whether differences in the index options should be ignored or updated when you publish to a database.");
export const descriptionIgnoreIncrement: string = localize('DeployOptions.Description.IgnoreIncrement', "Specifies whether differences in the increment for an identity column should be ignored or updated when you publish to a database.");
export const descriptionIgnoreIdentitySeed: string = localize('DeployOptions.Description.IgnoreIdentitySeed', "Specifies whether differences in the seed for an identity column should be ignored or updated when you publish updates to a database.");
export const descriptionIgnoreUserSettingsObjects: string = localize('DeployOptions.Description.IgnoreUserSettingsObjects', "Specifies whether differences in the user settings objects will be ignored or updated when you publish to a database.");
export const descriptionIgnoreFullTextCatalogFilePath: string = localize('DeployOptions.Description.IgnoreFullTextCatalogFilePath', "Specifies whether differences in the file path for the full-text catalog should be ignored or whether a warning should be issued when you publish to a database.");
export const descriptionIgnoreWhitespace: string = localize('DeployOptions.Description.IgnoreWhitespace', "Specifies whether differences in white space will be ignored or updated when you publish to a database.");
export const descriptionIgnoreWithNocheckOnForeignKeys: string = localize('DeployOptions.Description.IgnoreWithNocheckOnForeignKeys', "Specifies whether differences in the value of the WITH NOCHECK clause for foreign keys will be ignored or updated when you publish to a database.");
export const descriptionVerifyCollationCompatibility: string = localize('DeployOptions.Description.VerifyCollationCompatibility', "Specifies whether collation compatibility is verified.");
export const descriptionUnmodifiableObjectWarnings: string = localize('DeployOptions.Description.UnmodifiableObjectWarnings', "Specifies whether warnings should be generated when differences are found in objects that cannot be modified, for example, if the file size or file paths were different for a file.");
export const descriptionTreatVerificationErrorsAsWarnings: string = localize('DeployOptions.Description.TreatVerificationErrorsAsWarnings', "Specifies whether errors encountered during publish verification should be treated as warnings. The check is performed against the generated deployment plan before the plan is executed against your target database. Plan verification detects problems such as the loss of target-only objects (such as indexes) that must be dropped to make a change. Verification will also detect situations where dependencies (such as a table or view) exist because of a reference to a composite project, but do not exist in the target database. You might choose to do this to get a complete list of all issues, instead of having the publish action stop on the first error.");
export const descriptionScriptRefreshModule: string = localize('DeployOptions.Description.ScriptRefreshModule', "Include refresh statements at the end of the publish script.");
export const descriptionScriptNewConstraintValidation: string = localize('DeployOptions.Description.ScriptNewConstraintValidation', "At the end of publish all of the constraints will be verified as one set, avoiding data errors caused by a check or foreign key constraint in the middle of publish. If set to False, your constraints will be published without checking the corresponding data.");
export const descriptionScriptFileSize: string = localize('DeployOptions.Description.ScriptFileSize', "Controls whether size is specified when adding a file to a filegroup.");
export const descriptionScriptDeployStateChecks: string = localize('DeployOptions.Description.ScriptDeployStateChecks', "Specifies whether statements are generated in the publish script to verify that the database name and server name match the names specified in the database project.");
export const descriptionScriptDatabaseOptions: string = localize('DeployOptions.Description.ScriptDatabaseOptions', "Specifies whether target database properties should be set or updated as part of the publish action.");
export const descriptionScriptDatabaseCompatibility: string = localize('DeployOptions.Description.ScriptDatabaseCompatibility', "Specifies whether differences in the database compatibility should be ignored or updated when you publish to a database.");
export const descriptionScriptDatabaseCollation: string = localize('DeployOptions.Description.ScriptDatabaseCollation', "Specifies whether differences in the database collation should be ignored or updated when you publish to a database.");
export const descriptionRunDeploymentPlanExecutors: string = localize('DeployOptions.Description.RunDeploymentPlanExecutors', "Specifies whether DeploymentPlanExecutor contributors should be run when other operations are executed.");
export const descriptionRegisterDataTierApplication: string = localize('DeployOptions.Description.RegisterDataTierApplication', "Specifies whether the schema is registered with the database server.");
export const descriptionPopulateFilesOnFileGroups: string = localize('DeployOptions.Description.PopulateFilesOnFileGroups', "Specifies whether a new file is also created when a new FileGroup is created in the target database.");
export const descriptionNoAlterStatementsToChangeClrTypes: string = localize('DeployOptions.Description.NoAlterStatementsToChangeClrTypes', "Specifies that publish should always drop and re-create an assembly if there is a difference instead of issuing an ALTER ASSEMBLY statement");
export const descriptionIncludeTransactionalScripts: string = localize('DeployOptions.Description.IncludeTransactionalScripts', "Specifies whether transactional statements should be used where possible when you publish to a database.");
export const descriptionIncludeCompositeObjects: string = localize('DeployOptions.Description.IncludeCompositeObjects', "Include all composite elements as part of a single publish operation.");
export const descriptionAllowUnsafeRowLevelSecurityDataMovement: string = localize('DeployOptions.Description.AllowUnsafeRowLevelSecurityDataMovement', "Do not block data motion on a table which has Row Level Security if this property is set to true. Default is false.");
export const descriptionIgnoreWithNocheckOnCheckConstraints: string = localize('DeployOptions.Description.IgnoreWithNocheckOnCheckConstraints', "Specifies whether differences in the value of the WITH NOCHECK clause for check constraints will be ignored or updated when you publish to a database.");
export const descriptionIgnoreFillFactor: string = localize('DeployOptions.Description.IgnoreFillFactor', "Specifies whether differences in the fill factor for index storage should be ignored or whether a warning should be issued when you publish to a database.");
export const descriptionIgnoreFileSize: string = localize('DeployOptions.Description.IgnoreFileSize', "Specifies whether differences in the file sizes should be ignored or whether a warning should be issued when you publish to a database.");
export const descriptionIgnoreFilegroupPlacement: string = localize('DeployOptions.Description.IgnoreFilegroupPlacement', "Specifies whether differences in the placement of objects in FILEGROUPs should be ignored or updated when you publish to a database.");
export const descriptionDoNotAlterReplicatedObjects: string = localize('DeployOptions.Description.DoNotAlterReplicatedObjects', "Specifies whether objects that are replicated are identified during verification.");
export const descriptionDoNotAlterChangeDataCaptureObjects: string = localize('DeployOptions.Description.DoNotAlterChangeDataCaptureObjects', "If true, Change Data Capture objects are not altered.");
export const descriptionDisableAndReenableDdlTriggers: string = localize('DeployOptions.Description.DisableAndReenableDdlTriggers', "Specifies whether Data Definition Language (DDL) triggers are disabled at the beginning of the publish process and re-enabled at the end of the publish action.");
export const descriptionDeployDatabaseInSingleUserMode: string = localize('DeployOptions.Description.DeployDatabaseInSingleUserMode', "If true, the database is set to Single User Mode before deploying.");
export const descriptionCreateNewDatabase: string = localize('DeployOptions.Description.CreateNewDatabase', "Specifies whether the target database should be updated or whether it should be dropped and re-created when you publish to a database.");
export const descriptionCompareUsingTargetCollation: string = localize('DeployOptions.Description.CompareUsingTargetCollation', "This setting dictates how the database\'s collation is handled during deployment; by default the target database\'s collation will be updated if it does not match the collation specified by the source.  When this option is set, the target database\'s (or server\'s) collation should be used.");
export const descriptionCommentOutSetVarDeclarations: string = localize('DeployOptions.Description.CommentOutSetVarDeclarations', "Specifies whether the declaration of SETVAR variables should be commented out in the generated publish script. You might choose to do this if you plan to specify the values on the command line when you publish by using a tool such as SQLCMD.EXE.");
export const descriptionBlockWhenDriftDetected: string = localize('DeployOptions.Description.BlockWhenDriftDetected', "Specifies whether to block updating a database whose schema no longer matches its registration or is unregistered.");
export const descriptionBlockOnPossibleDataLoss: string = localize('DeployOptions.Description.BlockOnPossibleDataLoss', "Specifies that the publish episode should be terminated if there is a possibility of data loss resulting from the publish operation.");
export const descriptionBackupDatabaseBeforeChanges: string = localize('DeployOptions.Description.BackupDatabaseBeforeChanges', "Backups the database before deploying any changes.");
export const descriptionAllowIncompatiblePlatform: string = localize('DeployOptions.Description.AllowIncompatiblePlatform', "Specifies whether to attempt the action despite incompatible SQL Server platforms.");
export const descriptionAllowDropBlockingAssemblies: string = localize('DeployOptions.Description.AllowDropBlockingAssemblies', "This property is used by SqlClr deployment to cause any blocking assemblies to be dropped as part of the deployment plan. By default, any blocking/referencing assemblies will block an assembly update if the referencing assembly needs to be dropped.");
export const descriptionDropConstraintsNotInSource: string = localize('DeployOptions.Description.DropConstraintsNotInSource', "Specifies whether constraints that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.");
export const descriptionDropDmlTriggersNotInSource: string = localize('DeployOptions.Description.DropDmlTriggersNotInSource', "Specifies whether DML triggers that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.");
export const descriptionDropExtendedPropertiesNotInSource: string = localize('DeployOptions.Description.DropExtendedPropertiesNotInSource', "Specifies whether extended properties that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.");
export const descriptionDropIndexesNotInSource: string = localize('DeployOptions.Description.DropIndexesNotInSource', "Specifies whether indexes that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.");
export const descriptionIgnoreFileAndLogFilePath: string = localize('DeployOptions.Description.IgnoreFileAndLogFilePath', "Specifies whether differences in the paths for files and log files should be ignored or updated when you publish to a database.");
export const descriptionIgnoreExtendedProperties: string = localize('DeployOptions.Description.IgnoreExtendedProperties', "Specifies whether extended properties should be ignored.");
export const descriptionIgnoreDmlTriggerState: string = localize('DeployOptions.Description.IgnoreDmlTriggerState', "Specifies whether differences in the enabled or disabled state of DML triggers should be ignored or updated when you publish to a database.");
export const descriptionIgnoreDmlTriggerOrder: string = localize('DeployOptions.Description.IgnoreDmlTriggerOrder', "Specifies whether differences in the order of Data Manipulation Language (DML) triggers should be ignored or updated when you publish to a database.");
export const descriptionIgnoreDefaultSchema: string = localize('DeployOptions.Description.IgnoreDefaultSchema', "Specifies whether differences in the default schema should be ignored or updated when you publish to a database.");
export const descriptionIgnoreDdlTriggerState: string = localize('DeployOptions.Description.IgnoreDdlTriggerState', "Specifies whether differences in the enabled or disabled state of Data Definition Language (DDL) triggers should be ignored or updated when you publish to a database.");
export const descriptionIgnoreDdlTriggerOrder: string = localize('DeployOptions.Description.IgnoreDdlTriggerOrder', "Specifies whether differences in the order of Data Definition Language (DDL) triggers should be ignored or updated when you publish to a database or server.");
export const descriptionIgnoreCryptographicProviderFilePath: string = localize('DeployOptions.Description.IgnoreCryptographicProviderFilePath', "Specifies whether differences in the file path for the cryptographic provider should be ignored or updated when you publish to a database.");
export const descriptionVerifyDeployment: string = localize('DeployOptions.Description.VerifyDeployment', "Specifies whether checks should be performed before publishing that will stop the publish action if issues are present that might block successful publishing. For example, your publish action might stop if you have foreign keys on the target database that do not exist in the database project, and that will cause errors when you publish.");
export const descriptionIgnoreComments: string = localize('DeployOptions.Description.IgnoreComments', "Specifies whether differences in the comments should be ignored or updated when you publish to a database.");
export const descriptionIgnoreColumnCollation: string = localize('DeployOptions.Description.IgnoreColumnCollation', "Specifies whether differences in the column collations should be ignored or updated when you publish to a database.");
export const descriptionIgnoreAuthorizer: string = localize('DeployOptions.Description.IgnoreAuthorizer', "Specifies whether differences in the Authorizer should be ignored or updated when you publish to a database.");
export const descriptionIgnoreAnsiNulls: string = localize('DeployOptions.Description.IgnoreAnsiNulls', "Specifies whether differences in the ANSI NULLS setting should be ignored or updated when you publish to a database.");
export const descriptionGenerateSmartDefaults: string = localize('DeployOptions.Description.GenerateSmartDefaults', "Automatically provides a default value when updating a table that contains data with a column that does not allow null values.");
export const descriptionDropStatisticsNotInSource: string = localize('DeployOptions.Description.DropStatisticsNotInSource', "Specifies whether statistics that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.");
export const descriptionDropRoleMembersNotInSource: string = localize('DeployOptions.Description.DropRoleMembersNotInSource', "Specifies whether role members that are not defined in the database snapshot (.dacpac) file will be dropped from the target database when you publish updates to a database.</");
export const descriptionDropPermissionsNotInSource: string = localize('DeployOptions.Description.DropPermissionsNotInSource', "Specifies whether permissions that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish updates to a database.");
export const descriptionDropObjectsNotInSource: string = localize('DeployOptions.Description.DropObjectsNotInSource', "Specifies whether objects that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.  This value takes precedence over DropExtendedProperties.");
export const descriptionIgnoreColumnOrder: string = localize('DeployOptions.Description.IgnoreColumnOrder', "Specifies whether differences in table column order should be ignored or updated when you publish to a database.");
export const descriptionIgnoreTablePartitionOptions: string = localize('DeployOptions.Description.IgnoreTablePartitionOptions', "Specifies whether differences in the table partition options will be ignored or updated when you publish to a database. This option applies only to Azure Synapse Analytics dedicated SQL pool databases.");
export const descriptionDoNotEvaluateSqlCmdVariables: string = localize('DeployOptions.Description.DoNotEvaluateSqlCmdVariables', "Specifies whether SQLCMD variables to not replace with values");
export const descriptionDisableParallelismForEnablingIndexes: string = localize('DeployOptions.Description.DisableParallelismForEnablingIndexes', "Not using parallelism when rebuilding indexes while importing data into SQL Server.");
export const descriptionDisableIndexesForDataPhase: string = localize('DeployOptions.Description.DisableIndexesForDataPhase', "Disable indexes before importing data into SQL Server.");
export const descriptionRestoreSequenceCurrentValue: string = localize('DeployOptions.Description.RestoreSequenceCurrentValue', "Specifies whether sequence object current value should be deployed with dacpac file, the default value is True.");
export const descriptionRebuildIndexesOfflineForDataPhase: string = localize('DeployOptions.Description.RebuildIndexesOfflineForDataPhase', "Rebuild indexes offline after importing data.");
export const descriptionIsAlwaysEncryptedParameterizationEnabled: string = localize('DeployOptions.Description.IsAlwaysEncryptedParameterizationEnabled', "Enables variable parameterization on Always Encrypted columns in pre/post deployment scripts.");
export const descriptionPreserveIdentityLastValues: string = localize('DeployOptions.Description.PreserveIdentityLastValues', "Specifies whether last values for identity columns should be preserved during deployment.");
export const descriptionAllowExternalLibraryPaths: string = localize('DeployOptions.Description.AllowExternalLibraryPaths', "Allows file paths, if available, to be used to generate external library statements.");
export const descriptionAllowExternalLanguagePaths: string = localize('DeployOptions.Description.AllowExternalLanguagePaths', "Allows file paths, if available, to be used to generate external language statements.");
export const descriptionHashObjectNamesInLogs: string = localize('DeployOptions.Description.HashObjectNamesInLogs', "To replace all object names in logs with a random hash value.");
export const descriptionDoNotDropWorkloadClassifiers: string = localize('DeployOptions.Description.DoNotDropWorkloadClassifiers', "When false, WorkloadClassifiers in the target database that are not defined in the source will be dropped during deployment.");
export const descriptionIgnoreWorkloadClassifiers: string = localize('DeployOptions.Description.IgnoreWorkloadClassifiers', "Specifies whether to exclude workload classifiers that exist on the target during deployment.");
export const descriptionIgnoreDatabaseWorkloadGroups: string = localize('DeployOptions.Description.IgnoreDatabaseWorkloadGroups', "Specifies whether to exclude workload groups that exist on the target during deployment.");
export const descriptionDoNotDropDatabaseWorkloadGroups: string = localize('DeployOptions.Description.DoNotDropDatabaseWorkloadGroups', "When false, Database WorkloadGroups in the target database that are not defined in the source will be dropped during deployment.");
