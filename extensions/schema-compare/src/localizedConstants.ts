/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// Labels
export const OkButtonText: string = localize('schemaCompareDialog.ok', "OK");
export const CancelButtonText: string = localize('schemaCompareDialog.cancel', "Cancel");
export const SourceTitle: string = localize('schemaCompareDialog.SourceTitle', "Source");
export const TargetTitle: string = localize('schemaCompareDialog.TargetTitle', "Target");
export const FileTextBoxLabel: string = localize('schemaCompareDialog.fileTextBoxLabel', "File");
export const DacpacRadioButtonLabel: string = localize('schemaCompare.dacpacRadioButtonLabel', "Data-tier Application File (.dacpac)");
export const DatabaseRadioButtonLabel: string = localize('schemaCompare.databaseButtonLabel', "Database");
export const ProjectRadioButtonLabel: string = localize('schemaCompare.projectButtonLabel', "Database Project");
export const RadioButtonsLabel: string = localize('schemaCompare.radioButtonsLabel', "Type");
export const ServerDropdownLabel: string = localize('schemaCompareDialog.serverDropdownTitle', "Server");
export const DatabaseDropdownLabel: string = localize('schemaCompareDialog.databaseDropdownTitle', "Database");
export const StructureDropdownLabel: string = localize('schemaCompareDialog.structureDropdownLabel', "Folder Structure");
export const SchemaCompareLabel: string = localize('schemaCompare.dialogTitle', "Schema Compare");
export const differentSourceMessage: string = localize('schemaCompareDialog.differentSourceMessage', "A different source schema has been selected. Compare to see the comparison?");
export const differentTargetMessage: string = localize('schemaCompareDialog.differentTargetMessage', "A different target schema has been selected. Compare to see the comparison?");
export const differentSourceTargetMessage: string = localize('schemaCompareDialog.differentSourceTargetMessage', "Different source and target schemas have been selected. Compare to see the comparison?");
export const YesButtonText: string = localize('schemaCompareDialog.Yes', "Yes");
export const NoButtonText: string = localize('schemaCompareDialog.No', "No");
export const sourceFile: string = localize('schemaCompareDialog.sourceTextBox', "Source file");
export const targetFile: string = localize('schemaCompareDialog.targetTextBox', "Target file");
export const sourceDatabase: string = localize('schemaCompareDialog.sourceDatabaseDropdown', "Source Database");
export const targetDatabase: string = localize('schemaCompareDialog.targetDatabaseDropdown', "Target Database");
export const sourceServer: string = localize('schemaCompareDialog.sourceServerDropdown', "Source Server");
export const targetServer: string = localize('schemaCompareDialog.targetServerDropdown', "Target Server");
export const defaultText: string = localize('schemaCompareDialog.defaultUser', "default");
export const open: string = localize('schemaCompare.openFile', "Open");
export const targetStructure = localize('targetStructure', "Target Folder Structure");
export const file = localize('file', "File");
export const flat = localize('flat', "Flat");
export const objectType = localize('objectType', "Object Type");
export const schema = localize('schema', "Schema");
export const schemaObjectType = localize('schemaObjectType', "Schema/Object Type");
export const selectSourceFile: string = localize('schemaCompare.selectSourceFile', "Select source file");
export const selectTargetFile: string = localize('schemaCompare.selectTargetFile', "Select target file");
export const ResetButtonText: string = localize('SchemaCompareOptionsDialog.Reset', "Reset");
export const OptionsChangedMessage: string = localize('schemaCompareOptions.RecompareMessage', "Options have changed. Recompare to see the comparison?");
export const OptionsLabel: string = localize('SchemaCompare.SchemaCompareOptionsDialogLabel', "Schema Compare Options");
export const GeneralOptionsLabel: string = localize('SchemaCompare.GeneralOptionsLabel', "General Options");
export const ObjectTypesOptionsLabel: string = localize('SchemaCompare.ObjectTypesOptionsLabel', "Include Object Types");
export const diffEditorTitle: string = localize('schemaCompare.CompareDetailsTitle', "Compare Details");
export const applyConfirmation: string = localize('schemaCompare.ApplyConfirmation', "Are you sure you want to update the target?");
export const reCompareToRefeshMessage: string = localize('schemaCompare.RecompareToRefresh', "Press Compare to refresh the comparison.");
export const generateScriptEnabledMessage: string = localize('schemaCompare.generateScriptEnabledButton', "Generate script to deploy changes to target");
export const generateScriptNoChangesMessage: string = localize('schemaCompare.generateScriptNoChanges', "No changes to script");
export const applyEnabledMessage: string = localize('schemaCompare.applyButtonEnabledTitle', "Apply changes to target");
export const applyNoChangesMessage: string = localize('schemaCompare.applyNoChanges', "No changes to apply");
export const includeExcludeInfoMessage: string = localize('schemaCompare.includeExcludeInfoMessage', "Please note that include/exclude operations can take a moment to calculate affected dependencies");
export const sourceTitle: string = localize('schemaCompareDialog.SourceTitle', "Source");
export const targetTitle: string = localize('schemaCompareDialog.TargetTitle', "Target");
export const deleteAction: string = localize('schemaCompare.deleteAction', "Delete");
export const changeAction: string = localize('schemaCompare.changeAction', "Change");
export const addAction: string = localize('schemaCompare.addAction', "Add");
export const differencesTableTitle: string = localize('schemaCompare.differencesTableTitle', "Comparison between Source and Target");
export const waitText: string = localize('schemaCompare.waitText', "Initializing Comparison. This might take a moment.");
export const startText: string = localize('schemaCompare.startText', "To compare two schemas, first select a source schema and target schema, then press Compare.");
export const noDifferencesText: string = localize('schemaCompare.noDifferences', "No schema differences were found.");
export const type: string = localize('schemaCompare.typeColumn', "Type");
export const sourceName: string = localize('schemaCompare.sourceNameColumn', "Source Name");
export const include: string = localize('schemaCompare.includeColumnName', "Include");
export const action: string = localize('schemaCompare.actionColumn', "Action");
export const targetName: string = localize('schemaCompare.targetNameColumn', "Target Name");
export const generateScriptDisabled: string = localize('schemaCompare.generateScriptButtonDisabledTitle', "Generate script is enabled when the target is a database");
export const applyDisabled: string = localize('schemaCompare.applyButtonDisabledTitle', "Apply is enabled when the target is a database or database project");
export function cannotExcludeMessageDependent(diffEntryName: string, firstDependentName: string): string { return localize('schemaCompare.cannotExcludeMessageWithDependent', "Cannot exclude {0}. Included dependents exist, such as {1}", diffEntryName, firstDependentName); }
export function cannotIncludeMessageDependent(diffEntryName: string, firstDependentName: string): string { return localize('schemaCompare.cannotIncludeMessageWithDependent', "Cannot include {0}. Excluded dependents exist, such as {1}", diffEntryName, firstDependentName); }
export function cannotExcludeMessage(diffEntryName: string): string { return localize('schemaCompare.cannotExcludeMessage', "Cannot exclude {0}. Included dependents exist", diffEntryName); }
export function cannotIncludeMessage(diffEntryName: string): string { return localize('schemaCompare.cannotIncludeMessage', "Cannot include {0}. Excluded dependents exist", diffEntryName); }
export const compare: string = localize('schemaCompare.compareButton', "Compare");
export const stop: string = localize('schemaCompare.cancelCompareButton', "Stop");
export const generateScript: string = localize('schemaCompare.generateScriptButton', "Generate script");
export const options: string = localize('schemaCompare.optionsButton', "Options");
export const apply: string = localize('schemaCompare.updateButton', "Apply");
export const switchDirection: string = localize('schemaCompare.switchDirectionButton', "Switch direction");
export const switchDirectionDescription: string = localize('schemaCompare.switchButtonTitle', "Switch source and target");
export const selectSource: string = localize('schemaCompare.sourceButtonTitle', "Select Source");
export const selectTarget: string = localize('schemaCompare.targetButtonTitle', "Select Target");
export const openScmp: string = localize('schemaCompare.openScmpButton', "Open .scmp file");
export const openScmpDescription: string = localize('schemaCompare.openScmpButtonTitle', "Load source, target, and options saved in an .scmp file");
export const saveScmp: string = localize('schemaCompare.saveScmpButton', "Save .scmp file");
export const saveScmpDescription: string = localize('schemaCompare.saveScmpButtonTitle', "Save source and target, options, and excluded elements");
export const save: string = localize('schemaCompare.saveFile', "Save");
export function getConnectionString(caller: string): string { return localize('schemaCompare.GetConnectionString', "Do you want to connect to {0}?", caller); }
export const selectConnection: string = localize('schemaCompare.selectConnection', "Select connection");

// options
export const IgnoreTableOptions: string = localize('SchemaCompare.IgnoreTableOptions', "Ignore Table Options");
export const IgnoreSemicolonBetweenStatements: string = localize('SchemaCompare.IgnoreSemicolonBetweenStatements', "Ignore Semicolon Between Statements");
export const IgnoreRouteLifetime: string = localize('SchemaCompare.IgnoreRouteLifetime', "Ignore Route Lifetime");
export const IgnoreRoleMembership: string = localize('SchemaCompare.IgnoreRoleMembership', "Ignore Role Membership");
export const IgnoreQuotedIdentifiers: string = localize('SchemaCompare.IgnoreQuotedIdentifiers', "Ignore Quoted Identifiers");
export const IgnorePermissions: string = localize('SchemaCompare.IgnorePermissions', "Ignore Permissions");
export const IgnorePartitionSchemes: string = localize('SchemaCompare.IgnorePartitionSchemes', "Ignore Partition Schemes");
export const IgnoreObjectPlacementOnPartitionScheme: string = localize('SchemaCompare.IgnoreObjectPlacementOnPartitionScheme', "Ignore Object Placement On Partition Scheme");
export const IgnoreNotForReplication: string = localize('SchemaCompare.IgnoreNotForReplication', "Ignore Not For Replication");
export const IgnoreLoginSids: string = localize('SchemaCompare.IgnoreLoginSids', "Ignore Login Sids");
export const IgnoreLockHintsOnIndexes: string = localize('SchemaCompare.IgnoreLockHintsOnIndexes', "Ignore Lock Hints On Indexes");
export const IgnoreKeywordCasing: string = localize('SchemaCompare.IgnoreKeywordCasing', "Ignore Keyword Casing");
export const IgnoreIndexPadding: string = localize('SchemaCompare.IgnoreIndexPadding', "Ignore Index Padding");
export const IgnoreIndexOptions: string = localize('SchemaCompare.IgnoreIndexOptions', "Ignore Index Options");
export const IgnoreIncrement: string = localize('SchemaCompare.IgnoreIncrement', "Ignore Increment");
export const IgnoreIdentitySeed: string = localize('SchemaCompare.IgnoreIdentitySeed', "Ignore Identity Seed");
export const IgnoreUserSettingsObjects: string = localize('SchemaCompare.IgnoreUserSettingsObjects', "Ignore User Settings Objects");
export const IgnoreFullTextCatalogFilePath: string = localize('SchemaCompare.IgnoreFullTextCatalogFilePath', "Ignore Full Text Catalog FilePath");
export const IgnoreWhitespace: string = localize('SchemaCompare.IgnoreWhitespace', "Ignore Whitespace");
export const IgnoreWithNocheckOnForeignKeys: string = localize('SchemaCompare.IgnoreWithNocheckOnForeignKeys', "Ignore With Nocheck On ForeignKeys");
export const VerifyCollationCompatibility: string = localize('SchemaCompare.VerifyCollationCompatibility', "Verify Collation Compatibility");
export const UnmodifiableObjectWarnings: string = localize('SchemaCompare.UnmodifiableObjectWarnings', "Unmodifiable Object Warnings");
export const TreatVerificationErrorsAsWarnings: string = localize('SchemaCompare.TreatVerificationErrorsAsWarnings', "Treat Verification Errors As Warnings");
export const ScriptRefreshModule: string = localize('SchemaCompare.ScriptRefreshModule', "Script Refresh Module");
export const ScriptNewConstraintValidation: string = localize('SchemaCompare.ScriptNewConstraintValidation', "Script New Constraint Validation");
export const ScriptFileSize: string = localize('SchemaCompare.ScriptFileSize', "Script File Size");
export const ScriptDeployStateChecks: string = localize('SchemaCompare.ScriptDeployStateChecks', "Script Deploy StateChecks");
export const ScriptDatabaseOptions: string = localize('SchemaCompare.ScriptDatabaseOptions', "Script Database Options");
export const ScriptDatabaseCompatibility: string = localize('SchemaCompare.ScriptDatabaseCompatibility', "Script Database Compatibility");
export const ScriptDatabaseCollation: string = localize('SchemaCompare.ScriptDatabaseCollation', "Script Database Collation");
export const RunDeploymentPlanExecutors: string = localize('SchemaCompare.RunDeploymentPlanExecutors', "Run Deployment Plan Executors");
export const RegisterDataTierApplication: string = localize('SchemaCompare.RegisterDataTierApplication', "Register DataTier Application");
export const PopulateFilesOnFileGroups: string = localize('SchemaCompare.PopulateFilesOnFileGroups', "Populate Files On File Groups");
export const NoAlterStatementsToChangeClrTypes: string = localize('SchemaCompare.NoAlterStatementsToChangeClrTypes', "No Alter Statements To Change Clr Types");
export const IncludeTransactionalScripts: string = localize('SchemaCompare.IncludeTransactionalScripts', "Include Transactional Scripts");
export const IncludeCompositeObjects: string = localize('SchemaCompare.IncludeCompositeObjects', "Include Composite Objects");
export const AllowUnsafeRowLevelSecurityDataMovement: string = localize('SchemaCompare.AllowUnsafeRowLevelSecurityDataMovement', "Allow Unsafe Row Level Security Data Movement");
export const IgnoreWithNocheckOnCheckConstraints: string = localize('SchemaCompare.IgnoreWithNocheckOnCheckConstraints', "Ignore With No check On Check Constraints");
export const IgnoreFillFactor: string = localize('SchemaCompare.IgnoreFillFactor', "Ignore Fill Factor");
export const IgnoreFileSize: string = localize('SchemaCompare.IgnoreFileSize', "Ignore File Size");
export const IgnoreFilegroupPlacement: string = localize('SchemaCompare.IgnoreFilegroupPlacement', "Ignore Filegroup Placement");
export const DoNotAlterReplicatedObjects: string = localize('SchemaCompare.DoNotAlterReplicatedObjects', "Do Not Alter Replicated Objects");
export const DoNotAlterChangeDataCaptureObjects: string = localize('SchemaCompare.DoNotAlterChangeDataCaptureObjects', "Do Not Alter Change Data Capture Objects");
export const DisableAndReenableDdlTriggers: string = localize('SchemaCompare.DisableAndReenableDdlTriggers', "Disable And Reenable Ddl Triggers");
export const DeployDatabaseInSingleUserMode: string = localize('SchemaCompare.DeployDatabaseInSingleUserMode', "Deploy Database In Single User Mode");
export const CreateNewDatabase: string = localize('SchemaCompare.CreateNewDatabase', "Create New Database");
export const CompareUsingTargetCollation: string = localize('SchemaCompare.CompareUsingTargetCollation', "Compare Using Target Collation");
export const CommentOutSetVarDeclarations: string = localize('SchemaCompare.CommentOutSetVarDeclarations', "Comment Out Set Var Declarations");
export const BlockWhenDriftDetected: string = localize('SchemaCompare.BlockWhenDriftDetected', "Block When Drift Detected");
export const BlockOnPossibleDataLoss: string = localize('SchemaCompare.BlockOnPossibleDataLoss', "Block On Possible Data Loss");
export const BackupDatabaseBeforeChanges: string = localize('SchemaCompare.BackupDatabaseBeforeChanges', "Backup Database Before Changes");
export const AllowIncompatiblePlatform: string = localize('SchemaCompare.AllowIncompatiblePlatform', "Allow Incompatible Platform");
export const AllowDropBlockingAssemblies: string = localize('SchemaCompare.AllowDropBlockingAssemblies', "Allow Drop Blocking Assemblies");
export const DropConstraintsNotInSource: string = localize('SchemaCompare.DropConstraintsNotInSource', "Drop Constraints Not In Source");
export const DropDmlTriggersNotInSource: string = localize('SchemaCompare.DropDmlTriggersNotInSource', "Drop Dml Triggers Not In Source");
export const DropExtendedPropertiesNotInSource: string = localize('SchemaCompare.DropExtendedPropertiesNotInSource', "Drop Extended Properties Not In Source");
export const DropIndexesNotInSource: string = localize('SchemaCompare.DropIndexesNotInSource', "Drop Indexes Not In Source");
export const IgnoreFileAndLogFilePath: string = localize('SchemaCompare.IgnoreFileAndLogFilePath', "Ignore File And Log File Path");
export const IgnoreExtendedProperties: string = localize('SchemaCompare.IgnoreExtendedProperties', "Ignore Extended Properties");
export const IgnoreDmlTriggerState: string = localize('SchemaCompare.IgnoreDmlTriggerState', "Ignore Dml Trigger State");
export const IgnoreDmlTriggerOrder: string = localize('SchemaCompare.IgnoreDmlTriggerOrder', "Ignore Dml Trigger Order");
export const IgnoreDefaultSchema: string = localize('SchemaCompare.IgnoreDefaultSchema', "Ignore Default Schema");
export const IgnoreDdlTriggerState: string = localize('SchemaCompare.IgnoreDdlTriggerState', "Ignore Ddl Trigger State");
export const IgnoreDdlTriggerOrder: string = localize('SchemaCompare.IgnoreDdlTriggerOrder', "Ignore Ddl Trigger Order");
export const IgnoreCryptographicProviderFilePath: string = localize('SchemaCompare.IgnoreCryptographicProviderFilePath', "Ignore Cryptographic Provider FilePath");
export const VerifyDeployment: string = localize('SchemaCompare.VerifyDeployment', "Verify Deployment");
export const IgnoreComments: string = localize('SchemaCompare.IgnoreComments', "Ignore Comments");
export const IgnoreColumnCollation: string = localize('SchemaCompare.IgnoreColumnCollation', "Ignore Column Collation");
export const IgnoreAuthorizer: string = localize('SchemaCompare.IgnoreAuthorizer', "Ignore Authorizer");
export const IgnoreAnsiNulls: string = localize('SchemaCompare.IgnoreAnsiNulls', "Ignore AnsiNulls");
export const GenerateSmartDefaults: string = localize('SchemaCompare.GenerateSmartDefaults', "Generate SmartDefaults");
export const DropStatisticsNotInSource: string = localize('SchemaCompare.DropStatisticsNotInSource', "Drop Statistics Not In Source");
export const DropRoleMembersNotInSource: string = localize('SchemaCompare.DropRoleMembersNotInSource', "Drop Role Members Not In Source");
export const DropPermissionsNotInSource: string = localize('SchemaCompare.DropPermissionsNotInSource', "Drop Permissions Not In Source");
export const DropObjectsNotInSource: string = localize('SchemaCompare.DropObjectsNotInSource', "Drop Objects Not In Source");
export const IgnoreColumnOrder: string = localize('SchemaCompare.IgnoreColumnOrder', "Ignore Column Order");

// object types
export const Aggregates: string = localize('SchemaCompare.Aggregates', "Aggregates");
export const ApplicationRoles: string = localize('SchemaCompare.ApplicationRoles', "Application Roles");
export const Assemblies: string = localize('SchemaCompare.Assemblies', "Assemblies");
export const AssemblyFiles: string = localize('SchemaCompare.AssemblyFiles', "Assembly Files");
export const AsymmetricKeys: string = localize('SchemaCompare.AsymmetricKeys', "Asymmetric Keys");
export const BrokerPriorities: string = localize('SchemaCompare.BrokerPriorities', "Broker Priorities");
export const Certificates: string = localize('SchemaCompare.Certificates', "Certificates");
export const ColumnEncryptionKeys: string = localize('SchemaCompare.ColumnEncryptionKeys', "Column Encryption Keys");
export const ColumnMasterKeys: string = localize('SchemaCompare.ColumnMasterKeys', "Column Master Keys");
export const Contracts: string = localize('SchemaCompare.Contracts', "Contracts");
export const DatabaseOptions: string = localize('SchemaCompare.DatabaseOptions', "Database Options");
export const DatabaseRoles: string = localize('SchemaCompare.DatabaseRoles', "Database Roles");
export const DatabaseTriggers: string = localize('SchemaCompare.DatabaseTriggers', "Database Triggers");
export const Defaults: string = localize('SchemaCompare.Defaults', "Defaults");
export const ExtendedProperties: string = localize('SchemaCompare.ExtendedProperties', "Extended Properties");
export const ExternalDataSources: string = localize('SchemaCompare.ExternalDataSources', "External Data Sources");
export const ExternalFileFormats: string = localize('SchemaCompare.ExternalFileFormats', "External File Formats");
export const ExternalStreams: string = localize('SchemaCompare.ExternalStreams', "External Streams");
export const ExternalStreamingJobs: string = localize('SchemaCompare.ExternalStreamingJobs', "External Streaming Jobs");
export const ExternalTables: string = localize('SchemaCompare.ExternalTables', "External Tables");
export const Filegroups: string = localize('SchemaCompare.Filegroups', "Filegroups");
export const Files: string = localize('SchemaCompare.Files', "Files");
export const FileTables: string = localize('SchemaCompare.FileTables', "File Tables");
export const FullTextCatalogs: string = localize('SchemaCompare.FullTextCatalogs', "Full Text Catalogs");
export const FullTextStoplists: string = localize('SchemaCompare.FullTextStoplists', "Full Text Stoplists");
export const MessageTypes: string = localize('SchemaCompare.MessageTypes', "Message Types");
export const PartitionFunctions: string = localize('SchemaCompare.PartitionFunctions', "Partition Functions");
export const PartitionSchemes: string = localize('SchemaCompare.PartitionSchemes', "Partition Schemes");
export const Permissions: string = localize('SchemaCompare.Permissions', "Permissions");
export const Queues: string = localize('SchemaCompare.Queues', "Queues");
export const RemoteServiceBindings: string = localize('SchemaCompare.RemoteServiceBindings', "Remote Service Bindings");
export const RoleMembership: string = localize('SchemaCompare.RoleMembership', "Role Membership");
export const Rules: string = localize('SchemaCompare.Rules', "Rules");
export const ScalarValuedFunctions: string = localize('SchemaCompare.ScalarValuedFunctions', "Scalar Valued Functions");
export const SearchPropertyLists: string = localize('SchemaCompare.SearchPropertyLists', "Search Property Lists");
export const SecurityPolicies: string = localize('SchemaCompare.SecurityPolicies', "Security Policies");
export const Sequences: string = localize('SchemaCompare.Sequences', "Sequences");
export const Services: string = localize('SchemaCompare.Services', "Services");
export const Signatures: string = localize('SchemaCompare.Signatures', "Signatures");
export const StoredProcedures: string = localize('SchemaCompare.StoredProcedures', "Stored Procedures");
export const SymmetricKeys: string = localize('SchemaCompare.SymmetricKeys', "Symmetric Keys");
export const Synonyms: string = localize('SchemaCompare.Synonyms', "Synonyms");
export const Tables: string = localize('SchemaCompare.Tables', "Tables");
export const TableValuedFunctions: string = localize('SchemaCompare.TableValuedFunctions', "Table Valued Functions");
export const UserDefinedDataTypes: string = localize('SchemaCompare.UserDefinedDataTypes', "User Defined Data Types");
export const UserDefinedTableTypes: string = localize('SchemaCompare.UserDefinedTableTypes', "User Defined Table Types");
export const ClrUserDefinedTypes: string = localize('SchemaCompare.ClrUserDefinedTypes', "Clr User Defined Types");
export const Users: string = localize('SchemaCompare.Users', "Users");
export const Views: string = localize('SchemaCompare.Views', "Views");
export const XmlSchemaCollections: string = localize('SchemaCompare.XmlSchemaCollections', "Xml Schema Collections");
export const Audits: string = localize('SchemaCompare.Audits', "Audits");
export const Credentials: string = localize('SchemaCompare.Credentials', "Credentials");
export const CryptographicProviders: string = localize('SchemaCompare.CryptographicProviders', "Cryptographic Providers");
export const DatabaseAuditSpecifications: string = localize('SchemaCompare.DatabaseAuditSpecifications', "Database Audit Specifications");
export const DatabaseEncryptionKeys: string = localize('SchemaCompare.DatabaseEncryptionKeys', "Database Encryption Keys");
export const DatabaseScopedCredentials: string = localize('SchemaCompare.DatabaseScopedCredentials', "Database Scoped Credentials");
export const Endpoints: string = localize('SchemaCompare.Endpoints', "Endpoints");
export const ErrorMessages: string = localize('SchemaCompare.ErrorMessages', "Error Messages");
export const EventNotifications: string = localize('SchemaCompare.EventNotifications', "Event Notifications");
export const EventSessions: string = localize('SchemaCompare.EventSessions', "Event Sessions");
export const LinkedServerLogins: string = localize('SchemaCompare.LinkedServerLogins', "Linked Server Logins");
export const LinkedServers: string = localize('SchemaCompare.LinkedServers', "Linked Servers");
export const Logins: string = localize('SchemaCompare.Logins', "Logins");
export const MasterKeys: string = localize('SchemaCompare.MasterKeys', "Master Keys");
export const Routes: string = localize('SchemaCompare.Routes', "Routes");
export const ServerAuditSpecifications: string = localize('SchemaCompare.ServerAuditSpecifications', "Server Audit Specifications");
export const ServerRoleMembership: string = localize('SchemaCompare.ServerRoleMembership', "Server Role Membership");
export const ServerRoles: string = localize('SchemaCompare.ServerRoles', "Server Roles");
export const ServerTriggers: string = localize('SchemaCompare.ServerTriggers', "Server Triggers");

// Error messages
export function compareErrorMessage(errorMessage: string): string { return localize('schemaCompare.compareErrorMessage', "Schema Compare failed: {0}", errorMessage ? errorMessage : 'Unknown'); }
export function saveScmpErrorMessage(errorMessage: string): string { return localize('schemaCompare.saveScmpErrorMessage', "Save scmp failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function cancelErrorMessage(errorMessage: string): string { return localize('schemaCompare.cancelErrorMessage', "Cancel schema compare failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function generateScriptErrorMessage(errorMessage: string): string { return localize('schemaCompare.generateScriptErrorMessage', "Generate script failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export function applyErrorMessage(errorMessage: string): string { return localize('schemaCompare.updateErrorMessage', "Schema Compare Apply failed '{0}'", errorMessage ? errorMessage : 'Unknown'); }
export function openScmpErrorMessage(errorMessage: string): string { return localize('schemaCompare.openScmpErrorMessage', "Open scmp failed: '{0}'", (errorMessage) ? errorMessage : 'Unknown'); }
export const applyError: string = localize('schemaCompare.applyError', "There was an error updating the project");
export const dspErrorSource: string = localize('schemaCompareDialog.dspErrorSource', "The source .sqlproj file does not specify a database schema component");
export const dspErrorTarget: string = localize('schemaCompareDialog.dspErrorTarget', "The target .sqlproj file does not specify a database schema component");
export const noProjectExtension: string = localize('schemaCompareDialog.noProjectExtension', "The sql-database-projects extension is required to perform schema comparison with database projects");
export const noProjectExtensionApply: string = localize('schemaCompareDialog.noProjectExtensionApply', "The sql-database-projects extension is required to apply changes to a project");

// Information messages
export const applySuccess: string = localize('schemaCompare.applySuccess', "Project was successfully updated");

// Extensions
export const sqlDatabaseProjectExtensionId: string = 'microsoft.sql-database-projects';

// Commands
export const sqlDatabaseProjectsPublishChanges: string = 'sqlDatabaseProjects.schemaComparePublishProjectChanges';
