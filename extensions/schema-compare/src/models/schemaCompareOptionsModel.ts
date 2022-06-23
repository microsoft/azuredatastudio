/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from '../localizedConstants';
import * as mssql from 'mssql';
import { isNullOrUndefined } from 'util';

export class SchemaCompareOptionsModel {
	public deploymentOptions: mssql.DeploymentOptions;
	public excludedObjectTypes: number[] = [];
	public optionsMapTable: Map<string, mssql.DacDeployOptionPropertyBoolean>;
	public includeObjectTypeLabels: string[] = [];

	public optionsLookup = {};
	public includeObjectsLookup: Map<string, boolean> = new Map<string, boolean>();

	constructor(defaultOptions: mssql.DeploymentOptions) {
		this.deploymentOptions = defaultOptions;
		this.InitializeUpdateOptionsMapTable();
		this.InitializeOptionsLabels();
		this.includeObjectTypeLabels = Array.from(this.deploymentOptions.includeObjects.keys()).sort();
	}
	//#region Schema Compare Deployment Options
	/*
	* Initialize the options mapping table
	* This will map the key:Option_DisplayName to the value:DacFx_OptionsValue
	*/
	public InitializeUpdateOptionsMapTable() {
		this.optionsMapTable = new Map<string, mssql.DacDeployOptionPropertyBoolean>();
		this.optionsMapTable.set(this.deploymentOptions?.ignoreTableOptions.displayName, this.deploymentOptions.ignoreTableOptions);
		this.optionsMapTable.set(this.deploymentOptions.ignoreSemicolonBetweenStatements.displayName, this.deploymentOptions.ignoreSemicolonBetweenStatements);
		this.optionsMapTable.set(this.deploymentOptions.ignoreRouteLifetime.displayName, this.deploymentOptions.ignoreRouteLifetime);
		this.optionsMapTable.set(this.deploymentOptions.ignoreRoleMembership.displayName, this.deploymentOptions.ignoreRoleMembership);
		this.optionsMapTable.set(this.deploymentOptions.ignoreQuotedIdentifiers.displayName, this.deploymentOptions.ignoreQuotedIdentifiers);
		this.optionsMapTable.set(this.deploymentOptions.ignorePermissions.displayName, this.deploymentOptions.ignorePermissions);
		this.optionsMapTable.set(this.deploymentOptions.ignorePartitionSchemes.displayName, this.deploymentOptions.ignorePartitionSchemes);
		this.optionsMapTable.set(this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme.displayName, this.deploymentOptions.ignoreObjectPlacementOnPartitionScheme);
		this.optionsMapTable.set(this.deploymentOptions.ignoreNotForReplication.displayName, this.deploymentOptions.ignoreNotForReplication);
		this.optionsMapTable.set(this.deploymentOptions.ignoreLoginSids.displayName, this.deploymentOptions.ignoreLoginSids);
		this.optionsMapTable.set(this.deploymentOptions.ignoreLockHintsOnIndexes.displayName, this.deploymentOptions.ignoreLockHintsOnIndexes);
		this.optionsMapTable.set(this.deploymentOptions.ignoreKeywordCasing.displayName, this.deploymentOptions.ignoreKeywordCasing);
		this.optionsMapTable.set(this.deploymentOptions.ignoreIndexPadding.displayName, this.deploymentOptions.ignoreIndexPadding);
		this.optionsMapTable.set(this.deploymentOptions.ignoreIndexOptions.displayName, this.deploymentOptions.ignoreIndexOptions);
		this.optionsMapTable.set(this.deploymentOptions.ignoreIncrement.displayName, this.deploymentOptions.ignoreIncrement);
		this.optionsMapTable.set(this.deploymentOptions.ignoreIdentitySeed.displayName, this.deploymentOptions.ignoreIdentitySeed);
		this.optionsMapTable.set(this.deploymentOptions.ignoreUserSettingsObjects.displayName, this.deploymentOptions.ignoreUserSettingsObjects);
		this.optionsMapTable.set(this.deploymentOptions.ignoreFullTextCatalogFilePath.displayName, this.deploymentOptions.ignoreFullTextCatalogFilePath);
		this.optionsMapTable.set(this.deploymentOptions.ignoreWhitespace.displayName, this.deploymentOptions.ignoreWhitespace);
		this.optionsMapTable.set(this.deploymentOptions.ignoreWithNocheckOnForeignKeys.displayName, this.deploymentOptions.ignoreWithNocheckOnForeignKeys);
		this.optionsMapTable.set(this.deploymentOptions.verifyCollationCompatibility.displayName, this.deploymentOptions.verifyCollationCompatibility);
		this.optionsMapTable.set(this.deploymentOptions.unmodifiableObjectWarnings.displayName, this.deploymentOptions.unmodifiableObjectWarnings);
		this.optionsMapTable.set(this.deploymentOptions.treatVerificationErrorsAsWarnings.displayName, this.deploymentOptions.treatVerificationErrorsAsWarnings);
		this.optionsMapTable.set(this.deploymentOptions.scriptRefreshModule.displayName, this.deploymentOptions.scriptRefreshModule);
		this.optionsMapTable.set(this.deploymentOptions.scriptNewConstraintValidation.displayName, this.deploymentOptions.scriptNewConstraintValidation);
		this.optionsMapTable.set(this.deploymentOptions.scriptFileSize.displayName, this.deploymentOptions.scriptFileSize);
		this.optionsMapTable.set(this.deploymentOptions.scriptDeployStateChecks.displayName, this.deploymentOptions.scriptDeployStateChecks);
		this.optionsMapTable.set(this.deploymentOptions.scriptDatabaseOptions.displayName, this.deploymentOptions.scriptDatabaseOptions);
		this.optionsMapTable.set(this.deploymentOptions.scriptDatabaseCompatibility.displayName, this.deploymentOptions.scriptDatabaseCompatibility);
		this.optionsMapTable.set(this.deploymentOptions.scriptDatabaseCollation.displayName, this.deploymentOptions.scriptDatabaseCollation);
		this.optionsMapTable.set(this.deploymentOptions.runDeploymentPlanExecutors.displayName, this.deploymentOptions.runDeploymentPlanExecutors);
		this.optionsMapTable.set(this.deploymentOptions.registerDataTierApplication.displayName, this.deploymentOptions.registerDataTierApplication);
		this.optionsMapTable.set(this.deploymentOptions.populateFilesOnFileGroups.displayName, this.deploymentOptions.populateFilesOnFileGroups);
		this.optionsMapTable.set(this.deploymentOptions.noAlterStatementsToChangeClrTypes.displayName, this.deploymentOptions.noAlterStatementsToChangeClrTypes);
		this.optionsMapTable.set(this.deploymentOptions.includeTransactionalScripts.displayName, this.deploymentOptions.includeTransactionalScripts);
		this.optionsMapTable.set(this.deploymentOptions.includeCompositeObjects.displayName, this.deploymentOptions.includeCompositeObjects);
		this.optionsMapTable.set(this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement.displayName, this.deploymentOptions.allowUnsafeRowLevelSecurityDataMovement);
		this.optionsMapTable.set(this.deploymentOptions.ignoreWithNocheckOnCheckConstraints.displayName, this.deploymentOptions.ignoreWithNocheckOnCheckConstraints);
		this.optionsMapTable.set(this.deploymentOptions.ignoreFillFactor.displayName, this.deploymentOptions.ignoreFillFactor);
		this.optionsMapTable.set(this.deploymentOptions.ignoreFileSize.displayName, this.deploymentOptions.ignoreFileSize);
		this.optionsMapTable.set(this.deploymentOptions.ignoreFilegroupPlacement.displayName, this.deploymentOptions.ignoreFilegroupPlacement);
		this.optionsMapTable.set(this.deploymentOptions.doNotAlterReplicatedObjects.displayName, this.deploymentOptions.doNotAlterReplicatedObjects);
		this.optionsMapTable.set(this.deploymentOptions.doNotAlterChangeDataCaptureObjects.displayName, this.deploymentOptions.doNotAlterChangeDataCaptureObjects);
		this.optionsMapTable.set(this.deploymentOptions.disableAndReenableDdlTriggers.displayName, this.deploymentOptions.disableAndReenableDdlTriggers);
		this.optionsMapTable.set(this.deploymentOptions.deployDatabaseInSingleUserMode.displayName, this.deploymentOptions.deployDatabaseInSingleUserMode);
		this.optionsMapTable.set(this.deploymentOptions.createNewDatabase.displayName, this.deploymentOptions.createNewDatabase);
		this.optionsMapTable.set(this.deploymentOptions.compareUsingTargetCollation.displayName, this.deploymentOptions.compareUsingTargetCollation);
		this.optionsMapTable.set(this.deploymentOptions.commentOutSetVarDeclarations.displayName, this.deploymentOptions.commentOutSetVarDeclarations);
		this.optionsMapTable.set(this.deploymentOptions.blockWhenDriftDetected.displayName, this.deploymentOptions.blockWhenDriftDetected);
		this.optionsMapTable.set(this.deploymentOptions.blockOnPossibleDataLoss.displayName, this.deploymentOptions.blockOnPossibleDataLoss);
		this.optionsMapTable.set(this.deploymentOptions.backupDatabaseBeforeChanges.displayName, this.deploymentOptions.backupDatabaseBeforeChanges);
		this.optionsMapTable.set(this.deploymentOptions.allowIncompatiblePlatform.displayName, this.deploymentOptions.allowIncompatiblePlatform);
		this.optionsMapTable.set(this.deploymentOptions.allowDropBlockingAssemblies.displayName, this.deploymentOptions.allowDropBlockingAssemblies);
		this.optionsMapTable.set(this.deploymentOptions.dropConstraintsNotInSource.displayName, this.deploymentOptions.dropConstraintsNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.dropDmlTriggersNotInSource.displayName, this.deploymentOptions.dropDmlTriggersNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.dropExtendedPropertiesNotInSource.displayName, this.deploymentOptions.dropExtendedPropertiesNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.dropIndexesNotInSource.displayName, this.deploymentOptions.dropIndexesNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.ignoreFileAndLogFilePath.displayName, this.deploymentOptions.ignoreFileAndLogFilePath);
		this.optionsMapTable.set(this.deploymentOptions.ignoreExtendedProperties.displayName, this.deploymentOptions.ignoreExtendedProperties);
		this.optionsMapTable.set(this.deploymentOptions.ignoreDmlTriggerState.displayName, this.deploymentOptions.ignoreDmlTriggerState);
		this.optionsMapTable.set(this.deploymentOptions.ignoreDmlTriggerOrder.displayName, this.deploymentOptions.ignoreDmlTriggerOrder);
		this.optionsMapTable.set(this.deploymentOptions.ignoreDefaultSchema.displayName, this.deploymentOptions.ignoreDefaultSchema);
		this.optionsMapTable.set(this.deploymentOptions.ignoreDdlTriggerState.displayName, this.deploymentOptions.ignoreDdlTriggerState);
		this.optionsMapTable.set(this.deploymentOptions.ignoreDdlTriggerOrder.displayName, this.deploymentOptions.ignoreDdlTriggerOrder);
		this.optionsMapTable.set(this.deploymentOptions.ignoreCryptographicProviderFilePath.displayName, this.deploymentOptions.ignoreCryptographicProviderFilePath);
		this.optionsMapTable.set(this.deploymentOptions.verifyDeployment.displayName, this.deploymentOptions.verifyDeployment);
		this.optionsMapTable.set(this.deploymentOptions.ignoreComments.displayName, this.deploymentOptions.ignoreComments);
		this.optionsMapTable.set(this.deploymentOptions.ignoreColumnCollation.displayName, this.deploymentOptions.ignoreColumnCollation);
		this.optionsMapTable.set(this.deploymentOptions.ignoreAuthorizer.displayName, this.deploymentOptions.ignoreAuthorizer);
		this.optionsMapTable.set(this.deploymentOptions.ignoreAnsiNulls.displayName, this.deploymentOptions.ignoreAnsiNulls);
		this.optionsMapTable.set(this.deploymentOptions.generateSmartDefaults.displayName, this.deploymentOptions.generateSmartDefaults);
		this.optionsMapTable.set(this.deploymentOptions.dropStatisticsNotInSource.displayName, this.deploymentOptions.dropStatisticsNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.dropRoleMembersNotInSource.displayName, this.deploymentOptions.dropRoleMembersNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.dropPermissionsNotInSource.displayName, this.deploymentOptions.dropPermissionsNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.dropObjectsNotInSource.displayName, this.deploymentOptions.dropObjectsNotInSource);
		this.optionsMapTable.set(this.deploymentOptions.ignoreColumnOrder.displayName, this.deploymentOptions.ignoreColumnOrder);
		this.optionsMapTable.set(this.deploymentOptions.ignoreTablePartitionOptions.displayName, this.deploymentOptions.ignoreTablePartitionOptions);
		this.optionsMapTable.set(this.deploymentOptions.doNotEvaluateSqlCmdVariables.displayName, this.deploymentOptions.doNotEvaluateSqlCmdVariables);
		this.optionsMapTable.set(this.deploymentOptions.disableParallelismForEnablingIndexes.displayName, this.deploymentOptions.disableParallelismForEnablingIndexes);
		this.optionsMapTable.set(this.deploymentOptions.disableIndexesForDataPhase.displayName, this.deploymentOptions.disableIndexesForDataPhase);
		this.optionsMapTable.set(this.deploymentOptions.restoreSequenceCurrentValue.displayName, this.deploymentOptions.restoreSequenceCurrentValue);
		this.optionsMapTable.set(this.deploymentOptions.rebuildIndexesOfflineForDataPhase.displayName, this.deploymentOptions.rebuildIndexesOfflineForDataPhase);
		this.optionsMapTable.set(this.deploymentOptions.preserveIdentityLastValues.displayName, this.deploymentOptions.preserveIdentityLastValues);
		this.optionsMapTable.set(this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled.displayName, this.deploymentOptions.isAlwaysEncryptedParameterizationEnabled);
		this.optionsMapTable.set(this.deploymentOptions.allowExternalLibraryPaths.displayName, this.deploymentOptions.allowExternalLibraryPaths);
		this.optionsMapTable.set(this.deploymentOptions.allowExternalLanguagePaths.displayName, this.deploymentOptions.allowExternalLanguagePaths);
		this.optionsMapTable.set(this.deploymentOptions.hashObjectNamesInLogs.displayName, this.deploymentOptions.hashObjectNamesInLogs);
		this.optionsMapTable.set(this.deploymentOptions.doNotDropWorkloadClassifiers.displayName, this.deploymentOptions.doNotDropWorkloadClassifiers);
		this.optionsMapTable.set(this.deploymentOptions.ignoreWorkloadClassifiers.displayName, this.deploymentOptions.ignoreWorkloadClassifiers);
		this.optionsMapTable.set(this.deploymentOptions.ignoreDatabaseWorkloadGroups.displayName, this.deploymentOptions.ignoreDatabaseWorkloadGroups);
		this.optionsMapTable.set(this.deploymentOptions.doNotDropDatabaseWorkloadGroups.displayName, this.deploymentOptions.doNotDropDatabaseWorkloadGroups);
	}

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
		let data: any = [];
		this.includeObjectsLookup = new Map<string, boolean>();
		this.includeObjectTypeLabels.forEach(l => {
			let checked: boolean | undefined = this.getSchemaCompareIncludedObjectsUtil(l);
			if (checked !== undefined) {
				data.push([checked, l]);
				this.includeObjectsLookup?.set(l, checked);
			}
		});
		return data;
	}

	public setDeploymentOptions() {
		for (let option in this.optionsLookup) {
			this.setSchemaCompareOptionUtil(option, this.optionsLookup[option]);
		}
	}

	public setSchemaCompareOptionUtil(label: string, value: boolean) {
		let optionProp = this.optionsMapTable.get(label);
		optionProp.value = value;
		return this.optionsMapTable.set(label, optionProp);
	}

	public getSchemaCompareOptionUtil(label): boolean {
		return this.optionsMapTable.get(label)?.value;
	}

	public getDescription(label: string): string {
		return this.optionsMapTable.get(label)?.description;
	}

	public getSchemaCompareIncludedObjectsUtil(label: string): boolean {
		return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === this.deploymentOptions.includeObjects.get(label))) !== undefined ? false : true;
	}

	public setSchemaCompareIncludedObjectsUtil() {
		for (let option of this.includeObjectsLookup) {
			let optionNum = this.deploymentOptions.includeObjects?.get(option[0]);
			if (optionNum !== undefined && !option[1]) {
				this.excludedObjectTypes.push(optionNum);
			}
		}
		this.deploymentOptions.excludeObjectTypes.value = this.excludedObjectTypes;
	}
}
