/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../../../../mssql/src/mssql';
import * as constants from '../../common/constants';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;

	public optionsLookup = {};

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
	}

	public optionsLabels: string[] = [
		constants.IgnoreTableOptions,
		constants.IgnoreSemicolonBetweenStatements,
		constants.IgnoreRouteLifetime,
		constants.IgnoreRoleMembership,
		constants.IgnoreQuotedIdentifiers,
		constants.IgnorePermissions,
		constants.IgnorePartitionSchemes,
		constants.IgnoreObjectPlacementOnPartitionScheme,
		constants.IgnoreNotForReplication,
		constants.IgnoreLoginSids,
		constants.IgnoreLockHintsOnIndexes,
		constants.IgnoreKeywordCasing,
		constants.IgnoreIndexPadding,
		constants.IgnoreIndexOptions,
		constants.IgnoreIncrement,
		constants.IgnoreIdentitySeed,
		constants.IgnoreUserSettingsObjects,
		constants.IgnoreFullTextCatalogFilePath,
		constants.IgnoreWhitespace,
		constants.IgnoreWithNocheckOnForeignKeys,
		constants.VerifyCollationCompatibility,
		constants.UnmodifiableObjectWarnings,
		constants.TreatVerificationErrorsAsWarnings,
		constants.ScriptRefreshModule,
		constants.ScriptNewConstraintValidation,
		constants.ScriptFileSize,
		constants.ScriptDeployStateChecks,
		constants.ScriptDatabaseOptions,
		constants.ScriptDatabaseCompatibility,
		constants.ScriptDatabaseCollation,
		constants.RunDeploymentPlanExecutors,
		constants.RegisterDataTierApplication,
		constants.PopulateFilesOnFileGroups,
		constants.NoAlterStatementsToChangeClrTypes,
		constants.IncludeTransactionalScripts,
		constants.IncludeCompositeObjects,
		constants.AllowUnsafeRowLevelSecurityDataMovement,
		constants.IgnoreWithNocheckOnCheckConstraints,
		constants.IgnoreFillFactor,
		constants.IgnoreFileSize,
		constants.IgnoreFilegroupPlacement,
		constants.DoNotAlterReplicatedObjects,
		constants.DoNotAlterChangeDataCaptureObjects,
		constants.DisableAndReenableDdlTriggers,
		constants.DeployDatabaseInSingleUserMode,
		constants.CreateNewDatabase,
		constants.CompareUsingTargetCollation,
		constants.CommentOutSetVarDeclarations,
		constants.BlockWhenDriftDetected,
		constants.BlockOnPossibleDataLoss,
		constants.BackupDatabaseBeforeChanges,
		constants.AllowIncompatiblePlatform,
		constants.AllowDropBlockingAssemblies,
		constants.DropConstraintsNotInSource,
		constants.DropDmlTriggersNotInSource,
		constants.DropExtendedPropertiesNotInSource,
		constants.DropIndexesNotInSource,
		constants.IgnoreFileAndLogFilePath,
		constants.IgnoreExtendedProperties,
		constants.IgnoreDmlTriggerState,
		constants.IgnoreDmlTriggerOrder,
		constants.IgnoreDefaultSchema,
		constants.IgnoreDdlTriggerState,
		constants.IgnoreDdlTriggerOrder,
		constants.IgnoreCryptographicProviderFilePath,
		constants.VerifyDeployment,
		constants.IgnoreComments,
		constants.IgnoreColumnCollation,
		constants.IgnoreAuthorizer,
		constants.IgnoreAnsiNulls,
		constants.GenerateSmartDefaults,
		constants.DropStatisticsNotInSource,
		constants.DropRoleMembersNotInSource,
		constants.DropPermissionsNotInSource,
		constants.DropObjectsNotInSource,
		constants.IgnoreColumnOrder,
	].sort();

	public getOptionsData(): string[][] {
		let data = [];
		this.optionsLookup = {};
		this.optionsLabels.forEach(l => {
			let checked: boolean = this.getDeployOptionUtil(l);
			data.push([checked, l]);
			this.optionsLookup[l] = checked;
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
			case constants.IgnoreTableOptions:
				this.deploymentOptions.ignoreTableOptions = value;
				break;
			case constants.IgnoreSemicolonBetweenStatements:
				this.deploymentOptions.ignoreSemicolonBetweenStatements = value;
				break;
			case constants.IgnoreRouteLifetime:
				this.deploymentOptions.ignoreRouteLifetime = value;
				break;
			case constants.IgnoreRoleMembership:
				this.deploymentOptions.ignoreRoleMembership = value;
				break;
			case constants.IgnoreQuotedIdentifiers:
				this.deploymentOptions.ignoreQuotedIdentifiers = value;
				break;
			case constants.IgnorePermissions:
				this.deploymentOptions.ignorePermissions = value;
				break;
			case constants.IgnorePartitionSchemes:
				this.deploymentOptions.ignorePartitionSchemes = value;
				break;
			case constants.IgnoreObjectPlacementOnPartitionScheme:
				this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme = value;
				break;
			case constants.IgnoreNotForReplication:
				this.deploymentOptions.ignoreNotForReplication = value;
				break;
			case constants.IgnoreLoginSids:
				this.deploymentOptions.ignoreLoginSids = value;
				break;
			case constants.IgnoreLockHintsOnIndexes:
				this.deploymentOptions.ignoreLockHintsOnIndexes = value;
				break;
			case constants.IgnoreKeywordCasing:
				this.deploymentOptions.ignoreKeywordCasing = value;
				break;
			case constants.IgnoreIndexPadding:
				this.deploymentOptions.ignoreIndexPadding = value;
				break;
			case constants.IgnoreIndexOptions:
				this.deploymentOptions.ignoreIndexOptions = value;
				break;
			case constants.IgnoreIncrement:
				this.deploymentOptions.ignoreIncrement = value;
				break;
			case constants.IgnoreIdentitySeed:
				this.deploymentOptions.ignoreIdentitySeed = value;
				break;
			case constants.IgnoreUserSettingsObjects:
				this.deploymentOptions.ignoreUserSettingsObjects = value;
				break;
			case constants.IgnoreFullTextCatalogFilePath:
				this.deploymentOptions.ignoreFullTextCatalogFilePath = value;
				break;
			case constants.IgnoreWhitespace:
				this.deploymentOptions.ignoreWhitespace = value;
				break;
			case constants.IgnoreWithNocheckOnForeignKeys:
				this.deploymentOptions.ignoreWithNocheckOnForeignKeys = value;
				break;
			case constants.VerifyCollationCompatibility:
				this.deploymentOptions.verifyCollationCompatibility = value;
				break;
			case constants.UnmodifiableObjectWarnings:
				this.deploymentOptions.unmodifiableObjectWarnings = value;
				break;
			case constants.TreatVerificationErrorsAsWarnings:
				this.deploymentOptions.treatVerificationErrorsAsWarnings = value;
				break;
			case constants.ScriptRefreshModule:
				this.deploymentOptions.scriptRefreshModule = value;
				break;
			case constants.ScriptNewConstraintValidation:
				this.deploymentOptions.scriptNewConstraintValidation = value;
				break;
			case constants.ScriptFileSize:
				this.deploymentOptions.scriptFileSize = value;
				break;
			case constants.ScriptDeployStateChecks:
				this.deploymentOptions.scriptDeployStateChecks = value;
				break;
			case constants.ScriptDatabaseOptions:
				this.deploymentOptions.scriptDatabaseOptions = value;
				break;
			case constants.ScriptDatabaseCompatibility:
				this.deploymentOptions.scriptDatabaseCompatibility = value;
				break;
			case constants.ScriptDatabaseCollation:
				this.deploymentOptions.scriptDatabaseCollation = value;
				break;
			case constants.RunDeploymentPlanExecutors:
				this.deploymentOptions.runDeploymentPlanExecutors = value;
				break;
			case constants.RegisterDataTierApplication:
				this.deploymentOptions.registerDataTierApplication = value;
				break;
			case constants.PopulateFilesOnFileGroups:
				this.deploymentOptions.populateFilesOnFileGroups = value;
				break;
			case constants.NoAlterStatementsToChangeClrTypes:
				this.deploymentOptions.noAlterStatementsToChangeClrTypes = value;
				break;
			case constants.IncludeTransactionalScripts:
				this.deploymentOptions.includeTransactionalScripts = value;
				break;
			case constants.IncludeCompositeObjects:
				this.deploymentOptions.includeCompositeObjects = value;
				break;
			case constants.AllowUnsafeRowLevelSecurityDataMovement:
				this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement = value;
				break;
			case constants.IgnoreWithNocheckOnCheckConstraints:
				this.deploymentOptions.ignoreWithNocheckOnCheckConstraints = value;
				break;
			case constants.IgnoreFillFactor:
				this.deploymentOptions.ignoreFillFactor = value;
				break;
			case constants.IgnoreFileSize:
				this.deploymentOptions.ignoreFileSize = value;
				break;
			case constants.IgnoreFilegroupPlacement:
				this.deploymentOptions.ignoreFilegroupPlacement = value;
				break;
			case constants.DoNotAlterReplicatedObjects:
				this.deploymentOptions.doNotAlterReplicatedObjects = value;
				break;
			case constants.DoNotAlterChangeDataCaptureObjects:
				this.deploymentOptions.doNotAlterChangeDataCaptureObjects = value;
				break;
			case constants.DisableAndReenableDdlTriggers:
				this.deploymentOptions.disableAndReenableDdlTriggers = value;
				break;
			case constants.DeployDatabaseInSingleUserMode:
				this.deploymentOptions.deployDatabaseInSingleUserMode = value;
				break;
			case constants.CreateNewDatabase:
				this.deploymentOptions.createNewDatabase = value;
				break;
			case constants.CompareUsingTargetCollation:
				this.deploymentOptions.compareUsingTargetCollation = value;
				break;
			case constants.CommentOutSetVarDeclarations:
				this.deploymentOptions.commentOutSetVarDeclarations = value;
				break;
			case constants.BlockWhenDriftDetected:
				this.deploymentOptions.blockWhenDriftDetected = value;
				break;
			case constants.BlockOnPossibleDataLoss:
				this.deploymentOptions.blockOnPossibleDataLoss = value;
				break;
			case constants.BackupDatabaseBeforeChanges:
				this.deploymentOptions.backupDatabaseBeforeChanges = value;
				break;
			case constants.AllowIncompatiblePlatform:
				this.deploymentOptions.allowIncompatiblePlatform = value;
				break;
			case constants.AllowDropBlockingAssemblies:
				this.deploymentOptions.allowDropBlockingAssemblies = value;
				break;
			case constants.DropConstraintsNotInSource:
				this.deploymentOptions.dropConstraintsNotInSource = value;
				break;
			case constants.DropDmlTriggersNotInSource:
				this.deploymentOptions.dropDmlTriggersNotInSource = value;
				break;
			case constants.DropExtendedPropertiesNotInSource:
				this.deploymentOptions.dropExtendedPropertiesNotInSource = value;
				break;
			case constants.DropIndexesNotInSource:
				this.deploymentOptions.dropIndexesNotInSource = value;
				break;
			case constants.IgnoreFileAndLogFilePath:
				this.deploymentOptions.ignoreFileAndLogFilePath = value;
				break;
			case constants.IgnoreExtendedProperties:
				this.deploymentOptions.ignoreExtendedProperties = value;
				break;
			case constants.IgnoreDmlTriggerState:
				this.deploymentOptions.ignoreDmlTriggerState = value;
				break;
			case constants.IgnoreDmlTriggerOrder:
				this.deploymentOptions.ignoreDmlTriggerOrder = value;
				break;
			case constants.IgnoreDefaultSchema:
				this.deploymentOptions.ignoreDefaultSchema = value;
				break;
			case constants.IgnoreDdlTriggerState:
				this.deploymentOptions.ignoreDdlTriggerState = value;
				break;
			case constants.IgnoreDdlTriggerOrder:
				this.deploymentOptions.ignoreDdlTriggerOrder = value;
				break;
			case constants.IgnoreCryptographicProviderFilePath:
				this.deploymentOptions.ignoreCryptographicProviderFilePath = value;
				break;
			case constants.VerifyDeployment:
				this.deploymentOptions.verifyDeployment = value;
				break;
			case constants.IgnoreComments:
				this.deploymentOptions.ignoreComments = value;
				break;
			case constants.IgnoreColumnCollation:
				this.deploymentOptions.ignoreColumnCollation = value;
				break;
			case constants.IgnoreAuthorizer:
				this.deploymentOptions.ignoreAuthorizer = value;
				break;
			case constants.IgnoreAnsiNulls:
				this.deploymentOptions.ignoreAnsiNulls = value;
				break;
			case constants.GenerateSmartDefaults:
				this.deploymentOptions.generateSmartDefaults = value;
				break;
			case constants.DropStatisticsNotInSource:
				this.deploymentOptions.dropStatisticsNotInSource = value;
				break;
			case constants.DropRoleMembersNotInSource:
				this.deploymentOptions.dropRoleMembersNotInSource = value;
				break;
			case constants.DropPermissionsNotInSource:
				this.deploymentOptions.dropPermissionsNotInSource = value;
				break;
			case constants.DropObjectsNotInSource:
				this.deploymentOptions.dropObjectsNotInSource = value;
				break;
			case constants.IgnoreColumnOrder:
				this.deploymentOptions.ignoreColumnOrder = value;
				break;
		}
	}

	public getDeployOptionUtil(label): boolean {
		switch (label) {
			case constants.IgnoreTableOptions:
				return this.deploymentOptions.ignoreTableOptions;

			case constants.IgnoreSemicolonBetweenStatements:
				return this.deploymentOptions.ignoreSemicolonBetweenStatements;

			case constants.IgnoreRouteLifetime:
				return this.deploymentOptions.ignoreRouteLifetime;

			case constants.IgnoreRoleMembership:
				return this.deploymentOptions.ignoreRoleMembership;

			case constants.IgnoreQuotedIdentifiers:
				return this.deploymentOptions.ignoreQuotedIdentifiers;

			case constants.IgnorePermissions:
				return this.deploymentOptions.ignorePermissions;

			case constants.IgnorePartitionSchemes:
				return this.deploymentOptions.ignorePartitionSchemes;

			case constants.IgnoreObjectPlacementOnPartitionScheme:
				return this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme;

			case constants.IgnoreNotForReplication:
				return this.deploymentOptions.ignoreNotForReplication;

			case constants.IgnoreLoginSids:
				return this.deploymentOptions.ignoreLoginSids;

			case constants.IgnoreLockHintsOnIndexes:
				return this.deploymentOptions.ignoreLockHintsOnIndexes;

			case constants.IgnoreKeywordCasing:
				return this.deploymentOptions.ignoreKeywordCasing;

			case constants.IgnoreIndexPadding:
				return this.deploymentOptions.ignoreIndexPadding;

			case constants.IgnoreIndexOptions:
				return this.deploymentOptions.ignoreIndexOptions;

			case constants.IgnoreIncrement:
				return this.deploymentOptions.ignoreIncrement;

			case constants.IgnoreIdentitySeed:
				return this.deploymentOptions.ignoreIdentitySeed;

			case constants.IgnoreUserSettingsObjects:
				return this.deploymentOptions.ignoreUserSettingsObjects;

			case constants.IgnoreFullTextCatalogFilePath:
				return this.deploymentOptions.ignoreFullTextCatalogFilePath;

			case constants.IgnoreWhitespace:
				return this.deploymentOptions.ignoreWhitespace;

			case constants.IgnoreWithNocheckOnForeignKeys:
				return this.deploymentOptions.ignoreWithNocheckOnForeignKeys;

			case constants.VerifyCollationCompatibility:
				return this.deploymentOptions.verifyCollationCompatibility;

			case constants.UnmodifiableObjectWarnings:
				return this.deploymentOptions.unmodifiableObjectWarnings;

			case constants.TreatVerificationErrorsAsWarnings:
				return this.deploymentOptions.treatVerificationErrorsAsWarnings;

			case constants.ScriptRefreshModule:
				return this.deploymentOptions.scriptRefreshModule;

			case constants.ScriptNewConstraintValidation:
				return this.deploymentOptions.scriptNewConstraintValidation;

			case constants.ScriptFileSize:
				return this.deploymentOptions.scriptFileSize;

			case constants.ScriptDeployStateChecks:
				return this.deploymentOptions.scriptDeployStateChecks;

			case constants.ScriptDatabaseOptions:
				return this.deploymentOptions.scriptDatabaseOptions;

			case constants.ScriptDatabaseCompatibility:
				return this.deploymentOptions.scriptDatabaseCompatibility;

			case constants.ScriptDatabaseCollation:
				return this.deploymentOptions.scriptDatabaseCollation;

			case constants.RunDeploymentPlanExecutors:
				return this.deploymentOptions.runDeploymentPlanExecutors;

			case constants.RegisterDataTierApplication:
				return this.deploymentOptions.registerDataTierApplication;

			case constants.PopulateFilesOnFileGroups:
				return this.deploymentOptions.populateFilesOnFileGroups;

			case constants.NoAlterStatementsToChangeClrTypes:
				return this.deploymentOptions.noAlterStatementsToChangeClrTypes;

			case constants.IncludeTransactionalScripts:
				return this.deploymentOptions.includeTransactionalScripts;

			case constants.IncludeCompositeObjects:
				return this.deploymentOptions.includeCompositeObjects;

			case constants.AllowUnsafeRowLevelSecurityDataMovement:
				return this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement;

			case constants.IgnoreWithNocheckOnCheckConstraints:
				return this.deploymentOptions.ignoreWithNocheckOnCheckConstraints;

			case constants.IgnoreFillFactor:
				return this.deploymentOptions.ignoreFillFactor;

			case constants.IgnoreFileSize:
				return this.deploymentOptions.ignoreFileSize;

			case constants.IgnoreFilegroupPlacement:
				return this.deploymentOptions.ignoreFilegroupPlacement;

			case constants.DoNotAlterReplicatedObjects:
				return this.deploymentOptions.doNotAlterReplicatedObjects;

			case constants.DoNotAlterChangeDataCaptureObjects:
				return this.deploymentOptions.doNotAlterChangeDataCaptureObjects;

			case constants.DisableAndReenableDdlTriggers:
				return this.deploymentOptions.disableAndReenableDdlTriggers;

			case constants.DeployDatabaseInSingleUserMode:
				return this.deploymentOptions.deployDatabaseInSingleUserMode;

			case constants.CreateNewDatabase:
				return this.deploymentOptions.createNewDatabase;

			case constants.CompareUsingTargetCollation:
				return this.deploymentOptions.compareUsingTargetCollation;

			case constants.CommentOutSetVarDeclarations:
				return this.deploymentOptions.commentOutSetVarDeclarations;

			case constants.BlockWhenDriftDetected:
				return this.deploymentOptions.blockWhenDriftDetected;

			case constants.BlockOnPossibleDataLoss:
				return this.deploymentOptions.blockOnPossibleDataLoss;

			case constants.BackupDatabaseBeforeChanges:
				return this.deploymentOptions.backupDatabaseBeforeChanges;

			case constants.AllowIncompatiblePlatform:
				return this.deploymentOptions.allowIncompatiblePlatform;

			case constants.AllowDropBlockingAssemblies:
				return this.deploymentOptions.allowDropBlockingAssemblies;

			case constants.DropConstraintsNotInSource:
				return this.deploymentOptions.dropConstraintsNotInSource;

			case constants.DropDmlTriggersNotInSource:
				return this.deploymentOptions.dropDmlTriggersNotInSource;

			case constants.DropExtendedPropertiesNotInSource:
				return this.deploymentOptions.dropExtendedPropertiesNotInSource;

			case constants.DropIndexesNotInSource:
				return this.deploymentOptions.dropIndexesNotInSource;

			case constants.IgnoreFileAndLogFilePath:
				return this.deploymentOptions.ignoreFileAndLogFilePath;

			case constants.IgnoreExtendedProperties:
				return this.deploymentOptions.ignoreExtendedProperties;

			case constants.IgnoreDmlTriggerState:
				return this.deploymentOptions.ignoreDmlTriggerState;

			case constants.IgnoreDmlTriggerOrder:
				return this.deploymentOptions.ignoreDmlTriggerOrder;

			case constants.IgnoreDefaultSchema:
				return this.deploymentOptions.ignoreDefaultSchema;

			case constants.IgnoreDdlTriggerState:
				return this.deploymentOptions.ignoreDdlTriggerState;

			case constants.IgnoreDdlTriggerOrder:
				return this.deploymentOptions.ignoreDdlTriggerOrder;

			case constants.IgnoreCryptographicProviderFilePath:
				return this.deploymentOptions.ignoreCryptographicProviderFilePath;

			case constants.VerifyDeployment:
				return this.deploymentOptions.verifyDeployment;

			case constants.IgnoreComments:
				return this.deploymentOptions.ignoreComments;

			case constants.IgnoreColumnCollation:
				return this.deploymentOptions.ignoreColumnCollation;

			case constants.IgnoreAuthorizer:
				return this.deploymentOptions.ignoreAuthorizer;

			case constants.IgnoreAnsiNulls:
				return this.deploymentOptions.ignoreAnsiNulls;

			case constants.GenerateSmartDefaults:
				return this.deploymentOptions.generateSmartDefaults;

			case constants.DropStatisticsNotInSource:
				return this.deploymentOptions.dropStatisticsNotInSource;

			case constants.DropRoleMembersNotInSource:
				return this.deploymentOptions.dropRoleMembersNotInSource;

			case constants.DropPermissionsNotInSource:
				return this.deploymentOptions.dropPermissionsNotInSource;

			case constants.DropObjectsNotInSource:
				return this.deploymentOptions.dropObjectsNotInSource;

			case constants.IgnoreColumnOrder:
				return this.deploymentOptions.ignoreColumnOrder;
		}
		return false;
	}

	public getDescription(label: string): string {
		switch (label) {
			case constants.IgnoreTableOptions:
				return constants.descriptionIgnoreTableOptions;

			case constants.IgnoreSemicolonBetweenStatements:
				return constants.descriptionIgnoreSemicolonBetweenStatements;

			case constants.IgnoreRouteLifetime:
				return constants.descriptionIgnoreRouteLifetime;

			case constants.IgnoreRoleMembership:
				return constants.descriptionIgnoreRoleMembership;

			case constants.IgnoreQuotedIdentifiers:
				return constants.descriptionIgnoreQuotedIdentifiers;

			case constants.IgnorePermissions:
				return constants.descriptionIgnorePermissions;

			case constants.IgnorePartitionSchemes:
				return constants.descriptionIgnorePartitionSchemes;

			case constants.IgnoreObjectPlacementOnPartitionScheme:
				return constants.descriptionIgnoreObjectPlacementOnPartitionScheme;

			case constants.IgnoreNotForReplication:
				return constants.descriptionIgnoreNotForReplication;

			case constants.IgnoreLoginSids:
				return constants.descriptionIgnoreLoginSids;

			case constants.IgnoreLockHintsOnIndexes:
				return constants.descriptionIgnoreLockHintsOnIndexes;

			case constants.IgnoreKeywordCasing:
				return constants.descriptionIgnoreKeywordCasing;

			case constants.IgnoreIndexPadding:
				return constants.descriptionIgnoreIndexPadding;

			case constants.IgnoreIndexOptions:
				return constants.descriptionIgnoreIndexOptions;

			case constants.IgnoreIncrement:
				return constants.descriptionIgnoreIncrement;

			case constants.IgnoreIdentitySeed:
				return constants.descriptionIgnoreIdentitySeed;

			case constants.IgnoreUserSettingsObjects:
				return constants.descriptionIgnoreUserSettingsObjects;

			case constants.IgnoreFullTextCatalogFilePath:
				return constants.descriptionIgnoreFullTextCatalogFilePath;

			case constants.IgnoreWhitespace:
				return constants.descriptionIgnoreWhitespace;

			case constants.IgnoreWithNocheckOnForeignKeys:
				return constants.descriptionIgnoreWithNocheckOnForeignKeys;

			case constants.VerifyCollationCompatibility:
				return constants.descriptionVerifyCollationCompatibility;

			case constants.UnmodifiableObjectWarnings:
				return constants.descriptionUnmodifiableObjectWarnings;

			case constants.TreatVerificationErrorsAsWarnings:
				return constants.descriptionTreatVerificationErrorsAsWarnings;

			case constants.ScriptRefreshModule:
				return constants.descriptionScriptRefreshModule;

			case constants.ScriptNewConstraintValidation:
				return constants.descriptionScriptNewConstraintValidation;

			case constants.ScriptFileSize:
				return constants.descriptionScriptFileSize;

			case constants.ScriptDeployStateChecks:
				return constants.descriptionScriptDeployStateChecks;

			case constants.ScriptDatabaseOptions:
				return constants.descriptionScriptDatabaseOptions;

			case constants.ScriptDatabaseCompatibility:
				return constants.descriptionScriptDatabaseCompatibility;

			case constants.ScriptDatabaseCollation:
				return constants.descriptionScriptDatabaseCollation;

			case constants.RunDeploymentPlanExecutors:
				return constants.descriptionRunDeploymentPlanExecutors;

			case constants.RegisterDataTierApplication:
				return constants.descriptionRegisterDataTierApplication;

			case constants.PopulateFilesOnFileGroups:
				return constants.descriptionPopulateFilesOnFileGroups;

			case constants.NoAlterStatementsToChangeClrTypes:
				return constants.descriptionNoAlterStatementsToChangeClrTypes;

			case constants.IncludeTransactionalScripts:
				return constants.descriptionIncludeTransactionalScripts;

			case constants.IncludeCompositeObjects:
				return constants.descriptionIncludeCompositeObjects;

			case constants.AllowUnsafeRowLevelSecurityDataMovement:
				return constants.descriptionAllowUnsafeRowLevelSecurityDataMovement;

			case constants.IgnoreWithNocheckOnCheckConstraints:
				return constants.descriptionIgnoreWithNocheckOnCheckConstraints;

			case constants.IgnoreFillFactor:
				return constants.descriptionIgnoreFillFactor;

			case constants.IgnoreFileSize:
				return constants.descriptionIgnoreFileSize;

			case constants.IgnoreFilegroupPlacement:
				return constants.descriptionIgnoreFilegroupPlacement;

			case constants.DoNotAlterReplicatedObjects:
				return constants.descriptionDoNotAlterReplicatedObjects;

			case constants.DoNotAlterChangeDataCaptureObjects:
				return constants.descriptionDoNotAlterChangeDataCaptureObjects;

			case constants.DisableAndReenableDdlTriggers:
				return constants.descriptionDisableAndReenableDdlTriggers;

			case constants.DeployDatabaseInSingleUserMode:
				return constants.descriptionDeployDatabaseInSingleUserMode;

			case constants.CreateNewDatabase:
				return constants.descriptionCreateNewDatabase;

			case constants.CompareUsingTargetCollation:
				return constants.descriptionCompareUsingTargetCollation;

			case constants.CommentOutSetVarDeclarations:
				return constants.descriptionCommentOutSetVarDeclarations;

			case constants.BlockWhenDriftDetected:
				return constants.descriptionBlockWhenDriftDetected;

			case constants.BlockOnPossibleDataLoss:
				return constants.descriptionBlockOnPossibleDataLoss;

			case constants.BackupDatabaseBeforeChanges:
				return constants.descriptionBackupDatabaseBeforeChanges;

			case constants.AllowIncompatiblePlatform:
				return constants.descriptionAllowIncompatiblePlatform;

			case constants.AllowDropBlockingAssemblies:
				return constants.descriptionAllowDropBlockingAssemblies;

			case constants.DropConstraintsNotInSource:
				return constants.descriptionDropConstraintsNotInSource;

			case constants.DropDmlTriggersNotInSource:
				return constants.descriptionDropDmlTriggersNotInSource;

			case constants.DropExtendedPropertiesNotInSource:
				return constants.descriptionDropExtendedPropertiesNotInSource;

			case constants.DropIndexesNotInSource:
				return constants.descriptionDropIndexesNotInSource;

			case constants.IgnoreFileAndLogFilePath:
				return constants.descriptionIgnoreFileAndLogFilePath;

			case constants.IgnoreExtendedProperties:
				return constants.descriptionIgnoreExtendedProperties;

			case constants.IgnoreDmlTriggerState:
				return constants.descriptionIgnoreDmlTriggerState;

			case constants.IgnoreDmlTriggerOrder:
				return constants.descriptionIgnoreDmlTriggerOrder;

			case constants.IgnoreDefaultSchema:
				return constants.descriptionIgnoreDefaultSchema;

			case constants.IgnoreDdlTriggerState:
				return constants.descriptionIgnoreDdlTriggerState;

			case constants.IgnoreDdlTriggerOrder:
				return constants.descriptionIgnoreDdlTriggerOrder;

			case constants.IgnoreCryptographicProviderFilePath:
				return constants.descriptionIgnoreCryptographicProviderFilePath;

			case constants.VerifyDeployment:
				return constants.descriptionVerifyDeployment;

			case constants.IgnoreComments:
				return constants.descriptionIgnoreComments;

			case constants.IgnoreColumnCollation:
				return constants.descriptionIgnoreColumnCollation;

			case constants.IgnoreAuthorizer:
				return constants.descriptionIgnoreAuthorizer;

			case constants.IgnoreAnsiNulls:
				return constants.descriptionIgnoreAnsiNulls;

			case constants.GenerateSmartDefaults:
				return constants.descriptionGenerateSmartDefaults;

			case constants.DropStatisticsNotInSource:
				return constants.descriptionDropStatisticsNotInSource;

			case constants.DropRoleMembersNotInSource:
				return constants.descriptionDropRoleMembersNotInSource;

			case constants.DropPermissionsNotInSource:
				return constants.descriptionDropPermissionsNotInSource;

			case constants.DropObjectsNotInSource:
				return constants.descriptionDropObjectsNotInSource;

			case constants.IgnoreColumnOrder:
				return constants.descriptionIgnoreColumnOrder;
		}
	}
}
