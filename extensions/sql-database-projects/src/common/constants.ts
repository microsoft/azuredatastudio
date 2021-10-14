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
export const schemaCompareStartCommand = 'schemaCompare.start';
export const vscodeOpenCommand = 'vscode.open';

// UI Strings

export const dataSourcesNodeName = localize('dataSourcesNodeName', "Data Sources");
export const databaseReferencesNodeName = localize('databaseReferencesNodeName', "Database References");
export const sqlConnectionStringFriendly = localize('sqlConnectionStringFriendly', "SQL connection string");
export const yesString = localize('yesString', "Yes");
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
export const sqlCmdTableLabel = localize('sqlCmdTableLabel', "SQLCMD Variables");
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
export const browseForProfile = localize('browseForProfile', "Browse for profile");
export const browseForProfileWithIcon = `$(folder) ${browseForProfile}`;
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

// Deploy
export const selectPublishOption = localize('selectPublishOption', "Select where to publish the project to");
export const publishToExistingServer = localize('publishToExistingServer', "Publish to existing server");
export const publishToDockerContainer = localize('publishToDockerContainer', "Publish to new server in a container");
export const enterPortNumber = localize('enterPortNumber', "Enter SQL server port number or press enter to use the default value");
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
export const connectionNamePrefix = 'SQLDbProject';
export const sqlServerDockerRegistry = 'mcr.microsoft.com';
export const sqlServerDockerRepository = 'mssql/server';
export const azureSqlEdgeDockerRepository = 'azure-sql-edge';
export const commandsFolderName = 'commands';
export const mssqlFolderName = '.mssql';
export const dockerFileName = 'Dockerfile';
export const startCommandName = 'start.sh';
export const defaultPortNumber = '1433';
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
export const browseEllipsis = localize('browseEllipsis', "Browse...");
export const browseEllipsisWithIcon = `$(folder) ${browseEllipsis}`;
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
export const updateProjectForRoundTrip = localize('updateProjectForRoundTrip', "The targets, references, and system database references need to be updated to build this project. If the project is created in SSDT, it will continue to work in both tools. Do you want to update the project?");
export const updateProjectDatabaseReferencesForRoundTrip = localize('updateProjectDatabaseReferencesForRoundTrip', "The system database references need to be updated to build this project. If the project is created in SSDT, it will continue to work in both tools. Do you want to update the project?");
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

export const NetCoreInstallationConfirmation: string = localize('sqlDatabaseProjects.NetCoreInstallationConfirmation', "The .NET Core SDK cannot be located. Project build will not work. Please install .NET Core SDK version 3.1 or update the .NET Core SDK location in settings if already installed.");
export function NetCoreSupportedVersionInstallationConfirmation(installedVersion: string) { return localize('sqlDatabaseProjects.NetCoreSupportedVersionInstallationConfirmation', "Currently installed .NET Core SDK version is {0}, which is not supported. Project build will not work. Please install .NET Core SDK version 3.1 or update the .NET Core SDK supported version location in settings if already installed.", installedVersion); }
export const UpdateNetCoreLocation: string = localize('sqlDatabaseProjects.UpdateNetCoreLocation', "Update Location");
export const projectsOutputChannel = localize('sqlDatabaseProjects.outputChannel', "Database Projects");

// Prompt buttons
export const Install: string = localize('sqlDatabaseProjects.Install', "Install");
export const DoNotAskAgain: string = localize('sqlDatabaseProjects.doNotAskAgain', "Don't Ask Again");

// SqlProj file XML names
export const ItemGroup = 'ItemGroup';
export const Build = 'Build';
export const Folder = 'Folder';
export const Include = 'Include';
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
export const nodeButNotAutorestFound = localize('nodeButNotAutorestFound', "Autorest tool not found in system path, but found Node.js.  Running via npx.  Please execute 'npm install autorest -g' to install permanently.");
export const nodeNotFound = localize('nodeNotFound', "Neither autorest nor Node.js (npx) found in system path.  Please install Node.js for autorest generation to work.");
export const selectSpecFile = localize('selectSpecFile', "Select OpenAPI/Swagger spec file");
export function generatingProjectFailed(errorMessage: string) { return localize('generatingProjectFailed', "Generating project via AutoRest failed.  Check output pane for more details. Error: {0}", errorMessage); }
export function multipleMostDeploymentScripts(count: number) { return localize('multipleMostDeploymentScripts', "Unexpected number of {0} files: {1}", autorestPostDeploymentScriptName, count); }
export const specSelectionText = localize('specSelectionText', "OpenAPI/Swagger spec");

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
