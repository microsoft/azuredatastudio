/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';

export class DeployOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;

	public optionsLookup: Record<string, boolean> = {};
	public optionsMapTable: Record<string, mssql.DacDeployOptionPropertyBoolean> = {};

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.InitializeUpdateOptionsMapTable();
		this.InitializeOptionsLabels();
	}

	/*
	* Initialize the options mapping table
	* This will map the key:Option_DisplayName to the value:DacFx_OptionsValue
	*/
	public InitializeUpdateOptionsMapTable() {
		this.optionsMapTable[this.deploymentOptions.ignoreTableOptions.displayName] = this.deploymentOptions.ignoreTableOptions;
		this.optionsMapTable[this.deploymentOptions.ignoreSemicolonBetweenStatements.displayName] = this.deploymentOptions.ignoreSemicolonBetweenStatements;
		this.optionsMapTable[this.deploymentOptions.ignoreRouteLifetime.displayName] = this.deploymentOptions.ignoreRouteLifetime;
		this.optionsMapTable[this.deploymentOptions.ignoreRoleMembership.displayName] = this.deploymentOptions.ignoreRoleMembership;
		this.optionsMapTable[this.deploymentOptions.ignoreQuotedIdentifiers.displayName] = this.deploymentOptions.ignoreQuotedIdentifiers;
		this.optionsMapTable[this.deploymentOptions.ignorePermissions.displayName] = this.deploymentOptions.ignorePermissions;
		this.optionsMapTable[this.deploymentOptions.ignorePartitionSchemes.displayName] = this.deploymentOptions.ignorePartitionSchemes;
		this.optionsMapTable[this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme.displayName] = this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme;
		this.optionsMapTable[this.deploymentOptions.ignoreNotForReplication.displayName] = this.deploymentOptions.ignoreNotForReplication;
		this.optionsMapTable[this.deploymentOptions.ignoreLoginSids.displayName] = this.deploymentOptions.ignoreLoginSids;
		this.optionsMapTable[this.deploymentOptions.ignoreLockHintsOnIndexes.displayName] = this.deploymentOptions.ignoreLockHintsOnIndexes;
		this.optionsMapTable[this.deploymentOptions.ignoreKeywordCasing.displayName] = this.deploymentOptions.ignoreKeywordCasing;
		this.optionsMapTable[this.deploymentOptions.ignoreIndexPadding.displayName] = this.deploymentOptions.ignoreIndexPadding;
		this.optionsMapTable[this.deploymentOptions.ignoreIndexOptions.displayName] = this.deploymentOptions.ignoreIndexOptions;
		this.optionsMapTable[this.deploymentOptions.ignoreIncrement.displayName] = this.deploymentOptions.ignoreIncrement;
		this.optionsMapTable[this.deploymentOptions.ignoreIdentitySeed.displayName] = this.deploymentOptions.ignoreIdentitySeed;
		this.optionsMapTable[this.deploymentOptions.ignoreUserSettingsObjects.displayName] = this.deploymentOptions.ignoreUserSettingsObjects;
		this.optionsMapTable[this.deploymentOptions.ignoreFullTextCatalogFilePath.displayName] = this.deploymentOptions.ignoreFullTextCatalogFilePath;
		this.optionsMapTable[this.deploymentOptions.ignoreWhitespace.displayName] = this.deploymentOptions.ignoreWhitespace;
		this.optionsMapTable[this.deploymentOptions.ignoreWithNocheckOnForeignKeys.displayName] = this.deploymentOptions.ignoreWithNocheckOnForeignKeys;
		this.optionsMapTable[this.deploymentOptions.verifyCollationCompatibility.displayName] = this.deploymentOptions.verifyCollationCompatibility;
		this.optionsMapTable[this.deploymentOptions.unmodifiableObjectWarnings.displayName] = this.deploymentOptions.unmodifiableObjectWarnings;
		this.optionsMapTable[this.deploymentOptions.treatVerificationErrorsAsWarnings.displayName] = this.deploymentOptions.treatVerificationErrorsAsWarnings;
		this.optionsMapTable[this.deploymentOptions.scriptRefreshModule.displayName] = this.deploymentOptions.scriptRefreshModule;
		this.optionsMapTable[this.deploymentOptions.scriptNewConstraintValidation.displayName] = this.deploymentOptions.scriptNewConstraintValidation;
		this.optionsMapTable[this.deploymentOptions.scriptFileSize.displayName] = this.deploymentOptions.scriptFileSize;
		this.optionsMapTable[this.deploymentOptions.scriptDeployStateChecks.displayName] = this.deploymentOptions.scriptDeployStateChecks;
		this.optionsMapTable[this.deploymentOptions.scriptDatabaseOptions.displayName] = this.deploymentOptions.scriptDatabaseOptions;
		this.optionsMapTable[this.deploymentOptions.scriptDatabaseCompatibility.displayName] = this.deploymentOptions.scriptDatabaseCompatibility;
		this.optionsMapTable[this.deploymentOptions.scriptDatabaseCollation.displayName] = this.deploymentOptions.scriptDatabaseCollation;
		this.optionsMapTable[this.deploymentOptions.runDeploymentPlanExecutors.displayName] = this.deploymentOptions.runDeploymentPlanExecutors;
		this.optionsMapTable[this.deploymentOptions.registerDataTierApplication.displayName] = this.deploymentOptions.registerDataTierApplication;
		this.optionsMapTable[this.deploymentOptions.populateFilesOnFileGroups.displayName] = this.deploymentOptions.populateFilesOnFileGroups;
		this.optionsMapTable[this.deploymentOptions.noAlterStatementsToChangeClrTypes.displayName] = this.deploymentOptions.noAlterStatementsToChangeClrTypes;
		this.optionsMapTable[this.deploymentOptions.includeTransactionalScripts.displayName] = this.deploymentOptions.includeTransactionalScripts;
		this.optionsMapTable[this.deploymentOptions.includeCompositeObjects.displayName] = this.deploymentOptions.includeCompositeObjects;
		this.optionsMapTable[this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement.displayName] = this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement;
		this.optionsMapTable[this.deploymentOptions.ignoreWithNocheckOnCheckConstraints.displayName] = this.deploymentOptions.ignoreWithNocheckOnCheckConstraints;
		this.optionsMapTable[this.deploymentOptions.ignoreFillFactor.displayName] = this.deploymentOptions.ignoreFillFactor;
		this.optionsMapTable[this.deploymentOptions.ignoreFileSize.displayName] = this.deploymentOptions.ignoreFileSize;
		this.optionsMapTable[this.deploymentOptions.ignoreFilegroupPlacement.displayName] = this.deploymentOptions.ignoreFilegroupPlacement;
		this.optionsMapTable[this.deploymentOptions.doNotAlterReplicatedObjects.displayName] = this.deploymentOptions.doNotAlterReplicatedObjects;
		this.optionsMapTable[this.deploymentOptions.doNotAlterChangeDataCaptureObjects.displayName] = this.deploymentOptions.doNotAlterChangeDataCaptureObjects;
		this.optionsMapTable[this.deploymentOptions.disableAndReenableDdlTriggers.displayName] = this.deploymentOptions.disableAndReenableDdlTriggers;
		this.optionsMapTable[this.deploymentOptions.deployDatabaseInSingleUserMode.displayName] = this.deploymentOptions.deployDatabaseInSingleUserMode;
		this.optionsMapTable[this.deploymentOptions.createNewDatabase.displayName] = this.deploymentOptions.createNewDatabase;
		this.optionsMapTable[this.deploymentOptions.compareUsingTargetCollation.displayName] = this.deploymentOptions.compareUsingTargetCollation;
		this.optionsMapTable[this.deploymentOptions.commentOutSetVarDeclarations.displayName] = this.deploymentOptions.commentOutSetVarDeclarations;
		this.optionsMapTable[this.deploymentOptions.blockWhenDriftDetected.displayName] = this.deploymentOptions.blockWhenDriftDetected;
		this.optionsMapTable[this.deploymentOptions.blockOnPossibleDataLoss.displayName] = this.deploymentOptions.blockOnPossibleDataLoss;
		this.optionsMapTable[this.deploymentOptions.backupDatabaseBeforeChanges.displayName] = this.deploymentOptions.backupDatabaseBeforeChanges;
		this.optionsMapTable[this.deploymentOptions.allowIncompatiblePlatform.displayName] = this.deploymentOptions.allowIncompatiblePlatform;
		this.optionsMapTable[this.deploymentOptions.allowDropBlockingAssemblies.displayName] = this.deploymentOptions.allowDropBlockingAssemblies;
		this.optionsMapTable[this.deploymentOptions.dropConstraintsNotInSource.displayName] = this.deploymentOptions.dropConstraintsNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropDmlTriggersNotInSource.displayName] = this.deploymentOptions.dropDmlTriggersNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropExtendedPropertiesNotInSource.displayName] = this.deploymentOptions.dropExtendedPropertiesNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropIndexesNotInSource.displayName] = this.deploymentOptions.dropIndexesNotInSource;
		this.optionsMapTable[this.deploymentOptions.ignoreFileAndLogFilePath.displayName] = this.deploymentOptions.ignoreFileAndLogFilePath;
		this.optionsMapTable[this.deploymentOptions.ignoreExtendedProperties.displayName] = this.deploymentOptions.ignoreExtendedProperties;
		this.optionsMapTable[this.deploymentOptions.ignoreDmlTriggerState.displayName] = this.deploymentOptions.ignoreDmlTriggerState;
		this.optionsMapTable[this.deploymentOptions.ignoreDmlTriggerOrder.displayName] = this.deploymentOptions.ignoreDmlTriggerOrder;
		this.optionsMapTable[this.deploymentOptions.ignoreDefaultSchema.displayName] = this.deploymentOptions.ignoreDefaultSchema;
		this.optionsMapTable[this.deploymentOptions.ignoreDdlTriggerState.displayName] = this.deploymentOptions.ignoreDdlTriggerState;
		this.optionsMapTable[this.deploymentOptions.ignoreDdlTriggerOrder.displayName] = this.deploymentOptions.ignoreDdlTriggerOrder;
		this.optionsMapTable[this.deploymentOptions.ignoreCryptographicProviderFilePath.displayName] = this.deploymentOptions.ignoreCryptographicProviderFilePath;
		this.optionsMapTable[this.deploymentOptions.verifyDeployment.displayName] = this.deploymentOptions.verifyDeployment;
		this.optionsMapTable[this.deploymentOptions.ignoreComments.displayName] = this.deploymentOptions.ignoreComments;
		this.optionsMapTable[this.deploymentOptions.ignoreColumnCollation.displayName] = this.deploymentOptions.ignoreColumnCollation;
		this.optionsMapTable[this.deploymentOptions.ignoreAuthorizer.displayName] = this.deploymentOptions.ignoreAuthorizer;
		this.optionsMapTable[this.deploymentOptions.ignoreAnsiNulls.displayName] = this.deploymentOptions.ignoreAnsiNulls;
		this.optionsMapTable[this.deploymentOptions.generateSmartDefaults.displayName] = this.deploymentOptions.generateSmartDefaults;
		this.optionsMapTable[this.deploymentOptions.dropStatisticsNotInSource.displayName] = this.deploymentOptions.dropStatisticsNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropRoleMembersNotInSource.displayName] = this.deploymentOptions.dropRoleMembersNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropPermissionsNotInSource.displayName] = this.deploymentOptions.dropPermissionsNotInSource;
		this.optionsMapTable[this.deploymentOptions.dropObjectsNotInSource.displayName] = this.deploymentOptions.dropObjectsNotInSource;
		this.optionsMapTable[this.deploymentOptions.ignoreColumnOrder.displayName] = this.deploymentOptions.ignoreColumnOrder;
		this.optionsMapTable[this.deploymentOptions.ignoreTablePartitionOptions.displayName] = this.deploymentOptions.ignoreTablePartitionOptions;
		this.optionsMapTable[this.deploymentOptions.doNotEvaluateSqlCmdVariables.displayName] = this.deploymentOptions.doNotEvaluateSqlCmdVariables;
		this.optionsMapTable[this.deploymentOptions.disableParallelismForEnablingIndexes.displayName] = this.deploymentOptions.disableParallelismForEnablingIndexes;
		this.optionsMapTable[this.deploymentOptions.disableIndexesForDataPhase.displayName] = this.deploymentOptions.disableIndexesForDataPhase;
		this.optionsMapTable[this.deploymentOptions.restoreSequenceCurrentValue.displayName] = this.deploymentOptions.restoreSequenceCurrentValue;
		this.optionsMapTable[this.deploymentOptions.rebuildIndexesOfflineForDataPhase.displayName] = this.deploymentOptions.rebuildIndexesOfflineForDataPhase;
		this.optionsMapTable[this.deploymentOptions.preserveIdentityLastValues.displayName] = this.deploymentOptions.preserveIdentityLastValues;
		this.optionsMapTable[this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled.displayName] = this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled;
		this.optionsMapTable[this.deploymentOptions.allowExternalLibraryPaths.displayName] = this.deploymentOptions.allowExternalLibraryPaths;
		this.optionsMapTable[this.deploymentOptions.allowExternalLanguagePaths.displayName] = this.deploymentOptions.allowExternalLanguagePaths;
		this.optionsMapTable[this.deploymentOptions.hashObjectNamesInLogs.displayName] = this.deploymentOptions.hashObjectNamesInLogs;
		this.optionsMapTable[this.deploymentOptions.doNotDropWorkloadClassifiers.displayName] = this.deploymentOptions.doNotDropWorkloadClassifiers;
		this.optionsMapTable[this.deploymentOptions.ignoreWorkloadClassifiers.displayName] = this.deploymentOptions.ignoreWorkloadClassifiers;
		this.optionsMapTable[this.deploymentOptions.ignoreDatabaseWorkloadGroups.displayName] = this.deploymentOptions.ignoreDatabaseWorkloadGroups;
		this.optionsMapTable[this.deploymentOptions.doNotDropDatabaseWorkloadGroups.displayName] = this.deploymentOptions.doNotDropDatabaseWorkloadGroups;
	}

	/*
	* List of Dac Deploy options to display
	*/
	public optionsLabels: string[] = [];
	public InitializeOptionsLabels() {
		this.optionsLabels = [this.deploymentOptions.ignoreTableOptions.displayName
			, this.deploymentOptions.ignoreSemicolonBetweenStatements.displayName
			, this.deploymentOptions.ignoreRouteLifetime.displayName
			, this.deploymentOptions.ignoreRoleMembership.displayName
			, this.deploymentOptions.ignoreQuotedIdentifiers.displayName
			, this.deploymentOptions.ignorePermissions.displayName
			, this.deploymentOptions.ignorePartitionSchemes.displayName
			, this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme.displayName
			, this.deploymentOptions.ignoreNotForReplication.displayName
			, this.deploymentOptions.ignoreLoginSids.displayName
			, this.deploymentOptions.ignoreLockHintsOnIndexes.displayName
			, this.deploymentOptions.ignoreKeywordCasing.displayName
			, this.deploymentOptions.ignoreIndexPadding.displayName
			, this.deploymentOptions.ignoreIndexOptions.displayName
			, this.deploymentOptions.ignoreIncrement.displayName
			, this.deploymentOptions.ignoreIdentitySeed.displayName
			, this.deploymentOptions.ignoreUserSettingsObjects.displayName
			, this.deploymentOptions.ignoreFullTextCatalogFilePath.displayName
			, this.deploymentOptions.ignoreWhitespace.displayName
			, this.deploymentOptions.ignoreWithNocheckOnForeignKeys.displayName
			, this.deploymentOptions.verifyCollationCompatibility.displayName
			, this.deploymentOptions.unmodifiableObjectWarnings.displayName
			, this.deploymentOptions.treatVerificationErrorsAsWarnings.displayName
			, this.deploymentOptions.scriptRefreshModule.displayName
			, this.deploymentOptions.scriptNewConstraintValidation.displayName
			, this.deploymentOptions.scriptFileSize.displayName
			, this.deploymentOptions.scriptDeployStateChecks.displayName
			, this.deploymentOptions.scriptDatabaseOptions.displayName
			, this.deploymentOptions.scriptDatabaseCompatibility.displayName
			, this.deploymentOptions.scriptDatabaseCollation.displayName
			, this.deploymentOptions.runDeploymentPlanExecutors.displayName
			, this.deploymentOptions.registerDataTierApplication.displayName
			, this.deploymentOptions.populateFilesOnFileGroups.displayName
			, this.deploymentOptions.noAlterStatementsToChangeClrTypes.displayName
			, this.deploymentOptions.includeTransactionalScripts.displayName
			, this.deploymentOptions.includeCompositeObjects.displayName
			, this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement.displayName
			, this.deploymentOptions.ignoreWithNocheckOnCheckConstraints.displayName
			, this.deploymentOptions.ignoreFillFactor.displayName
			, this.deploymentOptions.ignoreFileSize.displayName
			, this.deploymentOptions.ignoreFilegroupPlacement.displayName
			, this.deploymentOptions.doNotAlterReplicatedObjects.displayName
			, this.deploymentOptions.doNotAlterChangeDataCaptureObjects.displayName
			, this.deploymentOptions.disableAndReenableDdlTriggers.displayName
			, this.deploymentOptions.deployDatabaseInSingleUserMode.displayName
			, this.deploymentOptions.createNewDatabase.displayName
			, this.deploymentOptions.compareUsingTargetCollation.displayName
			, this.deploymentOptions.commentOutSetVarDeclarations.displayName
			, this.deploymentOptions.blockWhenDriftDetected.displayName
			, this.deploymentOptions.blockOnPossibleDataLoss.displayName
			, this.deploymentOptions.backupDatabaseBeforeChanges.displayName
			, this.deploymentOptions.allowIncompatiblePlatform.displayName
			, this.deploymentOptions.allowDropBlockingAssemblies.displayName
			, this.deploymentOptions.dropConstraintsNotInSource.displayName
			, this.deploymentOptions.dropDmlTriggersNotInSource.displayName
			, this.deploymentOptions.dropExtendedPropertiesNotInSource.displayName
			, this.deploymentOptions.dropIndexesNotInSource.displayName
			, this.deploymentOptions.ignoreFileAndLogFilePath.displayName
			, this.deploymentOptions.ignoreExtendedProperties.displayName
			, this.deploymentOptions.ignoreDmlTriggerState.displayName
			, this.deploymentOptions.ignoreDmlTriggerOrder.displayName
			, this.deploymentOptions.ignoreDefaultSchema.displayName
			, this.deploymentOptions.ignoreDdlTriggerState.displayName
			, this.deploymentOptions.ignoreDdlTriggerOrder.displayName
			, this.deploymentOptions.ignoreCryptographicProviderFilePath.displayName
			, this.deploymentOptions.verifyDeployment.displayName
			, this.deploymentOptions.ignoreComments.displayName
			, this.deploymentOptions.ignoreColumnCollation.displayName
			, this.deploymentOptions.ignoreAuthorizer.displayName
			, this.deploymentOptions.ignoreAnsiNulls.displayName
			, this.deploymentOptions.generateSmartDefaults.displayName
			, this.deploymentOptions.dropStatisticsNotInSource.displayName
			, this.deploymentOptions.dropRoleMembersNotInSource.displayName
			, this.deploymentOptions.dropPermissionsNotInSource.displayName
			, this.deploymentOptions.dropObjectsNotInSource.displayName
			, this.deploymentOptions.ignoreColumnOrder.displayName
			, this.deploymentOptions.ignoreTablePartitionOptions.displayName
			, this.deploymentOptions.doNotEvaluateSqlCmdVariables.displayName
			, this.deploymentOptions.disableParallelismForEnablingIndexes.displayName
			, this.deploymentOptions.disableIndexesForDataPhase.displayName
			, this.deploymentOptions.restoreSequenceCurrentValue.displayName
			, this.deploymentOptions.rebuildIndexesOfflineForDataPhase.displayName
			, this.deploymentOptions.preserveIdentityLastValues.displayName
			, this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled.displayName
			, this.deploymentOptions.allowExternalLibraryPaths.displayName
			, this.deploymentOptions.allowExternalLanguagePaths.displayName
			, this.deploymentOptions.hashObjectNamesInLogs.displayName
			, this.deploymentOptions.doNotDropWorkloadClassifiers.displayName
			, this.deploymentOptions.ignoreWorkloadClassifiers.displayName
			, this.deploymentOptions.ignoreDatabaseWorkloadGroups.displayName
			, this.deploymentOptions.doNotDropDatabaseWorkloadGroups.displayName].sort();
	}

	/**
	 * Gets the options checkbox check value
	 * @returns string[][]
	 */
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
