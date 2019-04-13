/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';

const localize = nls.loadMessageBundle();

export class SchemaCompareOptionsDialog {
	private static readonly OkButtonText: string = localize('schemaCompareOptionsDialog.Ok', 'Ok');
	private static readonly CancelButtonText: string = localize('schemaCompareOptionsDialog.Cancel', 'Cancel');
	private static readonly OptionsLabel: string = localize('schemaCompare.SchemaCompareOptionsLabel', 'Schema Compare Options');
	private static readonly GeneralOptionsLabel: string = localize('schemaCompare.GeneralOptionsLabel', 'General Options');
	private static readonly ObjectTypesOptionsLabel: string = localize('schemaCompare.ObjectTypesOptionsLabel', 'Include Object Types');

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
	private static readonly VerifyCollationCompatibility: string = localize('SchemaCompare.VerifyCollationCompatibility', 'Verify CollationCompatibility');
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
	private static readonly NoAlterStatementsToChangeClrTypes: string = localize('SchemaCompare.NoAlterStatementsToChangeClrTypes', 'No Alter Statements To ChangeClrTypes');
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
	private static readonly ApplicationRoles: string = localize('SchemaCompare.ApplicationRoles', 'ApplicationRoles');
	private static readonly Assemblies: string = localize('SchemaCompare.Assemblies', 'Assemblies');
	private static readonly AssemblyFiles: string = localize('SchemaCompare.AssemblyFiles', 'AssemblyFiles');
	private static readonly AsymmetricKeys: string = localize('SchemaCompare.AsymmetricKeys', 'AsymmetricKeys');
	private static readonly BrokerPriorities: string = localize('SchemaCompare.BrokerPriorities', 'BrokerPriorities');
	private static readonly Certificates: string = localize('SchemaCompare.Certificates', 'Certificates');
	private static readonly ColumnEncryptionKeys: string = localize('SchemaCompare.ColumnEncryptionKeys', 'ColumnEncryptionKeys');
	private static readonly ColumnMasterKeys: string = localize('SchemaCompare.ColumnMasterKeys', 'ColumnMasterKeys');
	private static readonly Contracts: string = localize('SchemaCompare.Contracts', 'Contracts');
	private static readonly DatabaseOptions: string = localize('SchemaCompare.DatabaseOptions', 'DatabaseOptions');
	private static readonly DatabaseRoles: string = localize('SchemaCompare.DatabaseRoles', 'DatabaseRoles');
	private static readonly DatabaseTriggers: string = localize('SchemaCompare.DatabaseTriggers', 'DatabaseTriggers');
	private static readonly Defaults: string = localize('SchemaCompare.Defaults', 'Defaults');
	private static readonly ExtendedProperties: string = localize('SchemaCompare.ExtendedProperties', 'ExtendedProperties');
	private static readonly ExternalDataSources: string = localize('SchemaCompare.ExternalDataSources', 'ExternalDataSources');
	private static readonly ExternalFileFormats: string = localize('SchemaCompare.ExternalFileFormats', 'ExternalFileFormats');
	private static readonly ExternalTables: string = localize('SchemaCompare.ExternalTables', 'ExternalTables');
	private static readonly Filegroups: string = localize('SchemaCompare.Filegroups', 'Filegroups');
	private static readonly FileTables: string = localize('SchemaCompare.FileTables', 'FileTables');
	private static readonly FullTextCatalogs: string = localize('SchemaCompare.FullTextCatalogs', 'FullTextCatalogs');
	private static readonly FullTextStoplists: string = localize('SchemaCompare.FullTextStoplists', 'FullTextStoplists');
	private static readonly MessageTypes: string = localize('SchemaCompare.MessageTypes', 'MessageTypes');
	private static readonly PartitionFunctions: string = localize('SchemaCompare.PartitionFunctions', 'PartitionFunctions');
	private static readonly PartitionSchemes: string = localize('SchemaCompare.PartitionSchemes', 'PartitionSchemes');
	private static readonly Permissions: string = localize('SchemaCompare.Permissions', 'Permissions');
	private static readonly Queues: string = localize('SchemaCompare.Queues', 'Queues');
	private static readonly RemoteServiceBindings: string = localize('SchemaCompare.RemoteServiceBindings', 'RemoteServiceBindings');
	private static readonly RoleMembership: string = localize('SchemaCompare.RoleMembership', 'RoleMembership');
	private static readonly Rules: string = localize('SchemaCompare.Rules', 'Rules');
	private static readonly ScalarValuedFunctions: string = localize('SchemaCompare.ScalarValuedFunctions', 'ScalarValuedFunctions');
	private static readonly SearchPropertyLists: string = localize('SchemaCompare.SearchPropertyLists', 'SearchPropertyLists');
	private static readonly SecurityPolicies: string = localize('SchemaCompare.SecurityPolicies', 'SecurityPolicies');
	private static readonly Sequences: string = localize('SchemaCompare.Sequences', 'Sequences');
	private static readonly Services: string = localize('SchemaCompare.Services', 'Services');
	private static readonly Signatures: string = localize('SchemaCompare.Signatures', 'Signatures');
	private static readonly StoredProcedures: string = localize('SchemaCompare.StoredProcedures', 'StoredProcedures');
	private static readonly SymmetricKeys: string = localize('SchemaCompare.SymmetricKeys', 'SymmetricKeys');
	private static readonly Synonyms: string = localize('SchemaCompare.Synonyms', 'Synonyms');
	private static readonly Tables: string = localize('SchemaCompare.Tables', 'Tables');
	private static readonly TableValuedFunctions: string = localize('SchemaCompare.TableValuedFunctions', 'TableValuedFunctions');
	private static readonly UserDefinedDataTypes: string = localize('SchemaCompare.UserDefinedDataTypes', 'UserDefinedDataTypes');
	private static readonly UserDefinedTableTypes: string = localize('SchemaCompare.UserDefinedTableTypes', 'UserDefinedTableTypes');
	private static readonly ClrUserDefinedTypes: string = localize('SchemaCompare.ClrUserDefinedTypes', 'ClrUserDefinedTypes');
	private static readonly Users: string = localize('SchemaCompare.Users', 'Users');
	private static readonly Views: string = localize('SchemaCompare.Views', 'Views');
	private static readonly XmlSchemaCollections: string = localize('SchemaCompare.XmlSchemaCollections', 'XmlSchemaCollections');
	private static readonly Audits: string = localize('SchemaCompare.Audits', 'Audits');
	private static readonly Credentials: string = localize('SchemaCompare.Credentials', 'Credentials');
	private static readonly CryptographicProviders: string = localize('SchemaCompare.CryptographicProviders', 'CryptographicProviders');
	private static readonly DatabaseAuditSpecifications: string = localize('SchemaCompare.DatabaseAuditSpecifications', 'DatabaseAuditSpecifications');
	private static readonly DatabaseEncryptionKeys: string = localize('SchemaCompare.DatabaseEncryptionKeys', 'DatabaseEncryptionKeys');
	private static readonly DatabaseScopedCredentials: string = localize('SchemaCompare.DatabaseScopedCredentials', 'DatabaseScopedCredentials');
	private static readonly Endpoints: string = localize('SchemaCompare.Endpoints', 'Endpoints');
	private static readonly ErrorMessages: string = localize('SchemaCompare.ErrorMessages', 'ErrorMessages');
	private static readonly EventNotifications: string = localize('SchemaCompare.EventNotifications', 'EventNotifications');
	private static readonly EventSessions: string = localize('SchemaCompare.EventSessions', 'EventSessions');
	private static readonly LinkedServerLogins: string = localize('SchemaCompare.LinkedServerLogins', 'LinkedServerLogins');
	private static readonly LinkedServers: string = localize('SchemaCompare.LinkedServers', 'LinkedServers');
	private static readonly Logins: string = localize('SchemaCompare.Logins', 'Logins');
	private static readonly MasterKeys: string = localize('SchemaCompare.MasterKeys', 'MasterKeys');
	private static readonly Routes: string = localize('SchemaCompare.Routes', 'Routes');
	private static readonly ServerAuditSpecifications: string = localize('SchemaCompare.ServerAuditSpecifications', 'ServerAuditSpecifications');
	private static readonly ServerRoleMembership: string = localize('SchemaCompare.ServerRoleMembership', 'ServerRoleMembership');
	private static readonly ServerRoles: string = localize('SchemaCompare.ServerRoles', 'ServerRoles');
	private static readonly ServerTriggers: string = localize('SchemaCompare.ServerTriggers', 'ServerTriggers');

	public dialog: azdata.window.Dialog;
	public schemaCompareOptions: azdata.SchemaCompareOptions;

	private generalOptionsTab: azdata.window.DialogTab;
	private objectTypesTab: azdata.window.DialogTab;
	private optionsFlexBuilder: azdata.FlexContainer;
	private objectTypesFlexBuilder: azdata.FlexContainer;
	private generaloptionsCheckBoxes: azdata.CheckBoxComponent[] = [];
	private objectTypesCheckBoxes: azdata.CheckBoxComponent[] = [];
	private excludedObjectTypes: azdata.SchemaObjectType[] = [];

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
	];

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
	];

	constructor(defaultOptions: azdata.SchemaCompareOptions) {
		this.schemaCompareOptions = defaultOptions;
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

		azdata.window.openDialog(this.dialog);
	}

	protected async execute() {
		this.SetSchemaCompareOptions();
		this.SetObjectTypeOptions();
	}

	protected async cancel() {
	}

	private async initializeSchemaCompareOptionsDialogTab() {
		this.generalOptionsTab.registerContent(async view => {

			this.optionsFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'column', })
				.component();

			this.GetGeneralOptionCheckBoxes(view);
			this.generaloptionsCheckBoxes.forEach(box => {
				this.optionsFlexBuilder.addItem(box);
			});
			await view.initializeModel(this.optionsFlexBuilder);
		});
	}

	private async initializeSchemaCompareObjectTypesDialogTab() {
		this.objectTypesTab.registerContent(async view => {

			this.objectTypesFlexBuilder = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'column' })
				.component();

			this.GetObjectTypesCheckBoxes(view);
			this.objectTypesCheckBoxes.forEach(b => {
				this.objectTypesFlexBuilder.addItem(b);
			});
			await view.initializeModel(this.objectTypesFlexBuilder);
		});
	}

	private GetGeneralOptionCheckBoxes(view: azdata.ModelView) {
		this.optionsLabels.forEach(l => {
			let box: azdata.CheckBoxComponent = view.modelBuilder.checkBox().withProperties({
				checked: this.GetSchemaCompareOptionUtil(l),
				label: l
			}).component();
			this.generaloptionsCheckBoxes.push(box);
		});
	}

	private GetObjectTypesCheckBoxes(view: azdata.ModelView) {
		this.objectTypeLabels.forEach(l => {
			let box: azdata.CheckBoxComponent = view.modelBuilder.checkBox().withProperties({
				checked: this.GetSchemaCompareIncludedObjectsUtil(l),
				label: l
			}).component();
			this.objectTypesCheckBoxes.push(box);
		});
	}

	private SetSchemaCompareOptions() {
		this.generaloptionsCheckBoxes.forEach(box => {
			this.SetSchemaCompareOptionUtil(box.label, box.checked);
		});
	}

	private SetSchemaCompareOptionUtil(label: string, value: boolean) {
		switch (label) {
			case SchemaCompareOptionsDialog.IgnoreTableOptions:
				this.schemaCompareOptions.IgnoreTableOptions = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreSemicolonBetweenStatements:
				this.schemaCompareOptions.IgnoreSemicolonBetweenStatements = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreRouteLifetime:
				this.schemaCompareOptions.IgnoreRouteLifetime = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreRoleMembership:
				this.schemaCompareOptions.IgnoreRoleMembership = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreQuotedIdentifiers:
				this.schemaCompareOptions.IgnoreQuotedIdentifiers = value;
				break;
			case SchemaCompareOptionsDialog.IgnorePermissions:
				this.schemaCompareOptions.IgnorePermissions = value;
				break;
			case SchemaCompareOptionsDialog.IgnorePartitionSchemes:
				this.schemaCompareOptions.IgnorePartitionSchemes = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreObjectPlacementOnPartitionScheme:
				this.schemaCompareOptions.IgnoreObjectPlacementOnPartitionScheme = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreNotForReplication:
				this.schemaCompareOptions.IgnoreNotForReplication = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreLoginSids:
				this.schemaCompareOptions.IgnoreLoginSids = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreLockHintsOnIndexes:
				this.schemaCompareOptions.IgnoreLockHintsOnIndexes = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreKeywordCasing:
				this.schemaCompareOptions.IgnoreKeywordCasing = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIndexPadding:
				this.schemaCompareOptions.IgnoreIndexPadding = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIndexOptions:
				this.schemaCompareOptions.IgnoreIndexOptions = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIncrement:
				this.schemaCompareOptions.IgnoreIncrement = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreIdentitySeed:
				this.schemaCompareOptions.IgnoreIdentitySeed = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreUserSettingsObjects:
				this.schemaCompareOptions.IgnoreUserSettingsObjects = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFullTextCatalogFilePath:
				this.schemaCompareOptions.IgnoreFullTextCatalogFilePath = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreWhitespace:
				this.schemaCompareOptions.IgnoreWhitespace = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnForeignKeys:
				this.schemaCompareOptions.IgnoreWithNocheckOnForeignKeys = value;
				break;
			case SchemaCompareOptionsDialog.VerifyCollationCompatibility:
				this.schemaCompareOptions.VerifyCollationCompatibility = value;
				break;
			case SchemaCompareOptionsDialog.UnmodifiableObjectWarnings:
				this.schemaCompareOptions.UnmodifiableObjectWarnings = value;
				break;
			case SchemaCompareOptionsDialog.TreatVerificationErrorsAsWarnings:
				this.schemaCompareOptions.TreatVerificationErrorsAsWarnings = value;
				break;
			case SchemaCompareOptionsDialog.ScriptRefreshModule:
				this.schemaCompareOptions.ScriptRefreshModule = value;
				break;
			case SchemaCompareOptionsDialog.ScriptNewConstraintValidation:
				this.schemaCompareOptions.ScriptNewConstraintValidation = value;
				break;
			case SchemaCompareOptionsDialog.ScriptFileSize:
				this.schemaCompareOptions.ScriptFileSize = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDeployStateChecks:
				this.schemaCompareOptions.ScriptDeployStateChecks = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDatabaseOptions:
				this.schemaCompareOptions.ScriptDatabaseOptions = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDatabaseCompatibility:
				this.schemaCompareOptions.ScriptDatabaseCompatibility = value;
				break;
			case SchemaCompareOptionsDialog.ScriptDatabaseCollation:
				this.schemaCompareOptions.ScriptDatabaseCollation = value;
				break;
			case SchemaCompareOptionsDialog.RunDeploymentPlanExecutors:
				this.schemaCompareOptions.RunDeploymentPlanExecutors = value;
				break;
			case SchemaCompareOptionsDialog.RegisterDataTierApplication:
				this.schemaCompareOptions.RegisterDataTierApplication = value;
				break;
			case SchemaCompareOptionsDialog.PopulateFilesOnFileGroups:
				this.schemaCompareOptions.PopulateFilesOnFileGroups = value;
				break;
			case SchemaCompareOptionsDialog.NoAlterStatementsToChangeClrTypes:
				this.schemaCompareOptions.NoAlterStatementsToChangeClrTypes = value;
				break;
			case SchemaCompareOptionsDialog.IncludeTransactionalScripts:
				this.schemaCompareOptions.IncludeTransactionalScripts = value;
				break;
			case SchemaCompareOptionsDialog.IncludeCompositeObjects:
				this.schemaCompareOptions.IncludeCompositeObjects = value;
				break;
			case SchemaCompareOptionsDialog.AllowUnsafeRowLevelSecurityDataMovement:
				this.schemaCompareOptions.AllowUnsafeRowLevelSecurityDataMovement = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnCheckConstraints:
				this.schemaCompareOptions.IgnoreWithNocheckOnCheckConstraints = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFillFactor:
				this.schemaCompareOptions.IgnoreFillFactor = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFileSize:
				this.schemaCompareOptions.IgnoreFileSize = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFilegroupPlacement:
				this.schemaCompareOptions.IgnoreFilegroupPlacement = value;
				break;
			case SchemaCompareOptionsDialog.DoNotAlterReplicatedObjects:
				this.schemaCompareOptions.DoNotAlterReplicatedObjects = value;
				break;
			case SchemaCompareOptionsDialog.DoNotAlterChangeDataCaptureObjects:
				this.schemaCompareOptions.DoNotAlterChangeDataCaptureObjects = value;
				break;
			case SchemaCompareOptionsDialog.DisableAndReenableDdlTriggers:
				this.schemaCompareOptions.DisableAndReenableDdlTriggers = value;
				break;
			case SchemaCompareOptionsDialog.DeployDatabaseInSingleUserMode:
				this.schemaCompareOptions.DeployDatabaseInSingleUserMode = value;
				break;
			case SchemaCompareOptionsDialog.CreateNewDatabase:
				this.schemaCompareOptions.CreateNewDatabase = value;
				break;
			case SchemaCompareOptionsDialog.CompareUsingTargetCollation:
				this.schemaCompareOptions.CompareUsingTargetCollation = value;
				break;
			case SchemaCompareOptionsDialog.CommentOutSetVarDeclarations:
				this.schemaCompareOptions.CommentOutSetVarDeclarations = value;
				break;
			case SchemaCompareOptionsDialog.BlockWhenDriftDetected:
				this.schemaCompareOptions.BlockWhenDriftDetected = value;
				break;
			case SchemaCompareOptionsDialog.BlockOnPossibleDataLoss:
				this.schemaCompareOptions.BlockOnPossibleDataLoss = value;
				break;
			case SchemaCompareOptionsDialog.BackupDatabaseBeforeChanges:
				this.schemaCompareOptions.BackupDatabaseBeforeChanges = value;
				break;
			case SchemaCompareOptionsDialog.AllowIncompatiblePlatform:
				this.schemaCompareOptions.AllowIncompatiblePlatform = value;
				break;
			case SchemaCompareOptionsDialog.AllowDropBlockingAssemblies:
				this.schemaCompareOptions.AllowDropBlockingAssemblies = value;
				break;
			case SchemaCompareOptionsDialog.DropConstraintsNotInSource:
				this.schemaCompareOptions.DropConstraintsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropDmlTriggersNotInSource:
				this.schemaCompareOptions.DropDmlTriggersNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropExtendedPropertiesNotInSource:
				this.schemaCompareOptions.DropExtendedPropertiesNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropIndexesNotInSource:
				this.schemaCompareOptions.DropIndexesNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreFileAndLogFilePath:
				this.schemaCompareOptions.IgnoreFileAndLogFilePath = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreExtendedProperties:
				this.schemaCompareOptions.IgnoreExtendedProperties = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDmlTriggerState:
				this.schemaCompareOptions.IgnoreDmlTriggerState = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDmlTriggerOrder:
				this.schemaCompareOptions.IgnoreDmlTriggerOrder = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDefaultSchema:
				this.schemaCompareOptions.IgnoreDefaultSchema = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDdlTriggerState:
				this.schemaCompareOptions.IgnoreDdlTriggerState = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreDdlTriggerOrder:
				this.schemaCompareOptions.IgnoreDdlTriggerOrder = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreCryptographicProviderFilePath:
				this.schemaCompareOptions.IgnoreCryptographicProviderFilePath = value;
				break;
			case SchemaCompareOptionsDialog.VerifyDeployment:
				this.schemaCompareOptions.VerifyDeployment = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreComments:
				this.schemaCompareOptions.IgnoreComments = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreColumnCollation:
				this.schemaCompareOptions.IgnoreColumnCollation = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreAuthorizer:
				this.schemaCompareOptions.IgnoreAuthorizer = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreAnsiNulls:
				this.schemaCompareOptions.IgnoreAnsiNulls = value;
				break;
			case SchemaCompareOptionsDialog.GenerateSmartDefaults:
				this.schemaCompareOptions.GenerateSmartDefaults = value;
				break;
			case SchemaCompareOptionsDialog.DropStatisticsNotInSource:
				this.schemaCompareOptions.DropStatisticsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropRoleMembersNotInSource:
				this.schemaCompareOptions.DropRoleMembersNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropPermissionsNotInSource:
				this.schemaCompareOptions.DropPermissionsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.DropObjectsNotInSource:
				this.schemaCompareOptions.DropObjectsNotInSource = value;
				break;
			case SchemaCompareOptionsDialog.IgnoreColumnOrder:
				this.schemaCompareOptions.IgnoreColumnOrder = value;
				break;
		}
	}

	private GetSchemaCompareOptionUtil(label): boolean {
		switch (label) {
			case SchemaCompareOptionsDialog.IgnoreTableOptions:
				return this.schemaCompareOptions.IgnoreTableOptions;

			case SchemaCompareOptionsDialog.IgnoreSemicolonBetweenStatements:
				return this.schemaCompareOptions.IgnoreSemicolonBetweenStatements;

			case SchemaCompareOptionsDialog.IgnoreRouteLifetime:
				return this.schemaCompareOptions.IgnoreRouteLifetime;

			case SchemaCompareOptionsDialog.IgnoreRoleMembership:
				return this.schemaCompareOptions.IgnoreRoleMembership;

			case SchemaCompareOptionsDialog.IgnoreQuotedIdentifiers:
				return this.schemaCompareOptions.IgnoreQuotedIdentifiers;

			case SchemaCompareOptionsDialog.IgnorePermissions:
				return this.schemaCompareOptions.IgnorePermissions;

			case SchemaCompareOptionsDialog.IgnorePartitionSchemes:
				return this.schemaCompareOptions.IgnorePartitionSchemes;

			case SchemaCompareOptionsDialog.IgnoreObjectPlacementOnPartitionScheme:
				return this.schemaCompareOptions.IgnoreObjectPlacementOnPartitionScheme;

			case SchemaCompareOptionsDialog.IgnoreNotForReplication:
				return this.schemaCompareOptions.IgnoreNotForReplication;

			case SchemaCompareOptionsDialog.IgnoreLoginSids:
				return this.schemaCompareOptions.IgnoreLoginSids;

			case SchemaCompareOptionsDialog.IgnoreLockHintsOnIndexes:
				return this.schemaCompareOptions.IgnoreLockHintsOnIndexes;

			case SchemaCompareOptionsDialog.IgnoreKeywordCasing:
				return this.schemaCompareOptions.IgnoreKeywordCasing;

			case SchemaCompareOptionsDialog.IgnoreIndexPadding:
				return this.schemaCompareOptions.IgnoreIndexPadding;

			case SchemaCompareOptionsDialog.IgnoreIndexOptions:
				return this.schemaCompareOptions.IgnoreIndexOptions;

			case SchemaCompareOptionsDialog.IgnoreIncrement:
				return this.schemaCompareOptions.IgnoreIncrement;

			case SchemaCompareOptionsDialog.IgnoreIdentitySeed:
				return this.schemaCompareOptions.IgnoreIdentitySeed;

			case SchemaCompareOptionsDialog.IgnoreUserSettingsObjects:
				return this.schemaCompareOptions.IgnoreUserSettingsObjects;

			case SchemaCompareOptionsDialog.IgnoreFullTextCatalogFilePath:
				return this.schemaCompareOptions.IgnoreFullTextCatalogFilePath;

			case SchemaCompareOptionsDialog.IgnoreWhitespace:
				return this.schemaCompareOptions.IgnoreWhitespace;

			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnForeignKeys:
				return this.schemaCompareOptions.IgnoreWithNocheckOnForeignKeys;

			case SchemaCompareOptionsDialog.VerifyCollationCompatibility:
				return this.schemaCompareOptions.VerifyCollationCompatibility;

			case SchemaCompareOptionsDialog.UnmodifiableObjectWarnings:
				return this.schemaCompareOptions.UnmodifiableObjectWarnings;

			case SchemaCompareOptionsDialog.TreatVerificationErrorsAsWarnings:
				return this.schemaCompareOptions.TreatVerificationErrorsAsWarnings;

			case SchemaCompareOptionsDialog.ScriptRefreshModule:
				return this.schemaCompareOptions.ScriptRefreshModule;

			case SchemaCompareOptionsDialog.ScriptNewConstraintValidation:
				return this.schemaCompareOptions.ScriptNewConstraintValidation;

			case SchemaCompareOptionsDialog.ScriptFileSize:
				return this.schemaCompareOptions.ScriptFileSize;

			case SchemaCompareOptionsDialog.ScriptDeployStateChecks:
				return this.schemaCompareOptions.ScriptDeployStateChecks;

			case SchemaCompareOptionsDialog.ScriptDatabaseOptions:
				return this.schemaCompareOptions.ScriptDatabaseOptions;

			case SchemaCompareOptionsDialog.ScriptDatabaseCompatibility:
				return this.schemaCompareOptions.ScriptDatabaseCompatibility;

			case SchemaCompareOptionsDialog.ScriptDatabaseCollation:
				return this.schemaCompareOptions.ScriptDatabaseCollation;

			case SchemaCompareOptionsDialog.RunDeploymentPlanExecutors:
				return this.schemaCompareOptions.RunDeploymentPlanExecutors;

			case SchemaCompareOptionsDialog.RegisterDataTierApplication:
				return this.schemaCompareOptions.RegisterDataTierApplication;

			case SchemaCompareOptionsDialog.PopulateFilesOnFileGroups:
				return this.schemaCompareOptions.PopulateFilesOnFileGroups;

			case SchemaCompareOptionsDialog.NoAlterStatementsToChangeClrTypes:
				return this.schemaCompareOptions.NoAlterStatementsToChangeClrTypes;

			case SchemaCompareOptionsDialog.IncludeTransactionalScripts:
				return this.schemaCompareOptions.IncludeTransactionalScripts;

			case SchemaCompareOptionsDialog.IncludeCompositeObjects:
				return this.schemaCompareOptions.IncludeCompositeObjects;

			case SchemaCompareOptionsDialog.AllowUnsafeRowLevelSecurityDataMovement:
				return this.schemaCompareOptions.AllowUnsafeRowLevelSecurityDataMovement;

			case SchemaCompareOptionsDialog.IgnoreWithNocheckOnCheckConstraints:
				return this.schemaCompareOptions.IgnoreWithNocheckOnCheckConstraints;

			case SchemaCompareOptionsDialog.IgnoreFillFactor:
				return this.schemaCompareOptions.IgnoreFillFactor;

			case SchemaCompareOptionsDialog.IgnoreFileSize:
				return this.schemaCompareOptions.IgnoreFileSize;

			case SchemaCompareOptionsDialog.IgnoreFilegroupPlacement:
				return this.schemaCompareOptions.IgnoreFilegroupPlacement;

			case SchemaCompareOptionsDialog.DoNotAlterReplicatedObjects:
				return this.schemaCompareOptions.DoNotAlterReplicatedObjects;

			case SchemaCompareOptionsDialog.DoNotAlterChangeDataCaptureObjects:
				return this.schemaCompareOptions.DoNotAlterChangeDataCaptureObjects;

			case SchemaCompareOptionsDialog.DisableAndReenableDdlTriggers:
				return this.schemaCompareOptions.DisableAndReenableDdlTriggers;

			case SchemaCompareOptionsDialog.DeployDatabaseInSingleUserMode:
				return this.schemaCompareOptions.DeployDatabaseInSingleUserMode;

			case SchemaCompareOptionsDialog.CreateNewDatabase:
				return this.schemaCompareOptions.CreateNewDatabase;

			case SchemaCompareOptionsDialog.CompareUsingTargetCollation:
				return this.schemaCompareOptions.CompareUsingTargetCollation;

			case SchemaCompareOptionsDialog.CommentOutSetVarDeclarations:
				return this.schemaCompareOptions.CommentOutSetVarDeclarations;

			case SchemaCompareOptionsDialog.BlockWhenDriftDetected:
				return this.schemaCompareOptions.BlockWhenDriftDetected;

			case SchemaCompareOptionsDialog.BlockOnPossibleDataLoss:
				return this.schemaCompareOptions.BlockOnPossibleDataLoss;

			case SchemaCompareOptionsDialog.BackupDatabaseBeforeChanges:
				return this.schemaCompareOptions.BackupDatabaseBeforeChanges;

			case SchemaCompareOptionsDialog.AllowIncompatiblePlatform:
				return this.schemaCompareOptions.AllowIncompatiblePlatform;

			case SchemaCompareOptionsDialog.AllowDropBlockingAssemblies:
				return this.schemaCompareOptions.AllowDropBlockingAssemblies;

			case SchemaCompareOptionsDialog.DropConstraintsNotInSource:
				return this.schemaCompareOptions.DropConstraintsNotInSource;

			case SchemaCompareOptionsDialog.DropDmlTriggersNotInSource:
				return this.schemaCompareOptions.DropDmlTriggersNotInSource;

			case SchemaCompareOptionsDialog.DropExtendedPropertiesNotInSource:
				return this.schemaCompareOptions.DropExtendedPropertiesNotInSource;

			case SchemaCompareOptionsDialog.DropIndexesNotInSource:
				return this.schemaCompareOptions.DropIndexesNotInSource;

			case SchemaCompareOptionsDialog.IgnoreFileAndLogFilePath:
				return this.schemaCompareOptions.IgnoreFileAndLogFilePath;

			case SchemaCompareOptionsDialog.IgnoreExtendedProperties:
				return this.schemaCompareOptions.IgnoreExtendedProperties;

			case SchemaCompareOptionsDialog.IgnoreDmlTriggerState:
				return this.schemaCompareOptions.IgnoreDmlTriggerState;

			case SchemaCompareOptionsDialog.IgnoreDmlTriggerOrder:
				return this.schemaCompareOptions.IgnoreDmlTriggerOrder;

			case SchemaCompareOptionsDialog.IgnoreDefaultSchema:
				return this.schemaCompareOptions.IgnoreDefaultSchema;

			case SchemaCompareOptionsDialog.IgnoreDdlTriggerState:
				return this.schemaCompareOptions.IgnoreDdlTriggerState;

			case SchemaCompareOptionsDialog.IgnoreDdlTriggerOrder:
				return this.schemaCompareOptions.IgnoreDdlTriggerOrder;

			case SchemaCompareOptionsDialog.IgnoreCryptographicProviderFilePath:
				return this.schemaCompareOptions.IgnoreCryptographicProviderFilePath;

			case SchemaCompareOptionsDialog.VerifyDeployment:
				return this.schemaCompareOptions.VerifyDeployment;

			case SchemaCompareOptionsDialog.IgnoreComments:
				return this.schemaCompareOptions.IgnoreComments;

			case SchemaCompareOptionsDialog.IgnoreColumnCollation:
				return this.schemaCompareOptions.IgnoreColumnCollation;

			case SchemaCompareOptionsDialog.IgnoreAuthorizer:
				return this.schemaCompareOptions.IgnoreAuthorizer;

			case SchemaCompareOptionsDialog.IgnoreAnsiNulls:
				return this.schemaCompareOptions.IgnoreAnsiNulls;

			case SchemaCompareOptionsDialog.GenerateSmartDefaults:
				return this.schemaCompareOptions.GenerateSmartDefaults;

			case SchemaCompareOptionsDialog.DropStatisticsNotInSource:
				return this.schemaCompareOptions.DropStatisticsNotInSource;

			case SchemaCompareOptionsDialog.DropRoleMembersNotInSource:
				return this.schemaCompareOptions.DropRoleMembersNotInSource;

			case SchemaCompareOptionsDialog.DropPermissionsNotInSource:
				return this.schemaCompareOptions.DropPermissionsNotInSource;

			case SchemaCompareOptionsDialog.DropObjectsNotInSource:
				return this.schemaCompareOptions.DropObjectsNotInSource;

			case SchemaCompareOptionsDialog.IgnoreColumnOrder:
				return this.schemaCompareOptions.IgnoreColumnOrder;
		}
		return false;
	}

	private SetObjectTypeOptions() {
		this.objectTypesCheckBoxes.forEach(box => {
			this.SetSchemaCompareIncludedObjectsUtil(box.label, box.checked);
		});
		this.schemaCompareOptions.ExcludeObjectTypes = this.excludedObjectTypes;
	}

	private GetSchemaCompareIncludedObjectsUtil(label): boolean {
		switch (label) {
			case SchemaCompareOptionsDialog.Aggregates:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Aggregates)) ? false : true;
			case SchemaCompareOptionsDialog.ApplicationRoles:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ApplicationRoles)) ? false : true;
			case SchemaCompareOptionsDialog.Assemblies:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Assemblies)) ? false : true;
			case SchemaCompareOptionsDialog.AssemblyFiles:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.AssemblyFiles)) ? false : true;
			case SchemaCompareOptionsDialog.AsymmetricKeys:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.AsymmetricKeys)) ? false : true;
			case SchemaCompareOptionsDialog.BrokerPriorities:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.BrokerPriorities)) ? false : true;
			case SchemaCompareOptionsDialog.Certificates:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Certificates)) ? false : true;
			case SchemaCompareOptionsDialog.ColumnEncryptionKeys:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ColumnEncryptionKeys)) ? false : true;
			case SchemaCompareOptionsDialog.ColumnMasterKeys:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ColumnMasterKeys)) ? false : true;
			case SchemaCompareOptionsDialog.Contracts:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Contracts)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseOptions:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.DatabaseOptions)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseRoles:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.DatabaseRoles)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseTriggers:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.DatabaseTriggers)) ? false : true;
			case SchemaCompareOptionsDialog.Defaults:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Defaults)) ? false : true;
			case SchemaCompareOptionsDialog.ExtendedProperties:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ExtendedProperties)) ? false : true;
			case SchemaCompareOptionsDialog.ExternalDataSources:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ExternalDataSources)) ? false : true;
			case SchemaCompareOptionsDialog.ExternalFileFormats:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ExternalFileFormats)) ? false : true;
			case SchemaCompareOptionsDialog.ExternalTables:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ExternalTables)) ? false : true;
			case SchemaCompareOptionsDialog.Filegroups:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Filegroups)) ? false : true;
			case SchemaCompareOptionsDialog.FileTables:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.FileTables)) ? false : true;
			case SchemaCompareOptionsDialog.FullTextCatalogs:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.FullTextCatalogs)) ? false : true;
			case SchemaCompareOptionsDialog.FullTextStoplists:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.FullTextStoplists)) ? false : true;
			case SchemaCompareOptionsDialog.MessageTypes:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.MessageTypes)) ? false : true;
			case SchemaCompareOptionsDialog.PartitionFunctions:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.PartitionFunctions)) ? false : true;
			case SchemaCompareOptionsDialog.PartitionSchemes:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.PartitionSchemes)) ? false : true;
			case SchemaCompareOptionsDialog.Permissions:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Permissions)) ? false : true;
			case SchemaCompareOptionsDialog.Queues:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Queues)) ? false : true;
			case SchemaCompareOptionsDialog.RemoteServiceBindings:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.RemoteServiceBindings)) ? false : true;
			case SchemaCompareOptionsDialog.RoleMembership:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.RoleMembership)) ? false : true;
			case SchemaCompareOptionsDialog.Rules:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Rules)) ? false : true;
			case SchemaCompareOptionsDialog.ScalarValuedFunctions:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ScalarValuedFunctions)) ? false : true;
			case SchemaCompareOptionsDialog.SearchPropertyLists:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.SearchPropertyLists)) ? false : true;
			case SchemaCompareOptionsDialog.SecurityPolicies:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.SecurityPolicies)) ? false : true;
			case SchemaCompareOptionsDialog.Sequences:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Sequences)) ? false : true;
			case SchemaCompareOptionsDialog.Services:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Services)) ? false : true;
			case SchemaCompareOptionsDialog.Signatures:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Signatures)) ? false : true;
			case SchemaCompareOptionsDialog.StoredProcedures:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.StoredProcedures)) ? false : true;
			case SchemaCompareOptionsDialog.SymmetricKeys:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.SymmetricKeys)) ? false : true;
			case SchemaCompareOptionsDialog.Synonyms:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Synonyms)) ? false : true;
			case SchemaCompareOptionsDialog.Tables:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Tables)) ? false : true;
			case SchemaCompareOptionsDialog.TableValuedFunctions:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.TableValuedFunctions)) ? false : true;
			case SchemaCompareOptionsDialog.UserDefinedDataTypes:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.UserDefinedDataTypes)) ? false : true;
			case SchemaCompareOptionsDialog.UserDefinedTableTypes:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.UserDefinedTableTypes)) ? false : true;
			case SchemaCompareOptionsDialog.ClrUserDefinedTypes:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ClrUserDefinedTypes)) ? false : true;
			case SchemaCompareOptionsDialog.Users:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Users)) ? false : true;
			case SchemaCompareOptionsDialog.Views:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Views)) ? false : true;
			case SchemaCompareOptionsDialog.XmlSchemaCollections:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.XmlSchemaCollections)) ? false : true;
			case SchemaCompareOptionsDialog.Audits:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Audits)) ? false : true;
			case SchemaCompareOptionsDialog.Credentials:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Credentials)) ? false : true;
			case SchemaCompareOptionsDialog.CryptographicProviders:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.CryptographicProviders)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseAuditSpecifications:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.DatabaseAuditSpecifications)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseEncryptionKeys:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.DatabaseEncryptionKeys)) ? false : true;
			case SchemaCompareOptionsDialog.DatabaseScopedCredentials:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.DatabaseScopedCredentials)) ? false : true;
			case SchemaCompareOptionsDialog.Endpoints:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Endpoints)) ? false : true;
			case SchemaCompareOptionsDialog.ErrorMessages:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ErrorMessages)) ? false : true;
			case SchemaCompareOptionsDialog.EventNotifications:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.EventNotifications)) ? false : true;
			case SchemaCompareOptionsDialog.EventSessions:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.EventSessions)) ? false : true;
			case SchemaCompareOptionsDialog.LinkedServerLogins:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.LinkedServerLogins)) ? false : true;
			case SchemaCompareOptionsDialog.LinkedServers:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.LinkedServers)) ? false : true;
			case SchemaCompareOptionsDialog.Logins:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Logins)) ? false : true;
			case SchemaCompareOptionsDialog.MasterKeys:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.MasterKeys)) ? false : true;
			case SchemaCompareOptionsDialog.Routes:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.Routes)) ? false : true;
			case SchemaCompareOptionsDialog.ServerAuditSpecifications:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ServerAuditSpecifications)) ? false : true;
			case SchemaCompareOptionsDialog.ServerRoleMembership:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ServerRoleMembership)) ? false : true;
			case SchemaCompareOptionsDialog.ServerRoles:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ServerRoles)) ? false : true;
			case SchemaCompareOptionsDialog.ServerTriggers:
				return (this.schemaCompareOptions.ExcludeObjectTypes.find(x => x === azdata.SchemaObjectType.ServerTriggers)) ? false : true;
		}
		return false;
	}

	private SetSchemaCompareIncludedObjectsUtil(label: string, included: boolean) {
		switch (label) {
			case SchemaCompareOptionsDialog.Aggregates:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Aggregates);
				}
				return;
			case SchemaCompareOptionsDialog.ApplicationRoles:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ApplicationRoles);
				}
				return;
			case SchemaCompareOptionsDialog.Assemblies:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Assemblies);
				}
				return;
			case SchemaCompareOptionsDialog.AssemblyFiles:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.AssemblyFiles);
				}
				return;
			case SchemaCompareOptionsDialog.AsymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.AsymmetricKeys);
				}
				return;
			case SchemaCompareOptionsDialog.BrokerPriorities:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.BrokerPriorities);
				}
				return;
			case SchemaCompareOptionsDialog.Certificates:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Certificates);
				}
				return;
			case SchemaCompareOptionsDialog.ColumnEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ColumnEncryptionKeys);
				}
				return;
			case SchemaCompareOptionsDialog.ColumnMasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ColumnMasterKeys);
				}
				return;
			case SchemaCompareOptionsDialog.Contracts:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Contracts);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseOptions:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.DatabaseOptions);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseRoles:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.DatabaseRoles);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseTriggers:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.DatabaseTriggers);
				}
				return;
			case SchemaCompareOptionsDialog.Defaults:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Defaults);
				}
				return;
			case SchemaCompareOptionsDialog.ExtendedProperties:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ExtendedProperties);
				}
				return;
			case SchemaCompareOptionsDialog.ExternalDataSources:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ExternalDataSources);
				}
				return;
			case SchemaCompareOptionsDialog.ExternalFileFormats:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ExternalFileFormats);
				}
				return;
			case SchemaCompareOptionsDialog.ExternalTables:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ExternalTables);
				}
				return;
			case SchemaCompareOptionsDialog.Filegroups:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Filegroups);
				}
				return;
			case SchemaCompareOptionsDialog.FileTables:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.FileTables);
				}
				return;
			case SchemaCompareOptionsDialog.FullTextCatalogs:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.FullTextCatalogs);
				}
				return;
			case SchemaCompareOptionsDialog.FullTextStoplists:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.FullTextStoplists);
				}
				return;
			case SchemaCompareOptionsDialog.MessageTypes:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.MessageTypes);
				}
				return;
			case SchemaCompareOptionsDialog.PartitionFunctions:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.PartitionFunctions);
				}
				return;
			case SchemaCompareOptionsDialog.PartitionSchemes:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.PartitionSchemes);
				}
				return;
			case SchemaCompareOptionsDialog.Permissions:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Permissions);
				}
				return;
			case SchemaCompareOptionsDialog.Queues:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Queues);
				}
				return;
			case SchemaCompareOptionsDialog.RemoteServiceBindings:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.RemoteServiceBindings);
				}
				return;
			case SchemaCompareOptionsDialog.RoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.RoleMembership);
				}
				return;
			case SchemaCompareOptionsDialog.Rules:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Rules);
				}
				return;
			case SchemaCompareOptionsDialog.ScalarValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ScalarValuedFunctions);
				}
				return;
			case SchemaCompareOptionsDialog.SearchPropertyLists:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.SearchPropertyLists);
				}
				return;
			case SchemaCompareOptionsDialog.SecurityPolicies:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.SecurityPolicies);
				}
				return;
			case SchemaCompareOptionsDialog.Sequences:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Sequences);
				}
				return;
			case SchemaCompareOptionsDialog.Services:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Services);
				}
				return;
			case SchemaCompareOptionsDialog.Signatures:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Signatures);
				}
				return;
			case SchemaCompareOptionsDialog.StoredProcedures:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.StoredProcedures);
				}
				return;
			case SchemaCompareOptionsDialog.SymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.SymmetricKeys);
				}
				return;
			case SchemaCompareOptionsDialog.Synonyms:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Synonyms);
				}
				return;
			case SchemaCompareOptionsDialog.Tables:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Tables);
				}
				return;
			case SchemaCompareOptionsDialog.TableValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.TableValuedFunctions);
				}
				return;
			case SchemaCompareOptionsDialog.UserDefinedDataTypes:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.UserDefinedDataTypes);
				}
				return;
			case SchemaCompareOptionsDialog.UserDefinedTableTypes:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.UserDefinedTableTypes);
				}
				return;
			case SchemaCompareOptionsDialog.ClrUserDefinedTypes:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ClrUserDefinedTypes);
				}
				return;
			case SchemaCompareOptionsDialog.Users:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Users);
				}
				return;
			case SchemaCompareOptionsDialog.Views:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Views);
				}
				return;
			case SchemaCompareOptionsDialog.XmlSchemaCollections:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.XmlSchemaCollections);
				}
				return;
			case SchemaCompareOptionsDialog.Audits:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Audits);
				}
				return;
			case SchemaCompareOptionsDialog.Credentials:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Credentials);
				}
				return;
			case SchemaCompareOptionsDialog.CryptographicProviders:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.CryptographicProviders);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.DatabaseAuditSpecifications);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.DatabaseEncryptionKeys);
				}
				return;
			case SchemaCompareOptionsDialog.DatabaseScopedCredentials:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.DatabaseScopedCredentials);
				}
				return;
			case SchemaCompareOptionsDialog.Endpoints:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Endpoints);
				}
				return;
			case SchemaCompareOptionsDialog.ErrorMessages:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ErrorMessages);
				}
				return;
			case SchemaCompareOptionsDialog.EventNotifications:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.EventNotifications);
				}
				return;
			case SchemaCompareOptionsDialog.EventSessions:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.EventSessions);
				}
				return;
			case SchemaCompareOptionsDialog.LinkedServerLogins:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.LinkedServerLogins);
				}
				return;
			case SchemaCompareOptionsDialog.LinkedServers:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.LinkedServers);
				}
				return;
			case SchemaCompareOptionsDialog.Logins:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Logins);
				}
				return;
			case SchemaCompareOptionsDialog.MasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.MasterKeys);
				}
				return;
			case SchemaCompareOptionsDialog.Routes:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.Routes);
				}
				return;
			case SchemaCompareOptionsDialog.ServerAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ServerAuditSpecifications);
				}
				return;
			case SchemaCompareOptionsDialog.ServerRoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ServerRoleMembership);
				}
				return;
			case SchemaCompareOptionsDialog.ServerRoles:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ServerRoles);
				}
				return;
			case SchemaCompareOptionsDialog.ServerTriggers:
				if (!included) {
					this.excludedObjectTypes.push(azdata.SchemaObjectType.ServerTriggers);
				}
				return;
		}

	}
}