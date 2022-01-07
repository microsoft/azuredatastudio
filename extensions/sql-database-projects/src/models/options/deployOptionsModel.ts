/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from '../../../../mssql/src/mssql';
import * as constants from '../../common/constants';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;

	public optionsLookup: Record<string, boolean> = {};
	public optionsMapTable: Record<string, mssql.DacDeployOptionsBoolean> = {};

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.InitializeMapTable();
	}

	/*
	* Initialize the options mapping table
	* This will map the key:Option_DisplayName to the value:DacFx_OptionsValue
	*/
	public InitializeMapTable() {
		this.optionsMapTable[constants.IgnoreTableOptions] = this.deploymentOptions.ignoreTableOptions;
		this.optionsMapTable[constants.IgnoreSemicolonBetweenStatements] = this.deploymentOptions.ignoreSemicolonBetweenStatements;
		this.optionsMapTable[constants.IgnoreRouteLifetime] = this.deploymentOptions.ignoreRouteLifetime;
		this.optionsMapTable[constants.IgnoreRoleMembership] = this.deploymentOptions.ignoreRoleMembership;
		this.optionsMapTable[constants.IgnoreQuotedIdentifiers] = this.deploymentOptions.ignoreQuotedIdentifiers;
		this.optionsMapTable[constants.IgnorePermissions] = this.deploymentOptions.ignorePermissions;
		this.optionsMapTable[constants.IgnorePartitionSchemes] = this.deploymentOptions.ignorePartitionSchemes;
		this.optionsMapTable[constants.IgnoreObjectPlacementOnPartitionScheme] = this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme;
		this.optionsMapTable[constants.IgnoreNotForReplication] = this.deploymentOptions.ignoreNotForReplication;
		this.optionsMapTable[constants.IgnoreLoginSids] = this.deploymentOptions.ignoreLoginSids;
		this.optionsMapTable[constants.IgnoreLockHintsOnIndexes] = this.deploymentOptions.ignoreLockHintsOnIndexes;
		this.optionsMapTable[constants.IgnoreKeywordCasing] = this.deploymentOptions.ignoreKeywordCasing;
		this.optionsMapTable[constants.IgnoreIndexPadding] = this.deploymentOptions.ignoreIndexPadding;
		this.optionsMapTable[constants.IgnoreIndexOptions] = this.deploymentOptions.ignoreIndexOptions;
		this.optionsMapTable[constants.IgnoreIncrement] = this.deploymentOptions.ignoreIncrement;
		this.optionsMapTable[constants.IgnoreIdentitySeed] = this.deploymentOptions.ignoreIdentitySeed;
		this.optionsMapTable[constants.IgnoreUserSettingsObjects] = this.deploymentOptions.ignoreUserSettingsObjects;
		this.optionsMapTable[constants.IgnoreFullTextCatalogFilePath] = this.deploymentOptions.ignoreFullTextCatalogFilePath;
		this.optionsMapTable[constants.IgnoreWhitespace] = this.deploymentOptions.ignoreWhitespace;
		this.optionsMapTable[constants.IgnoreWithNocheckOnForeignKeys] = this.deploymentOptions.ignoreWithNocheckOnForeignKeys;
		this.optionsMapTable[constants.VerifyCollationCompatibility] = this.deploymentOptions.verifyCollationCompatibility;
		this.optionsMapTable[constants.UnmodifiableObjectWarnings] = this.deploymentOptions.unmodifiableObjectWarnings;
		this.optionsMapTable[constants.TreatVerificationErrorsAsWarnings] = this.deploymentOptions.treatVerificationErrorsAsWarnings;
		this.optionsMapTable[constants.ScriptRefreshModule] = this.deploymentOptions.scriptRefreshModule;
		this.optionsMapTable[constants.ScriptNewConstraintValidation] = this.deploymentOptions.scriptNewConstraintValidation;
		this.optionsMapTable[constants.ScriptFileSize] = this.deploymentOptions.scriptFileSize;
		this.optionsMapTable[constants.ScriptDeployStateChecks] = this.deploymentOptions.scriptDeployStateChecks;
		this.optionsMapTable[constants.ScriptDatabaseOptions] = this.deploymentOptions.scriptDatabaseOptions;
		this.optionsMapTable[constants.ScriptDatabaseCompatibility] = this.deploymentOptions.scriptDatabaseCompatibility;
		this.optionsMapTable[constants.ScriptDatabaseCollation] = this.deploymentOptions.scriptDatabaseCollation;
		this.optionsMapTable[constants.RunDeploymentPlanExecutors] = this.deploymentOptions.runDeploymentPlanExecutors;
		this.optionsMapTable[constants.RegisterDataTierApplication] = this.deploymentOptions.registerDataTierApplication;
		this.optionsMapTable[constants.PopulateFilesOnFileGroups] = this.deploymentOptions.populateFilesOnFileGroups;
		this.optionsMapTable[constants.NoAlterStatementsToChangeClrTypes] = this.deploymentOptions.noAlterStatementsToChangeClrTypes;
		this.optionsMapTable[constants.IncludeTransactionalScripts] = this.deploymentOptions.includeTransactionalScripts;
		this.optionsMapTable[constants.IncludeCompositeObjects] = this.deploymentOptions.includeCompositeObjects;
		this.optionsMapTable[constants.AllowUnsafeRowLevelSecurityDataMovement] = this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement;
		this.optionsMapTable[constants.IgnoreWithNocheckOnCheckConstraints] = this.deploymentOptions.ignoreWithNocheckOnCheckConstraints;
		this.optionsMapTable[constants.IgnoreFillFactor] = this.deploymentOptions.ignoreFillFactor;
		this.optionsMapTable[constants.IgnoreFileSize] = this.deploymentOptions.ignoreFileSize;
		this.optionsMapTable[constants.IgnoreFilegroupPlacement] = this.deploymentOptions.ignoreFilegroupPlacement;
		this.optionsMapTable[constants.DoNotAlterReplicatedObjects] = this.deploymentOptions.doNotAlterReplicatedObjects;
		this.optionsMapTable[constants.DoNotAlterChangeDataCaptureObjects] = this.deploymentOptions.doNotAlterChangeDataCaptureObjects;
		this.optionsMapTable[constants.DisableAndReenableDdlTriggers] = this.deploymentOptions.disableAndReenableDdlTriggers;
		this.optionsMapTable[constants.DeployDatabaseInSingleUserMode] = this.deploymentOptions.deployDatabaseInSingleUserMode;
		this.optionsMapTable[constants.CreateNewDatabase] = this.deploymentOptions.createNewDatabase;
		this.optionsMapTable[constants.CompareUsingTargetCollation] = this.deploymentOptions.compareUsingTargetCollation;
		this.optionsMapTable[constants.CommentOutSetVarDeclarations] = this.deploymentOptions.commentOutSetVarDeclarations;
		this.optionsMapTable[constants.BlockWhenDriftDetected] = this.deploymentOptions.blockWhenDriftDetected;
		this.optionsMapTable[constants.BlockOnPossibleDataLoss] = this.deploymentOptions.blockOnPossibleDataLoss;
		this.optionsMapTable[constants.BackupDatabaseBeforeChanges] = this.deploymentOptions.backupDatabaseBeforeChanges;
		this.optionsMapTable[constants.AllowIncompatiblePlatform] = this.deploymentOptions.allowIncompatiblePlatform;
		this.optionsMapTable[constants.AllowDropBlockingAssemblies] = this.deploymentOptions.allowDropBlockingAssemblies;
		this.optionsMapTable[constants.DropConstraintsNotInSource] = this.deploymentOptions.dropConstraintsNotInSource;
		this.optionsMapTable[constants.DropDmlTriggersNotInSource] = this.deploymentOptions.dropDmlTriggersNotInSource;
		this.optionsMapTable[constants.DropExtendedPropertiesNotInSource] = this.deploymentOptions.dropExtendedPropertiesNotInSource;
		this.optionsMapTable[constants.DropIndexesNotInSource] = this.deploymentOptions.dropIndexesNotInSource;
		this.optionsMapTable[constants.IgnoreFileAndLogFilePath] = this.deploymentOptions.ignoreFileAndLogFilePath;
		this.optionsMapTable[constants.IgnoreExtendedProperties] = this.deploymentOptions.ignoreExtendedProperties;
		this.optionsMapTable[constants.IgnoreDmlTriggerState] = this.deploymentOptions.ignoreDmlTriggerState;
		this.optionsMapTable[constants.IgnoreDmlTriggerOrder] = this.deploymentOptions.ignoreDmlTriggerOrder;
		this.optionsMapTable[constants.IgnoreDefaultSchema] = this.deploymentOptions.ignoreDefaultSchema;
		this.optionsMapTable[constants.IgnoreDdlTriggerState] = this.deploymentOptions.ignoreDdlTriggerState;
		this.optionsMapTable[constants.IgnoreDdlTriggerOrder] = this.deploymentOptions.ignoreDdlTriggerOrder;
		this.optionsMapTable[constants.IgnoreCryptographicProviderFilePath] = this.deploymentOptions.ignoreCryptographicProviderFilePath;
		this.optionsMapTable[constants.VerifyDeployment] = this.deploymentOptions.verifyDeployment;
		this.optionsMapTable[constants.IgnoreComments] = this.deploymentOptions.ignoreComments;
		this.optionsMapTable[constants.IgnoreColumnCollation] = this.deploymentOptions.ignoreColumnCollation;
		this.optionsMapTable[constants.IgnoreAuthorizer] = this.deploymentOptions.ignoreAuthorizer;
		this.optionsMapTable[constants.IgnoreAnsiNulls] = this.deploymentOptions.ignoreAnsiNulls;
		this.optionsMapTable[constants.GenerateSmartDefaults] = this.deploymentOptions.generateSmartDefaults;
		this.optionsMapTable[constants.DropStatisticsNotInSource] = this.deploymentOptions.dropStatisticsNotInSource;
		this.optionsMapTable[constants.DropRoleMembersNotInSource] = this.deploymentOptions.dropRoleMembersNotInSource;
		this.optionsMapTable[constants.DropPermissionsNotInSource] = this.deploymentOptions.dropPermissionsNotInSource;
		this.optionsMapTable[constants.DropObjectsNotInSource] = this.deploymentOptions.dropObjectsNotInSource;
		this.optionsMapTable[constants.IgnoreColumnOrder] = this.deploymentOptions.ignoreColumnOrder;
		this.optionsMapTable[constants.IgnoreTablePartitionOptions] = this.deploymentOptions.ignoreTablePartitionOptions;
		this.optionsMapTable[constants.DoNotEvaluateSqlCmdVariables] = this.deploymentOptions.doNotEvaluateSqlCmdVariables;
		this.optionsMapTable[constants.DisableParallelismForEnablingIndexes] = this.deploymentOptions.disableParallelismForEnablingIndexes;
		this.optionsMapTable[constants.DisableIndexesForDataPhase] = this.deploymentOptions.disableIndexesForDataPhase;
		this.optionsMapTable[constants.RestoreSequenceCurrentValue] = this.deploymentOptions.restoreSequenceCurrentValue;
		this.optionsMapTable[constants.RebuildIndexesOfflineForDataPhase] = this.deploymentOptions.rebuildIndexesOfflineForDataPhase;
		this.optionsMapTable[constants.PreserveIdentityLastValues] = this.deploymentOptions.preserveIdentityLastValues;
		this.optionsMapTable[constants.IsAlwaysEncryptedParameterizationEnabled] = this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled;
		this.optionsMapTable[constants.AllowExternalLibraryPaths] = this.deploymentOptions.allowExternalLibraryPaths;
		this.optionsMapTable[constants.AllowExternalLanguagePaths] = this.deploymentOptions.allowExternalLanguagePaths;
		this.optionsMapTable[constants.HashObjectNamesInLogs] = this.deploymentOptions.hashObjectNamesInLogs;
		this.optionsMapTable[constants.DoNotDropWorkloadClassifiers] = this.deploymentOptions.doNotDropWorkloadClassifiers;
		this.optionsMapTable[constants.IgnoreWorkloadClassifiers] = this.deploymentOptions.ignoreWorkloadClassifiers;
		this.optionsMapTable[constants.IgnoreDatabaseWorkloadGroups] = this.deploymentOptions.ignoreDatabaseWorkloadGroups;
		this.optionsMapTable[constants.DoNotDropDatabaseWorkloadGroups] = this.deploymentOptions.doNotDropDatabaseWorkloadGroups;
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
		constants.IgnoreTablePartitionOptions,
		constants.DoNotEvaluateSqlCmdVariables,
		constants.DisableParallelismForEnablingIndexes,
		constants.DisableIndexesForDataPhase,
		constants.RestoreSequenceCurrentValue,
		constants.RebuildIndexesOfflineForDataPhase,
		constants.PreserveIdentityLastValues,
		constants.IsAlwaysEncryptedParameterizationEnabled,
		constants.AllowExternalLibraryPaths,
		constants.AllowExternalLanguagePaths,
		constants.HashObjectNamesInLogs,
		constants.DoNotDropWorkloadClassifiers,
		constants.IgnoreWorkloadClassifiers,
		constants.IgnoreDatabaseWorkloadGroups,
		constants.DoNotDropDatabaseWorkloadGroups,
	].sort();

	public getOptionsData(): string[][] {
		let data: any = [];
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
			this.setDeployOptionUtil(option, this.optionsLookup[option]);
		}
	}

	/*
	* Sets the selected/changed value of the option
	*/
	public setDeployOptionUtil(label: string, value: boolean) {
		this.optionsMapTable[label].value = value;
	}

	/*
	* Gets the selected/default value of the option
	*/
	public getDeployOptionUtil(label: string): boolean {
		return this.optionsMapTable[label]?.value;
	}

	/*
	* Gets the description of the option selected
	*/
	public getDescription(label: string): string {
		return this.optionsMapTable[label]?.description;
	}
}
