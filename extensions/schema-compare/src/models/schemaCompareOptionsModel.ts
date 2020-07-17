/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from '../localizedConstants';
import * as mssql from '../../../mssql/src/mssql';
import { isNullOrUndefined } from 'util';

export class SchemaCompareOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public excludedObjectTypes: mssql.SchemaObjectType[] = [];

	public optionsLookup = {};
	public objectsLookup = {};

	public optionsLabels: string[] = [
		loc.IgnoreTableOptions,
		loc.IgnoreSemicolonBetweenStatements,
		loc.IgnoreRouteLifetime,
		loc.IgnoreRoleMembership,
		loc.IgnoreQuotedIdentifiers,
		loc.IgnorePermissions,
		loc.IgnorePartitionSchemes,
		loc.IgnoreObjectPlacementOnPartitionScheme,
		loc.IgnoreNotForReplication,
		loc.IgnoreLoginSids,
		loc.IgnoreLockHintsOnIndexes,
		loc.IgnoreKeywordCasing,
		loc.IgnoreIndexPadding,
		loc.IgnoreIndexOptions,
		loc.IgnoreIncrement,
		loc.IgnoreIdentitySeed,
		loc.IgnoreUserSettingsObjects,
		loc.IgnoreFullTextCatalogFilePath,
		loc.IgnoreWhitespace,
		loc.IgnoreWithNocheckOnForeignKeys,
		loc.VerifyCollationCompatibility,
		loc.UnmodifiableObjectWarnings,
		loc.TreatVerificationErrorsAsWarnings,
		loc.ScriptRefreshModule,
		loc.ScriptNewConstraintValidation,
		loc.ScriptFileSize,
		loc.ScriptDeployStateChecks,
		loc.ScriptDatabaseOptions,
		loc.ScriptDatabaseCompatibility,
		loc.ScriptDatabaseCollation,
		loc.RunDeploymentPlanExecutors,
		loc.RegisterDataTierApplication,
		loc.PopulateFilesOnFileGroups,
		loc.NoAlterStatementsToChangeClrTypes,
		loc.IncludeTransactionalScripts,
		loc.IncludeCompositeObjects,
		loc.AllowUnsafeRowLevelSecurityDataMovement,
		loc.IgnoreWithNocheckOnCheckConstraints,
		loc.IgnoreFillFactor,
		loc.IgnoreFileSize,
		loc.IgnoreFilegroupPlacement,
		loc.DoNotAlterReplicatedObjects,
		loc.DoNotAlterChangeDataCaptureObjects,
		loc.DisableAndReenableDdlTriggers,
		loc.DeployDatabaseInSingleUserMode,
		loc.CreateNewDatabase,
		loc.CompareUsingTargetCollation,
		loc.CommentOutSetVarDeclarations,
		loc.BlockWhenDriftDetected,
		loc.BlockOnPossibleDataLoss,
		loc.BackupDatabaseBeforeChanges,
		loc.AllowIncompatiblePlatform,
		loc.AllowDropBlockingAssemblies,
		loc.DropConstraintsNotInSource,
		loc.DropDmlTriggersNotInSource,
		loc.DropExtendedPropertiesNotInSource,
		loc.DropIndexesNotInSource,
		loc.IgnoreFileAndLogFilePath,
		loc.IgnoreExtendedProperties,
		loc.IgnoreDmlTriggerState,
		loc.IgnoreDmlTriggerOrder,
		loc.IgnoreDefaultSchema,
		loc.IgnoreDdlTriggerState,
		loc.IgnoreDdlTriggerOrder,
		loc.IgnoreCryptographicProviderFilePath,
		loc.VerifyDeployment,
		loc.IgnoreComments,
		loc.IgnoreColumnCollation,
		loc.IgnoreAuthorizer,
		loc.IgnoreAnsiNulls,
		loc.GenerateSmartDefaults,
		loc.DropStatisticsNotInSource,
		loc.DropRoleMembersNotInSource,
		loc.DropPermissionsNotInSource,
		loc.DropObjectsNotInSource,
		loc.IgnoreColumnOrder,
	].sort();

	public objectTypeLabels: string[] = [
		loc.Aggregates,
		loc.ApplicationRoles,
		loc.Assemblies,
		loc.AssemblyFiles,
		loc.AsymmetricKeys,
		loc.BrokerPriorities,
		loc.Certificates,
		loc.ColumnEncryptionKeys,
		loc.ColumnMasterKeys,
		loc.Contracts,
		loc.DatabaseOptions,
		loc.DatabaseRoles,
		loc.DatabaseTriggers,
		loc.Defaults,
		loc.ExtendedProperties,
		loc.ExternalDataSources,
		loc.ExternalFileFormats,
		loc.ExternalTables,
		loc.Filegroups,
		loc.Files,
		loc.FileTables,
		loc.FullTextCatalogs,
		loc.FullTextStoplists,
		loc.MessageTypes,
		loc.PartitionFunctions,
		loc.PartitionSchemes,
		loc.Permissions,
		loc.Queues,
		loc.RemoteServiceBindings,
		loc.RoleMembership,
		loc.Rules,
		loc.ScalarValuedFunctions,
		loc.SearchPropertyLists,
		loc.SecurityPolicies,
		loc.Sequences,
		loc.Services,
		loc.Signatures,
		loc.StoredProcedures,
		loc.SymmetricKeys,
		loc.Synonyms,
		loc.Tables,
		loc.TableValuedFunctions,
		loc.UserDefinedDataTypes,
		loc.UserDefinedTableTypes,
		loc.ClrUserDefinedTypes,
		loc.Users,
		loc.Views,
		loc.XmlSchemaCollections,
		loc.Audits,
		loc.Credentials,
		loc.CryptographicProviders,
		loc.DatabaseAuditSpecifications,
		loc.DatabaseEncryptionKeys,
		loc.DatabaseScopedCredentials,
		loc.Endpoints,
		loc.ErrorMessages,
		loc.EventNotifications,
		loc.EventSessions,
		loc.LinkedServerLogins,
		loc.LinkedServers,
		loc.Logins,
		loc.MasterKeys,
		loc.Routes,
		loc.ServerAuditSpecifications,
		loc.ServerRoleMembership,
		loc.ServerRoles,
		loc.ServerTriggers
	].sort();

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
	}

	public getOptionsData(): string[][] {
		let data = [];
		this.optionsLookup = {};
		this.optionsLabels.forEach(l => {
			let checked: boolean = this.getSchemaCompareOptionUtil(l);
			data.push([checked, l]);
			this.optionsLookup[l] = checked;
		});
		return data;
	}

	public getObjectsData(): string[][] {
		let data = [];
		this.objectsLookup = {};
		this.objectTypeLabels.forEach(l => {
			let checked: boolean = this.getSchemaCompareIncludedObjectsUtil(l);
			data.push([checked, l]);
			this.objectsLookup[l] = checked;
		});
		return data;
	}

	public setDeploymentOptions() {
		for (let option in this.optionsLookup) {
			this.setSchemaCompareOptionUtil(option, this.optionsLookup[option]);
		}
	}

	public setSchemaCompareOptionUtil(label: string, value: boolean) {
		switch (label) {
			case loc.IgnoreTableOptions:
				this.deploymentOptions.ignoreTableOptions = value;
				break;
			case loc.IgnoreSemicolonBetweenStatements:
				this.deploymentOptions.ignoreSemicolonBetweenStatements = value;
				break;
			case loc.IgnoreRouteLifetime:
				this.deploymentOptions.ignoreRouteLifetime = value;
				break;
			case loc.IgnoreRoleMembership:
				this.deploymentOptions.ignoreRoleMembership = value;
				break;
			case loc.IgnoreQuotedIdentifiers:
				this.deploymentOptions.ignoreQuotedIdentifiers = value;
				break;
			case loc.IgnorePermissions:
				this.deploymentOptions.ignorePermissions = value;
				break;
			case loc.IgnorePartitionSchemes:
				this.deploymentOptions.ignorePartitionSchemes = value;
				break;
			case loc.IgnoreObjectPlacementOnPartitionScheme:
				this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme = value;
				break;
			case loc.IgnoreNotForReplication:
				this.deploymentOptions.ignoreNotForReplication = value;
				break;
			case loc.IgnoreLoginSids:
				this.deploymentOptions.ignoreLoginSids = value;
				break;
			case loc.IgnoreLockHintsOnIndexes:
				this.deploymentOptions.ignoreLockHintsOnIndexes = value;
				break;
			case loc.IgnoreKeywordCasing:
				this.deploymentOptions.ignoreKeywordCasing = value;
				break;
			case loc.IgnoreIndexPadding:
				this.deploymentOptions.ignoreIndexPadding = value;
				break;
			case loc.IgnoreIndexOptions:
				this.deploymentOptions.ignoreIndexOptions = value;
				break;
			case loc.IgnoreIncrement:
				this.deploymentOptions.ignoreIncrement = value;
				break;
			case loc.IgnoreIdentitySeed:
				this.deploymentOptions.ignoreIdentitySeed = value;
				break;
			case loc.IgnoreUserSettingsObjects:
				this.deploymentOptions.ignoreUserSettingsObjects = value;
				break;
			case loc.IgnoreFullTextCatalogFilePath:
				this.deploymentOptions.ignoreFullTextCatalogFilePath = value;
				break;
			case loc.IgnoreWhitespace:
				this.deploymentOptions.ignoreWhitespace = value;
				break;
			case loc.IgnoreWithNocheckOnForeignKeys:
				this.deploymentOptions.ignoreWithNocheckOnForeignKeys = value;
				break;
			case loc.VerifyCollationCompatibility:
				this.deploymentOptions.verifyCollationCompatibility = value;
				break;
			case loc.UnmodifiableObjectWarnings:
				this.deploymentOptions.unmodifiableObjectWarnings = value;
				break;
			case loc.TreatVerificationErrorsAsWarnings:
				this.deploymentOptions.treatVerificationErrorsAsWarnings = value;
				break;
			case loc.ScriptRefreshModule:
				this.deploymentOptions.scriptRefreshModule = value;
				break;
			case loc.ScriptNewConstraintValidation:
				this.deploymentOptions.scriptNewConstraintValidation = value;
				break;
			case loc.ScriptFileSize:
				this.deploymentOptions.scriptFileSize = value;
				break;
			case loc.ScriptDeployStateChecks:
				this.deploymentOptions.scriptDeployStateChecks = value;
				break;
			case loc.ScriptDatabaseOptions:
				this.deploymentOptions.scriptDatabaseOptions = value;
				break;
			case loc.ScriptDatabaseCompatibility:
				this.deploymentOptions.scriptDatabaseCompatibility = value;
				break;
			case loc.ScriptDatabaseCollation:
				this.deploymentOptions.scriptDatabaseCollation = value;
				break;
			case loc.RunDeploymentPlanExecutors:
				this.deploymentOptions.runDeploymentPlanExecutors = value;
				break;
			case loc.RegisterDataTierApplication:
				this.deploymentOptions.registerDataTierApplication = value;
				break;
			case loc.PopulateFilesOnFileGroups:
				this.deploymentOptions.populateFilesOnFileGroups = value;
				break;
			case loc.NoAlterStatementsToChangeClrTypes:
				this.deploymentOptions.noAlterStatementsToChangeClrTypes = value;
				break;
			case loc.IncludeTransactionalScripts:
				this.deploymentOptions.includeTransactionalScripts = value;
				break;
			case loc.IncludeCompositeObjects:
				this.deploymentOptions.includeCompositeObjects = value;
				break;
			case loc.AllowUnsafeRowLevelSecurityDataMovement:
				this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement = value;
				break;
			case loc.IgnoreWithNocheckOnCheckConstraints:
				this.deploymentOptions.ignoreWithNocheckOnCheckConstraints = value;
				break;
			case loc.IgnoreFillFactor:
				this.deploymentOptions.ignoreFillFactor = value;
				break;
			case loc.IgnoreFileSize:
				this.deploymentOptions.ignoreFileSize = value;
				break;
			case loc.IgnoreFilegroupPlacement:
				this.deploymentOptions.ignoreFilegroupPlacement = value;
				break;
			case loc.DoNotAlterReplicatedObjects:
				this.deploymentOptions.doNotAlterReplicatedObjects = value;
				break;
			case loc.DoNotAlterChangeDataCaptureObjects:
				this.deploymentOptions.doNotAlterChangeDataCaptureObjects = value;
				break;
			case loc.DisableAndReenableDdlTriggers:
				this.deploymentOptions.disableAndReenableDdlTriggers = value;
				break;
			case loc.DeployDatabaseInSingleUserMode:
				this.deploymentOptions.deployDatabaseInSingleUserMode = value;
				break;
			case loc.CreateNewDatabase:
				this.deploymentOptions.createNewDatabase = value;
				break;
			case loc.CompareUsingTargetCollation:
				this.deploymentOptions.compareUsingTargetCollation = value;
				break;
			case loc.CommentOutSetVarDeclarations:
				this.deploymentOptions.commentOutSetVarDeclarations = value;
				break;
			case loc.BlockWhenDriftDetected:
				this.deploymentOptions.blockWhenDriftDetected = value;
				break;
			case loc.BlockOnPossibleDataLoss:
				this.deploymentOptions.blockOnPossibleDataLoss = value;
				break;
			case loc.BackupDatabaseBeforeChanges:
				this.deploymentOptions.backupDatabaseBeforeChanges = value;
				break;
			case loc.AllowIncompatiblePlatform:
				this.deploymentOptions.allowIncompatiblePlatform = value;
				break;
			case loc.AllowDropBlockingAssemblies:
				this.deploymentOptions.allowDropBlockingAssemblies = value;
				break;
			case loc.DropConstraintsNotInSource:
				this.deploymentOptions.dropConstraintsNotInSource = value;
				break;
			case loc.DropDmlTriggersNotInSource:
				this.deploymentOptions.dropDmlTriggersNotInSource = value;
				break;
			case loc.DropExtendedPropertiesNotInSource:
				this.deploymentOptions.dropExtendedPropertiesNotInSource = value;
				break;
			case loc.DropIndexesNotInSource:
				this.deploymentOptions.dropIndexesNotInSource = value;
				break;
			case loc.IgnoreFileAndLogFilePath:
				this.deploymentOptions.ignoreFileAndLogFilePath = value;
				break;
			case loc.IgnoreExtendedProperties:
				this.deploymentOptions.ignoreExtendedProperties = value;
				break;
			case loc.IgnoreDmlTriggerState:
				this.deploymentOptions.ignoreDmlTriggerState = value;
				break;
			case loc.IgnoreDmlTriggerOrder:
				this.deploymentOptions.ignoreDmlTriggerOrder = value;
				break;
			case loc.IgnoreDefaultSchema:
				this.deploymentOptions.ignoreDefaultSchema = value;
				break;
			case loc.IgnoreDdlTriggerState:
				this.deploymentOptions.ignoreDdlTriggerState = value;
				break;
			case loc.IgnoreDdlTriggerOrder:
				this.deploymentOptions.ignoreDdlTriggerOrder = value;
				break;
			case loc.IgnoreCryptographicProviderFilePath:
				this.deploymentOptions.ignoreCryptographicProviderFilePath = value;
				break;
			case loc.VerifyDeployment:
				this.deploymentOptions.verifyDeployment = value;
				break;
			case loc.IgnoreComments:
				this.deploymentOptions.ignoreComments = value;
				break;
			case loc.IgnoreColumnCollation:
				this.deploymentOptions.ignoreColumnCollation = value;
				break;
			case loc.IgnoreAuthorizer:
				this.deploymentOptions.ignoreAuthorizer = value;
				break;
			case loc.IgnoreAnsiNulls:
				this.deploymentOptions.ignoreAnsiNulls = value;
				break;
			case loc.GenerateSmartDefaults:
				this.deploymentOptions.generateSmartDefaults = value;
				break;
			case loc.DropStatisticsNotInSource:
				this.deploymentOptions.dropStatisticsNotInSource = value;
				break;
			case loc.DropRoleMembersNotInSource:
				this.deploymentOptions.dropRoleMembersNotInSource = value;
				break;
			case loc.DropPermissionsNotInSource:
				this.deploymentOptions.dropPermissionsNotInSource = value;
				break;
			case loc.DropObjectsNotInSource:
				this.deploymentOptions.dropObjectsNotInSource = value;
				break;
			case loc.IgnoreColumnOrder:
				this.deploymentOptions.ignoreColumnOrder = value;
				break;
		}
	}

	public getSchemaCompareOptionUtil(label): boolean {
		switch (label) {
			case loc.IgnoreTableOptions:
				return this.deploymentOptions.ignoreTableOptions;

			case loc.IgnoreSemicolonBetweenStatements:
				return this.deploymentOptions.ignoreSemicolonBetweenStatements;

			case loc.IgnoreRouteLifetime:
				return this.deploymentOptions.ignoreRouteLifetime;

			case loc.IgnoreRoleMembership:
				return this.deploymentOptions.ignoreRoleMembership;

			case loc.IgnoreQuotedIdentifiers:
				return this.deploymentOptions.ignoreQuotedIdentifiers;

			case loc.IgnorePermissions:
				return this.deploymentOptions.ignorePermissions;

			case loc.IgnorePartitionSchemes:
				return this.deploymentOptions.ignorePartitionSchemes;

			case loc.IgnoreObjectPlacementOnPartitionScheme:
				return this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme;

			case loc.IgnoreNotForReplication:
				return this.deploymentOptions.ignoreNotForReplication;

			case loc.IgnoreLoginSids:
				return this.deploymentOptions.ignoreLoginSids;

			case loc.IgnoreLockHintsOnIndexes:
				return this.deploymentOptions.ignoreLockHintsOnIndexes;

			case loc.IgnoreKeywordCasing:
				return this.deploymentOptions.ignoreKeywordCasing;

			case loc.IgnoreIndexPadding:
				return this.deploymentOptions.ignoreIndexPadding;

			case loc.IgnoreIndexOptions:
				return this.deploymentOptions.ignoreIndexOptions;

			case loc.IgnoreIncrement:
				return this.deploymentOptions.ignoreIncrement;

			case loc.IgnoreIdentitySeed:
				return this.deploymentOptions.ignoreIdentitySeed;

			case loc.IgnoreUserSettingsObjects:
				return this.deploymentOptions.ignoreUserSettingsObjects;

			case loc.IgnoreFullTextCatalogFilePath:
				return this.deploymentOptions.ignoreFullTextCatalogFilePath;

			case loc.IgnoreWhitespace:
				return this.deploymentOptions.ignoreWhitespace;

			case loc.IgnoreWithNocheckOnForeignKeys:
				return this.deploymentOptions.ignoreWithNocheckOnForeignKeys;

			case loc.VerifyCollationCompatibility:
				return this.deploymentOptions.verifyCollationCompatibility;

			case loc.UnmodifiableObjectWarnings:
				return this.deploymentOptions.unmodifiableObjectWarnings;

			case loc.TreatVerificationErrorsAsWarnings:
				return this.deploymentOptions.treatVerificationErrorsAsWarnings;

			case loc.ScriptRefreshModule:
				return this.deploymentOptions.scriptRefreshModule;

			case loc.ScriptNewConstraintValidation:
				return this.deploymentOptions.scriptNewConstraintValidation;

			case loc.ScriptFileSize:
				return this.deploymentOptions.scriptFileSize;

			case loc.ScriptDeployStateChecks:
				return this.deploymentOptions.scriptDeployStateChecks;

			case loc.ScriptDatabaseOptions:
				return this.deploymentOptions.scriptDatabaseOptions;

			case loc.ScriptDatabaseCompatibility:
				return this.deploymentOptions.scriptDatabaseCompatibility;

			case loc.ScriptDatabaseCollation:
				return this.deploymentOptions.scriptDatabaseCollation;

			case loc.RunDeploymentPlanExecutors:
				return this.deploymentOptions.runDeploymentPlanExecutors;

			case loc.RegisterDataTierApplication:
				return this.deploymentOptions.registerDataTierApplication;

			case loc.PopulateFilesOnFileGroups:
				return this.deploymentOptions.populateFilesOnFileGroups;

			case loc.NoAlterStatementsToChangeClrTypes:
				return this.deploymentOptions.noAlterStatementsToChangeClrTypes;

			case loc.IncludeTransactionalScripts:
				return this.deploymentOptions.includeTransactionalScripts;

			case loc.IncludeCompositeObjects:
				return this.deploymentOptions.includeCompositeObjects;

			case loc.AllowUnsafeRowLevelSecurityDataMovement:
				return this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement;

			case loc.IgnoreWithNocheckOnCheckConstraints:
				return this.deploymentOptions.ignoreWithNocheckOnCheckConstraints;

			case loc.IgnoreFillFactor:
				return this.deploymentOptions.ignoreFillFactor;

			case loc.IgnoreFileSize:
				return this.deploymentOptions.ignoreFileSize;

			case loc.IgnoreFilegroupPlacement:
				return this.deploymentOptions.ignoreFilegroupPlacement;

			case loc.DoNotAlterReplicatedObjects:
				return this.deploymentOptions.doNotAlterReplicatedObjects;

			case loc.DoNotAlterChangeDataCaptureObjects:
				return this.deploymentOptions.doNotAlterChangeDataCaptureObjects;

			case loc.DisableAndReenableDdlTriggers:
				return this.deploymentOptions.disableAndReenableDdlTriggers;

			case loc.DeployDatabaseInSingleUserMode:
				return this.deploymentOptions.deployDatabaseInSingleUserMode;

			case loc.CreateNewDatabase:
				return this.deploymentOptions.createNewDatabase;

			case loc.CompareUsingTargetCollation:
				return this.deploymentOptions.compareUsingTargetCollation;

			case loc.CommentOutSetVarDeclarations:
				return this.deploymentOptions.commentOutSetVarDeclarations;

			case loc.BlockWhenDriftDetected:
				return this.deploymentOptions.blockWhenDriftDetected;

			case loc.BlockOnPossibleDataLoss:
				return this.deploymentOptions.blockOnPossibleDataLoss;

			case loc.BackupDatabaseBeforeChanges:
				return this.deploymentOptions.backupDatabaseBeforeChanges;

			case loc.AllowIncompatiblePlatform:
				return this.deploymentOptions.allowIncompatiblePlatform;

			case loc.AllowDropBlockingAssemblies:
				return this.deploymentOptions.allowDropBlockingAssemblies;

			case loc.DropConstraintsNotInSource:
				return this.deploymentOptions.dropConstraintsNotInSource;

			case loc.DropDmlTriggersNotInSource:
				return this.deploymentOptions.dropDmlTriggersNotInSource;

			case loc.DropExtendedPropertiesNotInSource:
				return this.deploymentOptions.dropExtendedPropertiesNotInSource;

			case loc.DropIndexesNotInSource:
				return this.deploymentOptions.dropIndexesNotInSource;

			case loc.IgnoreFileAndLogFilePath:
				return this.deploymentOptions.ignoreFileAndLogFilePath;

			case loc.IgnoreExtendedProperties:
				return this.deploymentOptions.ignoreExtendedProperties;

			case loc.IgnoreDmlTriggerState:
				return this.deploymentOptions.ignoreDmlTriggerState;

			case loc.IgnoreDmlTriggerOrder:
				return this.deploymentOptions.ignoreDmlTriggerOrder;

			case loc.IgnoreDefaultSchema:
				return this.deploymentOptions.ignoreDefaultSchema;

			case loc.IgnoreDdlTriggerState:
				return this.deploymentOptions.ignoreDdlTriggerState;

			case loc.IgnoreDdlTriggerOrder:
				return this.deploymentOptions.ignoreDdlTriggerOrder;

			case loc.IgnoreCryptographicProviderFilePath:
				return this.deploymentOptions.ignoreCryptographicProviderFilePath;

			case loc.VerifyDeployment:
				return this.deploymentOptions.verifyDeployment;

			case loc.IgnoreComments:
				return this.deploymentOptions.ignoreComments;

			case loc.IgnoreColumnCollation:
				return this.deploymentOptions.ignoreColumnCollation;

			case loc.IgnoreAuthorizer:
				return this.deploymentOptions.ignoreAuthorizer;

			case loc.IgnoreAnsiNulls:
				return this.deploymentOptions.ignoreAnsiNulls;

			case loc.GenerateSmartDefaults:
				return this.deploymentOptions.generateSmartDefaults;

			case loc.DropStatisticsNotInSource:
				return this.deploymentOptions.dropStatisticsNotInSource;

			case loc.DropRoleMembersNotInSource:
				return this.deploymentOptions.dropRoleMembersNotInSource;

			case loc.DropPermissionsNotInSource:
				return this.deploymentOptions.dropPermissionsNotInSource;

			case loc.DropObjectsNotInSource:
				return this.deploymentOptions.dropObjectsNotInSource;

			case loc.IgnoreColumnOrder:
				return this.deploymentOptions.ignoreColumnOrder;
		}
		return false;
	}

	public setObjectTypeOptions() {
		for (let option in this.objectsLookup) {
			this.setSchemaCompareIncludedObjectsUtil(option, this.objectsLookup[option]);
		}
		this.deploymentOptions.excludeObjectTypes = this.excludedObjectTypes;
	}

	public getSchemaCompareIncludedObjectsUtil(label): boolean {
		switch (label) {
			case loc.Aggregates:
				return !isNullOrUndefined(this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Aggregates)) ? false : true;
			case loc.ApplicationRoles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ApplicationRoles)) ? false : true;
			case loc.Assemblies:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Assemblies)) ? false : true;
			case loc.AssemblyFiles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.AssemblyFiles)) ? false : true;
			case loc.AsymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.AsymmetricKeys)) ? false : true;
			case loc.BrokerPriorities:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.BrokerPriorities)) ? false : true;
			case loc.Certificates:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Certificates)) ? false : true;
			case loc.ColumnEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ColumnEncryptionKeys)) ? false : true;
			case loc.ColumnMasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ColumnMasterKeys)) ? false : true;
			case loc.Contracts:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Contracts)) ? false : true;
			case loc.DatabaseOptions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseOptions)) ? false : true;
			case loc.DatabaseRoles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseRoles)) ? false : true;
			case loc.DatabaseTriggers:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseTriggers)) ? false : true;
			case loc.Defaults:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Defaults)) ? false : true;
			case loc.ExtendedProperties:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExtendedProperties)) ? false : true;
			case loc.ExternalDataSources:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExternalDataSources)) ? false : true;
			case loc.ExternalFileFormats:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExternalFileFormats)) ? false : true;
			case loc.ExternalTables:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ExternalTables)) ? false : true;
			case loc.Filegroups:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Filegroups)) ? false : true;
			case loc.Files:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Files)) ? false : true;
			case loc.FileTables:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.FileTables)) ? false : true;
			case loc.FullTextCatalogs:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.FullTextCatalogs)) ? false : true;
			case loc.FullTextStoplists:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.FullTextStoplists)) ? false : true;
			case loc.MessageTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.MessageTypes)) ? false : true;
			case loc.PartitionFunctions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.PartitionFunctions)) ? false : true;
			case loc.PartitionSchemes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.PartitionSchemes)) ? false : true;
			case loc.Permissions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Permissions)) ? false : true;
			case loc.Queues:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Queues)) ? false : true;
			case loc.RemoteServiceBindings:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.RemoteServiceBindings)) ? false : true;
			case loc.RoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.RoleMembership)) ? false : true;
			case loc.Rules:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Rules)) ? false : true;
			case loc.ScalarValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ScalarValuedFunctions)) ? false : true;
			case loc.SearchPropertyLists:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.SearchPropertyLists)) ? false : true;
			case loc.SecurityPolicies:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.SecurityPolicies)) ? false : true;
			case loc.Sequences:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Sequences)) ? false : true;
			case loc.Services:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Services)) ? false : true;
			case loc.Signatures:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Signatures)) ? false : true;
			case loc.StoredProcedures:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.StoredProcedures)) ? false : true;
			case loc.SymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.SymmetricKeys)) ? false : true;
			case loc.Synonyms:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Synonyms)) ? false : true;
			case loc.Tables:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Tables)) ? false : true;
			case loc.TableValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.TableValuedFunctions)) ? false : true;
			case loc.UserDefinedDataTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.UserDefinedDataTypes)) ? false : true;
			case loc.UserDefinedTableTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.UserDefinedTableTypes)) ? false : true;
			case loc.ClrUserDefinedTypes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ClrUserDefinedTypes)) ? false : true;
			case loc.Users:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Users)) ? false : true;
			case loc.Views:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Views)) ? false : true;
			case loc.XmlSchemaCollections:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.XmlSchemaCollections)) ? false : true;
			case loc.Audits:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Audits)) ? false : true;
			case loc.Credentials:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Credentials)) ? false : true;
			case loc.CryptographicProviders:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.CryptographicProviders)) ? false : true;
			case loc.DatabaseAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseAuditSpecifications)) ? false : true;
			case loc.DatabaseEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseEncryptionKeys)) ? false : true;
			case loc.DatabaseScopedCredentials:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.DatabaseScopedCredentials)) ? false : true;
			case loc.Endpoints:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Endpoints)) ? false : true;
			case loc.ErrorMessages:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ErrorMessages)) ? false : true;
			case loc.EventNotifications:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.EventNotifications)) ? false : true;
			case loc.EventSessions:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.EventSessions)) ? false : true;
			case loc.LinkedServerLogins:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.LinkedServerLogins)) ? false : true;
			case loc.LinkedServers:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.LinkedServers)) ? false : true;
			case loc.Logins:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Logins)) ? false : true;
			case loc.MasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.MasterKeys)) ? false : true;
			case loc.Routes:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.Routes)) ? false : true;
			case loc.ServerAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerAuditSpecifications)) ? false : true;
			case loc.ServerRoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerRoleMembership)) ? false : true;
			case loc.ServerRoles:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerRoles)) ? false : true;
			case loc.ServerTriggers:
				return (this.deploymentOptions.excludeObjectTypes.find(x => x === mssql.SchemaObjectType.ServerTriggers)) ? false : true;
		}
		return false;
	}

	public setSchemaCompareIncludedObjectsUtil(label: string, included: boolean) {
		switch (label) {
			case loc.Aggregates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Aggregates);
				}
				return;
			case loc.ApplicationRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ApplicationRoles);
				}
				return;
			case loc.Assemblies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Assemblies);
				}
				return;
			case loc.AssemblyFiles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AssemblyFiles);
				}
				return;
			case loc.AsymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AsymmetricKeys);
				}
				return;
			case loc.BrokerPriorities:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.BrokerPriorities);
				}
				return;
			case loc.Certificates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Certificates);
				}
				return;
			case loc.ColumnEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnEncryptionKeys);
				}
				return;
			case loc.ColumnMasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnMasterKeys);
				}
				return;
			case loc.Contracts:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Contracts);
				}
				return;
			case loc.DatabaseOptions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseOptions);
				}
				return;
			case loc.DatabaseRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseRoles);
				}
				return;
			case loc.DatabaseTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseTriggers);
				}
				return;
			case loc.Defaults:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Defaults);
				}
				return;
			case loc.ExtendedProperties:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExtendedProperties);
				}
				return;
			case loc.ExternalDataSources:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalDataSources);
				}
				return;
			case loc.ExternalFileFormats:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalFileFormats);
				}
				return;
			case loc.ExternalTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalTables);
				}
				return;
			case loc.Filegroups:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Filegroups);
				}
				return;
			case loc.Files:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Files);
				}
				return;
			case loc.FileTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FileTables);
				}
				return;
			case loc.FullTextCatalogs:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextCatalogs);
				}
				return;
			case loc.FullTextStoplists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextStoplists);
				}
				return;
			case loc.MessageTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MessageTypes);
				}
				return;
			case loc.PartitionFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionFunctions);
				}
				return;
			case loc.PartitionSchemes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionSchemes);
				}
				return;
			case loc.Permissions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Permissions);
				}
				return;
			case loc.Queues:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Queues);
				}
				return;
			case loc.RemoteServiceBindings:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RemoteServiceBindings);
				}
				return;
			case loc.RoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RoleMembership);
				}
				return;
			case loc.Rules:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Rules);
				}
				return;
			case loc.ScalarValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ScalarValuedFunctions);
				}
				return;
			case loc.SearchPropertyLists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SearchPropertyLists);
				}
				return;
			case loc.SecurityPolicies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SecurityPolicies);
				}
				return;
			case loc.Sequences:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Sequences);
				}
				return;
			case loc.Services:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Services);
				}
				return;
			case loc.Signatures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Signatures);
				}
				return;
			case loc.StoredProcedures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.StoredProcedures);
				}
				return;
			case loc.SymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SymmetricKeys);
				}
				return;
			case loc.Synonyms:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Synonyms);
				}
				return;
			case loc.Tables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Tables);
				}
				return;
			case loc.TableValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.TableValuedFunctions);
				}
				return;
			case loc.UserDefinedDataTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedDataTypes);
				}
				return;
			case loc.UserDefinedTableTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedTableTypes);
				}
				return;
			case loc.ClrUserDefinedTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ClrUserDefinedTypes);
				}
				return;
			case loc.Users:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Users);
				}
				return;
			case loc.Views:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Views);
				}
				return;
			case loc.XmlSchemaCollections:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.XmlSchemaCollections);
				}
				return;
			case loc.Audits:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Audits);
				}
				return;
			case loc.Credentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Credentials);
				}
				return;
			case loc.CryptographicProviders:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.CryptographicProviders);
				}
				return;
			case loc.DatabaseAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseAuditSpecifications);
				}
				return;
			case loc.DatabaseEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseEncryptionKeys);
				}
				return;
			case loc.DatabaseScopedCredentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseScopedCredentials);
				}
				return;
			case loc.Endpoints:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Endpoints);
				}
				return;
			case loc.ErrorMessages:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ErrorMessages);
				}
				return;
			case loc.EventNotifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventNotifications);
				}
				return;
			case loc.EventSessions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventSessions);
				}
				return;
			case loc.LinkedServerLogins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServerLogins);
				}
				return;
			case loc.LinkedServers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServers);
				}
				return;
			case loc.Logins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Logins);
				}
				return;
			case loc.MasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MasterKeys);
				}
				return;
			case loc.Routes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Routes);
				}
				return;
			case loc.ServerAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerAuditSpecifications);
				}
				return;
			case loc.ServerRoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoleMembership);
				}
				return;
			case loc.ServerRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoles);
				}
				return;
			case loc.ServerTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerTriggers);
				}
				return;
		}
	}

	public getDescription(label: string): string {
		switch (label) {
			case loc.IgnoreTableOptions:
				return loc.descriptionIgnoreTableOptions;

			case loc.IgnoreSemicolonBetweenStatements:
				return loc.descriptionIgnoreSemicolonBetweenStatements;

			case loc.IgnoreRouteLifetime:
				return loc.descriptionIgnoreRouteLifetime;

			case loc.IgnoreRoleMembership:
				return loc.descriptionIgnoreRoleMembership;

			case loc.IgnoreQuotedIdentifiers:
				return loc.descriptionIgnoreQuotedIdentifiers;

			case loc.IgnorePermissions:
				return loc.descriptionIgnorePermissions;

			case loc.IgnorePartitionSchemes:
				return loc.descriptionIgnorePartitionSchemes;

			case loc.IgnoreObjectPlacementOnPartitionScheme:
				return loc.descriptionIgnoreObjectPlacementOnPartitionScheme;

			case loc.IgnoreNotForReplication:
				return loc.descriptionIgnoreNotForReplication;

			case loc.IgnoreLoginSids:
				return loc.descriptionIgnoreLoginSids;

			case loc.IgnoreLockHintsOnIndexes:
				return loc.descriptionIgnoreLockHintsOnIndexes;

			case loc.IgnoreKeywordCasing:
				return loc.descriptionIgnoreKeywordCasing;

			case loc.IgnoreIndexPadding:
				return loc.descriptionIgnoreIndexPadding;

			case loc.IgnoreIndexOptions:
				return loc.descriptionIgnoreIndexOptions;

			case loc.IgnoreIncrement:
				return loc.descriptionIgnoreIncrement;

			case loc.IgnoreIdentitySeed:
				return loc.descriptionIgnoreIdentitySeed;

			case loc.IgnoreUserSettingsObjects:
				return loc.descriptionIgnoreUserSettingsObjects;

			case loc.IgnoreFullTextCatalogFilePath:
				return loc.descriptionIgnoreFullTextCatalogFilePath;

			case loc.IgnoreWhitespace:
				return loc.descriptionIgnoreWhitespace;

			case loc.IgnoreWithNocheckOnForeignKeys:
				return loc.descriptionIgnoreWithNocheckOnForeignKeys;

			case loc.VerifyCollationCompatibility:
				return loc.descriptionVerifyCollationCompatibility;

			case loc.UnmodifiableObjectWarnings:
				return loc.descriptionUnmodifiableObjectWarnings;

			case loc.TreatVerificationErrorsAsWarnings:
				return loc.descriptionTreatVerificationErrorsAsWarnings;

			case loc.ScriptRefreshModule:
				return loc.descriptionScriptRefreshModule;

			case loc.ScriptNewConstraintValidation:
				return loc.descriptionScriptNewConstraintValidation;

			case loc.ScriptFileSize:
				return loc.descriptionScriptFileSize;

			case loc.ScriptDeployStateChecks:
				return loc.descriptionScriptDeployStateChecks;

			case loc.ScriptDatabaseOptions:
				return loc.descriptionScriptDatabaseOptions;

			case loc.ScriptDatabaseCompatibility:
				return loc.descriptionScriptDatabaseCompatibility;

			case loc.ScriptDatabaseCollation:
				return loc.descriptionScriptDatabaseCollation;

			case loc.RunDeploymentPlanExecutors:
				return loc.descriptionRunDeploymentPlanExecutors;

			case loc.RegisterDataTierApplication:
				return loc.descriptionRegisterDataTierApplication;

			case loc.PopulateFilesOnFileGroups:
				return loc.descriptionPopulateFilesOnFileGroups;

			case loc.NoAlterStatementsToChangeClrTypes:
				return loc.descriptionNoAlterStatementsToChangeClrTypes;

			case loc.IncludeTransactionalScripts:
				return loc.descriptionIncludeTransactionalScripts;

			case loc.IncludeCompositeObjects:
				return loc.descriptionIncludeCompositeObjects;

			case loc.AllowUnsafeRowLevelSecurityDataMovement:
				return loc.descriptionAllowUnsafeRowLevelSecurityDataMovement;

			case loc.IgnoreWithNocheckOnCheckConstraints:
				return loc.descriptionIgnoreWithNocheckOnCheckConstraints;

			case loc.IgnoreFillFactor:
				return loc.descriptionIgnoreFillFactor;

			case loc.IgnoreFileSize:
				return loc.descriptionIgnoreFileSize;

			case loc.IgnoreFilegroupPlacement:
				return loc.descriptionIgnoreFilegroupPlacement;

			case loc.DoNotAlterReplicatedObjects:
				return loc.descriptionDoNotAlterReplicatedObjects;

			case loc.DoNotAlterChangeDataCaptureObjects:
				return loc.descriptionDoNotAlterChangeDataCaptureObjects;

			case loc.DisableAndReenableDdlTriggers:
				return loc.descriptionDisableAndReenableDdlTriggers;

			case loc.DeployDatabaseInSingleUserMode:
				return loc.descriptionDeployDatabaseInSingleUserMode;

			case loc.CreateNewDatabase:
				return loc.descriptionCreateNewDatabase;

			case loc.CompareUsingTargetCollation:
				return loc.descriptionCompareUsingTargetCollation;

			case loc.CommentOutSetVarDeclarations:
				return loc.descriptionCommentOutSetVarDeclarations;

			case loc.BlockWhenDriftDetected:
				return loc.descriptionBlockWhenDriftDetected;

			case loc.BlockOnPossibleDataLoss:
				return loc.descriptionBlockOnPossibleDataLoss;

			case loc.BackupDatabaseBeforeChanges:
				return loc.descriptionBackupDatabaseBeforeChanges;

			case loc.AllowIncompatiblePlatform:
				return loc.descriptionAllowIncompatiblePlatform;

			case loc.AllowDropBlockingAssemblies:
				return loc.descriptionAllowDropBlockingAssemblies;

			case loc.DropConstraintsNotInSource:
				return loc.descriptionDropConstraintsNotInSource;

			case loc.DropDmlTriggersNotInSource:
				return loc.descriptionDropDmlTriggersNotInSource;

			case loc.DropExtendedPropertiesNotInSource:
				return loc.descriptionDropExtendedPropertiesNotInSource;

			case loc.DropIndexesNotInSource:
				return loc.descriptionDropIndexesNotInSource;

			case loc.IgnoreFileAndLogFilePath:
				return loc.descriptionIgnoreFileAndLogFilePath;

			case loc.IgnoreExtendedProperties:
				return loc.descriptionIgnoreExtendedProperties;

			case loc.IgnoreDmlTriggerState:
				return loc.descriptionIgnoreDmlTriggerState;

			case loc.IgnoreDmlTriggerOrder:
				return loc.descriptionIgnoreDmlTriggerOrder;

			case loc.IgnoreDefaultSchema:
				return loc.descriptionIgnoreDefaultSchema;

			case loc.IgnoreDdlTriggerState:
				return loc.descriptionIgnoreDdlTriggerState;

			case loc.IgnoreDdlTriggerOrder:
				return loc.descriptionIgnoreDdlTriggerOrder;

			case loc.IgnoreCryptographicProviderFilePath:
				return loc.descriptionIgnoreCryptographicProviderFilePath;

			case loc.VerifyDeployment:
				return loc.descriptionVerifyDeployment;

			case loc.IgnoreComments:
				return loc.descriptionIgnoreComments;

			case loc.IgnoreColumnCollation:
				return loc.descriptionIgnoreColumnCollation;

			case loc.IgnoreAuthorizer:
				return loc.descriptionIgnoreAuthorizer;

			case loc.IgnoreAnsiNulls:
				return loc.descriptionIgnoreAnsiNulls;

			case loc.GenerateSmartDefaults:
				return loc.descriptionGenerateSmartDefaults;

			case loc.DropStatisticsNotInSource:
				return loc.descriptionDropStatisticsNotInSource;

			case loc.DropRoleMembersNotInSource:
				return loc.descriptionDropRoleMembersNotInSource;

			case loc.DropPermissionsNotInSource:
				return loc.descriptionDropPermissionsNotInSource;

			case loc.DropObjectsNotInSource:
				return loc.descriptionDropObjectsNotInSource;

			case loc.IgnoreColumnOrder:
				return loc.descriptionIgnoreColumnOrder;
		}
	}
}
