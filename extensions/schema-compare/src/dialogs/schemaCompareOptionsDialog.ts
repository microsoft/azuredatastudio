/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { SchemaCompareMainWindow } from '../schemaCompareMainWindow';
import { isNullOrUndefined } from 'util';

const localize = nls.loadMessageBundle();

export class SchemaCompareOptionsDialog {

	//#region Localized strings

	private static readonly OkButtonText: string = localize('SchemaCompareOptionsDialog.Ok', 'OK');
	private static readonly CancelButtonText: string = localize('SchemaCompareOptionsDialog.Cancel', 'Cancel');
	private static readonly ResetButtonText: string = localize('SchemaCompareOptionsDialog.Reset', 'Reset');
	private static readonly YesButtonText: string = localize('SchemaCompareOptionsDialog.Yes', 'Yes');
	private static readonly NoButtonText: string = localize('SchemaCompareOptionsDialog.No', 'No');
	private static readonly OptionsChangedMessage: string = localize('schemaCompareOptions.RecompareMessage', 'Options have changed. Recompare to see the comparison?');
	private static readonly OptionsLabel: string = localize('SchemaCompare.SchemaCompareOptionsDialogLabel', 'Schema Compare Options');
	private static readonly GeneralOptionsLabel: string = localize('SchemaCompare.GeneralOptionsLabel', 'General Options');
	private static readonly ObjectTypesOptionsLabel: string = localize('SchemaCompare.ObjectTypesOptionsLabel', 'Include Object Types');

	private static readonly IgnoreTableOptions: string = localize('SchemaCompare.IgnoreTableOptions', 'Ignore Table Options');
	private static readonly IgnoreSemicolonBetweenStatements: string = localize('SchemaCompare.IgnoreSemicolonBetweenStatements', 'Ignore Semicolon Between Statements');
	private static readonly IgnoreRouteLifetime: string = localize('SchemaCompare.IgnoreRouteLifetime', 'Ignore Route Lifetime');
	private static readonly IgnoreRoleMembership: string = localize('SchemaCompare.IgnoreRoleMembership', 'Ignore Role Membership');
	private static readonly IgnoreQuotedIdentifiers: string = localize('SchemaCompare.IgnoreQuotedIdentifiers', 'Ignore Quoted Identifiers');
	private static readonly IgnorePermissions: string = localize('SchemaCompare.IgnorePermissions', 'Ignore Permissions');
	private static readonly IgnorePartitionSchemes: string = localize('SchemaCompare.IgnorePartitionSchemes', 'Ignore Partition Schemes');
	private static readonly IgnoreObjectPlacementOnPartitionScheme: string = localize('SchemaCompare.IgnoreObjectPlacementOnPartitionScheme', 'Ignore Object Placement On Partition Scheme');
	private static readonly IgnoreNotForReplication: string = localize('SchemaCompare.IgnoreNotForReplication', 'Ignore Not For Replication');
	private static readonly IgnoreLoginSids: string = localize('SchemaCompare.IgnoreLoginSids', 'Ignore Login Sids');
	private static readonly IgnoreLockHintsOnIndexes: string = localize('SchemaCompare.IgnoreLockHintsOnIndexes', 'Ignore Lock Hints On Indexes');
	private static readonly IgnoreKeywordCasing: string = localize('SchemaCompare.IgnoreKeywordCasing', 'Ignore Keyword Casing');
	private static readonly IgnoreIndexPadding: string = localize('SchemaCompare.IgnoreIndexPadding', 'Ignore Index Padding');
	private static readonly IgnoreIndexOptions: string = localize('SchemaCompare.IgnoreIndexOptions', 'Ignore Index Options');
	private static readonly IgnoreIncrement: string = localize('SchemaCompare.IgnoreIncrement', 'Ignore Increment');
	private static readonly IgnoreIdentitySeed: string = localize('SchemaCompare.IgnoreIdentitySeed', 'Ignore Identity Seed');
	private static readonly IgnoreUserSettingsObjects: string = localize('SchemaCompare.IgnoreUserSettingsObjects', 'Ignore User Settings Objects');
	private static readonly IgnoreFullTextCatalogFilePath: string = localize('SchemaCompare.IgnoreFullTextCatalogFilePath', 'Ignore Full Text Catalog FilePath');
	private static readonly IgnoreWhitespace: string = localize('SchemaCompare.IgnoreWhitespace', 'Ignore Whitespace');
	private static readonly IgnoreWithNocheckOnForeignKeys: string = localize('SchemaCompare.IgnoreWithNocheckOnForeignKeys', 'Ignore With Nocheck On ForeignKeys');
	private static readonly VerifyCollationCompatibility: string = localize('SchemaCompare.VerifyCollationCompatibility', 'Verify Collation Compatibility');
	private static readonly UnmodifiableObjectWarnings: string = localize('SchemaCompare.UnmodifiableObjectWarnings', 'Unmodifiable Object Warnings');
	private static readonly TreatVerificationErrorsAsWarnings: string = localize('SchemaCompare.TreatVerificationErrorsAsWarnings', 'Treat Verification Errors As Warnings');
	private static readonly ScriptRefreshModule: string = localize('SchemaCompare.ScriptRefreshModule', 'Script Refresh Module');
	private static readonly ScriptNewConstraintValidation: string = localize('SchemaCompare.ScriptNewConstraintValidation', 'Script New Constraint Validation');
	private static readonly ScriptFileSize: string = localize('SchemaCompare.ScriptFileSize', 'Script File Size');
	private static readonly ScriptDeployStateChecks: string = localize('SchemaCompare.ScriptDeployStateChecks', 'Script Deploy StateChecks');
	private static readonly ScriptDatabaseOptions: string = localize('SchemaCompare.ScriptDatabaseOptions', 'Script Database Options');
	private static readonly ScriptDatabaseCompatibility: string = localize('SchemaCompare.ScriptDatabaseCompatibility', 'Script Database Compatibility');
	private static readonly ScriptDatabaseCollation: string = localize('SchemaCompare.ScriptDatabaseCollation', 'Script Database Collation');
	private static readonly RunDeploymentPlanExecutors: string = localize('SchemaCompare.RunDeploymentPlanExecutors', 'Run Deployment Plan Executors');
	private static readonly RegisterDataTierApplication: string = localize('SchemaCompare.RegisterDataTierApplication', 'Register DataTier Application');
	private static readonly PopulateFilesOnFileGroups: string = localize('SchemaCompare.PopulateFilesOnFileGroups', 'Populate Files On File Groups');
	private static readonly NoAlterStatementsToChangeClrTypes: string = localize('SchemaCompare.NoAlterStatementsToChangeClrTypes', 'No Alter Statements To Change Clr Types');
	private static readonly IncludeTransactionalScripts: string = localize('SchemaCompare.IncludeTransactionalScripts', 'Include Transactional Scripts');
	private static readonly IncludeCompositeObjects: string = localize('SchemaCompare.IncludeCompositeObjects', 'Include Composite Objects');
	private static readonly AllowUnsafeRowLevelSecurityDataMovement: string = localize('SchemaCompare.AllowUnsafeRowLevelSecurityDataMovement', 'Allow Unsafe Row Level Security Data Movement');
	private static readonly IgnoreWithNocheckOnCheckConstraints: string = localize('SchemaCompare.IgnoreWithNocheckOnCheckConstraints', 'Ignore With No check On Check Constraints');
	private static readonly IgnoreFillFactor: string = localize('SchemaCompare.IgnoreFillFactor', 'Ignore Fill Factor');
	private static readonly IgnoreFileSize: string = localize('SchemaCompare.IgnoreFileSize', 'Ignore File Size');
	private static readonly IgnoreFilegroupPlacement: string = localize('SchemaCompare.IgnoreFilegroupPlacement', 'Ignore Filegroup Placement');
	private static readonly DoNotAlterReplicatedObjects: string = localize('SchemaCompare.DoNotAlterReplicatedObjects', 'Do Not Alter Replicated Objects');
	private static readonly DoNotAlterChangeDataCaptureObjects: string = localize('SchemaCompare.DoNotAlterChangeDataCaptureObjects', 'Do Not Alter Change Data Capture Objects');
	private static readonly DisableAndReenableDdlTriggers: string = localize('SchemaCompare.DisableAndReenableDdlTriggers', 'Disable And Reenable Ddl Triggers');
	private static readonly DeployDatabaseInSingleUserMode: string = localize('SchemaCompare.DeployDatabaseInSingleUserMode', 'Deploy Database In Single User Mode');
	private static readonly CreateNewDatabase: string = localize('SchemaCompare.CreateNewDatabase', 'Create New Database');
	private static readonly CompareUsingTargetCollation: string = localize('SchemaCompare.CompareUsingTargetCollation', 'Compare Using Target Collation');
	private static readonly CommentOutSetVarDeclarations: string = localize('SchemaCompare.CommentOutSetVarDeclarations', 'Comment Out Set Var Declarations');
	private static readonly BlockWhenDriftDetected: string = localize('SchemaCompare.BlockWhenDriftDetected', 'Block When Drift Detected');
	private static readonly BlockOnPossibleDataLoss: string = localize('SchemaCompare.BlockOnPossibleDataLoss', 'Block On Possible Data Loss');
	private static readonly BackupDatabaseBeforeChanges: string = localize('SchemaCompare.BackupDatabaseBeforeChanges', 'Backup Database Before Changes');
	private static readonly AllowIncompatiblePlatform: string = localize('SchemaCompare.AllowIncompatiblePlatform', 'Allow Incompatible Platform');
	private static readonly AllowDropBlockingAssemblies: string = localize('SchemaCompare.AllowDropBlockingAssemblies', 'Allow Drop Blocking Assemblies');
	private static readonly DropConstraintsNotInSource: string = localize('SchemaCompare.DropConstraintsNotInSource', 'Drop Constraints Not In Source');
	private static readonly DropDmlTriggersNotInSource: string = localize('SchemaCompare.DropDmlTriggersNotInSource', 'Drop Dml Triggers Not In Source');
	private static readonly DropExtendedPropertiesNotInSource: string = localize('SchemaCompare.DropExtendedPropertiesNotInSource', 'Drop Extended Properties Not In Source');
	private static readonly DropIndexesNotInSource: string = localize('SchemaCompare.DropIndexesNotInSource', 'Drop Indexes Not In Source');
	private static readonly IgnoreFileAndLogFilePath: string = localize('SchemaCompare.IgnoreFileAndLogFilePath', 'Ignore File And Log File Path');
	private static readonly IgnoreExtendedProperties: string = localize('SchemaCompare.IgnoreExtendedProperties', 'Ignore Extended Properties');
	private static readonly IgnoreDmlTriggerState: string = localize('SchemaCompare.IgnoreDmlTriggerState', 'Ignore Dml Trigger State');
	private static readonly IgnoreDmlTriggerOrder: string = localize('SchemaCompare.IgnoreDmlTriggerOrder', 'Ignore Dml Trigger Order');
	private static readonly IgnoreDefaultSchema: string = localize('SchemaCompare.IgnoreDefaultSchema', 'Ignore Default Schema');
	private static readonly IgnoreDdlTriggerState: string = localize('SchemaCompare.IgnoreDdlTriggerState', 'Ignore Ddl Trigger State');
	private static readonly IgnoreDdlTriggerOrder: string = localize('SchemaCompare.IgnoreDdlTriggerOrder', 'Ignore Ddl Trigger Order');
	private static readonly IgnoreCryptographicProviderFilePath: string = localize('SchemaCompare.IgnoreCryptographicProviderFilePath', 'Ignore Cryptographic Provider FilePath');
	private static readonly VerifyDeployment: string = localize('SchemaCompare.VerifyDeployment', 'Verify Deployment');
	private static readonly IgnoreComments: string = localize('SchemaCompare.IgnoreComments', 'Ignore Comments');
	private static readonly IgnoreColumnCollation: string = localize('SchemaCompare.IgnoreColumnCollation', 'Ignore Column Collation');
	private static readonly IgnoreAuthorizer: string = localize('SchemaCompare.IgnoreAuthorizer', 'Ignore Authorizer');
	private static readonly IgnoreAnsiNulls: string = localize('SchemaCompare.IgnoreAnsiNulls', 'Ignore AnsiNulls');
	private static readonly GenerateSmartDefaults: string = localize('SchemaCompare.GenerateSmartDefaults', 'Generate SmartDefaults');
	private static readonly DropStatisticsNotInSource: string = localize('SchemaCompare.DropStatisticsNotInSource', 'Drop Statistics Not In Source');
	private static readonly DropRoleMembersNotInSource: string = localize('SchemaCompare.DropRoleMembersNotInSource', 'Drop Role Members Not In Source');
	private static readonly DropPermissionsNotInSource: string = localize('SchemaCompare.DropPermissionsNotInSource', 'Drop Permissions Not In Source');
	private static readonly DropObjectsNotInSource: string = localize('SchemaCompare.DropObjectsNotInSource', 'Drop Objects Not In Source');
	private static readonly IgnoreColumnOrder: string = localize('SchemaCompare.IgnoreColumnOrder', 'Ignore Column Order');

	private static readonly Aggregates: string = localize('SchemaCompare.Aggregates', 'Aggregates');
	private static readonly ApplicationRoles: string = localize('SchemaCompare.ApplicationRoles', 'Application Roles');
	private static readonly Assemblies: string = localize('SchemaCompare.Assemblies', 'Assemblies');
	private static readonly AssemblyFiles: string = localize('SchemaCompare.AssemblyFiles', 'Assembly Files');
	private static readonly AsymmetricKeys: string = localize('SchemaCompare.AsymmetricKeys', 'Asymmetric Keys');
	private static readonly BrokerPriorities: string = localize('SchemaCompare.BrokerPriorities', 'Broker Priorities');
	private static readonly Certificates: string = localize('SchemaCompare.Certificates', 'Certificates');
	private static readonly ColumnEncryptionKeys: string = localize('SchemaCompare.ColumnEncryptionKeys', 'Column Encryption Keys');
	private static readonly ColumnMasterKeys: string = localize('SchemaCompare.ColumnMasterKeys', 'Column Master Keys');
	private static readonly Contracts: string = localize('SchemaCompare.Contracts', 'Contracts');
	private static readonly DatabaseOptions: string = localize('SchemaCompare.DatabaseOptions', 'Database Options');
	private static readonly DatabaseRoles: string = localize('SchemaCompare.DatabaseRoles', 'Database Roles');
	private static readonly DatabaseTriggers: string = localize('SchemaCompare.DatabaseTriggers', 'DatabaseTriggers');
	private static readonly Defaults: string = localize('SchemaCompare.Defaults', 'Defaults');
	private static readonly ExtendedProperties: string = localize('SchemaCompare.ExtendedProperties', 'Extended Properties');
	private static readonly ExternalDataSources: string = localize('SchemaCompare.ExternalDataSources', 'External Data Sources');
	private static readonly ExternalFileFormats: string = localize('SchemaCompare.ExternalFileFormats', 'External File Formats');
	private static readonly ExternalTables: string = localize('SchemaCompare.ExternalTables', 'External Tables');
	private static readonly Filegroups: string = localize('SchemaCompare.Filegroups', 'Filegroups');
	private static readonly Files: string = localize('SchemaCompare.Files', 'Files');
	private static readonly FileTables: string = localize('SchemaCompare.FileTables', 'File Tables');
	private static readonly FullTextCatalogs: string = localize('SchemaCompare.FullTextCatalogs', 'Full Text Catalogs');
	private static readonly FullTextStoplists: string = localize('SchemaCompare.FullTextStoplists', 'Full Text Stoplists');
	private static readonly MessageTypes: string = localize('SchemaCompare.MessageTypes', 'Message Types');
	private static readonly PartitionFunctions: string = localize('SchemaCompare.PartitionFunctions', 'Partition Functions');
	private static readonly PartitionSchemes: string = localize('SchemaCompare.PartitionSchemes', 'Partition Schemes');
	private static readonly Permissions: string = localize('SchemaCompare.Permissions', 'Permissions');
	private static readonly Queues: string = localize('SchemaCompare.Queues', 'Queues');
	private static readonly RemoteServiceBindings: string = localize('SchemaCompare.RemoteServiceBindings', 'Remote Service Bindings');
	private static readonly RoleMembership: string = localize('SchemaCompare.RoleMembership', 'Role Membership');
	private static readonly Rules: string = localize('SchemaCompare.Rules', 'Rules');
	private static readonly ScalarValuedFunctions: string = localize('SchemaCompare.ScalarValuedFunctions', 'Scalar Valued Functions');
	private static readonly SearchPropertyLists: string = localize('SchemaCompare.SearchPropertyLists', 'Search Property Lists');
	private static readonly SecurityPolicies: string = localize('SchemaCompare.SecurityPolicies', 'Security Policies');
	private static readonly Sequences: string = localize('SchemaCompare.Sequences', 'Sequences');
	private static readonly Services: string = localize('SchemaCompare.Services', 'Services');
	private static readonly Signatures: string = localize('SchemaCompare.Signatures', 'Signatures');
	private static readonly StoredProcedures: string = localize('SchemaCompare.StoredProcedures', 'StoredProcedures');
	private static readonly SymmetricKeys: string = localize('SchemaCompare.SymmetricKeys', 'SymmetricKeys');
	private static readonly Synonyms: string = localize('SchemaCompare.Synonyms', 'Synonyms');
	private static readonly Tables: string = localize('SchemaCompare.Tables', 'Tables');
	private static readonly TableValuedFunctions: string = localize('SchemaCompare.TableValuedFunctions', 'Table Valued Functions');
	private static readonly UserDefinedDataTypes: string = localize('SchemaCompare.UserDefinedDataTypes', 'User Defined Data Types');
	private static readonly UserDefinedTableTypes: string = localize('SchemaCompare.UserDefinedTableTypes', 'User Defined Table Types');
	private static readonly ClrUserDefinedTypes: string = localize('SchemaCompare.ClrUserDefinedTypes', 'Clr User Defined Types');
	private static readonly Users: string = localize('SchemaCompare.Users', 'Users');
	private static readonly Views: string = localize('SchemaCompare.Views', 'Views');
	private static readonly XmlSchemaCollections: string = localize('SchemaCompare.XmlSchemaCollections', 'Xml Schema Collections');
	private static readonly Audits: string = localize('SchemaCompare.Audits', 'Audits');
	private static readonly Credentials: string = localize('SchemaCompare.Credentials', 'Credentials');
	private static readonly CryptographicProviders: string = localize('SchemaCompare.CryptographicProviders', 'Cryptographic Providers');
	private static readonly DatabaseAuditSpecifications: string = localize('SchemaCompare.DatabaseAuditSpecifications', 'Database Audit Specifications');
	private static readonly DatabaseEncryptionKeys: string = localize('SchemaCompare.DatabaseEncryptionKeys', 'Database Encryption Keys');
	private static readonly DatabaseScopedCredentials: string = localize('SchemaCompare.DatabaseScopedCredentials', 'Database Scoped Credentials');
	private static readonly Endpoints: string = localize('SchemaCompare.Endpoints', 'Endpoints');
	private static readonly ErrorMessages: string = localize('SchemaCompare.ErrorMessages', 'Error Messages');
	private static readonly EventNotifications: string = localize('SchemaCompare.EventNotifications', 'Event Notifications');
	private static readonly EventSessions: string = localize('SchemaCompare.EventSessions', 'Event Sessions');
	private static readonly LinkedServerLogins: string = localize('SchemaCompare.LinkedServerLogins', 'Linked Server Logins');
	private static readonly LinkedServers: string = localize('SchemaCompare.LinkedServers', 'Linked Servers');
	private static readonly Logins: string = localize('SchemaCompare.Logins', 'Logins');
	private static readonly MasterKeys: string = localize('SchemaCompare.MasterKeys', 'Master Keys');
	private static readonly Routes: string = localize('SchemaCompare.Routes', 'Routes');
	private static readonly ServerAuditSpecifications: string = localize('SchemaCompare.ServerAuditSpecifications', 'Server Audit Specifications');
	private static readonly ServerRoleMembership: string = localize('SchemaCompare.ServerRoleMembership', 'Server Role Membership');
	private static readonly ServerRoles: string = localize('SchemaCompare.ServerRoles', 'Server Roles');
	private static readonly ServerTriggers: string = localize('SchemaCompare.ServerTriggers', 'Server Triggers');

	private static readonly descriptionIgnoreTableOptions: string = localize('SchemaCompare.Description.IgnoreTableOptions', 'Specifies whether differences in the table options will be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreSemicolonBetweenStatements: string = localize('SchemaCompare.Description.IgnoreSemicolonBetweenStatements', 'Specifies whether differences in the semi-colons between T-SQL statements will be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreRouteLifetime: string = localize('SchemaCompare.Description.IgnoreRouteLifetime', 'Specifies whether differences in the amount of time that SQL Server retains the route in the routing table should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreRoleMembership: string = localize('SchemaCompare.Description.IgnoreRoleMembership', 'Specifies whether differences in the role membership of logins should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreQuotedIdentifiers: string = localize('SchemaCompare.Description.IgnoreQuotedIdentifiers', 'Specifies whether differences in the quoted identifiers setting should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnorePermissions: string = localize('SchemaCompare.Description.IgnorePermissions', 'Specifies whether permissions should be ignored.');
	private static readonly descriptionIgnorePartitionSchemes: string = localize('SchemaCompare.Description.IgnorePartitionSchemes', 'Specifies whether differences in partition schemes and functions should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreObjectPlacementOnPartitionScheme: string = localize('SchemaCompare.Description.IgnoreObjectPlacementOnPartitionScheme', 'Specifies whether an object\'s placement on a partition scheme should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreNotForReplication: string = localize('SchemaCompare.Description.IgnoreNotForReplication', 'Specifies whether the not for replication settings should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreLoginSids: string = localize('SchemaCompare.Description.IgnoreLoginSids', 'Specifies whether differences in the security identification number (SID) should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreLockHintsOnIndexes: string = localize('SchemaCompare.Description.IgnoreLockHintsOnIndexes', 'Specifies whether differences in the lock hints on indexes should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreKeywordCasing: string = localize('SchemaCompare.Description.IgnoreKeywordCasing', 'Specifies whether differences in the casing of keywords should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreIndexPadding: string = localize('SchemaCompare.Description.IgnoreIndexPadding', 'Specifies whether differences in the index padding should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreIndexOptions: string = localize('SchemaCompare.Description.IgnoreIndexOptions', 'Specifies whether differences in the index options should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreIncrement: string = localize('SchemaCompare.Description.IgnoreIncrement', 'Specifies whether differences in the increment for an identity column should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreIdentitySeed: string = localize('SchemaCompare.Description.IgnoreIdentitySeed', 'Specifies whether differences in the seed for an identity column should be ignored or updated when you publish updates to a database.');
	private static readonly descriptionIgnoreUserSettingsObjects: string = localize('SchemaCompare.Description.IgnoreUserSettingsObjects', 'Specifies whether differences in the user settings objects will be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreFullTextCatalogFilePath: string = localize('SchemaCompare.Description.IgnoreFullTextCatalogFilePath', 'Specifies whether differences in the file path for the full-text catalog should be ignored or whether a warning should be issued when you publish to a database.');
	private static readonly descriptionIgnoreWhitespace: string = localize('SchemaCompare.Description.IgnoreWhitespace', 'Specifies whether differences in white space will be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreWithNocheckOnForeignKeys: string = localize('SchemaCompare.Description.IgnoreWithNocheckOnForeignKeys', 'Specifies whether differences in the value of the WITH NOCHECK clause for foreign keys will be ignored or updated when you publish to a database.');
	private static readonly descriptionVerifyCollationCompatibility: string = localize('SchemaCompare.Description.VerifyCollationCompatibility', 'Specifies whether collation compatibility is verified.');
	private static readonly descriptionUnmodifiableObjectWarnings: string = localize('SchemaCompare.Description.UnmodifiableObjectWarnings', 'Specifies whether warnings should be generated when differences are found in objects that cannot be modified, for example, if the file size or file paths were different for a file.');
	private static readonly descriptionTreatVerificationErrorsAsWarnings: string = localize('SchemaCompare.Description.TreatVerificationErrorsAsWarnings', 'Specifies whether errors encountered during publish verification should be treated as warnings. The check is performed against the generated deployment plan before the plan is executed against your target database. Plan verification detects problems such as the loss of target-only objects (such as indexes) that must be dropped to make a change. Verification will also detect situations where dependencies (such as a table or view) exist because of a reference to a composite project, but do not exist in the target database. You might choose to do this to get a complete list of all issues, instead of having the publish action stop on the first error.');
	private static readonly descriptionScriptRefreshModule: string = localize('SchemaCompare.Description.ScriptRefreshModule', 'Include refresh statements at the end of the publish script.');
	private static readonly descriptionScriptNewConstraintValidation: string = localize('SchemaCompare.Description.ScriptNewConstraintValidation', 'At the end of publish all of the constraints will be verified as one set, avoiding data errors caused by a check or foreign key constraint in the middle of publish. If set to False, your constraints will be published without checking the corresponding data.');
	private static readonly descriptionScriptFileSize: string = localize('SchemaCompare.Description.ScriptFileSize', 'Controls whether size is specified when adding a file to a filegroup.');
	private static readonly descriptionScriptDeployStateChecks: string = localize('SchemaCompare.Description.ScriptDeployStateChecks', 'Specifies whether statements are generated in the publish script to verify that the database name and server name match the names specified in the database project.');
	private static readonly descriptionScriptDatabaseOptions: string = localize('SchemaCompare.Description.ScriptDatabaseOptions', 'Specifies whether target database properties should be set or updated as part of the publish action.');
	private static readonly descriptionScriptDatabaseCompatibility: string = localize('SchemaCompare.Description.ScriptDatabaseCompatibility', 'Specifies whether differences in the database compatibility should be ignored or updated when you publish to a database.');
	private static readonly descriptionScriptDatabaseCollation: string = localize('SchemaCompare.Description.ScriptDatabaseCollation', 'Specifies whether differences in the database collation should be ignored or updated when you publish to a database.');
	private static readonly descriptionRunDeploymentPlanExecutors: string = localize('SchemaCompare.Description.RunDeploymentPlanExecutors', 'Specifies whether DeploymentPlanExecutor contributors should be run when other operations are executed.');
	private static readonly descriptionRegisterDataTierApplication: string = localize('SchemaCompare.Description.RegisterDataTierApplication', 'Specifies whether the schema is registered with the database server.');
	private static readonly descriptionPopulateFilesOnFileGroups: string = localize('SchemaCompare.Description.PopulateFilesOnFileGroups', 'Specifies whether a new file is also created when a new FileGroup is created in the target database.');
	private static readonly descriptionNoAlterStatementsToChangeClrTypes: string = localize('SchemaCompare.Description.NoAlterStatementsToChangeClrTypes', 'Specifies that publish should always drop and re-create an assembly if there is a difference instead of issuing an ALTER ASSEMBLY statement');
	private static readonly descriptionIncludeTransactionalScripts: string = localize('SchemaCompare.Description.IncludeTransactionalScripts', 'Specifies whether transactional statements should be used where possible when you publish to a database.');
	private static readonly descriptionIncludeCompositeObjects: string = localize('SchemaCompare.Description.IncludeCompositeObjects', 'Include all composite elements as part of a single publish operation.');
	private static readonly descriptionAllowUnsafeRowLevelSecurityDataMovement: string = localize('SchemaCompare.Description.AllowUnsafeRowLevelSecurityDataMovement', 'Do not block data motion on a table which has Row Level Security if this property is set to true. Default is false.');
	private static readonly descriptionIgnoreWithNocheckOnCheckConstraints: string = localize('SchemaCompare.Description.IgnoreWithNocheckOnCheckConstraints', 'Specifies whether differences in the value of the WITH NOCHECK clause for check constraints will be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreFillFactor: string = localize('SchemaCompare.Description.IgnoreFillFactor', 'Specifies whether differences in the fill factor for index storage should be ignored or whether a warning should be issued when you publish to a database.');
	private static readonly descriptionIgnoreFileSize: string = localize('SchemaCompare.Description.IgnoreFileSize', 'Specifies whether differences in the file sizes should be ignored or whether a warning should be issued when you publish to a database.');
	private static readonly descriptionIgnoreFilegroupPlacement: string = localize('SchemaCompare.Description.IgnoreFilegroupPlacement', 'Specifies whether differences in the placement of objects in FILEGROUPs should be ignored or updated when you publish to a database.');
	private static readonly descriptionDoNotAlterReplicatedObjects: string = localize('SchemaCompare.Description.DoNotAlterReplicatedObjects', 'Specifies whether objects that are replicated are identified during verification.');
	private static readonly descriptionDoNotAlterChangeDataCaptureObjects: string = localize('SchemaCompare.Description.DoNotAlterChangeDataCaptureObjects', 'If true, Change Data Capture objects are not altered.');
	private static readonly descriptionDisableAndReenableDdlTriggers: string = localize('SchemaCompare.Description.DisableAndReenableDdlTriggers', 'Specifies whether Data Definition Language (DDL) triggers are disabled at the beginning of the publish process and re-enabled at the end of the publish action.');
	private static readonly descriptionDeployDatabaseInSingleUserMode: string = localize('SchemaCompare.Description.DeployDatabaseInSingleUserMode', 'If true, the database is set to Single User Mode before deploying.');
	private static readonly descriptionCreateNewDatabase: string = localize('SchemaCompare.Description.CreateNewDatabase', 'Specifies whether the target database should be updated or whether it should be dropped and re-created when you publish to a database.');
	private static readonly descriptionCompareUsingTargetCollation: string = localize('SchemaCompare.Description.CompareUsingTargetCollation', 'This setting dictates how the database\'s collation is handled during deployment; by default the target database\'s collation will be updated if it does not match the collation specified by the source.  When this option is set, the target database\'s (or server\'s) collation should be used.');
	private static readonly descriptionCommentOutSetVarDeclarations: string = localize('SchemaCompare.Description.CommentOutSetVarDeclarations', 'Specifies whether the declaration of SETVAR variables should be commented out in the generated publish script. You might choose to do this if you plan to specify the values on the command line when you publish by using a tool such as SQLCMD.EXE.');
	private static readonly descriptionBlockWhenDriftDetected: string = localize('SchemaCompare.Description.BlockWhenDriftDetected', 'Specifies whether to block updating a database whose schema no longer matches its registration or is unregistered.');
	private static readonly descriptionBlockOnPossibleDataLoss: string = localize('SchemaCompare.Description.BlockOnPossibleDataLoss', 'Specifies that the publish episode should be terminated if there is a possibility of data loss resulting from the publish operation.');
	private static readonly descriptionBackupDatabaseBeforeChanges: string = localize('SchemaCompare.Description.BackupDatabaseBeforeChanges', 'Backups the database before deploying any changes.');
	private static readonly descriptionAllowIncompatiblePlatform: string = localize('SchemaCompare.Description.AllowIncompatiblePlatform', 'Specifies whether to attempt the action despite incompatible SQL Server platforms.');
	private static readonly descriptionAllowDropBlockingAssemblies: string = localize('SchemaCompare.Description.AllowDropBlockingAssemblies', 'This property is used by SqlClr deployment to cause any blocking assemblies to be dropped as part of the deployment plan. By default, any blocking/referencing assemblies will block an assembly update if the referencing assembly needs to be dropped.');
	private static readonly descriptionDropConstraintsNotInSource: string = localize('SchemaCompare.Description.DropConstraintsNotInSource', 'Specifies whether constraints that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.');
	private static readonly descriptionDropDmlTriggersNotInSource: string = localize('SchemaCompare.Description.DropDmlTriggersNotInSource', 'Specifies whether DML triggers that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.');
	private static readonly descriptionDropExtendedPropertiesNotInSource: string = localize('SchemaCompare.Description.DropExtendedPropertiesNotInSource', 'Specifies whether extended properties that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.');
	private static readonly descriptionDropIndexesNotInSource: string = localize('SchemaCompare.Description.DropIndexesNotInSource', 'Specifies whether indexes that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.');
	private static readonly descriptionIgnoreFileAndLogFilePath: string = localize('SchemaCompare.Description.IgnoreFileAndLogFilePath', 'Specifies whether differences in the paths for files and log files should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreExtendedProperties: string = localize('SchemaCompare.Description.IgnoreExtendedProperties', 'Specifies whether extended properties should be ignored.');
	private static readonly descriptionIgnoreDmlTriggerState: string = localize('SchemaCompare.Description.IgnoreDmlTriggerState', 'Specifies whether differences in the enabled or disabled state of DML triggers should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreDmlTriggerOrder: string = localize('SchemaCompare.Description.IgnoreDmlTriggerOrder', 'Specifies whether differences in the order of Data Manipulation Language (DML) triggers should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreDefaultSchema: string = localize('SchemaCompare.Description.IgnoreDefaultSchema', 'Specifies whether differences in the default schema should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreDdlTriggerState: string = localize('SchemaCompare.Description.IgnoreDdlTriggerState', 'Specifies whether differences in the enabled or disabled state of Data Definition Language (DDL) triggers should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreDdlTriggerOrder: string = localize('SchemaCompare.Description.IgnoreDdlTriggerOrder', 'Specifies whether differences in the order of Data Definition Language (DDL) triggers should be ignored or updated when you publish to a database or server.');
	private static readonly descriptionIgnoreCryptographicProviderFilePath: string = localize('SchemaCompare.Description.IgnoreCryptographicProviderFilePath', 'Specifies whether differences in the file path for the cryptographic provider should be ignored or updated when you publish to a database.');
	private static readonly descriptionVerifyDeployment: string = localize('SchemaCompare.Description.VerifyDeployment', 'Specifies whether checks should be performed before publishing that will stop the publish action if issues are present that might block successful publishing. For example, your publish action might stop if you have foreign keys on the target database that do not exist in the database project, and that will cause errors when you publish.');
	private static readonly descriptionIgnoreComments: string = localize('SchemaCompare.Description.IgnoreComments', 'Specifies whether differences in the comments should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreColumnCollation: string = localize('SchemaCompare.Description.IgnoreColumnCollation', 'Specifies whether differences in the column collations should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreAuthorizer: string = localize('SchemaCompare.Description.IgnoreAuthorizer', 'Specifies whether differences in the Authorizer should be ignored or updated when you publish to a database.');
	private static readonly descriptionIgnoreAnsiNulls: string = localize('SchemaCompare.Description.IgnoreAnsiNulls', 'Specifies whether differences in the ANSI NULLS setting should be ignored or updated when you publish to a database.');
	private static readonly descriptionGenerateSmartDefaults: string = localize('SchemaCompare.Description.GenerateSmartDefaults', 'Automatically provides a default value when updating a table that contains data with a column that does not allow null values.');
	private static readonly descriptionDropStatisticsNotInSource: string = localize('SchemaCompare.Description.DropStatisticsNotInSource', 'Specifies whether statistics that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.');
	private static readonly descriptionDropRoleMembersNotInSource: string = localize('SchemaCompare.Description.DropRoleMembersNotInSource', 'Specifies whether role members that are not defined in the database snapshot (.dacpac) file will be dropped from the target database when you publish updates to a database.</');
	private static readonly descriptionDropPermissionsNotInSource: string = localize('SchemaCompare.Description.DropPermissionsNotInSource', 'Specifies whether permissions that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish updates to a database.');
	private static readonly descriptionDropObjectsNotInSource: string = localize('SchemaCompare.Description.DropObjectsNotInSource', 'Specifies whether objects that do not exist in the database snapshot (.dacpac) file will be dropped from the target database when you publish to a database.  This value takes precedence over DropExtendedProperties.');
	private static readonly descriptionIgnoreColumnOrder: string = localize('SchemaCompare.Description.IgnoreColumnOrder', 'Specifies whether differences in table column order should be ignored or updated when you publish to a database.');

	//#endregion

	public dialog: azdata.window.Dialog;
	public deploymentOptions: mssql.DeploymentOptions;

	private generalOptionsTab: azdata.window.DialogTab;
	private objectTypesTab: azdata.window.DialogTab;
	private optionsFlexBuilder: azdata.FlexContainer;
	private objectTypesFlexBuilder: azdata.FlexContainer;

	private descriptionHeading: azdata.TableComponent;
	private descriptionText: azdata.TextComponent;
	private optionsTable: azdata.TableComponent;
	private objectsTable: azdata.TableComponent;
	private optionsLookup = {};
	private objectsLookup = {};
	private disposableListeners: vscode.Disposable[] = [];

	private excludedObjectTypes: mssql.SchemaObjectType[] = [];
	private optionsChanged: boolean = false;

	private optionsLabels: string[] = [
		SchemaCompareOptionsDialog.IgnoreTableOptions,
		SchemaCompareOptionsDialog.IgnoreSemicolonBetweenStatements,
		SchemaCompareOptionsDialog.IgnoreRouteLifetime,
		SchemaCompareOptionsDialog.IgnoreRoleMembership,
		SchemaCompareOptionsDialog.IgnoreQuotedIdentifiers,
		SchemaCompareOptionsDialog.IgnorePermissions,
		SchemaCompareOptionsDialog.IgnorePartitionSchemes,
		SchemaCompareOptionsDialog.IgnoreObjectPlacementOnPartitionScheme,
		SchemaCompareOptionsDialog.IgnoreNotForReplication,
		SchemaCompareOptionsDialog.IgnoreLoginSids,
		SchemaCompareOptionsDialog.IgnoreLockHintsOnIndexes,
		SchemaCompareOptionsDialog.IgnoreKeywordCasing,
		SchemaCompareOptionsDialog.IgnoreIndexPadding,
		SchemaCompareOptionsDialog.IgnoreIndexOptions,
		SchemaCompareOptionsDialog.IgnoreIncrement,
		SchemaCompareOptionsDialog.IgnoreIdentitySeed,
		SchemaCompareOptionsDialog.IgnoreUserSettingsObjects,
		SchemaCompareOptionsDialog.IgnoreFullTextCatalogFilePath,
		SchemaCompareOptionsDialog.IgnoreWhitespace,
		SchemaCompareOptionsDialog.IgnoreWithNocheckOnForeignKeys,
		SchemaCompareOptionsDialog.VerifyCollationCompatibility,
		SchemaCompareOptionsDialog.UnmodifiableObjectWarnings,
		SchemaCompareOptionsDialog.TreatVerificationErrorsAsWarnings,
		SchemaCompareOptionsDialog.ScriptRefreshModule,
		SchemaCompareOptionsDialog.ScriptNewConstraintValidation,
		SchemaCompareOptionsDialog.ScriptFileSize,
		SchemaCompareOptionsDialog.ScriptDeployStateChecks,
		SchemaCompareOptionsDialog.ScriptDatabaseOptions,
		SchemaCompareOptionsDialog.ScriptDatabaseCompatibility,
		SchemaCompareOptionsDialog.ScriptDatabaseCollation,
		SchemaCompareOptionsDialog.RunDeploymentPlanExecutors,
		SchemaCompareOptionsDialog.RegisterDataTierApplication,
		SchemaCompareOptionsDialog.PopulateFilesOnFileGroups,
		SchemaCompareOptionsDialog.NoAlterStatementsToChangeClrTypes,
		SchemaCompareOptionsDialog.IncludeTransactionalScripts,
		SchemaCompareOptionsDialog.IncludeCompositeObjects,
		SchemaCompareOptionsDialog.AllowUnsafeRowLevelSecurityDataMovement,
		SchemaCompareOptionsDialog.IgnoreWithNocheckOnCheckConstraints,
		SchemaCompareOptionsDialog.IgnoreFillFactor,
		SchemaCompareOptionsDialog.IgnoreFileSize,
		SchemaCompareOptionsDialog.IgnoreFilegroupPlacement,
		SchemaCompareOptionsDialog.DoNotAlterReplicatedObjects,
		SchemaCompareOptionsDialog.DoNotAlterChangeDataCaptureObjects,
		SchemaCompareOptionsDialog.DisableAndReenableDdlTriggers,
		SchemaCompareOptionsDialog.DeployDatabaseInSingleUserMode,
		SchemaCompareOptionsDialog.CreateNewDatabase,
		SchemaCompareOptionsDialog.CompareUsingTargetCollation,
		SchemaCompareOptionsDialog.CommentOutSetVarDeclarations,
		SchemaCompareOptionsDialog.BlockWhenDriftDetected,
		SchemaCompareOptionsDialog.BlockOnPossibleDataLoss,
		SchemaCompareOptionsDialog.BackupDatabaseBeforeChanges,
		SchemaCompareOptionsDialog.AllowIncompatiblePlatform,
		SchemaCompareOptionsDialog.AllowDropBlockingAssemblies,
		SchemaCompareOptionsDialog.DropConstraintsNotInSource,
		SchemaCompareOptionsDialog.DropDmlTriggersNotInSource,
		SchemaCompareOptionsDialog.DropExtendedPropertiesNotInSource,
		SchemaCompareOptionsDialog.DropIndexesNotInSource,
		SchemaCompareOptionsDialog.IgnoreFileAndLogFilePath,
		SchemaCompareOptionsDialog.IgnoreExtendedProperties,
		SchemaCompareOptionsDialog.IgnoreDmlTriggerState,
		SchemaCompareOptionsDialog.IgnoreDmlTriggerOrder,
		SchemaCompareOptionsDialog.IgnoreDefaultSchema,
		SchemaCompareOptionsDialog.IgnoreDdlTriggerState,
		SchemaCompareOptionsDialog.IgnoreDdlTriggerOrder,
		SchemaCompareOptionsDialog.IgnoreCryptographicProviderFilePath,
		SchemaCompareOptionsDialog.VerifyDeployment,
		SchemaCompareOptionsDialog.IgnoreComments,
		SchemaCompareOptionsDialog.IgnoreColumnCollation,
		SchemaCompareOptionsDialog.IgnoreAuthorizer,
		SchemaCompareOptionsDialog.IgnoreAnsiNulls,
		SchemaCompareOptionsDialog.GenerateSmartDefaults,
		SchemaCompareOptionsDialog.DropStatisticsNotInSource,
		SchemaCompareOptionsDialog.DropRoleMembersNotInSource,
		SchemaCompareOptionsDialog.DropPermissionsNotInSource,
		SchemaCompareOptionsDialog.DropObjectsNotInSource,
		SchemaCompareOptionsDialog.IgnoreColumnOrder,
	].sort();

	private objectTypeLabels: string[] = [
		SchemaCompareOptionsDialog.Aggregates,
		SchemaCompareOptionsDialog.ApplicationRoles,
		SchemaCompareOptionsDialog.Assemblies,
		SchemaCompareOptionsDialog.AssemblyFiles,
		SchemaCompareOptionsDialog.AsymmetricKeys,
		SchemaCompareOptionsDialog.BrokerPriorities,
		SchemaCompareOptionsDialog.Certificates,
		SchemaCompareOptionsDialog.ColumnEncryptionKeys,
		SchemaCompareOptionsDialog.ColumnMasterKeys,
		SchemaCompareOptionsDialog.Contracts,
		SchemaCompareOptionsDialog.DatabaseOptions,
		SchemaCompareOptionsDialog.DatabaseRoles,
		SchemaCompareOptionsDialog.DatabaseTriggers,
		SchemaCompareOptionsDialog.Defaults,
		SchemaCompareOptionsDialog.ExtendedProperties,
		SchemaCompareOptionsDialog.ExternalDataSources,
		SchemaCompareOptionsDialog.ExternalFileFormats,
		SchemaCompareOptionsDialog.ExternalTables,
		SchemaCompareOptionsDialog.Filegroups,
		SchemaCompareOptionsDialog.Files,
		SchemaCompareOptionsDialog.FileTables,
		SchemaCompareOptionsDialog.FullTextCatalogs,
		SchemaCompareOptionsDialog.FullTextStoplists,
		SchemaCompareOptionsDialog.MessageTypes,
		SchemaCompareOptionsDialog.PartitionFunctions,
		SchemaCompareOptionsDialog.PartitionSchemes,
		SchemaCompareOptionsDialog.Permissions,
		SchemaCompareOptionsDialog.Queues,
		SchemaCompareOptionsDialog.RemoteServiceBindings,
		SchemaCompareOptionsDialog.RoleMembership,
		SchemaCompareOptionsDialog.Rules,
		SchemaCompareOptionsDialog.ScalarValuedFunctions,
		SchemaCompareOptionsDialog.SearchPropertyLists,
		SchemaCompareOptionsDialog.SecurityPolicies,
		SchemaCompareOptionsDialog.Sequences,
		SchemaCompareOptionsDialog.Services,
		SchemaCompareOptionsDialog.Signatures,
		SchemaCompareOptionsDialog.StoredProcedures,
		SchemaCompareOptionsDialog.SymmetricKeys,
		SchemaCompareOptionsDialog.Synonyms,
		SchemaCompareOptionsDialog.Tables,
		SchemaCompareOptionsDialog.TableValuedFunctions,
		SchemaCompareOptionsDialog.UserDefinedDataTypes,
		SchemaCompareOptionsDialog.UserDefinedTableTypes,
		SchemaCompareOptionsDialog.ClrUserDefinedTypes,
		SchemaCompareOptionsDialog.Users,
		SchemaCompareOptionsDialog.Views,
		SchemaCompareOptionsDialog.XmlSchemaCollections,
		SchemaCompareOptionsDialog.Audits,
		SchemaCompareOptionsDialog.Credentials,
		SchemaCompareOptionsDialog.CryptographicProviders,
		SchemaCompareOptionsDialog.DatabaseAuditSpecifications,
		SchemaCompareOptionsDialog.DatabaseEncryptionKeys,
		SchemaCompareOptionsDialog.DatabaseScopedCredentials,
		SchemaCompareOptionsDialog.Endpoints,
		SchemaCompareOptionsDialog.ErrorMessages,
		SchemaCompareOptionsDialog.EventNotifications,
		SchemaCompareOptionsDialog.EventSessions,
		SchemaCompareOptionsDialog.LinkedServerLogins,
		SchemaCompareOptionsDialog.LinkedServers,
		SchemaCompareOptionsDialog.Logins,
		SchemaCompareOptionsDialog.MasterKeys,
		SchemaCompareOptionsDialog.Routes,
		SchemaCompareOptionsDialog.ServerAuditSpecifications,
		SchemaCompareOptionsDialog.ServerRoleMembership,
		SchemaCompareOptionsDialog.ServerRoles,
		SchemaCompareOptionsDialog.ServerTriggers
	].sort();

	constructor(defaultOptions: mssql.DeploymentOptions, private schemaComparison: SchemaCompareMainWindow) {
		this.deploymentOptions = defaultOptions;
	}

	protected async initializeDialog() {
		this.generalOptionsTab = azdata.window.createTab(SchemaCompareOptionsDialog.GeneralOptionsLabel);
		this.objectTypesTab = azdata.window.createTab(SchemaCompareOptionsDialog.ObjectTypesOptionsLabel);
		await this.initializeSchemaCompareOptionsDialogTab();
		await this.initializeSchemaCompareObjectTypesDialogTab();
		this.dialog.content = [this.generalOptionsTab, this.objectTypesTab];
	}

	public async openDialog() {
		let event = null;
		this.dialog = azdata.window.createModelViewDialog(SchemaCompareOptionsDialog.OptionsLabel, event);

		await this.initializeDialog();

		this.dialog.okButton.label = SchemaCompareOptionsDialog.OkButtonText;
		this.dialog.okButton.onClick(async () => await this.execute());

		this.dialog.cancelButton.label = SchemaCompareOptionsDialog.CancelButtonText;
		this.dialog.cancelButton.onClick(async () => await this.cancel());

		let resetButton = azdata.window.createButton(SchemaCompareOptionsDialog.ResetButtonText);
		resetButton.onClick(async () => await this.reset());
		this.dialog.customButtons = [];
		this.dialog.customButtons.push(resetButton);

		azdata.window.openDialog(this.dialog);
	}

	protected async execute() {
		this.SetDeploymentOptions();
		this.SetObjectTypeOptions();
		this.schemaComparison.setDeploymentOptions(this.deploymentOptions);

		if (this.optionsChanged) {
			vscode.window.showWarningMessage(SchemaCompareOptionsDialog.OptionsChangedMessage, SchemaCompareOptionsDialog.YesButtonText, SchemaCompareOptionsDialog.NoButtonText).then((result) => {
				if (result === SchemaCompareOptionsDialog.YesButtonText) {
					this.schemaComparison.startCompare();
				}
			});
		}
		this.disposeListeners();
	}

	protected async cancel() {
		this.disposeListeners();
	}

	private async reset() {
		let service = (vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).schemaCompare;
		let result = await service.schemaCompareGetDefaultOptions();
		this.deploymentOptions = result.defaultDeploymentOptions;
		this.optionsChanged = true;

		this.updateOptionsTable();
		this.optionsFlexBuilder.removeItem(this.optionsTable);
		this.optionsFlexBuilder.insertItem(this.optionsTable, 0, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });

		this.updateObjectsTable();
		this.objectTypesFlexBuilder.removeItem(this.objectsTable);
		this.objectTypesFlexBuilder.addItem(this.objectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });
	}

	private async initializeSchemaCompareOptionsDialogTab() {
		this.generalOptionsTab.registerContent(async view => {

			this.descriptionHeading = view.modelBuilder.table().withProperties({
				columns: [
					{
						value: 'Option Description',
						headerCssClass: 'no-borders',
						toolTip: 'Option Description'
					}
				]
			}).component();

			this.descriptionText = view.modelBuilder.text().withProperties({
				value: ' '
			}).component();


			this.optionsTable = view.modelBuilder.table().component();
			this.updateOptionsTable();

			this.disposableListeners.push(this.optionsTable.onRowSelected(async () => {
				let row = this.optionsTable.selectedRows[0];
				let label = this.optionsLabels[row];
				this.descriptionText.updateProperties({
					value: this.GetDescription(label)
				});
			}));

			this.disposableListeners.push(this.optionsTable.onCellAction(async (rowState) => {
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					let label = this.optionsLabels[checkboxState.row];
					this.optionsLookup[label] = checkboxState.checked;
					this.optionsChanged = true;
				}
			}));

			this.optionsFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			this.optionsFlexBuilder.addItem(this.optionsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '65vh' } });
			this.optionsFlexBuilder.addItem(this.descriptionHeading, { CSSStyles: { 'font-weight': 'bold', 'height': '30px' } });
			this.optionsFlexBuilder.addItem(this.descriptionText, { CSSStyles: { 'padding': '4px', 'margin-right': '10px', 'overflow': 'scroll', 'height': '10vh' } });
			await view.initializeModel(this.optionsFlexBuilder);
		});
	}

	private async initializeSchemaCompareObjectTypesDialogTab() {
		this.objectTypesTab.registerContent(async view => {

			this.objectTypesFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({
					flexFlow: 'column'
				}).component();

			this.objectsTable = view.modelBuilder.table().component();
			this.updateObjectsTable();

			this.disposableListeners.push(this.objectsTable.onCellAction(async (rowState) => {
				let checkboxState = <azdata.ICheckboxCellActionEventArgs>rowState;
				if (checkboxState && checkboxState.row !== undefined) {
					let label = this.objectTypeLabels[checkboxState.row];
					this.objectsLookup[label] = checkboxState.checked;
					this.optionsChanged = true;
				}
			}));

			this.objectTypesFlexBuilder.addItem(this.objectsTable, { CSSStyles: { 'overflow': 'scroll', 'height': '80vh' } });

			await view.initializeModel(this.objectTypesFlexBuilder);
		});
	}

	private disposeListeners(): void {
		if (this.disposableListeners) {
			this.disposableListeners.forEach(x => x.dispose());
		}
	}

	private updateOptionsTable(): void {
		let data = this.getOptionsData();
		this.optionsTable.updateProperties({
			data: data,
			columns: [
				{
					value: 'Include',
					type: azdata.ColumnType.checkBox,
					options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction },
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				},
				{
					value: 'Option Name',
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				}
			],
			ariaRowCount: data.length
		});
	}

	private updateObjectsTable(): void {
		let data = this.getObjectsData();
		this.objectsTable.updateProperties({
			data: data,
			columns: [
				{
					value: 'Include',
					type: azdata.ColumnType.checkBox,
					options: { actionOnCheckbox: azdata.ActionOnCellCheckboxCheck.customAction },
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				},
				{
					value: 'Option Name',
					headerCssClass: 'display-none',
					cssClass: 'no-borders align-with-header',
					width: 50
				}
			],
			ariaRowCount: data.length
		});
	}

	private getOptionsData(): string[][] {
		let data = [];
		this.optionsLookup = {};
		this.optionsLabels.forEach(l => {
			let checked: boolean = this.GetSchemaCompareOptionUtil(l);
			data.push([checked, l]);
			this.optionsLookup[l] = checked;
		});
		return data;
	}

	private getObjectsData(): string[][] {
		let data = [];
		this.objectsLookup = {};
		this.objectTypeLabels.forEach(l => {
			let checked: boolean = this.GetSchemaCompareIncludedObjectsUtil(l);
			data.push([checked, l]);
			this.objectsLookup[l] = checked;
		});
		return data;
	}

	private SetDeploymentOptions() {
		for (let option in this.optionsLookup) {
			this.SetSchemaCompareOptionUtil(option, this.optionsLookup[option]);
		}
	}

	private SetSchemaCompareOptionUtil(label: string, value: boolean) {
		switch (label) {
			case SchemaCompareOptionsDialog.IgnoreTableOptions:
				this.deploymentOptions.ignoreTableOptions = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreSemicolonBetweenStatements:
				this.deploymentOptions.ignoreSemicolonBetweenStatements = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreRouteLifetime:
				this.deploymentOptions.ignoreRouteLifetime = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreRoleMembership:
				this.deploymentOptions.ignoreRoleMembership = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreQuotedIdentifiers:
				this.deploymentOptions.ignoreQuotedIdentifiers = value;
				break;
			case SchemaCompareOptionsDialog.IgnorePermissions:
				this.deploymentOptions.ignorePermissions = value;
				break;
			case SchemaCompareOptionsDialog.IgnorePartitionSchemes:
				this.deploymentOptions.ignorePartitionSchemes = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreObjectPlacementOnPartitionScheme:
				this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreNotForReplication:
				this.deploymentOptions.ignoreNotForReplication = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreLoginSids:
				this.deploymentOptions.ignoreLoginSids = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreLockHintsOnIndexes:
				this.deploymentOptions.ignoreLockHintsOnIndexes = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreKeywordCasing:
				this.deploymentOptions.ignoreKeywordCasing = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIndexPadding:
				this.deploymentOptions.ignoreIndexPadding = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIndexOptions:
				this.deploymentOptions.ignoreIndexOptions = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIncrement:
				this.deploymentOptions.ignoreIncrement = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIdentitySeed:
				this.deploymentOptions.ignoreIdentitySeed = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreUserSettingsObjects:
				this.deploymentOptions.ignoreUserSettingsObjects = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFullTextCatalogFilePath:
				this.deploymentOptions.ignoreFullTextCatalogFilePath = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreWhitespace:
				this.deploymentOptions.ignoreWhitespace = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnForeignKeys:
				this.deploymentOptions.ignoreWithNocheckOnForeignKeys = value;
				break;
			case SchemaCompareOptionsDialog.VerifyCollationCompatibility:
				this.deploymentOptions.verifyCollationCompatibility = value;
				break;
			case SchemaCompareOptionsDialog.UnmodifiableObjectWarnings:
				this.deploymentOptions.unmodifiableObjectWarnings = value;
				break;
			case SchemaCompareOptionsDialog.TreatVerificationErrorsAsWarnings:
				this.deploymentOptions.treatVerificationErrorsAsWarnings = value;
				break;
			case SchemaCompareOptionsDialog.ScriptRefreshModule:
				this.deploymentOptions.scriptRefreshModule = value;
				break;
			case SchemaCompareOptionsDialog.ScriptNewConstraintValidation:
				this.deploymentOptions.scriptNewConstraintValidation = value;
				break;
			case SchemaCompareOptionsDialog.ScriptFileSize:
				this.deploymentOptions.scriptFileSize = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDeployStateChecks:
				this.deploymentOptions.scriptDeployStateChecks = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDatabaseOptions:
				this.deploymentOptions.scriptDatabaseOptions = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDatabaseCompatibility:
				this.deploymentOptions.scriptDatabaseCompatibility = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDatabaseCollation:
				this.deploymentOptions.scriptDatabaseCollation = value;
				break;
			case SchemaCompareOptionsDialog.RunDeploymentPlanExecutors:
				this.deploymentOptions.runDeploymentPlanExecutors = value;
				break;
			case SchemaCompareOptionsDialog.RegisterDataTierApplication:
				this.deploymentOptions.registerDataTierApplication = value;
				break;
			case SchemaCompareOptionsDialog.PopulateFilesOnFileGroups:
				this.deploymentOptions.populateFilesOnFileGroups = value;
				break;
			case SchemaCompareOptionsDialog.NoAlterStatementsToChangeClrTypes:
				this.deploymentOptions.noAlterStatementsToChangeClrTypes = value;
				break;
			case SchemaCompareOptionsDialog.IncludeTransactionalScripts:
				this.deploymentOptions.includeTransactionalScripts = value;
				break;
			case SchemaCompareOptionsDialog.IncludeCompositeObjects:
				this.deploymentOptions.includeCompositeObjects = value;
				break;
			case SchemaCompareOptionsDialog.AllowUnsafeRowLevelSecurityDataMovement:
				this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnCheckConstraints:
				this.deploymentOptions.ignoreWithNocheckOnCheckConstraints = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFillFactor:
				this.deploymentOptions.ignoreFillFactor = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFileSize:
				this.deploymentOptions.ignoreFileSize = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFilegroupPlacement:
				this.deploymentOptions.ignoreFilegroupPlacement = value;
				break;
			case SchemaCompareOptionsDialog.DoNotAlterReplicatedObjects:
				this.deploymentOptions.doNotAlterReplicatedObjects = value;
				break;
			case SchemaCompareOptionsDialog.DoNotAlterChangeDataCaptureObjects:
				this.deploymentOptions.doNotAlterChangeDataCaptureObjects = value;
				break;
			case SchemaCompareOptionsDialog.DisableAndReenableDdlTriggers:
				this.deploymentOptions.disableAndReenableDdlTriggers = value;
				break;
			case SchemaCompareOptionsDialog.DeployDatabaseInSingleUserMode:
				this.deploymentOptions.deployDatabaseInSingleUserMode = value;
				break;
			case SchemaCompareOptionsDialog.CreateNewDatabase:
				this.deploymentOptions.createNewDatabase = value;
				break;
			case SchemaCompareOptionsDialog.CompareUsingTargetCollation:
				this.deploymentOptions.compareUsingTargetCollation = value;
				break;
			case SchemaCompareOptionsDialog.CommentOutSetVarDeclarations:
				this.deploymentOptions.commentOutSetVarDeclarations = value;
				break;
			case SchemaCompareOptionsDialog.BlockWhenDriftDetected:
				this.deploymentOptions.blockWhenDriftDetected = value;
				break;
			case SchemaCompareOptionsDialog.BlockOnPossibleDataLoss:
				this.deploymentOptions.blockOnPossibleDataLoss = value;
				break;
			case SchemaCompareOptionsDialog.BackupDatabaseBeforeChanges:
				this.deploymentOptions.backupDatabaseBeforeChanges = value;
				break;
			case SchemaCompareOptionsDialog.AllowIncompatiblePlatform:
				this.deploymentOptions.allowIncompatiblePlatform = value;
				break;
			case SchemaCompareOptionsDialog.AllowDropBlockingAssemblies:
				this.deploymentOptions.allowDropBlockingAssemblies = value;
				break;
			case SchemaCompareOptionsDialog.DropConstraintsNotInSource:
				this.deploymentOptions.dropConstraintsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropDmlTriggersNotInSource:
				this.deploymentOptions.dropDmlTriggersNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropExtendedPropertiesNotInSource:
				this.deploymentOptions.dropExtendedPropertiesNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropIndexesNotInSource:
				this.deploymentOptions.dropIndexesNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFileAndLogFilePath:
				this.deploymentOptions.ignoreFileAndLogFilePath = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreExtendedProperties:
				this.deploymentOptions.ignoreExtendedProperties = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDmlTriggerState:
				this.deploymentOptions.ignoreDmlTriggerState = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDmlTriggerOrder:
				this.deploymentOptions.ignoreDmlTriggerOrder = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDefaultSchema:
				this.deploymentOptions.ignoreDefaultSchema = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDdlTriggerState:
				this.deploymentOptions.ignoreDdlTriggerState = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDdlTriggerOrder:
				this.deploymentOptions.ignoreDdlTriggerOrder = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreCryptographicProviderFilePath:
				this.deploymentOptions.ignoreCryptographicProviderFilePath = value;
				break;
			case SchemaCompareOptionsDialog.VerifyDeployment:
				this.deploymentOptions.verifyDeployment = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreComments:
				this.deploymentOptions.ignoreComments = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreColumnCollation:
				this.deploymentOptions.ignoreColumnCollation = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreAuthorizer:
				this.deploymentOptions.ignoreAuthorizer = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreAnsiNulls:
				this.deploymentOptions.ignoreAnsiNulls = value;
				break;
			case SchemaCompareOptionsDialog.GenerateSmartDefaults:
				this.deploymentOptions.generateSmartDefaults = value;
				break;
			case SchemaCompareOptionsDialog.DropStatisticsNotInSource:
				this.deploymentOptions.dropStatisticsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropRoleMembersNotInSource:
				this.deploymentOptions.dropRoleMembersNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropPermissionsNotInSource:
				this.deploymentOptions.dropPermissionsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropObjectsNotInSource:
				this.deploymentOptions.dropObjectsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreColumnOrder:
				this.deploymentOptions.ignoreColumnOrder = value;
				break;
		}
	}

	private GetSchemaCompareOptionUtil(label): boolean {
		switch (label) {
			case SchemaCompareOptionsDialog.IgnoreTableOptions:
				return this.deploymentOptions.ignoreTableOptions;

			case SchemaCompareOptionsDialog.IgnoreSemicolonBetweenStatements:
				return this.deploymentOptions.ignoreSemicolonBetweenStatements;

			case SchemaCompareOptionsDialog.IgnoreRouteLifetime:
				return this.deploymentOptions.ignoreRouteLifetime;

			case SchemaCompareOptionsDialog.IgnoreRoleMembership:
				return this.deploymentOptions.ignoreRoleMembership;

			case SchemaCompareOptionsDialog.IgnoreQuotedIdentifiers:
				return this.deploymentOptions.ignoreQuotedIdentifiers;

			case SchemaCompareOptionsDialog.IgnorePermissions:
				return this.deploymentOptions.ignorePermissions;

			case SchemaCompareOptionsDialog.IgnorePartitionSchemes:
				return this.deploymentOptions.ignorePartitionSchemes;

			case SchemaCompareOptionsDialog.IgnoreObjectPlacementOnPartitionScheme:
				return this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme;

			case SchemaCompareOptionsDialog.IgnoreNotForReplication:
				return this.deploymentOptions.ignoreNotForReplication;

			case SchemaCompareOptionsDialog.IgnoreLoginSids:
				return this.deploymentOptions.ignoreLoginSids;

			case SchemaCompareOptionsDialog.IgnoreLockHintsOnIndexes:
				return this.deploymentOptions.ignoreLockHintsOnIndexes;

			case SchemaCompareOptionsDialog.IgnoreKeywordCasing:
				return this.deploymentOptions.ignoreKeywordCasing;

			case SchemaCompareOptionsDialog.IgnoreIndexPadding:
				return this.deploymentOptions.ignoreIndexPadding;

			case SchemaCompareOptionsDialog.IgnoreIndexOptions:
				return this.deploymentOptions.ignoreIndexOptions;

			case SchemaCompareOptionsDialog.IgnoreIncrement:
				return this.deploymentOptions.ignoreIncrement;

			case SchemaCompareOptionsDialog.IgnoreIdentitySeed:
				return this.deploymentOptions.ignoreIdentitySeed;

			case SchemaCompareOptionsDialog.IgnoreUserSettingsObjects:
				return this.deploymentOptions.ignoreUserSettingsObjects;

			case SchemaCompareOptionsDialog.IgnoreFullTextCatalogFilePath:
				return this.deploymentOptions.ignoreFullTextCatalogFilePath;

			case SchemaCompareOptionsDialog.IgnoreWhitespace:
				return this.deploymentOptions.ignoreWhitespace;

			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnForeignKeys:
				return this.deploymentOptions.ignoreWithNocheckOnForeignKeys;

			case SchemaCompareOptionsDialog.VerifyCollationCompatibility:
				return this.deploymentOptions.verifyCollationCompatibility;

			case SchemaCompareOptionsDialog.UnmodifiableObjectWarnings:
				return this.deploymentOptions.unmodifiableObjectWarnings;

			case SchemaCompareOptionsDialog.TreatVerificationErrorsAsWarnings:
				return this.deploymentOptions.treatVerificationErrorsAsWarnings;

			case SchemaCompareOptionsDialog.ScriptRefreshModule:
				return this.deploymentOptions.scriptRefreshModule;

			case SchemaCompareOptionsDialog.ScriptNewConstraintValidation:
				return this.deploymentOptions.scriptNewConstraintValidation;

			case SchemaCompareOptionsDialog.ScriptFileSize:
				return this.deploymentOptions.scriptFileSize;

			case SchemaCompareOptionsDialog.ScriptDeployStateChecks:
				return this.deploymentOptions.scriptDeployStateChecks;

			case SchemaCompareOptionsDialog.ScriptDatabaseOptions:
				return this.deploymentOptions.scriptDatabaseOptions;

			case SchemaCompareOptionsDialog.ScriptDatabaseCompatibility:
				return this.deploymentOptions.scriptDatabaseCompatibility;

			case SchemaCompareOptionsDialog.ScriptDatabaseCollation:
				return this.deploymentOptions.scriptDatabaseCollation;

			case SchemaCompareOptionsDialog.RunDeploymentPlanExecutors:
				return this.deploymentOptions.runDeploymentPlanExecutors;

			case SchemaCompareOptionsDialog.RegisterDataTierApplication:
				return this.deploymentOptions.registerDataTierApplication;

			case SchemaCompareOptionsDialog.PopulateFilesOnFileGroups:
				return this.deploymentOptions.populateFilesOnFileGroups;

			case SchemaCompareOptionsDialog.NoAlterStatementsToChangeClrTypes:
				return this.deploymentOptions.noAlterStatementsToChangeClrTypes;

			case SchemaCompareOptionsDialog.IncludeTransactionalScripts:
				return this.deploymentOptions.includeTransactionalScripts;

			case SchemaCompareOptionsDialog.IncludeCompositeObjects:
				return this.deploymentOptions.includeCompositeObjects;

			case SchemaCompareOptionsDialog.AllowUnsafeRowLevelSecurityDataMovement:
				return this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement;

			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnCheckConstraints:
				return this.deploymentOptions.ignoreWithNocheckOnCheckConstraints;

			case SchemaCompareOptionsDialog.IgnoreFillFactor:
				return this.deploymentOptions.ignoreFillFactor;

			case SchemaCompareOptionsDialog.IgnoreFileSize:
				return this.deploymentOptions.ignoreFileSize;

			case SchemaCompareOptionsDialog.IgnoreFilegroupPlacement:
				return this.deploymentOptions.ignoreFilegroupPlacement;

			case SchemaCompareOptionsDialog.DoNotAlterReplicatedObjects:
				return this.deploymentOptions.doNotAlterReplicatedObjects;

			case SchemaCompareOptionsDialog.DoNotAlterChangeDataCaptureObjects:
				return this.deploymentOptions.doNotAlterChangeDataCaptureObjects;

			case SchemaCompareOptionsDialog.DisableAndReenableDdlTriggers:
				return this.deploymentOptions.disableAndReenableDdlTriggers;

			case SchemaCompareOptionsDialog.DeployDatabaseInSingleUserMode:
				return this.deploymentOptions.deployDatabaseInSingleUserMode;

			case SchemaCompareOptionsDialog.CreateNewDatabase:
				return this.deploymentOptions.createNewDatabase;

			case SchemaCompareOptionsDialog.CompareUsingTargetCollation:
				return this.deploymentOptions.compareUsingTargetCollation;

			case SchemaCompareOptionsDialog.CommentOutSetVarDeclarations:
				return this.deploymentOptions.commentOutSetVarDeclarations;

			case SchemaCompareOptionsDialog.BlockWhenDriftDetected:
				return this.deploymentOptions.blockWhenDriftDetected;

			case SchemaCompareOptionsDialog.BlockOnPossibleDataLoss:
				return this.deploymentOptions.blockOnPossibleDataLoss;

			case SchemaCompareOptionsDialog.BackupDatabaseBeforeChanges:
				return this.deploymentOptions.backupDatabaseBeforeChanges;

			case SchemaCompareOptionsDialog.AllowIncompatiblePlatform:
				return this.deploymentOptions.allowIncompatiblePlatform;

			case SchemaCompareOptionsDialog.AllowDropBlockingAssemblies:
				return this.deploymentOptions.allowDropBlockingAssemblies;

			case SchemaCompareOptionsDialog.DropConstraintsNotInSource:
				return this.deploymentOptions.dropConstraintsNotInSource;

			case SchemaCompareOptionsDialog.DropDmlTriggersNotInSource:
				return this.deploymentOptions.dropDmlTriggersNotInSource;

			case SchemaCompareOptionsDialog.DropExtendedPropertiesNotInSource:
				return this.deploymentOptions.dropExtendedPropertiesNotInSource;

			case SchemaCompareOptionsDialog.DropIndexesNotInSource:
				return this.deploymentOptions.dropIndexesNotInSource;

			case SchemaCompareOptionsDialog.IgnoreFileAndLogFilePath:
				return this.deploymentOptions.ignoreFileAndLogFilePath;

			case SchemaCompareOptionsDialog.IgnoreExtendedProperties:
				return this.deploymentOptions.ignoreExtendedProperties;

			case SchemaCompareOptionsDialog.IgnoreDmlTriggerState:
				return this.deploymentOptions.ignoreDmlTriggerState;

			case SchemaCompareOptionsDialog.IgnoreDmlTriggerOrder:
				return this.deploymentOptions.ignoreDmlTriggerOrder;

			case SchemaCompareOptionsDialog.IgnoreDefaultSchema:
				return this.deploymentOptions.ignoreDefaultSchema;

			case SchemaCompareOptionsDialog.IgnoreDdlTriggerState:
				return this.deploymentOptions.ignoreDdlTriggerState;

			case SchemaCompareOptionsDialog.IgnoreDdlTriggerOrder:
				return this.deploymentOptions.ignoreDdlTriggerOrder;

			case SchemaCompareOptionsDialog.IgnoreCryptographicProviderFilePath:
				return this.deploymentOptions.ignoreCryptographicProviderFilePath;

			case SchemaCompareOptionsDialog.VerifyDeployment:
				return this.deploymentOptions.verifyDeployment;

			case SchemaCompareOptionsDialog.IgnoreComments:
				return this.deploymentOptions.ignoreComments;

			case SchemaCompareOptionsDialog.IgnoreColumnCollation:
				return this.deploymentOptions.ignoreColumnCollation;

			case SchemaCompareOptionsDialog.IgnoreAuthorizer:
				return this.deploymentOptions.ignoreAuthorizer;

			case SchemaCompareOptionsDialog.IgnoreAnsiNulls:
				return this.deploymentOptions.ignoreAnsiNulls;

			case SchemaCompareOptionsDialog.GenerateSmartDefaults:
				return this.deploymentOptions.generateSmartDefaults;

			case SchemaCompareOptionsDialog.DropStatisticsNotInSource:
				return this.deploymentOptions.dropStatisticsNotInSource;

			case SchemaCompareOptionsDialog.DropRoleMembersNotInSource:
				return this.deploymentOptions.dropRoleMembersNotInSource;

			case SchemaCompareOptionsDialog.DropPermissionsNotInSource:
				return this.deploymentOptions.dropPermissionsNotInSource;

			case SchemaCompareOptionsDialog.DropObjectsNotInSource:
				return this.deploymentOptions.dropObjectsNotInSource;

			case SchemaCompareOptionsDialog.IgnoreColumnOrder:
				return this.deploymentOptions.ignoreColumnOrder;
		}
		return false;
	}

	private SetObjectTypeOptions() {
		for (let option in this.objectsLookup) {
			this.SetSchemaCompareIncludedObjectsUtil(option, this.objectsLookup[option]);
		}
		this.deploymentOptions.excludeObjectTypes = this.excludedObjectTypes;
	}

	private GetSchemaCompareIncludedObjectsUtil(label): boolean {
		switch (label) {
			case SchemaCompareOptionsDialog.Aggregates:
				return !isNullOrUndefined(this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Aggregates)) ? false : true;
			case SchemaCompareOptionsDialog.ApplicationRoles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ApplicationRoles)) ? false : true;
			case SchemaCompareOptionsDialog.Assemblies:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Assemblies)) ? false : true;
			case SchemaCompareOptionsDialog.AssemblyFiles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.AssemblyFiles)) ? false : true;
			case SchemaCompareOptionsDialog.AsymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.AsymmetricKeys)) ? false : true;
			case SchemaCompareOptionsDialog.BrokerPriorities:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.BrokerPriorities)) ? false : true;
			case SchemaCompareOptionsDialog.Certificates:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Certificates)) ? false : true;
			case SchemaCompareOptionsDialog.ColumnEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ColumnEncryptionKeys)) ? false : true;
			case SchemaCompareOptionsDialog.ColumnMasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ColumnMasterKeys)) ? false : true;
			case SchemaCompareOptionsDialog.Contracts:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Contracts)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseOptions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseOptions)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseRoles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseRoles)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseTriggers:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseTriggers)) ? false : true;
			case SchemaCompareOptionsDialog.Defaults:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Defaults)) ? false : true;
			case SchemaCompareOptionsDialog.ExtendedProperties:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExtendedProperties)) ? false : true;
			case SchemaCompareOptionsDialog.ExternalDataSources:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExternalDataSources)) ? false : true;
			case SchemaCompareOptionsDialog.ExternalFileFormats:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExternalFileFormats)) ? false : true;
			case SchemaCompareOptionsDialog.ExternalTables:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExternalTables)) ? false : true;
			case SchemaCompareOptionsDialog.Filegroups:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Filegroups)) ? false : true;
			case SchemaCompareOptionsDialog.Files:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Files)) ? false : true;
			case SchemaCompareOptionsDialog.FileTables:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.FileTables)) ? false : true;
			case SchemaCompareOptionsDialog.FullTextCatalogs:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.FullTextCatalogs)) ? false : true;
			case SchemaCompareOptionsDialog.FullTextStoplists:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.FullTextStoplists)) ? false : true;
			case SchemaCompareOptionsDialog.MessageTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.MessageTypes)) ? false : true;
			case SchemaCompareOptionsDialog.PartitionFunctions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.PartitionFunctions)) ? false : true;
			case SchemaCompareOptionsDialog.PartitionSchemes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.PartitionSchemes)) ? false : true;
			case SchemaCompareOptionsDialog.Permissions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Permissions)) ? false : true;
			case SchemaCompareOptionsDialog.Queues:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Queues)) ? false : true;
			case SchemaCompareOptionsDialog.RemoteServiceBindings:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.RemoteServiceBindings)) ? false : true;
			case SchemaCompareOptionsDialog.RoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.RoleMembership)) ? false : true;
			case SchemaCompareOptionsDialog.Rules:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Rules)) ? false : true;
			case SchemaCompareOptionsDialog.ScalarValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ScalarValuedFunctions)) ? false : true;
			case SchemaCompareOptionsDialog.SearchPropertyLists:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.SearchPropertyLists)) ? false : true;
			case SchemaCompareOptionsDialog.SecurityPolicies:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.SecurityPolicies)) ? false : true;
			case SchemaCompareOptionsDialog.Sequences:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Sequences)) ? false : true;
			case SchemaCompareOptionsDialog.Services:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Services)) ? false : true;
			case SchemaCompareOptionsDialog.Signatures:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Signatures)) ? false : true;
			case SchemaCompareOptionsDialog.StoredProcedures:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.StoredProcedures)) ? false : true;
			case SchemaCompareOptionsDialog.SymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.SymmetricKeys)) ? false : true;
			case SchemaCompareOptionsDialog.Synonyms:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Synonyms)) ? false : true;
			case SchemaCompareOptionsDialog.Tables:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Tables)) ? false : true;
			case SchemaCompareOptionsDialog.TableValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.TableValuedFunctions)) ? false : true;
			case SchemaCompareOptionsDialog.UserDefinedDataTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.UserDefinedDataTypes)) ? false : true;
			case SchemaCompareOptionsDialog.UserDefinedTableTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.UserDefinedTableTypes)) ? false : true;
			case SchemaCompareOptionsDialog.ClrUserDefinedTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ClrUserDefinedTypes)) ? false : true;
			case SchemaCompareOptionsDialog.Users:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Users)) ? false : true;
			case SchemaCompareOptionsDialog.Views:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Views)) ? false : true;
			case SchemaCompareOptionsDialog.XmlSchemaCollections:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.XmlSchemaCollections)) ? false : true;
			case SchemaCompareOptionsDialog.Audits:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Audits)) ? false : true;
			case SchemaCompareOptionsDialog.Credentials:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Credentials)) ? false : true;
			case SchemaCompareOptionsDialog.CryptographicProviders:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.CryptographicProviders)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseAuditSpecifications)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseEncryptionKeys)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseScopedCredentials:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseScopedCredentials)) ? false : true;
			case SchemaCompareOptionsDialog.Endpoints:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Endpoints)) ? false : true;
			case SchemaCompareOptionsDialog.ErrorMessages:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ErrorMessages)) ? false : true;
			case SchemaCompareOptionsDialog.EventNotifications:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.EventNotifications)) ? false : true;
			case SchemaCompareOptionsDialog.EventSessions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.EventSessions)) ? false : true;
			case SchemaCompareOptionsDialog.LinkedServerLogins:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.LinkedServerLogins)) ? false : true;
			case SchemaCompareOptionsDialog.LinkedServers:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.LinkedServers)) ? false : true;
			case SchemaCompareOptionsDialog.Logins:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Logins)) ? false : true;
			case SchemaCompareOptionsDialog.MasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.MasterKeys)) ? false : true;
			case SchemaCompareOptionsDialog.Routes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Routes)) ? false : true;
			case SchemaCompareOptionsDialog.ServerAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerAuditSpecifications)) ? false : true;
			case SchemaCompareOptionsDialog.ServerRoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerRoleMembership)) ? false : true;
			case SchemaCompareOptionsDialog.ServerRoles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerRoles)) ? false : true;
			case SchemaCompareOptionsDialog.ServerTriggers:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerTriggers)) ? false : true;
		}
		return false;
	}

	private SetSchemaCompareIncludedObjectsUtil(label: string, included: boolean) {
		switch (label) {
			case SchemaCompareOptionsDialog.Aggregates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Aggregates);
				}
				return;
			case SchemaCompareOptionsDialog.ApplicationRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ApplicationRoles);
				}
				return;
			case SchemaCompareOptionsDialog.Assemblies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Assemblies);
				}
				return;
			case SchemaCompareOptionsDialog.AssemblyFiles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AssemblyFiles);
				}
				return;
			case SchemaCompareOptionsDialog.AsymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AsymmetricKeys);
				}
				return;
			case SchemaCompareOptionsDialog.BrokerPriorities:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.BrokerPriorities);
				}
				return;
			case SchemaCompareOptionsDialog.Certificates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Certificates);
				}
				return;
			case SchemaCompareOptionsDialog.ColumnEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnEncryptionKeys);
				}
				return;
			case SchemaCompareOptionsDialog.ColumnMasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnMasterKeys);
				}
				return;
			case SchemaCompareOptionsDialog.Contracts:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Contracts);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseOptions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseOptions);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseRoles);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseTriggers);
				}
				return;
			case SchemaCompareOptionsDialog.Defaults:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Defaults);
				}
				return;
			case SchemaCompareOptionsDialog.ExtendedProperties:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExtendedProperties);
				}
				return;
			case SchemaCompareOptionsDialog.ExternalDataSources:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalDataSources);
				}
				return;
			case SchemaCompareOptionsDialog.ExternalFileFormats:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalFileFormats);
				}
				return;
			case SchemaCompareOptionsDialog.ExternalTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalTables);
				}
				return;
			case SchemaCompareOptionsDialog.Filegroups:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Filegroups);
				}
				return;
			case SchemaCompareOptionsDialog.Files:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Files);
				}
				return;
			case SchemaCompareOptionsDialog.FileTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FileTables);
				}
				return;
			case SchemaCompareOptionsDialog.FullTextCatalogs:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextCatalogs);
				}
				return;
			case SchemaCompareOptionsDialog.FullTextStoplists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextStoplists);
				}
				return;
			case SchemaCompareOptionsDialog.MessageTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MessageTypes);
				}
				return;
			case SchemaCompareOptionsDialog.PartitionFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionFunctions);
				}
				return;
			case SchemaCompareOptionsDialog.PartitionSchemes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionSchemes);
				}
				return;
			case SchemaCompareOptionsDialog.Permissions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Permissions);
				}
				return;
			case SchemaCompareOptionsDialog.Queues:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Queues);
				}
				return;
			case SchemaCompareOptionsDialog.RemoteServiceBindings:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RemoteServiceBindings);
				}
				return;
			case SchemaCompareOptionsDialog.RoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RoleMembership);
				}
				return;
			case SchemaCompareOptionsDialog.Rules:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Rules);
				}
				return;
			case SchemaCompareOptionsDialog.ScalarValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ScalarValuedFunctions);
				}
				return;
			case SchemaCompareOptionsDialog.SearchPropertyLists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SearchPropertyLists);
				}
				return;
			case SchemaCompareOptionsDialog.SecurityPolicies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SecurityPolicies);
				}
				return;
			case SchemaCompareOptionsDialog.Sequences:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Sequences);
				}
				return;
			case SchemaCompareOptionsDialog.Services:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Services);
				}
				return;
			case SchemaCompareOptionsDialog.Signatures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Signatures);
				}
				return;
			case SchemaCompareOptionsDialog.StoredProcedures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.StoredProcedures);
				}
				return;
			case SchemaCompareOptionsDialog.SymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SymmetricKeys);
				}
				return;
			case SchemaCompareOptionsDialog.Synonyms:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Synonyms);
				}
				return;
			case SchemaCompareOptionsDialog.Tables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Tables);
				}
				return;
			case SchemaCompareOptionsDialog.TableValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.TableValuedFunctions);
				}
				return;
			case SchemaCompareOptionsDialog.UserDefinedDataTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedDataTypes);
				}
				return;
			case SchemaCompareOptionsDialog.UserDefinedTableTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedTableTypes);
				}
				return;
			case SchemaCompareOptionsDialog.ClrUserDefinedTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ClrUserDefinedTypes);
				}
				return;
			case SchemaCompareOptionsDialog.Users:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Users);
				}
				return;
			case SchemaCompareOptionsDialog.Views:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Views);
				}
				return;
			case SchemaCompareOptionsDialog.XmlSchemaCollections:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.XmlSchemaCollections);
				}
				return;
			case SchemaCompareOptionsDialog.Audits:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Audits);
				}
				return;
			case SchemaCompareOptionsDialog.Credentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Credentials);
				}
				return;
			case SchemaCompareOptionsDialog.CryptographicProviders:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.CryptographicProviders);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseAuditSpecifications);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseEncryptionKeys);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseScopedCredentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseScopedCredentials);
				}
				return;
			case SchemaCompareOptionsDialog.Endpoints:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Endpoints);
				}
				return;
			case SchemaCompareOptionsDialog.ErrorMessages:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ErrorMessages);
				}
				return;
			case SchemaCompareOptionsDialog.EventNotifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventNotifications);
				}
				return;
			case SchemaCompareOptionsDialog.EventSessions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventSessions);
				}
				return;
			case SchemaCompareOptionsDialog.LinkedServerLogins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServerLogins);
				}
				return;
			case SchemaCompareOptionsDialog.LinkedServers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServers);
				}
				return;
			case SchemaCompareOptionsDialog.Logins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Logins);
				}
				return;
			case SchemaCompareOptionsDialog.MasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MasterKeys);
				}
				return;
			case SchemaCompareOptionsDialog.Routes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Routes);
				}
				return;
			case SchemaCompareOptionsDialog.ServerAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerAuditSpecifications);
				}
				return;
			case SchemaCompareOptionsDialog.ServerRoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoleMembership);
				}
				return;
			case SchemaCompareOptionsDialog.ServerRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoles);
				}
				return;
			case SchemaCompareOptionsDialog.ServerTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerTriggers);
				}
				return;
		}
	}

	private GetDescription(label: string): string {
		switch (label) {
			case SchemaCompareOptionsDialog.IgnoreTableOptions:
				return SchemaCompareOptionsDialog.descriptionIgnoreTableOptions;

			case SchemaCompareOptionsDialog.IgnoreSemicolonBetweenStatements:
				return SchemaCompareOptionsDialog.descriptionIgnoreSemicolonBetweenStatements;

			case SchemaCompareOptionsDialog.IgnoreRouteLifetime:
				return SchemaCompareOptionsDialog.descriptionIgnoreRouteLifetime;

			case SchemaCompareOptionsDialog.IgnoreRoleMembership:
				return SchemaCompareOptionsDialog.descriptionIgnoreRoleMembership;

			case SchemaCompareOptionsDialog.IgnoreQuotedIdentifiers:
				return SchemaCompareOptionsDialog.descriptionIgnoreQuotedIdentifiers;

			case SchemaCompareOptionsDialog.IgnorePermissions:
				return SchemaCompareOptionsDialog.descriptionIgnorePermissions;

			case SchemaCompareOptionsDialog.IgnorePartitionSchemes:
				return SchemaCompareOptionsDialog.descriptionIgnorePartitionSchemes;

			case SchemaCompareOptionsDialog.IgnoreObjectPlacementOnPartitionScheme:
				return SchemaCompareOptionsDialog.descriptionIgnoreObjectPlacementOnPartitionScheme;

			case SchemaCompareOptionsDialog.IgnoreNotForReplication:
				return SchemaCompareOptionsDialog.descriptionIgnoreNotForReplication;

			case SchemaCompareOptionsDialog.IgnoreLoginSids:
				return SchemaCompareOptionsDialog.descriptionIgnoreLoginSids;

			case SchemaCompareOptionsDialog.IgnoreLockHintsOnIndexes:
				return SchemaCompareOptionsDialog.descriptionIgnoreLockHintsOnIndexes;

			case SchemaCompareOptionsDialog.IgnoreKeywordCasing:
				return SchemaCompareOptionsDialog.descriptionIgnoreKeywordCasing;

			case SchemaCompareOptionsDialog.IgnoreIndexPadding:
				return SchemaCompareOptionsDialog.descriptionIgnoreIndexPadding;

			case SchemaCompareOptionsDialog.IgnoreIndexOptions:
				return SchemaCompareOptionsDialog.descriptionIgnoreIndexOptions;

			case SchemaCompareOptionsDialog.IgnoreIncrement:
				return SchemaCompareOptionsDialog.descriptionIgnoreIncrement;

			case SchemaCompareOptionsDialog.IgnoreIdentitySeed:
				return SchemaCompareOptionsDialog.descriptionIgnoreIdentitySeed;

			case SchemaCompareOptionsDialog.IgnoreUserSettingsObjects:
				return SchemaCompareOptionsDialog.descriptionIgnoreUserSettingsObjects;

			case SchemaCompareOptionsDialog.IgnoreFullTextCatalogFilePath:
				return SchemaCompareOptionsDialog.descriptionIgnoreFullTextCatalogFilePath;

			case SchemaCompareOptionsDialog.IgnoreWhitespace:
				return SchemaCompareOptionsDialog.descriptionIgnoreWhitespace;

			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnForeignKeys:
				return SchemaCompareOptionsDialog.descriptionIgnoreWithNocheckOnForeignKeys;

			case SchemaCompareOptionsDialog.VerifyCollationCompatibility:
				return SchemaCompareOptionsDialog.descriptionVerifyCollationCompatibility;

			case SchemaCompareOptionsDialog.UnmodifiableObjectWarnings:
				return SchemaCompareOptionsDialog.descriptionUnmodifiableObjectWarnings;

			case SchemaCompareOptionsDialog.TreatVerificationErrorsAsWarnings:
				return SchemaCompareOptionsDialog.descriptionTreatVerificationErrorsAsWarnings;

			case SchemaCompareOptionsDialog.ScriptRefreshModule:
				return SchemaCompareOptionsDialog.descriptionScriptRefreshModule;

			case SchemaCompareOptionsDialog.ScriptNewConstraintValidation:
				return SchemaCompareOptionsDialog.descriptionScriptNewConstraintValidation;

			case SchemaCompareOptionsDialog.ScriptFileSize:
				return SchemaCompareOptionsDialog.descriptionScriptFileSize;

			case SchemaCompareOptionsDialog.ScriptDeployStateChecks:
				return SchemaCompareOptionsDialog.descriptionScriptDeployStateChecks;

			case SchemaCompareOptionsDialog.ScriptDatabaseOptions:
				return SchemaCompareOptionsDialog.descriptionScriptDatabaseOptions;

			case SchemaCompareOptionsDialog.ScriptDatabaseCompatibility:
				return SchemaCompareOptionsDialog.descriptionScriptDatabaseCompatibility;

			case SchemaCompareOptionsDialog.ScriptDatabaseCollation:
				return SchemaCompareOptionsDialog.descriptionScriptDatabaseCollation;

			case SchemaCompareOptionsDialog.RunDeploymentPlanExecutors:
				return SchemaCompareOptionsDialog.descriptionRunDeploymentPlanExecutors;

			case SchemaCompareOptionsDialog.RegisterDataTierApplication:
				return SchemaCompareOptionsDialog.descriptionRegisterDataTierApplication;

			case SchemaCompareOptionsDialog.PopulateFilesOnFileGroups:
				return SchemaCompareOptionsDialog.descriptionPopulateFilesOnFileGroups;

			case SchemaCompareOptionsDialog.NoAlterStatementsToChangeClrTypes:
				return SchemaCompareOptionsDialog.descriptionNoAlterStatementsToChangeClrTypes;

			case SchemaCompareOptionsDialog.IncludeTransactionalScripts:
				return SchemaCompareOptionsDialog.descriptionIncludeTransactionalScripts;

			case SchemaCompareOptionsDialog.IncludeCompositeObjects:
				return SchemaCompareOptionsDialog.descriptionIncludeCompositeObjects;

			case SchemaCompareOptionsDialog.AllowUnsafeRowLevelSecurityDataMovement:
				return SchemaCompareOptionsDialog.descriptionAllowUnsafeRowLevelSecurityDataMovement;

			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnCheckConstraints:
				return SchemaCompareOptionsDialog.descriptionIgnoreWithNocheckOnCheckConstraints;

			case SchemaCompareOptionsDialog.IgnoreFillFactor:
				return SchemaCompareOptionsDialog.descriptionIgnoreFillFactor;

			case SchemaCompareOptionsDialog.IgnoreFileSize:
				return SchemaCompareOptionsDialog.descriptionIgnoreFileSize;

			case SchemaCompareOptionsDialog.IgnoreFilegroupPlacement:
				return SchemaCompareOptionsDialog.descriptionIgnoreFilegroupPlacement;

			case SchemaCompareOptionsDialog.DoNotAlterReplicatedObjects:
				return SchemaCompareOptionsDialog.descriptionDoNotAlterReplicatedObjects;

			case SchemaCompareOptionsDialog.DoNotAlterChangeDataCaptureObjects:
				return SchemaCompareOptionsDialog.descriptionDoNotAlterChangeDataCaptureObjects;

			case SchemaCompareOptionsDialog.DisableAndReenableDdlTriggers:
				return SchemaCompareOptionsDialog.descriptionDisableAndReenableDdlTriggers;

			case SchemaCompareOptionsDialog.DeployDatabaseInSingleUserMode:
				return SchemaCompareOptionsDialog.descriptionDeployDatabaseInSingleUserMode;

			case SchemaCompareOptionsDialog.CreateNewDatabase:
				return SchemaCompareOptionsDialog.descriptionCreateNewDatabase;

			case SchemaCompareOptionsDialog.CompareUsingTargetCollation:
				return SchemaCompareOptionsDialog.descriptionCompareUsingTargetCollation;

			case SchemaCompareOptionsDialog.CommentOutSetVarDeclarations:
				return SchemaCompareOptionsDialog.descriptionCommentOutSetVarDeclarations;

			case SchemaCompareOptionsDialog.BlockWhenDriftDetected:
				return SchemaCompareOptionsDialog.descriptionBlockWhenDriftDetected;

			case SchemaCompareOptionsDialog.BlockOnPossibleDataLoss:
				return SchemaCompareOptionsDialog.descriptionBlockOnPossibleDataLoss;

			case SchemaCompareOptionsDialog.BackupDatabaseBeforeChanges:
				return SchemaCompareOptionsDialog.descriptionBackupDatabaseBeforeChanges;

			case SchemaCompareOptionsDialog.AllowIncompatiblePlatform:
				return SchemaCompareOptionsDialog.descriptionAllowIncompatiblePlatform;

			case SchemaCompareOptionsDialog.AllowDropBlockingAssemblies:
				return SchemaCompareOptionsDialog.descriptionAllowDropBlockingAssemblies;

			case SchemaCompareOptionsDialog.DropConstraintsNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropConstraintsNotInSource;

			case SchemaCompareOptionsDialog.DropDmlTriggersNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropDmlTriggersNotInSource;

			case SchemaCompareOptionsDialog.DropExtendedPropertiesNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropExtendedPropertiesNotInSource;

			case SchemaCompareOptionsDialog.DropIndexesNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropIndexesNotInSource;

			case SchemaCompareOptionsDialog.IgnoreFileAndLogFilePath:
				return SchemaCompareOptionsDialog.descriptionIgnoreFileAndLogFilePath;

			case SchemaCompareOptionsDialog.IgnoreExtendedProperties:
				return SchemaCompareOptionsDialog.descriptionIgnoreExtendedProperties;

			case SchemaCompareOptionsDialog.IgnoreDmlTriggerState:
				return SchemaCompareOptionsDialog.descriptionIgnoreDmlTriggerState;

			case SchemaCompareOptionsDialog.IgnoreDmlTriggerOrder:
				return SchemaCompareOptionsDialog.descriptionIgnoreDmlTriggerOrder;

			case SchemaCompareOptionsDialog.IgnoreDefaultSchema:
				return SchemaCompareOptionsDialog.descriptionIgnoreDefaultSchema;

			case SchemaCompareOptionsDialog.IgnoreDdlTriggerState:
				return SchemaCompareOptionsDialog.descriptionIgnoreDdlTriggerState;

			case SchemaCompareOptionsDialog.IgnoreDdlTriggerOrder:
				return SchemaCompareOptionsDialog.descriptionIgnoreDdlTriggerOrder;

			case SchemaCompareOptionsDialog.IgnoreCryptographicProviderFilePath:
				return SchemaCompareOptionsDialog.descriptionIgnoreCryptographicProviderFilePath;

			case SchemaCompareOptionsDialog.VerifyDeployment:
				return SchemaCompareOptionsDialog.descriptionVerifyDeployment;

			case SchemaCompareOptionsDialog.IgnoreComments:
				return SchemaCompareOptionsDialog.descriptionIgnoreComments;

			case SchemaCompareOptionsDialog.IgnoreColumnCollation:
				return SchemaCompareOptionsDialog.descriptionIgnoreColumnCollation;

			case SchemaCompareOptionsDialog.IgnoreAuthorizer:
				return SchemaCompareOptionsDialog.descriptionIgnoreAuthorizer;

			case SchemaCompareOptionsDialog.IgnoreAnsiNulls:
				return SchemaCompareOptionsDialog.descriptionIgnoreAnsiNulls;

			case SchemaCompareOptionsDialog.GenerateSmartDefaults:
				return SchemaCompareOptionsDialog.descriptionGenerateSmartDefaults;

			case SchemaCompareOptionsDialog.DropStatisticsNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropStatisticsNotInSource;

			case SchemaCompareOptionsDialog.DropRoleMembersNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropRoleMembersNotInSource;

			case SchemaCompareOptionsDialog.DropPermissionsNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropPermissionsNotInSource;

			case SchemaCompareOptionsDialog.DropObjectsNotInSource:
				return SchemaCompareOptionsDialog.descriptionDropObjectsNotInSource;

			case SchemaCompareOptionsDialog.IgnoreColumnOrder:
				return SchemaCompareOptionsDialog.descriptionIgnoreColumnOrder;
		}
	}
}
