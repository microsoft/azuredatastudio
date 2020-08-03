/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

// Placeholder values
export const dataSourcesFileName = 'datasources.json';
export const sqlprojExtension = '.sqlproj';
export const sqlFileExtension = '.sql';
export const schemaCompareExtensionId = 'microsoft.schema-compare';
export const sqlDatabaseProjectExtensionId = 'microsoft.sql-database-projects';
export const mssqlExtensionId = 'microsoft.mssql';
export const dacpac = 'dacpac';
export const master = 'master';
export const masterDacpac = 'master.dacpac';
export const msdb = 'msdb';
export const msdbDacpac = 'msdb.dacpac';
export const MicrosoftDatatoolsSchemaSqlSql = 'Microsoft.Data.Tools.Schema.Sql.Sql';
export const databaseSchemaProvider = 'DatabaseSchemaProvider';

// commands
export const revealFileInOsCommand = 'revealFileInOS';
export const schemaCompareStartCommand = 'schemaCompare.start';
export const sqlDatabaseProjectsViewFocusCommand = 'sqlDatabaseProjectsView.focus';
export const vscodeOpenCommand = 'vscode.open';

// UI Strings

export const projectNodeName = localize('projectNodeName', "Database Project");
export const dataSourcesNodeName = localize('dataSourcesNodeName', "Data Sources");
export const databaseReferencesNodeName = localize('databaseReferencesNodeName', "Database References");
export const sqlConnectionStringFriendly = localize('sqlConnectionStringFriendly', "SQL connection string");
export const newDatabaseProjectName = localize('newDatabaseProjectName', "New database project name:");
export const sqlDatabaseProject = localize('sqlDatabaseProject', "SQL database project");
export const yesString = localize('yesString', "Yes");
export const noString = localize('noString', "No");
export const extractTargetInput = localize('extractTargetInput', "Select folder structure for SQL files");
export const extractDatabaseSelection = localize('extractDatabaseSelection', "Select database to import");
export const selectString = localize('selectString', "Select");
export const addDatabaseReferenceInput = localize('addDatabaseReferenceInput', "Add database reference for:");
export const systemDatabaseReferenceInput = localize('systemDatabaseReferenceInput', "System Database:");
export const databaseReferenceLocation = localize('databaseReferenceLocation', "Database location");
export const databaseReferenceSameDatabase = localize('databaseReferenceSameDatabase', "Same database");
export const databaseReferenceDifferentDabaseSameServer = localize('databaseReferenceDifferentDabaseSameServer', "Different database, same server");
export const databaseReferenceDatabaseName = localize('databaseReferenceDatabaseName', "Database name");
export const dacpacFiles = localize('dacpacFiles', "dacpac Files");
export const publishSettingsFiles = localize('publishSettingsFiles', "Publish Settings File");
export const systemDatabase = localize('systemDatabase', "System Database");
export const file = localize('file', "File");
export const flat = localize('flat', "Flat");
export const objectType = localize('objectType', "Object Type");
export const schema = localize('schema', "Schema");
export const schemaObjectType = localize('schemaObjectType', "Schema/Object Type");
export function newObjectNamePrompt(objectType: string) { return localize('newObjectNamePrompt', 'New {0} name:', objectType); }
export function deleteConfirmation(toDelete: string) { return localize('deleteConfirmation', "Are you sure you want to delete {0}?", toDelete); }
export function deleteConfirmationContents(toDelete: string) { return localize('deleteConfirmationContents', "Are you sure you want to delete {0} and all of its contents?", toDelete); }


// Publish dialog strings

export const publishDialogName = localize('publishDialogName', "Publish Database");
export const publishDialogOkButtonText = localize('publishDialogOkButtonText', "Publish");
export const cancelButtonText = localize('cancelButtonText', "Cancel");
export const generateScriptButtonText = localize('generateScriptButtonText', "Generate Script");
export const targetDatabaseSettings = localize('targetDatabaseSettings', "Target Database Settings");
export const databaseNameLabel = localize('databaseNameLabel', "Database");
export const targetConnectionLabel = localize('targetConnectionLabel', "Target Connection");
export const editConnectionButtonText = localize('editConnectionButtonText', "Edit");
export const clearButtonText = localize('clearButtonText', "Clear");
export const dataSourceRadioButtonLabel = localize('dataSourceRadioButtonLabel', "Data sources");
export const connectionRadioButtonLabel = localize('connectionRadioButtonLabel', "Connections");
export const selectConnectionRadioButtonsTitle = localize('selectconnectionRadioButtonsTitle', "Specify connection from:");
export const dataSourceDropdownTitle = localize('dataSourceDropdownTitle', "Data source");
export const noDataSourcesText = localize('noDataSourcesText', "No data sources in this project");
export const loadProfileButtonText = localize('loadProfileButtonText', "Load Profile...");
export const profileWarningText = localize('profileWarningText', "⚠ Warning: Connection strings using AAD Authentication are not supported at this time");
export const profileReadError = localize('profileReadError', "Could not load the profile file.");
export const sqlCmdTableLabel = localize('sqlCmdTableLabel', "SQLCMD Variables");
export const sqlCmdVariableColumn = localize('sqlCmdVariableColumn', "Variable");
export const sqlCmdValueColumn = localize('sqlCmdValueColumn', "Value");

// Error messages

export const multipleSqlProjFiles = localize('multipleSqlProjFilesSelected', "Multiple .sqlproj files selected; please select only one.");
export const noSqlProjFiles = localize('noSqlProjFilesSelected', "No .sqlproj file selected; please select one.");
export const noDataSourcesFile = localize('noDataSourcesFile', "No {0} found", dataSourcesFileName);
export const missingVersion = localize('missingVersion', "Missing 'version' entry in {0}", dataSourcesFileName);
export const unrecognizedDataSourcesVersion = localize('unrecognizedDataSourcesVersion', "Unrecognized version: ");
export const unknownDataSourceType = localize('unknownDataSourceType', "Unknown data source type: ");
export const invalidSqlConnectionString = localize('invalidSqlConnectionString', "Invalid SQL connection string");
export const projectNameRequired = localize('projectNameRequired', "Name is required to create a new database project.");
export const projectLocationRequired = localize('projectLocationRequired', "Location is required to create a new database project.");
export const projectLocationNotEmpty = localize('projectLocationNotEmpty', "Current project location is not empty. Select an empty folder for precise extraction.");
export const extractTargetRequired = localize('extractTargetRequired', "Target information for extract is required to import database to project.");
export const schemaCompareNotInstalled = localize('schemaCompareNotInstalled', "Schema compare extension installation is required to run schema compare");
export const buildDacpacNotFound = localize('buildDacpacNotFound', "Dacpac created from build not found");
export const updateProjectForRoundTrip = localize('updateProjectForRoundTrip', "To build this project, Azure Data Studio needs to update targets, references, and system database references. If the project is created in SSDT, it will continue to work in both tools. Do you want Azure Data Studio to update the project?");
export const updateProjectDatabaseReferencesForRoundTrip = localize('updateProjectDatabaseReferencesForRoundTrip', "To build this project, Azure Data Studio needs to update system database references. If the project is created in SSDT, it will continue to work in both tools. Do you want Azure Data Studio to update the project?");
export const databaseReferenceTypeRequired = localize('databaseReferenceTypeRequired', "Database reference type is required for adding a reference to a database");
export const systemDatabaseReferenceRequired = localize('systemDatabaseReferenceRequired', "System database selection is required for adding a reference to a system database");
export const dacpacFileLocationRequired = localize('dacpacFileLocationRequired', "Dacpac file location is required for adding a reference to a database");
export const databaseLocationRequired = localize('databaseLocation', "Database location is required for adding a reference to a database");
export const databaseNameRequired = localize('databaseNameRequired', "Database name is required for adding a reference to a different database");
export const invalidDataSchemaProvider = localize('invalidDataSchemaProvider', "Invalid DSP in .sqlproj file");
export const invalidDatabaseReference = localize('invalidDatabaseReference', "Invalid database reference in .sqlproj file");
export const databaseSelectionRequired = localize('databaseSelectionRequired', "Database selection is required to import a project");
export const databaseReferenceAlreadyExists = localize('databaseReferenceAlreadyExists', "A reference to this database already exists in this project");
export const ousiderFolderPath = localize('outsideFolderPath', "Items with absolute path outside project folder are not supported. Please make sure the paths in the project file are relative to project folder.");
export function projectAlreadyOpened(path: string) { return localize('projectAlreadyOpened', "Project '{0}' is already opened.", path); }
export function projectAlreadyExists(name: string, path: string) { return localize('projectAlreadyExists', "A project named {0} already exists in {1}.", name, path); }
export function noFileExist(fileName: string) { return localize('noFileExist', "File {0} doesn't exist", fileName); }
export function cannotResolvePath(path: string) { return localize('cannotResolvePath', "Cannot resolve path {0}", path); }
export function fileAlreadyExists(filename: string) { return localize('fileAlreadyExists', "A file with the name '{0}' already exists on disk at this location. Please choose another name.", filename); }
export function folderAlreadyExists(filename: string) { return localize('folderAlreadyExists', "A folder with the name '{0}' already exists on disk at this location. Please choose another name.", filename); }
export function invalidInput(input: string) { return localize('invalidInput', "Invalid input: {0}", input); }
export function unableToCreatePublishConnection(input: string) { return localize('unableToCreatePublishConnection', "Unable to construct connection: {0}", input); }

export function mssqlNotFound(mssqlConfigDir: string) { return localize('mssqlNotFound', "Could not get mssql extension's install location at {0}", mssqlConfigDir); }
export function projBuildFailed(errorMessage: string) { return localize('projBuildFailed', "Build failed. Check output pane for more details. {0}", errorMessage); }
export function unexpectedProjectContext(uri: string) { return localize('unexpectedProjectContext', "Unable to establish project context.  Command invoked from unexpected location: {0}", uri); }
export function unableToPerformAction(action: string, uri: string) { return localize('unableToPerformAction', "Unable to locate '{0}' target: '{1}'", action, uri); }
export function unableToFindObject(path: string, objType: string) { return localize('unableToFindFile', "Unable to find {1} with path '{0}'", path, objType); }

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
export const AfterCleanTarget = 'AfterClean';
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
export const DSP = 'DSP';
export const Properties = 'Properties';
export const RelativeOuterPath = '..';

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

// Profile XML names
export const targetDatabaseName = 'TargetDatabaseName';
export const targetConnectionString = 'TargetConnectionString';

// SQL connection string components
export const initialCatalogSetting = 'Initial Catalog';
export const dataSourceSetting = 'Data Source';
export const integratedSecuritySetting = 'Integrated Security';
export const userIdSetting = 'User ID';
export const passwordSetting = 'Password';

// Tree item types
export enum DatabaseProjectItemType {
	project = 'databaseProject.itemType.project',
	folder = 'databaseProject.itemType.folder',
	file = 'databaseProject.itemType.file',
	referencesRoot = 'databaseProject.itemType.referencesRoot',
	reference = 'databaseProject.itemType.reference',
	dataSourceRoot = 'databaseProject.itemType.dataSourceRoot',
	dataSource = 'databaseProject.itemType.dataSource'
}
